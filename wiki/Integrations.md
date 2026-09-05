# Integrations

Studio integrates with external systems through explicit, scoped server-side contracts. A connection must not silently grant access to an entire manuscript, review, account, or institution.

## Publishing systems

| Integration | Current boundary |
| --- | --- |
| OJS | Signed launch, structured manuscript/metadata transfer, author/editor/reviewer context, assignment-aware review, and writeback paths under active end-to-end testing |
| OMP | Connector and review architecture present; end-to-end parity and hardening remain active work |

OJS/OMP stays authoritative for submission workflow state, review rounds, assignments, and editorial decisions. Studio is the structured authoring and review workspace. It does not connect directly to the publishing platform's database.

Relevant repositories:

- [OMI OJS plugin](https://github.com/open-manuscript-initiative/omi-ojs-plugin)
- [OMI OMP plugin](https://github.com/open-manuscript-initiative/omi-omp-plugin)

## Identity

Supported or prepared identity paths include:

- local Studio accounts and server-side sessions;
- ORCID sign-in and explicit linking;
- Google and Microsoft OpenID Connect;
- configurable institutional OIDC;
- the federated OMI Identity architecture.

Matching e-mail addresses alone must never silently merge accounts. Identity proves who a user is; each Studio/publishing installation still decides local manuscript, institutional, and editorial authorization.

## Storage

- local and provider-synchronized folders on trusted desktop devices;
- Android system document providers;
- iOS/iPadOS Files providers;
- profile-scoped WebDAV/Nextcloud connections;
- OAuth-ready Google Drive, OneDrive, and Dropbox provider configuration.

Login identity clients and storage OAuth clients use separate credentials because storage scopes are materially broader.

## Language and AI services

The extension layer supports LanguageTool-compatible proofreading, structured DeepL translation, and provider-neutral AI agents. Execution is scoped to a selection, block, section, manuscript, or configured task. Review-confidential content requires explicit permission boundaries.

## Secret handling

- External service credentials stay server-side.
- OJS/OMP shared secrets are encrypted at rest with AES-256-GCM.
- `INTEGRATION_MASTER_KEY` is distinct from every remote shared secret.
- Do not place secrets in `VITE_*`, browser storage, source control, URLs, or logs.
- Use a different shared secret for every external installation.
- Use HTTPS and replay-resistant, short-lived signed launch assertions.

## References

- [External publishing-system integration setup](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/server/INTEGRATIONS.md)
- [Integration extension SDK](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/integration-extension-sdk.md)
- [OJS 3.5 compatibility](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/pkp-ojs-3.5-compatibility.md)
- [PKP integration test environment](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/pkp-integration-test-environment.md)
- [ORCID OAuth](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/orcid-oauth-v1.md)
- [Cloud OAuth pull-request checklist](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/docs/cloud-oauth-pr-checklist.md)
