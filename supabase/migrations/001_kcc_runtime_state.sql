create table if not exists public.kcc_runtime_state (
  singleton_id text primary key,
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.kcc_replace_runtime_state(
  p_singleton_id text,
  p_expected_version bigint,
  p_state jsonb
)
returns table(version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version bigint;
begin
  perform pg_advisory_xact_lock(hashtext('kcc_runtime_state:' || p_singleton_id));

  insert into public.kcc_runtime_state(singleton_id, state, version, updated_at)
  values (p_singleton_id, p_state, 1, now())
  on conflict (singleton_id) do nothing;

  update public.kcc_runtime_state
     set state = p_state,
         version = version + 1,
         updated_at = now()
   where singleton_id = p_singleton_id
     and version = p_expected_version
  returning public.kcc_runtime_state.version into v_next_version;

  if v_next_version is null then
    raise exception 'KCC storage version conflict for %', p_singleton_id
      using errcode = '40001';
  end if;

  return query select v_next_version;
end;
$$;

revoke all on function public.kcc_replace_runtime_state(text, bigint, jsonb) from public;
