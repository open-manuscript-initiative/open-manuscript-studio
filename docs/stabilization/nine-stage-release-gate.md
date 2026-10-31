# OMI Studio — nine-stage stabilization and version-bump gate

Owner-approved sequence (2026-10-31). This is a **release-management
checklist**, not a declaration of OMI-SPEC conformance or an automated CI
release lock. The normative register still governs standards maturity.

| Stage | Models | Implementation work | Stage completed? |
| --- | --- | --- | --- |
| 1 | 000, 120, 100, 140 | Core review: [#786](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/786); fixture/independent review gaps documented | Not certified |
| 2 | 150, 110, 130 | Nested anchors, notes, citations: [#788](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/788) merged, CI succeeded | Review gates still apply |
| 3 | 160, 180 | History and validation isolation: [#789](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/789), merged with green CI | Independent review / release-level evidence still required |
| 4 | 220, 210, 221, 225 | Bibliographic identity, citations, reference library and sources: [#790](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/790), merged with green CI | Independent review / release-level evidence still required |
| 5 | 320, 330 | Portable file format and container: [#791](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/791), merged with green CI | Independent review / release-level evidence still required |
| 6 | 190, 170, 200 | Collaboration, translation, review: [#792](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/792), merged with green CI | Independent review / release-level evidence still required |
| 7 | 240, 230 | Rendering and publication: [#793](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/793), merged with green CI | Independent review / release-level evidence still required |
| 8 | 340 | Import and export: [#794](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/794), [phase 8 evidence](spec-340-phase8.md) | Merged with green CI; independent interoperability and release acceptance still required |
| 9 | 350, then 300, 310 | Capability/conformance, plugins and API: [#795](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/795), [phase 9 evidence](spec-350-300-310-phase9.md) | Draft PR; CI and independent review/acceptance pending |

## Explicit version hold

**Do not increase Studio's application version or generate new public app
releases solely because an individual stabilization PR merges.** The
release/version-bump action is deferred until all nine phases have been
reviewed, regression-tested and accepted, with required workflows green,
remaining critical issues resolved or explicitly disclosed, and manual
platform/export/privacy checks recorded.

Before a version increase, verify the current version against `package.json`,
`package-lock.json`, `src-tauri/tauri.conf.json`, mobile build numbers,
README and website release pages. Release approval must record the
exact merged main commit and explicit user authorization.

Each phase follows: reconcile normative requirements → create
version-pinned positive and negative fixtures → verify Studio implementation
→ public and independent review → lifecycle or capability-claim decision.
A green Studio CI run is necessary but not sufficient for conformance
or standards maturity; Draft stays Draft absent separate approval.

This document must be updated as each phase closes. An open PR is not
completion evidence. No background or autonomous version bump is implied.
