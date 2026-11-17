# Reviewed editorial-production migration rollout

Date: 2026-11-17. Applies to the Plesk/systemd production deployment after
Studio PR #929. This procedure and its automated tests are not evidence that
production was backed up or migrated.

## Deploy failure

The #929 merge passed build and PostgreSQL CI, but production stopped during
the rollback preflight, before runtime replacement and Prisma migration:
`Migration changes require a reviewed database backup and manual migration rollout`.
The checkout returned to the previous commit. Retrying that same commit does
not change its reviewed migration list.

## SQL review and compatibility

Exact migration: `server/prisma/migrations/20261116010000_add_editorial_production/migration.sql`.
Pinned Git blob: `421438c437b4000c083614b795567fde5813515d`.

The SQL creates `editorial_productions`, `editorial_production_files`, their
constraints and a file lookup index. It does not alter existing columns,
rewrite existing manuscript rows, grant permissions or publish submissions.
Its submission foreign key requires `native_editorial_submissions` to exist.
Cascade deletes concern only production rows/files attached to a deleted
submission; no existing submission is deleted by this migration. Creating the
foreign key can acquire a lock on the referenced table: choose a suitable
maintenance period and investigate any lock timeout or failed migration.

The old API can continue with these additional tables present. A failed rollout
restores previous code/runtime assets without dropping the new tables or
restoring databases over edits made by users. Database recovery is a separate
operator-reviewed operation.

## Protected rollout

1. Review this exact SQL and the corrective PR. The deployment helper adds only
   this hash-pinned migration to the existing reviewed list. Changed SQL,
   unrelated migrations and pending Identity changes still stop deployment.
2. Merge the corrective PR after its required CI passes. Its standard deploy
   checks both live Prisma migration histories, creates private custom-format
   backups of Studio and Identity, validates/decompresses both archives and
   records their SHA-256 checksums. No runtime update proceeds on backup failure.
   Existing PostgreSQL tools, configured connections and sufficient disk space
   are required. Do not bypass the preflight with a direct migrate command.
3. Confirm the log records successful backups and a complete runtime snapshot
   before `prisma:migrate:deploy`. Review the private manifest under
   `$HOME/.omi-studio-rollbacks/<run>-<sha>/database/manifest.json` on the server.
   `restoreWasTested: false` means archive validation is not a full restore drill.
   Maintain and exercise the existing off-host recovery plan separately.
4. Confirm both Prisma deploy commands, API/client builds and health checks
   succeed, and that the final GitHub production job is green. Reopen Studio
   from OJS using a fresh launch. An OJS HTTP 500 that persists still requires
   the OJS PHP error log; this migration does not establish its cause.
5. Verify native copyediting/proof approvals using distinct test accounts and
   perform the disposable real-OJS acceptance run before certifying the whole
   editorial workflow. The production workflow remains Preview.

Validation for this corrective change is recorded in its PR. PostgreSQL backup
utilities and Prisma status are simulated in the deployment contract tests;
these tests do not connect to live databases. The exact migration itself has
its separate PostgreSQL CI test in `tests/editorial-production.postgres.test.mjs`.
