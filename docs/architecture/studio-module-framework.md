# Studio discipline module framework

## Scope

A Studio module adds an optional research workflow for one or more disciplines.
The module system is separate from OMI manuscript semantics: modules may use
Studio services and external providers, but must not change the OMI document
model merely to store module-specific state.

The first framework increment provides provider-neutral manifests, a validated
in-process registry, explicit contribution slots, declared capabilities, and
the two-level activation policy. It does not load remote code or implement the
administrator and workspace preference screens.

## Module manifest

A module has a stable qualified ID, semantic version, supported module API
version, host translation keys, optional discipline IDs, required capability
IDs, and declared contributions. The host validates manifests and rejects
duplicate IDs, invalid identifiers, duplicate contributions, and unsupported
API versions.

Contribution slots in API version 1 are:

- `workspace-home`: an entry on a research workspace landing page.
- `workspace-tools`: an action or tool exposed in a workspace.
- `research-navigation`: a module destination in research navigation.

Translations stay in Studio's locale system. Manifests refer to translation
keys rather than shipping untranslated user-facing strings.

## Activation and authority

There are two separate decisions:

1. An installation administrator enables a module for the Studio installation.
2. A researcher activates an enabled module for a specific workspace.

The shared resolver expresses those states for UI and policy evaluation.
Installation policy and workspace preferences are data contracts, not an
authorization mechanism. The server must own both settings and check module
availability and the user's authorization on every protected API operation.
A module's `requiredCapabilities` declaration describes requested access; it
does not grant it.

The UI should hide modules disabled by the installation, offer enabled modules
as workspace choices, and show active modules in that workspace. Settings
updates should use the installation policy revision to detect stale writes.
Workspace preferences must be scoped to the authenticated user and workspace.

## Loading and integration rules

Version 1 registers trusted modules in Studio's own source tree. A registry
entry is metadata only; module code remains part of the reviewed Studio build.
Do not evaluate arbitrary JavaScript, HTML, or remote bundles from a manifest.
When third-party distribution is considered, it needs a separate signed,
sandboxed extension design and a security review.

A module should integrate through named contribution slots and provider-neutral
service interfaces. It must not import another discipline module's internals,
access Prisma or databases directly, or put service credentials in OMI files.
External archives and other providers belong behind server-side connectors;
provider credentials and authorization stay server-side.

## Follow-up implementation

The next increment can add server-owned installation settings, user/workspace
preferences, and screens for administrators and researchers. It can then add
the history and archives module as the first discipline-specific implementation,
with archive-provider adapters behind the same module API.
