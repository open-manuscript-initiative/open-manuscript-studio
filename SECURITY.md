# Security Policy

## Supported versions

Open Manuscript Studio is currently in alpha development. Security fixes are applied to the current development line and the most recent published prerelease. Older alpha builds should be upgraded rather than treated as supported long-term releases.

## Reporting a vulnerability

Please do not disclose exploitable security vulnerabilities in a public issue before maintainers have had a reasonable opportunity to investigate them.

Use GitHub's private vulnerability reporting / Security Advisory mechanism for this repository when available. If private reporting is not available, contact the Open Manuscript Initiative through the contact information published on the project's official website and clearly mark the message as a security report.

A useful report includes the affected version or commit, affected component, reproduction steps, expected and actual behavior, potential impact, and any suggested mitigation.

## Release and code-signing security

Official desktop releases must be produced from the official repository through the project's controlled CI/release workflow. Local or manually modified binaries are not official signed releases.

The project's code-signing requirements, trusted build provenance, signing roles, approval process, and verification requirements are documented in [Code Signing Policy](docs/CODE_SIGNING_POLICY.md).

Accounts with administrative, release, or signing privileges must use multi-factor authentication where supported. Signing credentials and service secrets must not be committed to the repository.

## Scope

Security reports may concern, among other areas, authentication and authorization, manuscript confidentiality, peer-review confidentiality, OJS/OMP integration, import/export processing, local file access, cloud-storage integrations, desktop packaging, dependency or supply-chain compromise, and release/signing infrastructure.
