# One-time reviewed Android closed-test migration – Plesk production

This procedure repairs the production deployment that stopped on 9 November 2026 at
`server/prisma/migrations/20261109060000_android_closed_test_signups/migration.sql`.
The blocked run was **CI/CD #3659**: the build and tests were successful, but the
production rollback gate intentionally refused a new database migration and returned
the server checkout to `5351faf9`.

## Exactly what the exception permits

`scripts/production-rollback.sh` now admits **only** a *newly added*
`server/prisma/migrations/20261109060000_android_closed_test_signups/migration.sql`
file whose Git blob hash equals the explicitly reviewed source
`dfc5ee96dc2cbc9bf2d1622ce494bd5b133e0bba`.
This migration **only creates** the applicant table and its index, without changing
existing tables. Any other migration (including identity schema migrations, SQL
modifications, deletes or multiple migrations) remains a hard stop.

Before Prisma deploy, the SSH deploy job must complete both:
1. A private, validated custom-format `pg_dump` of the **Studio** database.
2. A private, validated custom-format `pg_dump` of the **identity** database.

These use `DATABASE_URL` and `IDENTITY_DATABASE_URL` from the
deployed server environment / `server/.env`. The password goes to the
PostgreSQL child process via `PGPASSWORD` and never appears in argv,
the logs or the backup manifest. Node 24 and matching `pg_dump` /
`pg_restore` must be available on the Plesk deployment account.

Backups are written with restrictive permissions under
`$HOME/.omi-studio-rollbacks/<run-id>-<SHA>/database/`, with
`studio.dump`, `identity.dump`, and a manifest of
sizes and SHA-256 checksums. The archives are checked with
`pg_restore --list` and a decompression-only SQL rendering to
`/dev/null`. **This is not a full test restore.**

If **any** backup fails, the snapshot is not marked complete, no Prisma migration
runs, and the workflow restores the previous Git checkout. The operator must not
override this gate to deploy.

## Approval and operational checks

- The existing 8 November full server backup and other database backups were
  reported by the operator; their restore usability was **not independently
  verified in this change**. Keep the existing protected backup.
- Before the first live rollout, the operator must ensure PostgreSQL client tools
  are available to the **SSH deployment account** and that both configured
  application users have sufficient backup permissions. A failed backup
  safely blocks the rollout.
- Review the PR, confirm no extra migrations were added, and allow CI tests
  and GitHub security checks to complete.
- Merge after approval. The existing GitHub Actions main deployment will take
  new fresh DB backups; **do not run the old** `/var/www/vhosts/openmanuscript.org/studio/deploy.sh`
  because it resets the checkout and has no comparable DB snapshot gate.
- After deployment verify:
  - `sudo systemctl is-active omi-studio-api.service` returns `active`.
  - `curl -fsS https://studio.openmanuscript.org/api/health` succeeds.
  - An anonymous POST with invalid JSON (`'{}'`) to
    `/api/public/android-test/signups` returns HTTP **400**, not
    `401`, `404` or `503`.
  - The real signup sends one confirmation e-mail, does not grant Google Play
    entitlement automatically, and the withdrawal link is usable.
  - User login, OJS/OMP connections, collaboration and document opening work.
- Backups are sensitive data: keep snapshots access-restricted, arrange an
  encrypted/off-host copy in the institution's approved EU backup system and
  apply a documented retention period. Do not post backups or URLs in issues.

## Rollback semantics

The existing rollback restores **the previous code, published web files and
server runtime dependencies**, but **never** automatically restores PostgreSQL
after the application has restarted. The new applicant table is backwards
compatible with the old Studio version; keeping it avoids destroying signups
or changes made during a failed deployment.

The snapshots include pre-migration PostgreSQL archives for a **separately
reviewed/manual disaster recovery**, not an automatic database rewind.
If a different or destructive migration is introduced, this one-time
exception does not apply. Such a migration needs its own reviewed plan and
recovery exercise.

## Regression tests

`node --check scripts/backup-reviewed-migration.mjs`
and `node --test tests/production-rollback.test.mjs` verify
the additive allowlist, successful private backups, missing backup utility
failure, tampered SQL failure, and an additional identity migration failure.
No production database is accessed by these tests.
