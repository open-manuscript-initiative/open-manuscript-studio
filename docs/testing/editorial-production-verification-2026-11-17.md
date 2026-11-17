# Editorial production verification — 2026-11-17

Implementation base: Studio `20cb07bf9bccd012a7f43e00227067780cf5e2bb`;
OJS connector `6dfdc4b67bd74539423455680630c00866c6406f`.
All inputs in these tests are synthetic. No production submission was created,
no live database migration was applied, and no article was published.

| Check | Local result | What this establishes |
| --- | --- | --- |
| Client TypeScript / Vite build | PASS | Updated client compiles and bundles |
| Server TypeScript | PASS | API and generated Prisma contracts compile |
| Prisma schema validation | PASS | Additive production models are valid |
| ESLint on changed implementation files | PASS | Changed code meets repository lint rules |
| Production domain / native workflow suite | 20 PASS | 7 transition behavior tests and 13 existing native-workflow contract checks |
| Production, publication proxy and web delivery HTTP/service suite | 16 PASS | Authorization, exact proof bytes, stale versions, transactional source promotion/rollback, revocation, native readiness and OJS refresh behavior |
| Publication/review/role regressions | 30 PASS | Existing publication-build, artifact, assurance, peer-review and role behavior |
| Semantic core boundary gate | 6 PASS | The semantic core does not gain UI/store/native/network runtime dependencies |
| OJS workflow snapshot PHP test | PASS | Selected projection/token stability and private-field exclusion |
| OJS artifact controller PHP contract | PASS | Native editorial access and metadata-change rejection before and during locked persistence |
| Browser production scenario | ENVIRONMENT BLOCKED | Chromium failed before application load: process singleton socket operation not permitted |
| Production PostgreSQL migration test | NOT RUN LOCALLY | Added to the existing PostgreSQL CI gate; a real test database is required |
| Real OJS submission → two review rounds → publication | NOT RUN | Requires a disposable OJS installation and distinct test accounts |

The PHP contracts were run using the available PHP.wasm CLI. Native PHP
8.2/8.3/8.4 and PKP compatibility CI remain separate checks. Existing build
warnings about chunk size/dynamic imports remain; the build completed.

The browser scenario is committed as `e2e/editorial-production.spec.ts` and is
included in the normal Playwright CI suite. Its local failure is not an
application assertion failure and is not recorded as a pass. The exact additive
migration is exercised by `tests/editorial-production.postgres.test.mjs` in the
isolated PostgreSQL CI job. CI results must be attached to the PR before claiming
those gates passed.

See `../editorial-workflow-priorities.md` for the remaining real OJS acceptance
steps and connector work. These results do not certify full OJS workflow parity,
turn Preview into stable, or authorize production migration/publication.
