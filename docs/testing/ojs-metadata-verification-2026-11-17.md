# OJS metadata reconciliation verification — 2026-11-17

Scope: selected metadata transfer, personal-credential proxy, native permission
and optimistic concurrency checks. Companion plugin source: 1.8.0.0.

| Check | Local result |
| --- | --- |
| Full `npm run lint` including new tests | PASS |
| Client `tsc --noEmit` and production `npm run build` | PASS |
| Server `tsc -p server/tsconfig.json` | PASS |
| Pure selective metadata model | 6 tests PASS |
| Store checkpoint, reopen/revert, concurrent edit, no-op | 3 tests PASS |
| Publication/workflow/metadata HTTP proxy | 8 tests PASS |
| Publication HTML/artifact model regression | 8 tests PASS |
| Plugin PHP contract scripts | All 9 scripts PASS |
| Changed plugin implementation syntax | PASS |
| Browser interaction | NOT RUN: local Chromium cannot create its process singleton socket |
| Real OJS 3.5 repository/DB/notification integration | NOT RUN |

The build reports existing large-chunk and mixed dynamic/static import warnings.
Generated returned-translation changes from prebuild are not part of this change.

PHP contracts ran with the available PHP WASM CLI; CI retains native PHP
8.2/8.3/8.4 coverage. Repository doubles verify the controller's sequencing and
rejections, not PKP runtime certification. Follow `../ojs-metadata-reconciliation.md`
for the disposable real OJS two-session acceptance run. This evidence is not a
release approval, deployment or complete workflow certification.
