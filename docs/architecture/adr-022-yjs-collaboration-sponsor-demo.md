# ADR-022: Isolated Yjs collaboration sponsor demo

- Status: Proposed
- Date: 2026-09-27

## Context

A sponsor-facing demonstration can show concurrent editing. The first deployment must remain a synthetic, single-room prototype and must not imply production readiness for peer review or editorial workflows.

## Decision

Use Yjs with Hocuspocus as a separate application under demos/collaboration/. Issue a short-lived HMAC session token after a shared access-code check. Persist only the fixed synthetic room through an atomic local-file state adapter. Use loopback-only HTTP and WebSocket listeners behind the existing Plesk Nginx vhost.

Keep the demo isolated from Studio account identity, PostgreSQL, the canonical API, OMI schema/container contracts, manuscript import/export, and OJS/OMP connectors. Keep the single-VPS deployment as the first profile. Do not claim horizontal scaling.

## Consequences

- Existing Studio data paths and services remain independent.
- The demo can restart and recover the synthetic Yjs state on the same VPS.
- Multiple nodes are not supported: local-file state and in-process Hocuspocus document ownership are single-node.
- Production provisioning requires one root step; normal CI deploy gets only a narrowly scoped sidecar restart permission.
- Collaboration on real manuscripts requires a separate architecture/security ADR for identity, authorization, shared-state durability, recovery, and auditability.
