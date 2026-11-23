# EuroOffice separation: deployment checklist

The owner confirmed there are no production files in the former embedded Office workspace, only experiments. There is no production DOCX migration in this change. Still, create a normal PostgreSQL backup before deploying.

1. Merge only after the Studio TypeScript/server builds, security checks, DOCX import/export tests and web/mobile acceptance tests pass.
2. Deploy the Studio API and web frontend from the same revision. The Office routes are absent from the active Express application; the old `EUROOFFICE_URL`/`EUROOFFICE_JWT_SECRET` variables are no longer needed by Studio. Remove them **only from the Studio API environment**, not from the separate Office service.
3. Ensure `/api/v1/eurooffice/status`, `/api/v1/eurooffice/documents` and `/api/v1/eurooffice/embed-host` return 404. Confirm no Office action appears in Studio's New Document menu.
4. Test OMI study/volume creation, DOCX import on web and Android, export, scholarly notes, print publication, OJS and OMP publication, and authentication.
5. Build/install new signed Windows and Android releases as appropriate: installed binaries have bundled frontend assets; a web deployment alone will not remove old Office screens from existing installations.
6. Verify the separate Office service directly at its own endpoint (create/edit/save/reopen one test document), with independent backups, updates, credentials and access controls.
7. Do not run an automatic `DROP TABLE` migration or delete the `plain_documents`/`euro_office_*` data until a subsequent explicit inventory and retention decision.

**Rollback:** use the existing Studio VPS/Plesk snapshot and restore a matching API and frontend revision. Existing database tables were not changed. Re-enabling the old embedded editor requires reverting code and separately reviewing the previous Office settings; simply adding environment variables to this version does not re-enable the route.

**Deferred cleanup:** remove the dormant legacy Office server modules, schema and obsolete integration test fixtures in a separate audited PR, after checking all installations for unexpectedly valuable files. The separate EuroOffice container is outside this repository's deployment scope.