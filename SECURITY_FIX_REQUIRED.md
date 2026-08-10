# SECURITY FIX REQUIRED

The current main branch has three confirmed production security blockers:

1. Hardcoded fallback JWT/admin secrets in `server/singleOwnerAuth.ts`.
2. Blanket `/api/kcc` authorization exemption in `server.ts`.
3. Worker endpoints accepting arbitrary `x-worker-id` without cryptographic authentication.

These must be fixed before autonomous execution is enabled.
