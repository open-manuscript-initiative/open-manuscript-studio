# ADR-036 — Project-owned research data and direct cloud storage

Status: accepted, 2026-11-14

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
