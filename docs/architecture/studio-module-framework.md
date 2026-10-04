# Studio discipline module framework

## Scope

A Studio module adds an optional research workflow for one or more disciplines.
The module system is separate from OMI manuscript semantics: modules may use
Studio services and external providers, but must not change the OMI document
model merely to store module-specific state.

The framework provides provider-neutral manifests, a validated in-process
registry, contribution slots, capability declarations, and two-level activation.
The Studio menu opens a module manager and hosts empty shells for the built-in
discipline modules. They provide catalog descriptions, activation controls, and
navigation placeholders only; they do not implement research or search
functions and do not load remote code.

## Built-in module catalog

The initial catalog includes these modules:

| Module | Disciplines | Planned scope |
| --- | --- | --- |
| History and archives | History, archival studies | Search archival catalogs and connect archive records with research context. |
| Religious texts | Theology, religious studies | Locate religious passages, compare editions and translations, and relate manuscript witnesses and interpretation. |
| Critical text edition | Philology, classical philology, literary studies | Manage transcriptions, textual variants, manuscript witnesses, critical apparatus, and digital editions. |
| Corpus linguistics | Linguistics | Search corpora, produce concordances, align texts, and annotate linguistic features. |
| Musicology | Musicology | Work with notation and musical events, align scores and recordings, annotate passages, and compare variants. |
| Cultural heritage | Archaeology, art history, museum studies | Describe objects and sites with people, events, dates, and places, and annotate image regions. |
| Social research methods | Social sciences, behavioral sciences, economics | Organize survey instruments, variables, codebooks, interview coding, datasets, and methods. |
| Legal sources | Law | Search legislation and court decisions, track jurisdiction and effective dates, cite provisions and cases, and compare versions. Provider access is jurisdiction-specific. |
| Research reproducibility | Natural sciences, engineering | Relate publications to versioned datasets, code, methods, supplemental materials, and research repositories. |

These entries are module shells. Their descriptions communicate the planned
scope; no connectors, search interfaces, discipline workflows, or data
processing functions are implemented yet. Additional disciplines can add
modules through the same manifest and contribution system.

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

The shared resolver expresses those states for UI and policy evaluation. The
current shell uses a built-in installation policy and stores the researcher's
selection in browser storage, scoped to the authenticated user and a temporary
default workspace. This is scaffolding; it is not synchronized across devices
and does not provide administrator controls. A future workspace model should
supply a real workspace ID.

Installation policy and workspace preferences are not an authorization
mechanism. The server must own both settings and check module availability and
the user's authorization on every protected API operation. A module's
`requiredCapabilities` declaration describes requested access; it does not
grant it. Settings updates should use the installation policy revision to
detect stale writes.

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

Replace the temporary built-in installation policy and browser preference store
with server-owned settings and real workspace-scoped preferences. Implement
each module's discipline-specific research functions and provider adapters in
later work. The current catalog is only the shared activation, description, and
navigation scaffold.
