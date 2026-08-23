# Open Manuscript Studio

**Open Manuscript Studio** is the open-source reference implementation of the **Open Manuscript Initiative (OMI)**: a structured, multilingual scholarly authoring environment for writing, reviewing, exchanging and preparing manuscripts for publication without locking the manuscript to one application, operating system or publishing platform.

> **Current status:** `0.1.0-alpha.4` · active alpha / beta-readiness stabilization.
>
> The core authoring, account, review, import/export, native packaging and institutional-administration layers are implemented and actively exercised. Work before beta is focused primarily on regression coverage, interoperability, recovery/error handling, migration discipline and trusted distribution rather than on basic product scaffolding.

- Web Studio: https://studio.openmanuscript.org
- Project website and specifications: https://openmanuscript.org
- Downloads: https://openmanuscript.org/studio/
- License: MIT

## Platform status

Studio uses one shared React/TypeScript application core and one OMI manuscript model across web, desktop and mobile clients. Tauri 2 supplies the native shell and operating-system integration.

| Platform | Current state | Native delivery |
|---|---|---|
| Web | Operational | Hosted Studio |
| Windows x64 | Operational | Setup EXE and MSI |
| Linux x64 | Automated native build | AppImage and DEB |
| macOS Apple Silicon | Automated native build | DMG; signing/notarization hardening remains |
| macOS Intel | Automated native build | DMG; signing/notarization hardening remains |
| Android | Operational public alpha | Universal APK; Documents/SAF file workflow |
| iOS / iPadOS | Validated native build target | iPhone/iPad simulator build passes; TestFlight/App Store signing and physical-device validation remain |

The iOS/iPadOS target is no longer only architectural planning: Tauri/Xcode project generation and Apple Silicon iPhone/iPad simulator compilation are validated in CI. Public Apple distribution still requires the real Apple Developer Team ID, signing certificate, provisioning profile, production Universal Link association and TestFlight/device validation.

## What Studio can do today

### Structured scholarly authoring

- semantic manuscript sections and blocks rather than presentation-only document state;
- Tiptap-based rich-text editing with headings, lists, tables, notes, references and inline formatting;
- browser-style multi-document tabs on desktop;
- optional Word-like document outline for long-form navigation;
- structured search and replace with scoped result navigation;
- manuscript, metadata and interface language handling;
- 24 supported European UI languages with localized help;
- IANA time-zone preferences and portable account settings;
- large DOCX import with deferred editor mounting for improved long-document responsiveness;
- direct DOCX-to-OMI opening with structural preservation of headings, inline semantics, notes, lists, references and tables.

### Accounts, identities and profiles

Studio separates **account identity**, **scholarly contributor identity** and **institutional affiliation/authority** instead of treating them as one field set.

Implemented account features include:

- server-backed registration, login, logout and session handling;
- password recovery with single-use expiring reset tokens and session revocation after password change;
- ORCID sign-in and explicit account linking;
- Google sign-in via OpenID Connect;
- Microsoft sign-in via OpenID Connect;
- configurable institutional/generic OIDC providers using Authorization Code + PKCE, state/nonce validation and issuer/audience verification;
- connected-identity management in the Account panel;
- protection against removing the last usable sign-in method;
- no silent account merging based only on matching e-mail addresses.

External identity providers are linked by stable provider identity rather than display name. Provider availability remains configuration-dependent on the Studio installation.

### Personal and institutional profiles

A user account can maintain personal profile data separately from one or more institution memberships.

Institutional profiles can carry shared institution/ROR identity plus membership-specific department, position, institutional e-mail, linked identity and role. One affiliation can be selected as the default without duplicating the institution record into every account.

Institution authorization uses explicit roles:

- `MEMBER`
- `ADMIN`
- `OWNER`

Institution administrators use the same human Studio account rather than a separate shadow account. Administrative authority is server-side and does **not** automatically grant access to manuscripts, peer-review content or editorial material.

### Central administration and Institution Admin API

A separate OMI central administration plane is implemented for deployments that need to manage multiple institutions.

Central `ADMIN` / `OWNER` privileges are distinct from institution roles and can manage institution lifecycle, institution administrators, institution-scoped API credentials and administrative audit events without inheriting scholarly-content permissions.

Institution machine credentials are:

- bound to one institution;
- displayed in raw form only at creation time;
- stored as hashes;
- revocable and optionally expiring;
- limited by explicit scopes such as `institution:read`, `members:read` and `members:write`;
- prevented from changing institution `OWNER` roles.

