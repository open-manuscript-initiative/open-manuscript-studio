# ADR-032: Separate EuroOffice from OMI Studio

**Decision date:** 2026-11-23. **Status:** implemented on development branch; release validation pending.

## Decision

OMI Studio is a scholarly editing, structured manuscript and publication platform. EuroOffice is a general-purpose document editor. Their UI, deployment, update cycle, authentication and document storage must not be coupled. EuroOffice may continue at its own service origin, but Studio will not embed its DocsAPI iframe or act as its document store.

The owner confirmed that the former integrated Office workspace contains **only experimental test documents**, not production files. The change therefore needs no production-data migration.

## Implementation boundary

- Remove Office creation from the Studio New Document menu and remove `PlainDocumentWorkspace`, `EuroOfficeIsolatedFrame`, their recovery UI and the legacy archive UI. Neither web nor native Studio loads a remote Office script.
- Unregister `euroOfficeRouter` from the Express app. Former `/api/v1/eurooffice/*` and `/api/v1/integrations/eurooffice/*` endpoints are no longer exposed. Setting previous EuroOffice environment values cannot re-enable them.
- Remove Office variables from new-install environment examples and current institutional setup guidance. Retire Office-specific E2E testing from Studio CI.
- Preserve native OMI DOCX/ODT import/export, manuscript editing, structured notes, pagination, publishing and OJS/OMP integrations independently.
- Retain old back-end Office bridge source and Prisma schema temporarily for audited rollback and later cleanup. These modules are not registered with the running app. **No table is dropped and no existing document bytes are migrated or deleted** by this PR.

## Future integration contract

Any future Office-to-OMI exchange must be an optional, independently versioned connector. It must require user intent, explicit ownership, secure file transfer, semantic import review and provenance handling. For now, exchange is by user-initiated download and import of a DOCX file. The Office service operates independently and is not part of Studio's release gate.

## Deployment

Deploy Studio API and frontend from the same commit. Rebuild and distribute the native apps, which otherwise retain old bundled UI assets. Verify Office API routes return 404, native DOCX importing works on Android and desktop, OMI study/volume creation works, and normal OJS/OMP workflows are unaffected. Test the standalone Office service separately.

If unexpectedly discovering valuable old Office content, keep the database and backups intact and export through a reviewed isolated migration before deleting the retired schema. See [operator runbook](../server/eurooffice-separation-runbook.md).