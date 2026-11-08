# Windows MSIX signing and distribution (Open Manuscript Studio)

**Status:** separate candidate workflow, not an approved Windows RC publication. Existing MSI/NSIS outputs, Android release artifacts and the seven-file 1.0 RC evidence/hash/approval gate remain unchanged.

## Distribution and trust

| Path | Package | Signature | Updates |
| --- | --- | --- | --- |
| Microsoft Store | Unsigned MSIX uploaded to Partner Center | Microsoft signs the package after certification | Store-managed |
| OMI website / GitHub direct download | Requires a separately implemented signing workflow | Not produced by the Store workflow | Separate identity and upgrade testing required |
| Local development | MSIX signed with an isolated self-signed test certificate | Only on machines that explicitly trust the test certificate | Not a public release |

MSIX is **not a drop-in replacement** for Tauri's existing MSI/NSIS installers. It introduces a Windows package identity, a different installation/state model and potentially different update handling. Do not publish an unsigned or self-signed MSIX as an official public installer.

## Microsoft Store onboarding (preferred for 1.0 RC; no Azure subscription)

1. Open https://storedeveloper.microsoft.com/ and use **Get started**. Registration through the new flow is free for both Individual and Company. Do not start through older Partner Center links because they can open the legacy registration route.
2. Pick the legal publisher: **Individual** if publishing in the person's own name as a non-business project, or **Company** only if a real incorporated business, university or nonprofit is the publisher and the registrant is authorized to act for it. Individual accounts cannot simply be converted to Company accounts.
3. Complete Microsoft verification. Individuals use government ID and selfie. Company registration normally requires organizational verification (D-U-N-S or official registry documents) and a domain-matching work contact email.
4. In Partner Center **Apps & Games → New product → MSIX or PWA app**, check availability and reserve **Open Manuscript Studio**. Do not choose **EXE or MSI app**, because that is a distinct distribution pipeline whose binaries need independent signing.
5. On the reserved app's **Product management → Product identity** page, copy the exact **Package/Identity/Name**, **Package/Identity/Publisher**, and **Package/Properties/PublisherDisplayName**. All three are input parameters for the workflow; never guess them from the Tauri identifier or project name.
6. Manually dispatch **Windows MSIX candidates (Microsoft Store)** on **main** and verify the three public package identity inputs against Partner Center. The reserved Open Manuscript Studio values are prefilled; override them only for another deliberately reserved identity. Obtain the **omi-studio-windows-msix-store-unsigned** artifact after a successful build. This workflow has no distribution selector or direct-signing job.
7. In Partner Center start a new submission and upload that unsigned `.msix` to Packages. Microsoft signs it only after certification. Fill out the listing, privacy, age rating and required geographic/pricing fields. Until Microsoft certification is complete, **the unsigned MSIX is not a public downloadable installer**.
8. Review app installation, WebView2, document persistence, file handlers, ORCID callback, and Store-managed updates on a real Windows device. Publish only after the separate RC manual Go/No-Go. Use the Store's listing URL for the OMI website once published.

**No Azure subscription, Azure service principal or code-signing certificate is needed for the Store path.** The workflow is Store-only and contains no Azure action or signing credentials. GitHub validates action allowlists before job conditions, so even a skipped, disallowed signing action would prevent the Store build from starting. The previous SignPath Foundation rejection does not block the Store route.

Reference: https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account and https://learn.microsoft.com/en-us/windows/apps/publish/view-app-identity-details

## Reserved Store identity

The public Partner Center identity confirmed on 8 November 2026 is:

| Workflow input | Exact Partner Center value |
| --- | --- |
| `msix_identity` | `VargaIstvn.OpenManuscriptStudio` |
| `msix_publisher` | `CN=ED26F194-9F12-45EE-A4BC-C7DCD3A00E83` |
| `msix_publisher_display_name` | `Varga István` |

These values are application identifiers, not secrets. Keep Name and Publisher stable for updates and increase the four-part numeric MSIX version.

## Build failure recovery

If an older run reports `azure/trusted-signing-action@v0 is not allowed`, merge the Store-only workflow fix and start a **new Run workflow on main**. **Re-run all jobs** reuses the old workflow revision and will repeat the startup failure. No action allowlist change or Azure provisioning is required for this Store path.

## Candidate verification before publication

1. Review the build's SHA-256, source commit, package identity and version. The artifact is unsigned and intended for Partner Center, not public installation.
2. Perform Windows x64 installation, launch and uninstall tests through the appropriate testing channel. Explicitly test native file open/save, login/ORCID protocol callback, app data and manuscript preservation, WebView2 availability, an update from an older MSIX and coexistence/migration from MSI/NSIS.
3. A green packaging workflow **does not approve an RC release**. Record device tests and the exact artifact hashes in the existing 1.0 RC approval process, then decide whether to publish through Partner Center. Update public links only for approved Store distribution.

Direct-download MSIX signing remains a separate future implementation requiring its own trusted certificate, approved action policy, protected signing credentials, signature verification and channel compatibility tests. The Store workflow does not produce directly signed packages.

## Files and responsibility boundaries

- scripts/build-windows-msix.mjs — validates identity, exact publisher DN and the four-number Windows installer version; stages the Tauri Windows binary and generated MSIX icons. The manifest registers the openmanuscript custom protocol and the full-trust desktop capability.
- scripts/pack-windows-msix.ps1 — uses Windows SDK MakeAppx to produce an unsigned x64 MSIX for review and later signing.
- .github/workflows/windows-msix.yml — manually dispatched Store-only candidate workflow with public identity defaults. No Azure actions, signing secrets, automatic GitHub release publication or change to the seven existing RC file hashes.
- tests/windows-msix-packaging.test.mjs — tests Publisher and identity validation, numeric version requirements and required manifest fields.
- docs/CODE_SIGNING_POLICY.md — continues to govern the existing MSI/NSIS / SignPath plan, which is **not** automatically signed by this new MSIX process.

The Tauri signed updater must not bypass the Store update mechanism for Store-installed MSIX packages. Implement and validate distribution-channel-aware update selection before release. Test actual MSIX process behavior and state storage on Windows 11 before a production claim; manifest-only tests do not establish installability.

## Official sources

- Microsoft Store signs submitted MSIX packages: https://learn.microsoft.com/en-us/windows/apps/publish/get-started
- MSIX signing, identities and direct delivery: https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide
- MSIX certificate requirements: https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview
- Windows SDK MakeAppx: https://learn.microsoft.com/en-us/windows/uwp/packaging/create-app-package-with-makeappx-tool
- Tauri build without bundling: https://v2.tauri.app/distribute/
