# KCC Cloudflare runtime

This repository now contains a standalone Cloudflare Workers entrypoint in `worker.ts`. It does not pretend that the existing Node/Express process, synchronous filesystem JSON store, or timer-based daemons are durable on Workers.

The Workers path uses a Cloudflare D1 binding named `KCC_DB`. The schema in `migrations/0001_kcc_runtime.sql` provides durable runtime state, a queue boundary, and a provider-evidence ledger. The queue only records `QUEUED` work; it does not manufacture completion or provider evidence. Long-running execution must be connected later to an explicitly authorized event-driven worker/queue consumer.

## Free-tier setup

1. Create a D1 database in the Cloudflare dashboard or with Wrangler.
2. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with the real database ID.
3. Apply the migration with `npx wrangler d1 migrations apply kitora-command-center --remote`.
4. Store the worker secret with `npx wrangler secret put KCC_WORKER_SECRET`.
5. Configure a real AI provider secret only if that provider is intentionally enabled.
6. Deploy with `npx wrangler deploy`.

The `/api/live` endpoint only proves that the Worker responds. `/api/kcc/health` remains unsuccessful until the D1 ledger contains both provider-verified `REAL_FULFILLMENT_EVIDENCE` and provider-verified `REAL_NOTIFICATION_EVIDENCE`. The public evidence endpoint is deliberately blocked; evidence must be written by a verified provider adapter.

This is a staging/runtime migration path. It does not authorize PayPal Live, production CJ fulfillment, WhatsApp production actions, or automatic merging to `main`.
