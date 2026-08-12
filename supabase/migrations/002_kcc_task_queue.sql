create table if not exists public.kcc_task_queue (
  id text primary key,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('QUEUED','RUNNING','COMPLETED','FAILED','RETRYING')),
  attempts integer not null default 0,
  max_retries integer not null default 3,
  provider_used text,
  result jsonb,
  last_error text,
  lease_owner text,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kcc_task_queue_status_idx
  on public.kcc_task_queue(status, created_at);

create or replace function public.kcc_enqueue_task(
  p_id text,
  p_type text,
  p_payload jsonb,
  p_max_retries integer
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.kcc_task_queue(id, type, payload, status, attempts, max_retries)
  values (p_id, p_type, coalesce(p_payload, '{}'::jsonb), 'QUEUED', 0, greatest(1, coalesce(p_max_retries, 3)))
  on conflict (id) do nothing;
$$;

create or replace function public.kcc_claim_task_batch(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
returns setof public.kcc_task_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
      from public.kcc_task_queue
     where (status = 'QUEUED' or (status = 'RUNNING' and lease_until < now()))
     order by created_at
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 3), 10))
  )
  update public.kcc_task_queue q
     set status = 'RUNNING',
         attempts = q.attempts + 1,
         lease_owner = p_worker_id,
         lease_until = now() + make_interval(secs => greatest(5, least(coalesce(p_lease_seconds, 300), 900))),
         updated_at = now()
    from candidates c
   where q.id = c.id
  returning q.*;
end;
$$;

create or replace function public.kcc_complete_task(
  p_id text,
  p_worker_id text,
  p_result jsonb,
  p_provider_used text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.kcc_task_queue
     set status = 'COMPLETED',
         result = coalesce(p_result, '{}'::jsonb),
         provider_used = p_provider_used,
         lease_owner = null,
         lease_until = null,
         updated_at = now()
   where id = p_id
     and status = 'RUNNING'
     and lease_owner = p_worker_id;
  select found;
$$;

create or replace function public.kcc_fail_task(
  p_id text,
  p_worker_id text,
  p_error text,
  p_retry boolean
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.kcc_task_queue
     set status = case when p_retry then 'QUEUED' else 'FAILED' end,
         last_error = left(coalesce(p_error, 'Execution failed'), 2000),
         lease_owner = null,
         lease_until = null,
         updated_at = now()
   where id = p_id
     and status = 'RUNNING'
     and lease_owner = p_worker_id;
  select found;
$$;

revoke all on function public.kcc_enqueue_task(text, text, jsonb, integer) from public;
revoke all on function public.kcc_claim_task_batch(text, integer, integer) from public;
revoke all on function public.kcc_complete_task(text, text, jsonb, text) from public;
revoke all on function public.kcc_fail_task(text, text, text, boolean) from public;
