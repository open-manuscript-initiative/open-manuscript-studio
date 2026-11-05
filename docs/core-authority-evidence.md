# Identity, rights and authorization boundary evidence — 2026-11-05

Twelve scenarios target OMI-SPEC-000@0.2.0 and OMI-SPEC-140@0.2.0. They provide **partial** observations for REQ-PRI-006 (scholarly metadata is not account/editorial authority), REQ-MET-008 (identity descriptions are not credentials), REQ-MET-009 (rights assertions are not service authorization) and REQ-PRI-013 (missing rights/provenance do not become permission or verified authorship).

The informative `studio-authority-boundaries-0.1` scope executes the real collaboration policy, connection-ticket service and federated-identity prerequisite helper from `server/src`, plus the real Studio identity/import/validation/JATS modules. Only the Prisma persistence port is replaced with an isolated in-memory test double. Ticket randomness, hashing, document/account scoping, role decisions, status checks, expiry and reauthorization execute as implemented. These are not live database, HTTP-route or WebSocket acceptance tests.

## Observed boundaries

- A portable author/editor/reviewer with a matching account identifier, synthetic verified ORCID and ROR affiliation neither creates an account session nor supplies server membership.
- Declared CC0/CC BY licence URLs, rights text and an opaque portable OWNER/approval claim do not issue a connection ticket without explicit scoped membership.
- A persisted VIEWER stays read-only after scholarly editor/rights changes. No collaboration role implies editorial publication approval, and unknown/administrative/scholarly role labels are rejected by the collaboration action policy.
- Membership is scoped to the authenticated principal supplied by the service caller and the exact document. A valid ticket for one document cannot authorize another.
- Revocation, account suspension and ticket expiry override the tested scholarly assertions. Current membership is rechecked during authorization and reauthorization.
- Missing rights remain absent on portable save/reopen and JATS generation; no licence/copyright holder is invented. Metadata inspection leaves missing provenance and self-asserted identity status unchanged. Neither observation supplies missing membership.
- The federated administrator prerequisite helper rejects scholarly ORCID/ROR/role labels, unverified email claims and a verified unrelated email. Only the narrowly defined stored OIDC/SAML verified matching-email evidence passes this prerequisite; it is not itself an administrator grant or signature verification.

The implemented boundaries pass these cases without a production-code change. An existing service membership may authorize an operation without establishing legal reuse rights; the tests keep those meanings separate. Synthetic verified identity fixtures are preservation inputs, not proof about actual people or institutions.

Run `npm run test:core-authority`. On a committed checkout, `npm run evidence:core-authority -- --report test-results/core-authority.json` runs the same cases and records commit, exact source hashes (including server modules), Draft targets, environment and mappings. The Node 24 test commands enable TypeScript transformation and experimental module mocking; no database credentials or deployed server are used. CI uploads fresh evidence and the regular core test chain includes the suite.

Every mapping stays partial. Live database/route acceptance, all authorization paths, real SSO signatures/identity ownership, complete institutional administrator provisioning, legal rights clearance, browser/native acceptance and independent interoperability remain open. Producer declarations and specification lifecycle states remain unchanged.
