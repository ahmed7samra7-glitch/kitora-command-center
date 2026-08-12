# KCC Production Storage

KCC uses `local` storage only for development and tests. Production must use a durable driver.

## Current production target

`STORAGE_DRIVER=supabase`

Required variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The durable runtime state is stored in `public.kcc_runtime_state`. Migration:

`supabase/migrations/001_kcc_runtime_state.sql`

The migration installs an atomic replacement function guarded by a PostgreSQL advisory transaction lock and a monotonically increasing version. A stale writer receives a serialization-style conflict instead of silently overwriting a newer state.

## Important compatibility constraint

The existing `dbRuntime.get/set/update` call sites are synchronous. The first launch-hardening step therefore introduces the production adapter and atomic persistence primitive without pretending that every existing caller has already been converted to async database operations.

Production launch remains **NO-GO** until the runtime state access layer is migrated behind this adapter (or an equivalent synchronous-safe process boundary) and cold-start/restart persistence tests pass against a real Supabase project.

## Rollback

Rollback the application to the last known-good revision. Do not delete the `kcc_runtime_state` table during an application rollback. The schema is backward-compatible with older application revisions because it is isolated under a dedicated table.
