# Reviewed audit-retention index migration: safe production rollout

**Date:** 2026-11-16  
**Applies to:** Open Manuscript Studio Plesk/systemd deployment, following merge of PR #922  
**Status:** Code change under review. This document is not evidence of a completed database backup or production migration.

## Why production deployment stopped

The merged PR #922 added the Prisma migration
`server/prisma/migrations/20261116110000_audit_retention_created_at_indexes/migration.sql`.
The production rollback preflight previously allowed **only** the pinned Android
closed-test signup migration. The production deploy therefore stopped before the
application upgrade with the correct fail-closed warning:

`Migration changes require a reviewed database backup and manual migration rollout`

The failed workflow's checkout was reset to the prior commit. Do **not**
work around the guard by running `prisma migrate deploy` by hand without a
database backup and operator-approved procedure.

## Reviewed change and safety boundary

The new migration adds only these three B-tree indexes on pre-existing
`created_at` columns, each using `CREATE INDEX IF NOT EXISTS`:

- `integration_audit_events_created_at_idx`
- `studio_module_audit_events_created_at_idx`
- `collaboration_audit_events_created_at_idx`

Its **pinned Git blob SHA-1** is
`34d086111c77bab71b3725ae99f1a531b703ed66`.
The previously approved Android signup migration remains pinned separately.
The deploy gate refuses edited SQL, deletions/renames of migrations, any added
unapproved Studio/Identity migration, and unrecognized pending Prisma migrations.
`reviewed-migration-status.mjs` now allows only an explicitly reviewed subset
of the two named migrations to be pending. Database divergence must be
investigated manually.

The three index operations are additive to the schema, and the previous API
does not depend on them. **They can still take table locks while being built**;
for large or heavily written tables, arrange a maintenance window and assess
the impact before approving deployment. The gate does not certify that index
creation will be non-blocking. An operator may instead choose a dedicated
manually managed online-index rollout after assessing PostgreSQL transaction
limitations; do not edit the already-published migration file.

## Required operator acceptance

1. Confirm that the previous API is healthy and the live checkout is still at
   its prior tested revision. Never interpret a red deploy as success.
2. Confirm the SQL, exact Git blob SHA and the list of migrations pending in
   both Studio and Identity PostgreSQL schemas. Unrelated pending migrations
   are a deployment blocker.
3. Confirm backup capacity, the two correctly configured DB connections,
   PostgreSQL `pg_dump`/`pg_restore` binaries, access controls and available
   maintenance time. The pre-deploy helper runs two private custom-format
   `pg_dump` exports, verifies their archives via `pg_restore`, and writes
   checksums and a manifest before touching runtime binaries.
4. **Review the backup manifest.** Its `restoreWasTested: false` field
   explicitly means decompression checks are not a full database restore
   drill. Keep existing off-host backups and test actual restores according
   to the operational recovery plan. Do not claim otherwise.
5. After CI and human acceptance, merge the corrective PR. The standard
   `.github/workflows/ci.yml` deploy calls
   `scripts/production-rollback.sh snapshot` before Prisma migration.
   Any failed snapshot blocks deployment; the site checkout reverts to the
   prior revision. Successful backups live in the protected
   `$HOME/.omi-studio-rollbacks/<run>-<sha>/database/` directory.
6. After a successful rollout, verify `prisma migrate status` for both
   schemas, the public API health, privacy notice, audit dry-run
   (`npm run privacy:cleanup`) and the full workflow status.
   Do **not** automatically enable audit record purging: the optional
   systemd timer requires its separate data-retention/legal approval.
7. If a deployment after migration fails, the automatic rollback restores
   web/API binaries and previous Node dependencies **without restoring the
   PostgreSQL database**. The added indexes are backward compatible with
   previous application code; a DB rollback is a separate human-reviewed
   disaster-recovery operation, never automatic.

This procedure **does not bypass the database-backup gate**, does not modify
production from GitHub alone, and does not show that production data was
backed up until the successful deployment log confirms it.
