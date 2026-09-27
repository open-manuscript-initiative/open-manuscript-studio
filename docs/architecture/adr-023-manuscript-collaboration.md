# ADR-023: Invitation-authorized manuscript collaboration

- Status: Accepted
- Date: 2026-09-27
- Supersedes: ADR-022 only for the boundary between the isolated sponsor demo and Studio collaboration. ADR-022 remains the policy for the synthetic demo. ADR-024 supersedes the production-disabled default in section 6, the matching consequence below, and the default-off deployment instructions in implementation step 4.

## Context

The Yjs sponsor demo proves concurrent editing and collaborator cursor labels, but it is intentionally disconnected from Studio accounts, manuscript storage, PostgreSQL, and workflow authorization. It cannot be reused as a real-manuscript collaboration backend.

The current general workspace invitation model is persisted in browser storage. It is not an authorization source. The server's existing invitations are scoped to editorial/review assignments and cannot grant general manuscript editing access. The editor is composed of multiple Tiptap sessions whose content is converted to and from the portable OMI manuscript model; the shared editor state must not silently become a replacement for that model or for the existing save/revision flow.

Studio 1.0 ADR-006 makes the portable OMI document/artifact and the explicit document session the persistence boundary. ADR-007 keeps editor undo session-local and revisions linear. Both records explicitly invite reconsideration when multi-writer editing becomes a stable requirement. This ADR supplies that decision for an opt-in collaboration preview.

## Decision

1. Add manuscript collaboration as an explicit, opt-in, server-authorized capability. Existing local and native editing, file save/open, OMI container contracts, API-v1 contracts, review authority, and OJS/OMP connector authority remain unchanged unless separately revised.
2. Studio identity remains the identity authority. The collaboration service receives a short-lived, single-purpose connection ticket minted by the authenticated Studio API. The ticket is bound to the authenticated user, document, role, expiry, and read/write capabilities. The synchronization service revalidates document membership and permissions; client-supplied names, emails, role claims, and room names never grant access.
3. Invitation lifecycle is server-owned and document-scoped. Invites have `pending`, `accepted`, `declined`, `revoked`, or `expired` states, a one-time high-entropy token stored only as a hash, an expiry, and an invited e-mail address. Acceptance requires an authenticated Studio account whose e-mail exactly matches the invitation. The invite can be accepted from its one-time e-mail link or from the authenticated Studio inbox; inbox responses contain no bearer token, and accept/decline by invitation ID rechecks the signed-in account's e-mail. E-mail is a notification/onboarding convenience, not the authorization source. Only `accepted` membership grants synchronization access. Revocation blocks new tickets and closes active sessions. A list of manuscript contributors or invited e-mail addresses is not membership.
4. The collaboration service is the authority for in-session concurrent edits and awareness. Awareness is ephemeral and may expose the account's approved display name and a deterministic session color to other authorized members. It is not an audit log, attribution history, or change-tracking record. No peer-review identity/anonymity policy is changed.
5. Yjs state is a recoverable collaboration replica/session, not the portable manuscript format, revision history, or peer-review record. A validated import from the current OMI document initializes a collaboration session. A validated export/checkpoint converts a stable collaborative editor projection back through the existing Tiptap-to-OMI boundary. OMI schema/container shape does not change. Import/export, explicit save, and revision creation keep their existing validators and release gates.
6. A server-side durable store is required before real manuscript content is admitted. The first adapter is local PostgreSQL, which is already a Studio backend dependency. Persistence tables and migrations are implementation details of the collaboration service; they do not add fields to the OMI file/container. Storage and transport contracts remain provider-neutral. The first deployment profile remains one VPS and is disabled unless explicitly configured. For this profile, Yjs snapshots are stored in PostgreSQL, the WebSocket listener runs in the API process on loopback port 3022, and the existing Plesk provisioning script can add `/collaboration/ws` to the vhost proxy block when an operator runs it manually. The GitHub deploy workflow does not run that provisioning script or enable the feature flag.
7. The collaboration service starts as a single-node profile. The PostgreSQL snapshot adapter survives process restarts, but the live document and awareness fanout are process-local. Running multiple API/WebSocket instances against this adapter is unsupported: a distributed profile needs a shared Yjs update/presence backplane, coordinated document ownership, and concurrency/recovery tests. Distributed queue/cache behavior requires separately tested adapters and must not be implied by the demo or this preview.
8. The first product slice supports accepted, authenticated collaborators editing the same manuscript text with Yjs awareness labels. It does not provide tracked changes, review comments, peer-review workflow transitions, or persistent per-author text attribution. Editorial/review assignments continue through their existing APIs.

## Alternatives considered

- Reuse the sponsor demo's shared code and synthetic room: rejected because it bypasses Studio identity, manuscript ownership, and durable per-document authorization.
- Treat the local workspace store as authorization: rejected because browser state is user-controlled and not shared reliably between devices.
- Make the entire Yjs update log the new OMI file format or revision history: rejected because that would change the portable contract and conflate editing convergence with semantic history.
- Persist only in process memory: rejected because a restart loses real manuscript edits and invitations.
- Enable distributed deployment on the first implementation: rejected because it would require cross-node document ownership, persistence/concurrency, presence fanout, deployment changes, and additional recovery tests.

## Consequences

- A relational migration and server authorization boundary are required before editor UI can connect to real documents.
- Accepted membership becomes the single access predicate for both REST handshakes and WebSocket document connections.
- Import/export must be serialized with collaborative state checkpoints and must preserve the current OMI validators and semantic node handling.
- Each implementation PR must include invitation and permission tests, synchronization recovery tests, relevant editor Playwright coverage, release-hardening/release-readiness gates, and an architecture-drift check. ADR-024 supersedes the original statement that production deployment configuration is not enabled automatically.

## Mergeable implementation PR sequence

This sequence records the original implementation plan. ADR-024 supersedes the default-off deployment instructions in step 4.

1. **Invitation and membership authority.** Add server-owned document membership and invitation state, authenticated invitation issue/inspect/accept/decline/revoke endpoints, verified-email binding, expiry/revocation behavior, and audit events. No Yjs connection or production enablement in this PR. Test pending invitations cannot read/write; accepted members receive only their granted scope; wrong-account, expired, replayed, revoked, and removed-member cases fail.
2. **Durable collaboration service.** Add a provider-neutral collaboration transport/persistence boundary, PostgreSQL local adapter, connection-ticket endpoint, per-document authorization, reconnect/recovery and revocation behavior. Keep a local single-node profile; document the manual Plesk WebSocket route while leaving production deploy defaults untouched. Test authorization, persistence round trips, process restart recovery, stale/revoked tickets, and concurrent joins.
3. **Studio editor adapter and opt-in entry point.** Map eligible Tiptap text sessions to Yjs without changing the OMI JSON/container AST; show pending/accepted collaborator state and presence labels; require explicit collaboration activation and accepted invitations. Preserve normal local/native edit path. Test multi-user text convergence, cursor labels, invitation accept path, offline/local mode, save/reopen/import/export and large-document performance.
4. **Release and deployment profile documentation.** Document opt-in single-VPS service settings, secrets, health checks, backups, migration/rollback, and later distributed prerequisites. Do not turn the feature on in production. A separately approved deployment change is needed to enable it.
