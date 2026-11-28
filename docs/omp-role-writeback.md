# Returning OMP editorial tasks

This change extends the OJS role-return implementation to OMP. Install the matching **unreleased omi-omp-plugin role-writeback change** before using it. Older plugins produce a visible transfer failure and retain retry access; Studio does not fall back to an apparent successful comments-only return. The existing OJS/translation migrations from Studio #1104/#1105 are required. No additional database migration is introduced: the historical `ojs_review_writeback_contexts` and review-form tables hold assignment-scoped context for both providers.

The OMP editor handoff now opens **Participants and assignments** with native press reviewer/assistant candidates. Scientific reviewers, language reviewers and translators can be assigned and reconnected from there. OMP grants, route paths and workspace IDs are provider-specific; an OJS grant cannot authorize an OMP request. The shared lifecycle/profile implementation keeps directional translator pairs isolated and opens profile setup when needed.

Scientific review returns a Word document with real comments plus an exact structured public snapshot. Confidential comments remain separate. Scientific submission closes Studio manuscript/form access; a successful atomic native return also completes the OMP assignment. Return errors and retries remain available without reopening the manuscript. Direct native reviewer launches retain their assigned chapter and review-round context. OMP supports both internal and external rounds and only advertises native recommendation IDs where supported.

Language review and translation use open collaboration until the editor selects **Accept and complete work**. Completion requires a successful return receipt and fresh native editorial authorization. A conditional update rejects concurrent working revisions. All existing manuscript access endpoints then refuse the completed participant task. The same completion control is also available for OJS tasks through the shared panel.

Translations always require the title, abstract and keywords. They update only the target locale of the current unpublished volume publication. Full manuscript translation is required only for an actual or planned full-text publication language, not merely because a metadata locale is enabled. Metadata-only return sends no source document. Chapter-only metadata translation is not included because native OMP chapter metadata has no keyword field; the existing editor launcher assigns volume metadata work.

OMP source reopening excludes translations in another language and reviewer-only attachments, selects the latest eligible source-language workflow revision (including internal review stage 20), and restores its paired snapshot for exact public comment IDs/status. The selected source file and sidecar must belong to the same stage and chapter and remain on the registered installation origin.

The separate requested shareable translator/language-reviewer work-accounting report is not present in OJS main at this change's baseline and is not implemented here. This ports the merged OJS role-writeback, access and language-policy changes (#1104/#1105 and plugin #57/#58).

Validation:

- `npm run test:ojs-role-writeback`: common role/access/profile regressions plus OMP atomic return, signed provider isolation, native-bound task creation/completion and real DOCX/snapshot source reopening.
- `npm run test:omp-editorial` and existing OMP native-client tests.
- Frontend/server TypeScript and changed-code ESLint.
- `e2e/omp-assignments.spec.ts`: synthetic native handoff at desktop/mobile widths, OMP labels/routes, assignment and completion. Run against the installed browser in CI.
- Matching plugin `php tests/role-writeback.php` and full PHP/contract suite. These isolated tests do not certify an installed native OMP deployment.

Deploy the two changes together, then verify one task per role on the real OMP installation, including failed transfer/retry, internal and external rounds, a metadata-only translation, full-text translation and editorial closure. No production system was accessed by this change.