## Peer review and publishing workflows

The current Studio line includes:

- double-blind peer review;
- anonymous reviewer projection and identity separation;
- reviewer assignments and reviewer workspaces;
- editor-facing review overview;
- comments and persisted review state;
- role-aware author/editor/reviewer workflows;
- server-backed manuscript snapshots and review context.

### OJS

The OJS integration supports configuration-dependent connected workflows including:

- signed launch assertions;
- manuscript and metadata retrieval;
- structured file import;
- author/editor/reviewer context;
- peer-review assignment context;
- return through the integration workflow.

OJS remains authoritative for submission workflow state, assignments, rounds and editorial decisions. Studio acts as the structured authoring/review workspace rather than coupling directly to the OJS database.

### OMP

The Open Monograph Press connector architecture is present and shares the same integration principles. End-to-end OMP hardening remains active work before it is described at the same operational maturity as the tested OJS paths.

## Storage: own device, shared device and cloud

Installed Studio clients distinguish between a trusted **own device** and a **shared/foreign device**.

### Own device

When the signed-in user marks the installation as their own device, normal native system storage can be used as the persistent working location.

On desktop this includes:

- local folders;
- external drives;
- mounted/network storage;
- provider-synchronized folders such as OneDrive, SharePoint, Google Drive, Dropbox, Nextcloud and iCloud Drive.

For synchronized folders the provider's own desktop client handles authentication and synchronization. Studio writes ordinary portable OMI files and does not need the provider password or OAuth token for this mode.

### Shared or foreign device

New device-local trust defaults to shared/foreign-device mode. Studio does not retain a local working-file path as the normal persistent location in this mode and prefers profile-scoped cloud connections where configured.

A removable device such as a USB drive can still be used explicitly for one-off open/save operations. The selected local path is not retained as the current long-term working location.

### Profile-scoped cloud connections

Direct cloud/service connections belong to the signed-in account profile rather than to one device. Current direct WebDAV/Nextcloud support includes encrypted server-side credential storage, connection testing, portable backup upload, restore and deletion.

Provider OAuth integrations can use the same profile-scoped model without conflating them with local synchronized folders.

## Android native file workflow

Android uses the operating system **Documents / Storage Access Framework** instead of broad shared-storage permissions.

The native Android workflow supports:

- opening an OMI document from the system picker;
- Save to the current selected document target;
- Save As to another system-selected destination;
- portable `.omi.zip` backup;
- supported publication exports to system document providers.

Raw `content://` document identifiers are treated as implementation details and are not exposed as ordinary user-facing paths.

## iOS and iPadOS

The iOS/iPadOS target uses the Apple **Files / UIDocumentPicker** model with security-scoped access rather than broad filesystem assumptions.

Depending on device configuration, the picker can expose:

- On My iPhone / On My iPad;
- iCloud Drive;
- connected external storage supported by iOS/iPadOS;
- third-party Files providers installed by the user.

The current iOS/iPadOS implementation includes iPhone/iPad orientation metadata, iPad multitasking support, hardware keyboard/trackpad-friendly indirect input settings, native Files document handling and the shared mobile authentication handoff.

Production Universal Links require the real Apple Development Team ID in the Apple App Site Association configuration for `app.openmanuscript.org`. The project deliberately does not guess or commit production signing identity.

## Import, export and manuscript portability

Portable OMI interchange is a first-class design goal.

Current output support includes:

- portable OMI package (`.omi.zip`);
- OMI JSON (`.omi.json`);
- JATS XML;
- semantic/offline HTML package;
- DOCX;
- EPUB;
- LaTeX;
- PDF/print workflow where supported;
- IDML;
- XPress Tags (XTG);
- FrameMaker MIF;
- Scribus SLA.

Mobile clients intentionally show only the formats that have meaningful native mobile delivery: OMI package/JSON, JATS, HTML package, DOCX, EPUB and LaTeX. Desktop-oriented DTP formats and browser print/PDF are hidden rather than presented as non-functional mobile actions.

Publisher profiles, export styles and print styles remain separated from manuscript semantics so one structured manuscript can target multiple publication pipelines.

## Proofreading, translation and AI-assisted integrations

Studio's integration layer supports explicit, scoped external-service execution rather than silently sending whole manuscripts to providers.

Current implementation includes:

- local platform/browser spellcheck following manuscript language;
- optional LanguageTool-compatible grammar/style checking;
- structured DeepL translation over selection/block/section/manuscript scopes;
- provider-neutral AI agents for language editing, metadata assistance, summarization and citation checking;
- integration execution records and audit metadata without storing manuscript text or service secrets in the audit trail;
- explicit permission boundaries for review-confidential content.

