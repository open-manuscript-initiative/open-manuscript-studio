# Code Signing Policy

## Purpose

Open Manuscript Studio is an open-source application distributed by the Open Manuscript Initiative. This policy defines how official desktop binaries are built, reviewed, approved, signed, and published.

## Source and license

The source code for Open Manuscript Studio is publicly available in this repository and is licensed under the MIT License. Official signed binaries must be produced from source code in the official `open-manuscript-initiative/open-manuscript-studio` repository.

## Signing service

The Open Manuscript Initiative intends to use the SignPath Foundation open-source code-signing service for eligible Windows release artifacts.

Code signing is provided free of charge by SignPath Foundation for approved open-source projects. The signing certificate and signing infrastructure are controlled by SignPath Foundation. Approval by SignPath Foundation is required before this integration can be activated.

## Trusted build provenance

Official signed release artifacts must:

1. originate from the official GitHub repository;
2. be built by the project's GitHub Actions release workflow using GitHub-hosted runners;
3. be generated from the exact commit associated with the release;
4. pass the project's automated tests before signing;
5. be submitted to the configured SignPath project without manual replacement or modification of the binary between build and signing;
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

Signing credentials or service secrets must never be committed to the repository. They must be stored using the secret-management facilities provided by GitHub and/or SignPath.

## Release approval

Official release signing is restricted to release artifacts produced by the trusted build workflow. Signing requests requiring approval must be reviewed before the signed artifact is published.

The approver should verify at minimum:

- the release version and source commit;
- successful CI/test status;
- the expected artifact type and architecture;
- that the artifact was produced by the trusted workflow;
- that no unreviewed signing or packaging configuration change is included.

## Windows artifacts

The intended Windows release artifacts are the Tauri-generated NSIS `.exe` installer and WiX `.msi` installer. Where supported by the signing configuration, executable payloads that require Authenticode signatures should be signed before the containing installer is finalized or by an approved SignPath artifact configuration that performs the required nested/deep signing.

## Verification

Users and distributors should verify that official Windows binaries carry a valid Authenticode signature and that the signature chain is trusted by Windows. Release artifacts published before code signing was introduced may legitimately be unsigned and should be identified as such by their release date/version.

## Security incidents

If signing credentials, signing configuration, release permissions, or build provenance are suspected to be compromised, signing and publication must be suspended until the incident has been investigated. Affected credentials must be revoked or rotated as appropriate, and potentially affected releases must be identified publicly.

## Privacy

The signing workflow is intended to process release artifacts and build/release metadata, not manuscript content or end-user data. SignPath Foundation and GitHub process account, audit, build, and service metadata according to their respective privacy policies.

The Open Manuscript Initiative's application-level privacy documentation is maintained separately from this code-signing policy.

## Changes to this policy

Changes to this policy, the trusted build workflow, or the signing configuration must be reviewed with the same care as other release-security changes. Material changes should be merged before they are used for an official signed release.
