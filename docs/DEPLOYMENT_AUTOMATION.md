# KCC Deployment Automation

Cloud Run deployment is automated by `.github/workflows/kcc-deploy.yml`.

The workflow deploys the `main` branch to project `ais-europe-west2-116319078cfc4` in region `europe-west2` and verifies `/api/kcc/health` after deployment.

Required GitHub Actions secret:
- `GCP_CREDENTIALS`: Google Cloud service-account JSON with permission to deploy to Cloud Run and access the referenced Secret Manager versions.

The application runtime secrets are read from Google Cloud Secret Manager and are never committed to the repository.