These features are configuration-dependent where an external service or credential is required.

## ORCID and author signatures

ORCID account linking is integrated with the author-identity model and with portable cryptographic author-signing work.

The current implementation can bind immutable committed manuscript revisions to verified ORCID identity and portable WebAuthn/issuer verification evidence. Personal and institutional ORCID deployment credentials are kept in separate configuration namespaces.

## Security model

The current development line includes a growing security baseline:

- server-side rate limiting;
- OIDC PKCE/state/nonce and issuer/audience validation;
- explicit connected-identity linking;
- hashed password-reset and Institution Admin API tokens;
- session revocation after password reset;
- SSRF restrictions for server-side remote requests;
- encrypted storage for supported direct integration credentials;
- safer import/export escaping and validation;
- institution and central-admin authorization boundaries;
- administrative and integration auditing;
- automated CI/security scanning.

Administrative roles do not implicitly grant manuscript/editorial-content access.

## Architecture

```text
                         OMI Studio Core
                                │
               ┌────────────────┼────────────────┐
               │                │                │
             Web UI         Desktop UI       Mobile UI
               │                │                │
            Browser           Tauri 2          Tauri 2
                                │                │
                   Windows · macOS · Linux   Android · iOS/iPadOS
                                │
                         Studio API
                                │
             PostgreSQL · identity · review · integrations
                                │
       OJS · OMP · ORCID · OIDC · storage · DeepL · AI services
```

The OMI manuscript schema remains independent of the Studio application version and of the operating system. Platform adapters provide native file dialogs, filesystem access, packaging, update behavior and mobile authentication return handling around one scholarly core.

## Technology stack

- React
- TypeScript
- Vite
- Zustand
- Tiptap
- Tauri 2
- Rust
- Node.js server components
- PostgreSQL
- Prisma

## Development setup

Recommended baseline:

- Node.js 24
- npm
- Rust stable for native builds
- platform-specific Tauri prerequisites

Install dependencies:

```bash
npm ci
```

Run the web client:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build the web client:

```bash
npm run build
```

Desktop development/build:

```bash
npm run desktop:dev
npm run desktop:build
```

Android project/development/build:

```bash
npm run android:init
npm run android:dev
npm run android:build
```

iOS/iPadOS project/development/build requires macOS/Xcode and the Apple/Tauri toolchain:

```bash
npm run ios:init
npm run ios:dev
npm run ios:build
```

Public iOS device/TestFlight/App Store distribution additionally requires Apple Developer signing and provisioning credentials.

## Release engineering

GitHub Actions builds and regression-checks the shared product line across web, desktop, Android and iOS simulator targets.

Current distribution hardening includes:

- reproducible lockfile-controlled JavaScript and Rust/Tauri dependency graphs;
- Windows, Linux, macOS and Android artifact builds;
- validated iPhone/iPad simulator build;
- desktop update flow;
- Windows SignPath code-signing preparation;
- macOS signing/notarization work;
- prepared Apple signing workflow for a future TestFlight/App Store IPA.

The public release line remains alpha until the beta-readiness gate is met.

## Documentation

Project specifications, architecture, implementation status and deployment documentation are maintained at:

**https://openmanuscript.org/**

Useful starting points:

- [Studio implementation status](https://openmanuscript.org/docs/governance/studio-implementation-status/)
- [Cross-platform Studio architecture](https://openmanuscript.org/docs/foundations/cross-platform-studio/)
- [iOS and iPadOS Studio](https://openmanuscript.org/docs/foundations/ios-ipados-studio/)
- [Institutional and central administration](https://openmanuscript.org/docs/integrations/institutional-administration/)
- [Integration implementation status](https://openmanuscript.org/docs/integrations/implementation-status/)
- [Code signing policy](https://openmanuscript.org/docs/governance/code-signing-policy/)

Repository documents include:

- `SECURITY.md` — vulnerability reporting and release security;
- `CONTRIBUTING.md` — contribution guidelines;
- `CODE_OF_CONDUCT.md` — community standards;
- `LICENSE` — MIT License.

## Project principle

Open Manuscript Studio is a **reference implementation**, not a proprietary replacement for the OMI standard. Its purpose is to exercise OMI specifications in real authoring, peer-review, editorial, institutional and publishing workflows while keeping scholarly manuscripts structured, portable and interoperable.

**Write naturally. Structure once. Publish everywhere.**
