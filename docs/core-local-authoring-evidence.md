# Local authoring and source editability evidence — 2026-11-05

Twelve scenarios target OMI-SPEC-000@0.2.0 and OMI-SPEC-100@0.2.0. They provide **partial** observations for REQ-DOC-010 (local authoring), REQ-DOC-011 (editable import/source attribution) and REQ-PRI-007 (provenance must not lock ordinary content).

The informative observation profile `studio-local-model-authoring-0.1` covers the already initialized Studio model/store in a local Node process with installed dependencies. Each case clears the account session, replaces Fetch, WebSocket, XMLHttpRequest and Node HTTP/HTTPS request/get entry points with failing guards, and asserts that no guarded call was attempted. This is a bounded authoring observation, not an approved semantic profile, an offline app installation test or proof that every transport API is intercepted.

## Operations observed

- Create a study, edit title/abstract/body, checkpoint, serialize and reopen without an account or server call.
- Inspect imported metadata, continue editing, and switch between two local document sessions while retaining pending edits and checkpoint history.
- Modify and remove the first imported heading, ordinary source-notice prose and scholarly source metadata. Confirmed source relationships and hidden origin annotations do not lock body editing.
- Delete attributed content, clean active annotations/relationships atomically, retain prior source history and restore content through explicit revision restoration.
- Retain document-level self-attestation after deleting the first heading. Import-origin metadata is not a content pin.
- Use a real ProseMirror transaction to remove an empty leading editor heading while preserving its following paragraph, then save/reopen the resulting content.

Two cases exposed silent no-ops in text editing and deletion under embedded section/block trees, even though portable OMI accepts those structures. Text updates now locate and map blocks through both supported tree representations. Deletion removes the targeted subtree without flattening structure, retaining the existing relationship cleanup and history behavior. Ordinary unrelated blocks, identities and source records survive. Other specialized visual/style editing paths are not claimed to gain complete nested-tree support.

Run `npm run test:core-local-authoring`. On a committed checkout, `npm run evidence:core-local-authoring -- --report test-results/core-local-authoring.json` runs the same cases and records source commit/file digests, target revisions and requirement mappings. CI uploads a fresh report; the normal core test chain includes the suite.

All three mappings stay partial. Complete offline installation/bootstrap, browser/native UI acceptance, actual device persistence/crash recovery, every network API, hosted authorization, rights clearance, every source-relationship editor and independent interoperability remain open. Editing a visible notice does not rewrite or authenticate a separate source relationship. These local authoring observations do not grant service access or clear rights. Producer declarations and specification lifecycle states remain unchanged.
