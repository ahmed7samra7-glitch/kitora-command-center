# KITORA COMMAND CENTER (KCC) - Cloud Run Production Deployment Guide

## System Specifications
- **Runtime**: Node.js 22 (Alpine Container)
- **Host Binding**: `0.0.0.0`
- **Default Port**: `3000` (respects `process.env.PORT`)
- **Production Entry Point**: `node dist/server.cjs`
- **Process Liveness Endpoint**: `GET /api/live`
- **Readiness and KCC ALIVE Endpoint**: `GET /api/kcc/health` or `GET /api/health`

## Health Endpoint Contract
`GET /api/live` is the process-liveness check. It returns HTTP 200 with `{ "status": "LIVE" }` when the HTTP process is operational and does not inspect provider credentials or KCC evidence.

`GET /api/kcc/health` is the readiness and KCC ALIVE status endpoint. It reports KCC evidence state separately; missing fulfillment or WhatsApp evidence must keep `productionReadiness.kccAlive` false.

A `GET /api/kcc/health` request returns:
```json
{
  "success": true,
  "status": "HEALTHY",
  "serverStatus": "UP",
  "uptimeSeconds": 120,
  "timestamp": "2026-08-11T12:00:00.000Z",
  "version": "1.0.0-production",
  "subsystems": {
    "server": { "status": "UP", "port": 3000, "host": "0.0.0.0" },
    "database": { "status": "CONNECTED" },
    "autonomousAgentRuntime": { "status": "RUNNING" }
  }
}
```

## Environment Variables
Configure the following environment variables in Google Cloud Secret Manager or Cloud Run Environment Settings:

| Variable Name | Description | Required |
|---|---|---|
| `PORT` | Container HTTP port (injected by Cloud Run) | Auto |
| `NODE_ENV` | Production execution mode (`production`) | Yes |
| `GEMINI_API_KEY` | Google Gemini AI Studio API key | Yes |
| `APP_URL` | Public production URL of the deployed Cloud Run service | Yes |
| `ADMIN_EMAIL` | Single-owner administrator email | Yes |
| `JWT_SECRET` | Secret key for JWT session authorization | Yes |
| `KCC_CHATGPT_SECRET` | Secret key for ChatGPT Custom GPT Bridge | Yes |
| `PAYPAL_CLIENT_ID` | PayPal REST API Client ID | Optional |
| `PAYPAL_CLIENT_SECRET` | PayPal REST API Client Secret | Optional |
| `PAYPAL_MODE` | PayPal mode (`sandbox` or `live`) | Optional |
| `CJ_DROPSHIPPING_EMAIL` | CJ Dropshipping account email | Optional |
| `CJ_DROPSHIPPING_API_KEY` | CJ Dropshipping API key | Optional |
| `WHATSAPP_TOKEN` | WhatsApp Cloud API Bearer token | Optional |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business Phone Number ID | Optional |
| `SUPABASE_URL` | Supabase Postgres/REST URL | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Optional |
| `GITHUB_TOKEN` | GitHub Personal Access Token for auto-updates | Optional |

## Local Container Build & Verification
```bash
# 1. Build Production Container
docker build -t kitora-command-center:latest .

# 2. Test Container Run
docker run -d --name kcc-prod -p 3000:3000 -e PORT=3000 -e NODE_ENV=production kitora-command-center:latest

# 3. Verify process liveness, then inspect readiness
curl -sSf http://localhost:3000/api/live
curl -s http://localhost:3000/api/kcc/health

# 4. Cleanup
docker stop kcc-prod && docker rm kcc-prod
```

## Cloud Run Deployment Command
To deploy directly via Google Cloud SDK (`gcloud`):
```bash
# Set GCP Project and Region
gcloud config set project YOUR_GCP_PROJECT_ID

# Deploy Container to Cloud Run
gcloud run deploy kitora-command-center \
  --source . \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --port 3000 \
  --min-instances 1 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars "NODE_ENV=production,ADMIN_EMAIL=samraboss@gmail.com" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,KCC_CHATGPT_SECRET=KCC_CHATGPT_SECRET:latest"
```

## Post-Deployment Verification
```bash
# Ping deployed process-liveness check
curl -sSf https://YOUR-SERVICE-URL.run.app/api/live

# Inspect readiness and KCC ALIVE state separately
curl -s https://YOUR-SERVICE-URL.run.app/api/kcc/health
```
