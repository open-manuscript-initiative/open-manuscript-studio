# ADR-036 — Project-owned research data and direct cloud storage

Status: accepted target, 2026-11-14; contract reconciliation proposed 2026-11-15, pending companion merges/CI.

Companion: [OMI #207](https://github.com/open-manuscript-initiative/omi/pull/207).

## Context

Research modules currently keep domain records in browser storage. The family-tree
and relationship-network modules share an IndexedDB workspace scoped by Studio
user and workspace. Studio's direct cloud connections currently proxy object
reads and writes through its API server. This couples the research dataset to a
particular browser/Studio account and makes the Studio server carry both storage
and payload traffic as the number and size of projects grow.

Research projects must remain usable independently of a particular Studio
deployment. A project's research data therefore needs its own portable format
and persistence authority.

## Decision

1. **The project owns module data.** Module datasets are versioned,
   provider-neutral project resources. They are addressed by stable project and
   module identifiers, not by a Studio user ID or the current default workspace.
2. **The selected project cloud location is authoritative.** A user's chosen
   provider stores the portable project resource/package as opaque bytes. The
   provider does not interpret OMI research semantics. Provider credentials and
   device-specific paths are not embedded in the portable project.
3. **Bulk data travels directly between client and provider.** The Studio API
   may perform control-plane work such as account authorization, capability
   checks, and short-lived transfer negotiation. It must not persist or proxy
   research-project payloads. If a provider cannot support a direct client or
   OS-managed file path, the client must disclose that limitation; it must not
   silently fall back to relaying the dataset through Studio.
4. **Local browser storage is a cache.** It can support responsiveness and
   offline recovery, but it is not the only durable copy. The UI must distinguish
   local changes from provider-confirmed saves and must not report a cloud save
   before the provider confirms the write and integrity metadata.
5. **Concurrent edits fail visibly.** Writes bind to the last observed provider
   revision/ETag and content digest. A stale revision produces a conflict state;
   silent last-write-wins replacement is prohibited. Merge behavior is a
   separately versioned project operation.
6. **Publication is an explicit projection.** A project owner selects records
   and fields for a searchable web view. Studio produces a portable static
   publication bundle for a user-controlled host. The source project and cloud
   object remain private unless the owner separately publishes them. Private
   notes, raw imports, participant data, and unselected fields are excluded by
   default.
7. **The first migration target is genealogy.** Family-tree and
   relationship-network views continue to share one dataset, but that dataset
   moves from the user/workspace IndexedDB key to the project resource model.
   Existing local data is preserved until the user explicitly imports or
   verifies its migration; migration must not silently discard it.

## Consequences

- Project data remains readable and transferable without the original Studio
  server or account.
- Studio server storage and payload bandwidth do not grow with research data.
- Cloud-provider authentication and transfer capability differ. Direct OAuth,
  provider-issued transfer URLs, and OS-synchronized files are transport
  adapters to the same project-resource contract, not separate data formats.
- Browser and native clients must expose clear connection, offline, conflict,
  integrity, and save-status states.
- Static publication can be searched in the visitor's browser and hosted by the
  project owner. Live multi-user editing is outside this decision.

## Implementation sequence

1. Define the portable project-resource envelope and validation/migration rules.
2. Add provider-neutral direct-transfer and native-file adapters with
   revision/digest checks; do not route payload bytes through the Studio API.
3. Migrate genealogy/network data as the first project-scoped module resource.
4. Add a reviewed allow-list projection and static searchable web bundle.
5. Migrate other modules incrementally after their existing import/export and
   privacy boundaries are characterized.

This ADR records the accepted architecture. It does not claim these
implementation steps or provider compatibility checks are complete.

## Current implementation slice — reconciliation 2026-11-15

Canonical exchange is OMI-SPEC-360 Draft 0.1.0: `format: omi-research-project`,
string version `0.1.0`, stable project ID, title, created/updated timestamps and
resource descriptors (`resourceId`, `resourceType`, `schemaVersion`, `mediaType`,
`inline` or manifest-bound `path`). The canonical schema and shared golden are
owned by OMI and pinned by immutable commit/checksum in Studio's conformance gate.
Studio generates native-CSP-safe validation at build time; this is not a Stable
format/conformance promotion.

The genealogy adapter edits exactly one supported inline graph, preserving
unknown envelope/descriptor properties and other opaque inline resources. It
refuses unresolved external path members, unsupported versions and ambiguous
supported resources before replacing any state. The single-JSON subset is bounded
by 64 MiB UTF-8, 1,000 resources, depth 64 and 1,000,000 JSON values plus graph
quotas. Archive resolution and provider-integrity evidence remain future work.

**Open as project** retains source identity/resources and is confirmed before
switching away from populated state. **Add to this project** copies only graph
records under the destination identity; it never adopts source project metadata
or silently imports unrelated resources. Dataset replacement for GEDCOM retains
the destination project identity. Opening, editing and switching via undo preserve
project metadata. This explicit distinction replaces treating every JSON open as
an ordinary graph merge.

The account/workspace key is a selection binding, not portable ownership. Durable
local cache records use project-ID-scoped keys within that access scope. Persist
the whole package successfully before updating the selected-project binding;
serialize writes, retain edits on failure and report only local save status.
Previous project caches remain separate; the original legacy key is never
rewritten by loading or the first confirmed migration. Undo is bounded to 30
in-session changes; an exported file remains the portable cross-device backup.
Caches do not grant another account access to project data.

The released `org.omi.research-project` / numeric `1` prototype and bare graph
JSON remain explicit migration inputs. Only canonical output is written. Preserve
the exact prototype source in the namespaced research-project-migration extension;
retain the original file and legacy browser record. Unknown opaque canonical
resources survive current graph edits and save/reopen. Failed/oversized conversions
leave the active project unchanged. No bulk background rewrite is performed.

Native file dialogs may target OS-managed provider locations; browsers download
files for separate upload. This remains **manual file transfer**. Direct cloud
OAuth/transfer, ETag conflict detection, provider-confirmed byte/digest receipts,
provider selection UI and reviewed searchable public projections are not implemented.
The cloud-authority decision is conditional on an explicitly configured and tested
storage adapter. A local cache write or file download must never claim provider
confirmation or automatic synchronization.

## Alternatives, acceptance and revisit

Keeping the prototype as a second canonical format would perpetuate incompatible
consumers. Rewriting every legacy cache on load risks recovery loss. Using a global
workspace as project authority or flattening unknown resources risks wrong-project
writes/data loss. Broad server relay or a claim of cloud completion is rejected.

Require canonical producer/consumer golden checks, prototype/bare-graph migration,
source/unknown-resource preservation, createdAt and identity retention, open/add/
undo/reload distinctions, failure injection for cache/binding writes, native-CSP
and desktop/mobile browser interaction. Existing exact-candidate gates remain;
provider/native/operator acceptance is separate. No manuscript/container-generation
change or database migration is introduced. Revisit for archive resources, resource
schema changes, real provider bindings, concurrent writes or public projection.
