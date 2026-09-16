# KITORA COMMAND CENTER (KCC) — Staging Deployment

## Deployment boundary

KCC is currently deployable only as a zero-cost staging/demo service. It is
not approved for production commerce. Do not enable billing, deploy through
Google Cloud Run, use PayPal Live, or add production CJ/WhatsApp credentials.

`render.yaml` is the current repository staging manifest; there is no
Cloudflare Worker or Pages configuration in this repository yet. It specifies
Render's free tier and is intended only for a non-commercial staging
environment. Free instances can spin down and their local filesystem is not
durable, so a successful deployment is not proof of production readiness or
commerce activity.

## Runtime contract

- Runtime: Node.js 22 container
- Host binding: `0.0.0.0`
- Port: `process.env.PORT` (defaults to `3000`)
- Build: `npm run build`
- Start: `npm start`
- Liveness: `GET /api/live`
- Readiness/evidence: `GET /api/kcc/health` (also available at `/api/health`)

`/api/live` only confirms that the HTTP process is running. It never confirms
provider configuration, payment, fulfillment, delivery, or `KCC_ALIVE`.

`/api/kcc/health` exposes the evidence-based readiness state. Missing or stale
provider-backed CJ fulfillment evidence or signed WhatsApp delivery evidence
must keep `productionReadiness.kccAlive` false.

## Staging deployment

1. Create a Render service from this repository and apply `render.yaml`.
2. Keep the service on the free tier and use it only for staging/demo work.
3. Set only the non-production secrets needed for the scenario. Do not add
   PayPal Live, CJ production, or WhatsApp production credentials.
4. Verify the process and then inspect the evidence state:

```bash
curl -sSf https://YOUR-STAGING-URL/api/live
curl -s https://YOUR-STAGING-URL/api/kcc/health
```

The expected state without the required independent real-world evidence is
`KCC_ALIVE = false`. A healthy staging process must not be presented as a
production deployment or a completed commerce lifecycle.

## Local verification

```bash
npm ci
npm run lint
npm test
npm run build
```

Run these checks before opening a pull request. Passing them verifies the
implementation controls only; it does not authorize production deployment or
prove external fulfillment/notification events.
