# KCC Cloud Run — GitHub OIDC / Workload Identity Federation

KCC deployment uses GitHub Actions OIDC with Google Cloud Workload Identity Federation. No long-lived Google service-account JSON key is stored in GitHub.

Required repository variables:

- `WIF_PROVIDER`: full Google Workload Identity Provider resource name, using the GCP project number, for example `projects/123456789/locations/global/workloadIdentityPools/github/providers/github`.
- `WIF_SERVICE_ACCOUNT`: the Google service-account email that GitHub Actions is allowed to impersonate.

The workflow requires GitHub Actions permission `id-token: write` and uses `google-github-actions/auth@v3` for keyless authentication.

The Google identity setup must grant the GitHub repository principal permission to impersonate the target service account. The service account then needs the least-privilege roles required to build from source and deploy to Cloud Run, plus access to the configured Secret Manager secrets.
