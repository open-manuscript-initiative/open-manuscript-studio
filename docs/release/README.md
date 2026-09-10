# Release-readiness evidence

The 1.0 release uses committed scope, automated evidence, and explicit manual
acceptance. Start with:

- [`1.0-scope.md`](./1.0-scope.md) for Stable, Preview, and Experimental targets;
- [`1.0-blocker-policy.md`](./1.0-blocker-policy.md) for non-negotiable gates;
- [`readiness.config.json`](./readiness.config.json) for machine-readable checks.

Run the local structural checks with:

```bash
npm run release:readiness -- --strict-local
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
server typecheck, three content-neutral DOCX benchmarks, SBOM generation, and a
SHA-256 evidence manifest. Its artifact is diagnostic evidence, not a release.
