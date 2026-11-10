# Code Signing Policy

## Purpose

Open Manuscript Studio is an open-source application distributed by the Open Manuscript Initiative. This policy defines how official desktop binaries are built, reviewed, approved, signed, and published.

## Source and license

The source code for Open Manuscript Studio is publicly available in this repository and is licensed under the MIT License. Official signed binaries must be produced from source code in the official `open-manuscript-initiative/open-manuscript-studio` repository.

## Signing service and status — 10 November 2026

The selected path is **Microsoft Store MSIX**. Microsoft signs the package during
publication after certification. The Store-only workflow builds an unsigned
candidate without Azure or private signing credentials.
On 10 November Microsoft notified the publisher that the Store submission was
processed and available, possibly taking up to two hours to appear to customers.
This does not itself verify the Store-delivered package signature or installation,
update and data-preservation behavior, and it does not approve stable Studio 1.0.
The IARC classification questionnaire submitted on 9 November has separately been
reported live, without a confirmed age-category value in the notification.
[Current build and remaining validation](windows-msix-signing.md).

The earlier SignPath Foundation application was declined, according to the owner.
SignPath is not an active signing provider; no SignPath certificate or sponsorship
is claimed. Direct EXE/MSI signing remains unconfigured.

## Trusted build provenance

Official signed release artifacts must:

1. originate from the official GitHub repository;
2. be built by the project's GitHub Actions release workflow using GitHub-hosted runners;
3. be generated from the exact commit associated with the release;
4. pass the project's automated tests before signing;
5. be submitted through the approved channel (Partner Center for Store MSIX) without unreviewed binary replacement;
6. be published only after successful signing and verification.

Unsigned locally produced binaries are development builds and must not be represented as official signed releases.

## Roles

The project distinguishes the following code-signing roles:

- **Authors / Committers** contribute source code and changes to the build configuration.
- **Reviewers** review changes that affect application behavior, dependencies, packaging, release automation, or signing configuration.
- **Approvers** authorize official signing requests and releases. An approver must not approve a binary whose provenance cannot be verified against the official repository and CI workflow.

A person may hold more than one project role where appropriate, but release approval remains an explicit action rather than an implicit consequence of committing code.

## Authentication and access

Accounts with administrative, release, or signing privileges must use multi-factor authentication where supported. Access to signing configuration, GitHub environments, secrets, and release permissions must be limited to maintainers who require it.

Signing credentials or service secrets must never be committed to the repository. They must be stored using the secret-management facilities provided by the approved CI/signing service.

## Release approval

Official release signing is restricted to release artifacts produced by the trusted build workflow. Signing requests requiring approval must be reviewed before the signed artifact is published.

The approver should verify at minimum:

- the release version and source commit;
- successful CI/test status;
- the expected artifact type and architecture;
- that the artifact was produced by the trusted workflow;
- that no unreviewed signing or packaging configuration change is included.

## Windows artifacts

The Store workflow produces an unsigned `.msix` candidate for Partner Center validation and Microsoft certification/signing. Existing NSIS `.exe` and WiX `.msi` installers remain a separate channel and must not be described as signed without their own verified Authenticode signatures. Store-managed updates, identity and migration require real-device acceptance.

## Verification

Users and distributors should verify that official Windows binaries carry a valid Authenticode signature and that the signature chain is trusted by Windows. Release artifacts published before code signing was introduced may legitimately be unsigned and should be identified as such by their release date/version.

## Security incidents

If signing credentials, signing configuration, release permissions, or build provenance are suspected to be compromised, signing and publication must be suspended until the incident has been investigated. Affected credentials must be revoked or rotated as appropriate, and potentially affected releases must be identified publicly.

## Privacy

The signing workflow is intended to process release artifacts and build/release metadata, not manuscript content or end-user data. Microsoft and GitHub process account, audit, build, submission and service metadata according to their respective privacy policies.

The Open Manuscript Initiative's application-level privacy documentation is maintained separately from this code-signing policy.

## Changes to this policy

Changes to this policy, the trusted build workflow, or the signing configuration must be reviewed with the same care as other release-security changes. Material changes should be merged before they are used for an official signed release.
