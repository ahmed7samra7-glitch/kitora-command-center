# KCC Cloudflare runtime

The repository contains a standalone Cloudflare Workers entrypoint in `worker.ts`. This path does not treat the existing Node/Express process, local JSON filesystem store, or timer-based daemons as durable Workers infrastructure.

## Runtime architecture

- **HTTP:** Cloudflare Worker fetch handler.
- **Persistent state:** Cloudflare D1 binding `KCC_DB`.
- **Asynchronous execution:** Cloudflare Queue `kitora-command-center-tasks`.
- **Queue consumer:** the same Worker exposes a `queue()` handler.
- **Task state:** D1 records QUEUED/RUNNING/COMPLETED/FAILED state, retry attempts, errors, and results.
- **Brain:** native Worker execution through configured Gemini, OpenAI, or Claude APIs, with decisions persisted in `kcc_brain_decisions`.
- **Scheduling:** Cron Triggers enqueue autonomous Brain missions every 15 minutes, hourly, every 6 hours, and daily (UTC).
- **Evidence:** client-authored commerce evidence is rejected. KCC_ALIVE remains fail-closed.

The queue consumer currently executes only explicitly implemented safe runtime task types such as `KCC_HEALTH_CHECK` and `KCC_ALIVE_STATUS_CHECK`. Unsupported business/provider task types fail closed rather than pretending they were executed. Provider-backed business adapters still need to be wired to the Worker runtime before those operations can be treated as production-capable.

## Brain execution

- Brain execution requires a real configured provider; deterministic success is never synthesized.
- Gemini is the default provider for the zero-cost staging path. Provider usage remains subject to the provider's current quota and pricing rules.
- High-sensitivity or costed actions are persisted with an owner-approval requirement.
- Brain output is reasoning/planning evidence only. It is not proof of payment, fulfillment, shipment, delivery, or notification.

## Cloudflare setup

1. Create the D1 database named `kitora-command-center`. The current repository config is already bound to the real database ID.
2. Create the Queue named `kitora-command-center-tasks`.
3. Apply the checked-in D1 migration:
   `npx wrangler d1 migrations apply kitora-command-center --remote`
4. Add the runtime secret `KCC_WORKER_SECRET` in Cloudflare Secrets.
5. Add real provider secrets only when a provider is intentionally enabled and its production action is authorized.
6. Deploy with the Cloudflare Git integration or `npx wrangler deploy`.

Cloudflare Queues is included on the Workers Free plan with a daily operations allowance; keep KCC usage inside the free limits. The queue consumer is deliberately configured with bounded concurrency and retries.

## Verification boundaries

- `/api/live` only proves the Worker responds.
- `/api/kcc/health` returns fail-closed until D1 has provider-verified `REAL_FULFILLMENT_EVIDENCE` and `REAL_NOTIFICATION_EVIDENCE`.
- `POST /api/kcc/evidence` is always rejected from clients.
- No PayPal Live transaction, production CJ fulfillment, or WhatsApp production action is authorized by this runtime path.

This migration path is intentionally incremental: it makes the Cloudflare runtime durable and event-driven without falsely claiming that the full Node business runtime has already been ported.
