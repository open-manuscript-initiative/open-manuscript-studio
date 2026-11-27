# OMP volume metadata reconciliation (Preview)

An imported OMP volume with exact installation/press/submission/publication provenance exposes a separate volume metadata panel. Choose a personal OMP connection, inspect the exact native publication, select language and fields, and confirm one direction. Title, subtitle, abstract and keywords only; secondary-language title/subtitle are disabled where the local model cannot represent them. Existing chapter content, identifiers, series and other locales are not overwritten. Abstract transfer uses plain text. No automatic retries after uncertain writes; inspect the native publication.

The panel checks the common editorial capability projection before inspection. Older plugins receive an update message without a metadata request. The server rechecks the native capability for every operation; a capability advertisement never supplies object-level permission.

| Studio route under `/api/v1/integrations/connections/:connectionId` | Native contract | Purpose |
| --- | --- | --- |
| `editorial-capabilities` (GET) | `omi-publishing-editorial/1` | Explicit OMP profile and supported feature projection |
| `omp-workflow-status` (POST) | `omi-omp-workflow/1` | Read-only submission workflow, native series and work type |
| `omp-metadata` (POST) | `omi-omp-metadata/1` | Exact-identity inspection and confirmed selected-field writes |
| `chapter-page-range` (POST) | `omi-chapter-page-range/1` | Verified printed chapter labels with the inspected workflow token |

All routes require a session and an owned enabled personal connection. Native per-installation credentials remain server-side. OMP authorizes current object/stage access; metadata writes require current IDs, native edit permission, supported locale and exact state token. Studio validates receipts against installation/press/publication, selected locale/fields and before/after tokens. The OJS metadata/workflow routes reject OMP connections. Matching legacy paths use shared handlers and deprecation headers.

The checked OpenAPI snapshot is generated from the runtime DTOs with `npm run api:editorial:generate`. Client OMP request/response types refer to those DTOs. `npm run test:omp-editorial` covers volume/domain contracts, HTTP authorization, foreign/stale/missing receipts and the real native client's path/credential boundary. `e2e/omp-volume-metadata.spec.ts` exercises the browser panel with synthetic API fixtures. CI and Readiness include the contract/HTTP suite; regular browser CI includes the panel tests.

Requires the OMP plugin containing #32. Native production acceptance and release evidence are pending; OMP remains Preview. These tests do not promote OMP to Stable or certify the deployed plugin.
