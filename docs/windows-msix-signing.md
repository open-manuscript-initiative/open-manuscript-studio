# Windows MSIX signing and distribution (Open Manuscript Studio)

**Status:** separate candidate workflow, not an approved Windows RC publication. Existing MSI/NSIS outputs, Android release artifacts and the seven-file 1.0 RC evidence/hash/approval gate remain unchanged.

## Distribution and trust

| Path | Package | Signature | Updates |
| --- | --- | --- | --- |
| Microsoft Store | Unsigned MSIX uploaded to Partner Center | Microsoft signs the package after certification | Store-managed |
| OMI website / GitHub direct download | MSIX signed using Azure Artifact Signing | Windows-verifiable public-trust certificate | An .appinstaller feed can follow after identity and upgrade testing |
| Local development | MSIX signed with an isolated self-signed test certificate | Only on machines that explicitly trust the test certificate | Not a public release |

MSIX is **not a drop-in replacement** for Tauri's existing MSI/NSIS installers. It introduces a Windows package identity, a different installation/state model and potentially different update handling. Do not publish an unsigned or self-signed MSIX as an official public installer.

## Microsoft Store onboarding (preferred for 1.0 RC; no Azure subscription)

1. Open https://storedeveloper.microsoft.com/ and use **Get started**. Registration through the new flow is free for both Individual and Company. Do not start through older Partner Center links because they can open the legacy registration route.
2. Pick the legal publisher: **Individual** if publishing in the person's own name as a non-business project, or **Company** only if a real incorporated business, university or nonprofit is the publisher and the registrant is authorized to act for it. Individual accounts cannot simply be converted to Company accounts.
3. Complete Microsoft verification. Individuals use government ID and selfie. Company registration normally requires organizational verification (D-U-N-S or official registry documents) and a domain-matching work contact email.
4. In Partner Center **Apps & Games → New product → MSIX or PWA app**, check availability and reserve **Open Manuscript Studio**. Do not choose **EXE or MSI app**, because that is a distinct distribution pipeline whose binaries need independent signing.
5. On the reserved app's **Product management → Product identity** page, copy the exact **Package/Identity/Name**, **Package/Identity/Publisher**, and **Package/Properties/PublisherDisplayName**. All three are input parameters for the workflow; never guess them from the Tauri identifier or project name.
6. After this PR is merged and the full build/review gate passes, manually dispatch **Windows MSIX candidates (Store or direct signing)** on main, select **store** (default), and paste the three public package identity values. Obtain the **omi-studio-windows-msix-store-unsigned** artifact.
7. In Partner Center start a new submission and upload that unsigned `.msix` to Packages. Microsoft signs it only after certification. Fill out the listing, privacy, age rating and required geographic/pricing fields. Until Microsoft certification is complete, **the unsigned MSIX is not a public downloadable installer**.
8. Review app installation, WebView2, document persistence, file handlers, ORCID callback, and Store-managed updates on a real Windows device. Publish only after the separate RC manual Go/No-Go. Use the Store's listing URL for the OMI website once published.

**No Azure subscription, Azure service principal or code-signing certificate is needed for the Store path.** The optional `direct` branch remains inactive unless deliberately selected and configured later. The previous SignPath Foundation rejection does not block the Store route.

Reference: https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account and https://learn.microsoft.com/en-us/windows/apps/publish/view-app-identity-details

## Maintainer provisioning (required before the first signed build)

1. Reserve the application package name in Microsoft Partner Center. Obtain the exact **Package Identity Name** and **Publisher** distinguished name (DN). Do not assume the Tauri identifier, org.openmanuscript.studio, is the Store-reserved identity. Windows MSIX updates depend on an unchanged package name and Publisher and an increasing four-part numeric version.
2. For direct delivery, create an Azure Artifact Signing account, complete the organizational identity check and obtain a public-trust certificate profile. The MSIX manifest Publisher must exactly match the certificate Subject DN (including all fields and their order). If Store and Azure identities differ, the two channels cannot be treated as a single seamless update channel.
3. Create a protected GitHub Environment named **windows-signing**, require reviewer approval and restrict it to main. Put the following values in that environment:
   - Secrets: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.
   - Variables: AZURE_TRUSTED_SIGNING_ENDPOINT, AZURE_CODE_SIGNING_NAME, AZURE_CERT_PROFILE_NAME.
   Grant only the minimum signing permissions to the identity. Never commit private keys, PFX files or service credentials.
4. On the main branch, manually dispatch **Windows MSIX candidates (Store or direct signing)**. Select either store or direct and supply the actual package identity, exact Publisher DN and exact PublisherDisplayName from Partner Center (or the verified matching certificate publisher profile). Store mode produces the unsigned Partner Center candidate; direct mode submits that same workflow run's package to the protected signing environment and publishes an artifact only after successful SignTool verification.
5. Review SHA-256, source commit, package identity and version, verify the signature chain for direct delivery, and perform Windows x64 installation, launch and uninstall tests. Explicitly test native file open/save, login/ORCID protocol callback, app data and manuscript preservation, WebView2 availability, an update from an older MSIX and coexistence/migration from MSI/NSIS.
6. A green packaging/signing workflow **does not approve an RC release**. Record device tests and the exact artifact hashes in the existing 1.0 RC approval process, then decide whether to publish through Partner Center and/or the direct channel. Update public links only for actually approved and verified signed artifacts.

## Files and responsibility boundaries

- scripts/build-windows-msix.mjs — validates identity, exact publisher DN and the four-number Windows installer version; stages the Tauri Windows binary and generated MSIX icons. The manifest registers the openmanuscript custom protocol and the full-trust desktop capability.
- scripts/pack-windows-msix.ps1 — uses Windows SDK MakeAppx to produce an unsigned x64 MSIX for review and later signing.
- .github/workflows/windows-msix.yml — manually dispatched independent candidate workflow. Direct packages are signed with Azure Artifact Signing in a protected environment. No automatic GitHub release publication or change to the seven existing RC file hashes.
- tests/windows-msix-packaging.test.mjs — tests Publisher and identity validation, numeric version requirements and required manifest fields.
- docs/CODE_SIGNING_POLICY.md — continues to govern the existing MSI/NSIS / SignPath plan, which is **not** automatically signed by this new MSIX process.

The Tauri signed updater must not bypass the Store update mechanism for Store-installed MSIX packages. Implement and validate distribution-channel-aware update selection before release. Test actual MSIX process behavior and state storage on Windows 11 before a production claim; manifest-only tests do not establish installability.

## Official sources

- Microsoft Store signs submitted MSIX packages: https://learn.microsoft.com/en-us/windows/apps/publish/get-started
- MSIX signing, identities and direct delivery: https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide
- MSIX certificate requirements: https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview
- Windows SDK MakeAppx: https://learn.microsoft.com/en-us/windows/uwp/packaging/create-app-package-with-makeappx-tool
- Tauri build without bundling: https://v2.tauri.app/distribute/
