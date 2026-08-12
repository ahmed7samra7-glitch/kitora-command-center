# KITORA COMMAND CENTER (KCC) - Production Deployment Guide

## Current production architecture
- Runtime: Node.js 22
- HTTP binding: `0.0.0.0`
- Default port: `3000`
- Entry point: `node dist/server.cjs`
- Execution mode: **batch / scale-to-zero by default**
- `ENABLE_CONTINUOUS_LOOP=false` is the required production default.
- Production storage: **Supabase**; local `data/db.json` is development/test only.
- Durable task queue: Supabase `kcc_task_queue` with atomic Postgres task claims.

## Production health contract
`GET /api/kcc/health` and `GET /api/health` must report the HTTP/API service as healthy in batch mode without requiring background daemons to be running. The payload exposes the execution mode (`BATCH` or `CONTINUOUS`) and storage status.

## Required production configuration
Configure these through the platform's secret store; never commit values:

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV=production` | Yes | Production mode |
| `STORAGE_DRIVER=supabase` | Yes | Durable production storage |
| `SUPABASE_URL` | Yes | Supabase REST endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase access; never expose to clients |
| `ENABLE_CONTINUOUS_LOOP=false` | Yes | Prevent permanent process loops |
| `KCC_EXECUTION_SECRET` | Yes | Protect batch execution endpoints |
| `KCC_CHATGPT_SECRET` | Yes | ChatGPT command bridge |
| `JWT_SECRET` | Yes | Owner/session security |
| `GEMINI_API_KEY` | Yes for Gemini operations | Gemini provider |
| `PAYPAL_CLIENT_ID` | Yes for live PayPal | PayPal checkout |
| `PAYPAL_CLIENT_SECRET` | Yes for live PayPal | PayPal checkout |
| `PAYPAL_MODE=live` | Yes for live payments | PayPal environment |
| `PAYPAL_WEBHOOK_ID` | Yes for live webhooks | PayPal webhook signature verification |
| `CJ_DROPSHIPPING_EMAIL` | Yes for CJ operations | CJ integration |
| `CJ_DROPSHIPPING_API_KEY` | Yes for CJ operations | CJ integration |
| `WHATSAPP_TOKEN` | Required if WhatsApp is enabled | WhatsApp Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | Required if WhatsApp is enabled | WhatsApp Cloud API |
| `GITHUB_TOKEN` | Required only for GitHub automation | Repository automation |

## Database migration
Before production, apply both SQL migrations in `supabase/migrations/` in order:

1. `001_kcc_runtime_state.sql`
2. `002_kcc_task_queue.sql`

Do not point production at `data/db.json`.

## Cloud Run scaling policy
The intended production service configuration is:

```text
min instances = 0
max instances = 3
memory = 1Gi
cpu = 1
execution mode = batch
```

Cloud Run defaults to service-level minimum instances of zero, and supports explicit minimum/maximum instance limits. citeturn187622search0turn187622search1

## Batch execution endpoints
Both endpoints require the `x-kcc-execution-secret` header:

```text
POST /api/kcc/loop/tick
POST /api/kcc/agent/process-queue
```

Each request performs a bounded unit of work and terminates.

## CI/CD authentication
GitHub Actions uses OIDC / Workload Identity Federation. No long-lived Google service-account JSON key should be stored in GitHub.

Required GitHub repository variables:

```text
WIF_PROVIDER
WIF_SERVICE_ACCOUNT
```

The workflow must prove these are configured before attempting deployment.

## Post-deployment verification

1. GET `/api/kcc/health` and verify HTTP 200.
2. Confirm `executionMode=BATCH`.
3. Confirm database/storage status is healthy.
4. Confirm `ENABLE_CONTINUOUS_LOOP=false`.
5. Trigger one bounded queue batch using the protected endpoint.
6. Confirm duplicate task/webhook protection from the application logs/ledger.

## Rollback

Rollback is revision/commit based:

1. Keep the last verified production commit/revision.
2. Deploy the previous known-good revision if the new revision fails health or smoke verification.
3. Do not roll back by restoring `data/db.json` as a production database.
4. Preserve the durable Supabase task/event records during application rollback.

## Cost control

KCC does **not** claim a guaranteed zero-dollar bill. The design goal is to minimize usage and prevent unintended always-on compute:

- scale-to-zero (`min=0`)
- bounded `max=3`
- no permanent runtime loops by default
- bounded task batches
- external triggers instead of always-on polling

Billing alerts/limits must be configured at the cloud-account level separately.

## Current launch blocker

Cloud Run deployment is **not yet verified** in the current Google Cloud project because the project currently requires a billing account and the WIF/IAM path has not been proven end-to-end. Do not declare production GO until that external dependency is resolved.
