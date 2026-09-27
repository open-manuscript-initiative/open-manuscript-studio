# ADR-024: Enable manuscript collaboration in production

- Status: Accepted
- Date: 2026-09-27
- Supersedes: ADR-023 section 6 only. All other ADR-023 decisions remain in force.

## Context

Studio now has invitation-authorized manuscript collaboration with PostgreSQL-backed Yjs snapshots, connection tickets, role checks, reconnect recovery, and a production WebSocket listener. The feature has its own migrations and deployment route. Keeping the production API default disabled leaves the shipped editor and invitation flow unavailable after deployment, even though the server implementation and storage are present.

The current supported production profile is a single VPS. Its API process also hosts the collaboration WebSocket listener on loopback port 3022, and Plesk forwards `/collaboration/ws` to that listener. PostgreSQL remains authoritative for identity, invitations, memberships, and durable collaboration snapshots. Accepted invitation membership remains mandatory before a collaborator can access a manuscript.

## Decision

1. In `NODE_ENV=production`, manuscript collaboration is enabled by default. An explicit `MANUSCRIPT_COLLABORATION_ENABLED=false` remains an operator-controlled emergency switch. Development and test environments remain disabled unless explicitly enabled.
2. Production deploys must run the collaboration migrations and expose `/collaboration/ws` through the Plesk provisioning route before the editor can establish a WebSocket connection. The deploy workflow verifies that the API reports collaboration enabled. The root provisioning script remains a separate, explicit server setup action; the deployment workflow does not edit Plesk configuration.
3. Enabling the server capability does not grant manuscript access. Authors still invite an account, and the invitee must sign in with the matching account and accept before membership authorizes collaboration.
4. The supported production profile remains single-node. PostgreSQL snapshots survive API restarts, while live Yjs documents and awareness fanout remain process-local. Horizontal API/WebSocket scaling is unsupported until a shared update and presence backplane, document ownership coordination, and recovery tests are adopted.
5. The OMI schema/container contract, existing manuscript save/export validators, and review workflow authority remain unchanged.

## Consequences

- New production deployments expose the feature without a separate feature-flag activation step.
- Existing systemd environment files that explicitly contain `MANUSCRIPT_COLLABORATION_ENABLED=false` continue to override the production default and must be updated by the server operator.
- Operators can disable the feature explicitly if the WebSocket route or database dependency is unavailable.
- Deploy verification catches a disabled production API rather than silently serving an editor without collaboration.
