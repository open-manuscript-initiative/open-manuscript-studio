# Release-readiness evidence

The 1.0 release uses committed scope, automated evidence, and explicit manual
acceptance. Start with:

- [`evidence/1.0.0-rc.1/e1200268ad549c0a40ace8724715cd2405e9d03c/`](./evidence/1.0.0-rc.1/e1200268ad549c0a40ace8724715cd2405e9d03c/) for the operator's 4 November Windows/Android/web/PKP observations and the partially completed receipt (**not final release approval; full gates remain pending**);
- [`2026-11-04-rc1-final-acceptance.md`](./2026-11-04-rc1-final-acceptance.md) for automatic installer hashes/pending receipt preparation, Linux Preview scope, actual signature/update/recovery observations and final publication;
- [`1.0.0-rc.1.md`](./1.0.0-rc.1.md) for staged RC package identities and publication behavior (**unreleased; acceptance still required**);
- [`1.0-scope.md`](./1.0-scope.md) for Stable, Preview, and Experimental targets;
- [`1.0-blocker-policy.md`](./1.0-blocker-policy.md) for non-negotiable gates;
- [`readiness.config.json`](./readiness.config.json) for machine-readable checks.
- [`2026-11-03-rc1-acceptance-record.md`](./2026-11-03-rc1-acceptance-record.md) for the dated, evidence-linked RC1 GO/NO-GO acceptance record (**currently NO-GO; not a release authorization**).
- [`2026-11-03-rc1-final-operator-actions.md`](./2026-11-03-rc1-final-operator-actions.md) for the remaining #765/#271/#390 operator actions, signed updates, rollback and 13-gate RC1 sign-off (**no automatic GO**).

Run the local structural checks with:

```bash
npm run release:readiness -- --strict-local
```

Run the publication-output release gates with:

```bash
npm run test:jats-validation
npm run test:jats4r-profile
npm run test:vivliostyle-pdf
npm run test:publication-release
npm run test:web-publication
```

To generate the machine-readable and human-readable publication gate evidence:

```bash
npm run publication:release:gate -- \
  --strict \
  --json benchmark-results/publication-release.json \
  --markdown benchmark-results/publication-release.md
```

Create a synthetic DOCX and measure the complete import/editor pipeline with:

```bash
npm run benchmark:docx:generate -- \
  --output benchmark-results/synthetic-large.docx \
  --words 250000

npm run benchmark:docx -- \
  --input benchmark-results/synthetic-large.docx \
  --label synthetic-large \
  --json benchmark-results/synthetic-large.json \
  --assert-roundtrip
```

For a real manuscript, use a path outside the repository and omit `--label`.
The resulting identifier is then a short SHA-256 digest. The harness never
prints the file name, path, manuscript text, metadata, notes, or images.

The **1.0 Readiness** GitHub workflow runs the local checks, tests, web build,
server typecheck, JATS 1.4 DTD/JATS4R/conformance release gates, a real pinned
Vivliostyle PDF smoke render, three content-neutral DOCX benchmarks, SBOM
generation, and a SHA-256 evidence manifest. The artifact contains
`publication-release.json` and `publication-release.md` alongside the other
evidence. It is diagnostic evidence, not a release.
