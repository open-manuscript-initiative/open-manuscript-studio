# Google Cloud project consolidation

Open Manuscript Studio keeps its Google integrations in one canonical Google
Cloud project:

- **Project ID:** `open-manuscript-studio-508703`
- **Expected project number:** `452031980278`

The project ID and project number must be checked together in Google Cloud
Console. A matching project ID alone is not enough to prove that the restored
Play-connected project is being used.

## Integrations

| Integration | Google Cloud resource | Repository/runtime credential |
| --- | --- | --- |
| Google Play uploads | Google Play Developer API and a dedicated service account | GitHub Actions secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| Google sign-in | OAuth consent screen and a Google OIDC OAuth client | Server `GOOGLE_OIDC_CLIENT_ID`, `GOOGLE_OIDC_CLIENT_SECRET`, `GOOGLE_OIDC_REDIRECT_URI` |
| Google Drive storage | Google Drive API and a separate OAuth client | Server `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` |

The Google OIDC and Google Drive clients belong to the same Cloud project but
must remain separate clients. Their permissions, scopes and redirect URIs are
different.

## Migration sequence

1. In Google Cloud Console, select `open-manuscript-studio-508703` and verify
   that it is `ACTIVE` and has project number `452031980278`.
2. Enable the Google Play Developer API and Google Drive API in that project.
   Configure the OAuth consent screen there as required.
3. Create a dedicated Play service account in this project and create a new
   JSON key. The old service account/key from project 258278693067 remains
   tied to that old project. In Play Console, invite the new service account
   and grant only the minimum release permissions required by the workflow.
4. Create a new Google OIDC client in this project. Preserve the exact
   callback URI:
   `https://studio.example.org/api/auth/oidc/google/callback`
   (replace the host only when the deployment uses another configured origin).
5. Create a new Google Drive OAuth client in this project. Preserve the
   exact callback URI:
   `https://studio.example.org/api/cloud/oauth/google-drive/callback`.
6. Update the server's `GOOGLE_OIDC_*` and `GOOGLE_DRIVE_OAUTH_*` values
   together, then restart the server. Never commit client secrets.
7. Keep `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` unchanged if its
   `project_id` is `open-manuscript-studio-508703` and the key remains
   active. If the service account or key changes, replace the complete GitHub
   secret without exposing it in chat, issues or logs.
8. Run an Android Release build with Play upload enabled on the internal track,
   then test Google sign-in and Google Drive connection/upload.
9. Only after all three paths pass should the unused OAuth clients and old Cloud
   projects be disabled or deleted.

## CI guard

The Android Release workflow checks the Play credential JSON before uploading.
It rejects a secret whose `project_id` is not
`open-manuscript-studio-508703`. This prevents a deleted or unrelated Cloud
project from silently being used again.
