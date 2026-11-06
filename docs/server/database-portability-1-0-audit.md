# Database portability audit — 1.0 release boundary

Status: **audit / planning only**. PostgreSQL remains the **only supported backend for 1.0**. This document does not certify MariaDB compatibility.

## Scope and evidence (default branch, 2026-11-06)

- Both Prisma schemas (`server/prisma/schema.prisma`, `server/prisma/identity/schema.prisma`) declare `provider = "postgresql"`. The application and identity databases must be assessed separately.
- Both client entrypoints (`server/src/lib/prisma.ts`, `server/src/lib/identityPrisma.ts`) instantiate `@prisma/adapter-pg` directly; the connection strings are `DATABASE_URL` and `IDENTITY_DATABASE_URL`.
- PostgreSQL-specific schema types include `@db.Uuid`, `@db.JsonB`, and `@db.Timestamptz`. Portability requires explicit data-model and migration decisions, not just a different connection URL.
- Raw SQL exists outside repositories, including `server/src/routes/agentReviewRoutes.ts`, `server/src/routes/authorSignatureRoutes.ts`, `server/src/integrations/ojs/reviewWriteback.ts`, and `server/src/integrations/omp/nativeContext.ts`. PostgreSQL casts such as `::uuid` and `ON CONFLICT` are migration concerns.
- `server/src/repositories/euroOfficeRepository.ts` uses transactional row locking (`SELECT ... FOR UPDATE`). The concurrency and idempotency semantics must be tested on any additional backend.
- Existing repository modules under `server/src/repositories/` are a useful seam but **do not** currently isolate all database access.
- Existing PostgreSQL-specific tests include `tests/server-registry.postgres.test.mjs` and `tests/integration-state.postgres.test.mjs`.

These are confirmed examples, **not an exhaustive inventory**. Before implementing another backend, run a full source-wide static inventory and review generated SQL/migrations.

## 1.0 decision / release gate

**Do not introduce MariaDB dependencies, dual-database migrations, a new provider selector, or a cross-cutting repository rewrite before 1.0.**

Safe optional preparatory changes are limited to small, independently reviewed, behavior-preserving refactors around existing PostgreSQL client boundaries. They must:
1. Preserve existing PostgreSQL schemas, migration history, SQL semantics, public API responses, authentication, and transaction behavior.
2. Avoid new runtime flags or database provider auto-detection.
3. Pass existing CI, PostgreSQL integration tests, security checks, and deployment/rollback acceptance.
4. Be reverted or deferred if they threaten the 1.0 release timeline.

This audit is documentation-only and imposes **no new 1.0 blocker**.

## Post-1.0 workstream: MariaDB

1. Complete a codebase-wide inventory of raw SQL, database-specific Prisma types, migrations, indexing, JSON semantics, locking, upserts, and connection lifecycle.
2. Define persistence contracts at meaningful domain boundaries; do not build a speculative generic ORM wrapper.
3. Design distinct Prisma schema/migration tracks and supported adapter selection for application and identity databases.
4. Test migrations, fresh installs, backups/restores, auth and sessions, document save/import/export, collaborative edits, OJS/OMP integrations, and concurrent writes against both databases.
5. Add a dedicated MariaDB CI matrix and explicit operator documentation; only then label MariaDB supported.

## Demonstration environments

- `demo.openmanuscript.org`: personal author demonstration, PostgreSQL for 1.0.
- `institutional-demo.openmanuscript.org`: institutional demonstration, PostgreSQL for 1.0.
- `staging.openmanuscript.org`: RC and security acceptance; keep isolated.
- Production: unchanged.

Do not repurpose a demo as a MariaDB acceptance environment until the backend and its test gates exist. All environments require isolated storage, database credentials, sessions and integration secrets.
