# Studio API egress acceptance record (#765) — TEMPLATE

**Do not fill with credentials, domain challenge strings, bearer tokens, names, full private IP allowlists, manuscripts or raw Plesk firewall output.** Store the detailed private record under an approved administrative location. A redacted PASS/FAIL summary can be attached to #765.

| Field | Value |
|---|---|
| Date and timezone | NOT TESTED |
| Reviewed and deployed Studio commit SHA | NOT VERIFIED |
| VPS OS and firewall type | NOT VERIFIED |
| Dedicated non-root service UID confirmed (without revealing UID publicly) | NOT VERIFIED |
| The service UID is exclusive to Studio API | NOT VERIFIED |
| Approved local DB/DNS exceptions independently checked | NOT VERIFIED |
| All approved external APIs enumerated and maintained | NOT VERIFIED |
| Backup and independent SSH rollback access tested | NOT VERIFIED |
| Candidate policy validated with nft --check | NOT VERIFIED |
| Installed private nft table exists on the actual host | NOT VERIFIED |
| IPv4 private/metadata counter tests | NOT VERIFIED |
| IPv6 local/ULA counter tests | NOT VERIFIED |
| Public HTTPS reachability under API UID | NOT VERIFIED |
| Authenticated WebDAV/Nextcloud upload and download | NOT VERIFIED |
| OJS/OMP signed editorial workflow | NOT VERIFIED |
| ORCID/OIDC, Drive/OneDrive/Dropbox, mail and enabled services | NOT VERIFIED |
| API, PostgreSQL, collaboration and public health | NOT VERIFIED |
| PDF worker separate namespace and render/import | NOT VERIFIED |
| DNS rebinding from controlled public-to-private canary | NOT VERIFIED |
| IPv4-mapped/6to4/NAT64 and redirect abuse tests | NOT VERIFIED |
| Container FORWARD or non-host API variants assessed | NOT VERIFIED |
| Shared-UID or permitted localhost-port SSRF residual risk addressed | NOT VERIFIED |
| Boot persistence and emergency table-only rollback rehearsed | NOT VERIFIED |
| Operator / security reviewer approval | NOT VERIFIED |

The result is **NOT ACCEPTED** while any mandatory field is NOT VERIFIED, FAIL, or unsupported. The presence of a PDF-worker success report, a PR merge, or a CI green status is not a substitute for this host-specific record. Keep #765 release-blocker open until the actual deployed service has passed both negative and positive tests and the permitted local-socket DNS-rebinding issue has been addressed.
