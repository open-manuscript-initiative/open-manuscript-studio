# JATS4R publication profile

Open Manuscript Studio applies an offline JATS4R publication profile after its
own semantic-conformance checks and before a JATS artifact is released.

## Why this is a separate gate

The JATS 1.4 DTD answers whether the XML is structurally legal for the selected
tag set. The OMI conformance matrix answers whether Studio preserved the
manuscript semantics it claims to support. JATS4R adds a third question:
whether the JATS follows reuse-oriented community best practices.

These checks are complementary. A document can be valid against the JATS DTD
and still violate a JATS4R recommendation.

## Upstream basis

The Studio profile is versioned independently as
`jats4r@1.0.0` and is traced to:

- repository: `JATS4R/jats-schematrons`;
- upstream Schematron version: `v0.0.17`;
- profile scope: `omi-article-authoring-baseline`.

Version `0.0.17` is also the JATS4R Schematron version pinned by the official
`JATS4R/jats-validator-docker` image inspected when this profile was created.

Studio does **not** claim that its local validator is a complete implementation
of every rule in the official JATS4R Schematron suite. It implements and pins
the subset relevant to the JATS Article Authoring surface that Studio currently
emits. Each diagnostic names the upstream Schematron category from which the
rule was derived.

## Offline validation

Validation runs locally in Studio. Manuscript XML is not sent to the public
JATS4R validation service. This preserves unpublished-manuscript privacy and
makes CI/release evidence deterministic.

The current profile covers:

- abstracts and translated-abstract language;
- accessibility of figures, tables, sections, links and formulae;
- contributor and affiliation identifiers;
- structured bibliographic citations and data citations;
- keyword-group reuse warnings;
- mathematical expression wrappers and representations;
- permissions, copyright and canonical licence metadata;
- object language tags.

Errors are publication-release blockers. Warnings and informational findings
are surfaced to the user but do not alone prevent export.

## Renderer changes for reuse

The JATS renderer now emits several structures needed by the profile:

- a top-level `permissions` element in `article-meta`;
- `copyright-year`, `copyright-holder`, licence text and canonical
  `ali:license_ref` where manuscript metadata provides them;
- explicit `institution` markup inside affiliations;
- descriptive ROR and reference links.

No copyright or licence values are fabricated. Data-availability statements
are intentionally not mapped to the JATS4R-recommended
`back/sec[@sec-type='data-availability']` in this profile because the pinned
JATS 1.4 **Article Authoring** DTD does not permit `sec` directly in
`back`. That rule belongs to a later Publishing/downstream profile rather
than being emitted as DTD-invalid XML. When none are present,
`<permissions/>` is emitted because JATS4R requires the wrapper but does not
require Studio to invent rights assertions.

## Publication release order

A released JATS artifact must pass:

1. renderer/profile diagnostics;
2. OMI semantic-fidelity gate;
3. JATS4R publication profile;
4. pinned JATS 1.4 Article Authoring / MathML 3 target check;
5. full offline DTD validation;
6. publication-build provenance sidecar creation.

The dedicated JATS export panel and the general export panel use the same gate.

## Profile framework

`src/model/jatsPublicationProfiles.ts` reserves profile identifiers for later
downstream constraints:

- `jats4r` — implemented in this phase;
- `crossref` — planned;
- `pmc` — planned;
- `ojs` — planned;
- `custom` — planned publisher-defined rules.

These future profiles should compose with the existing DTD, semantic-fidelity
and provenance gates instead of replacing them.

## Verification

Run:

```bash
npm run test:jats-validation
npm run test:jats4r-profile
npm run test:publication-release
```

The 1.0 Readiness workflow records the JATS4R profile definition as part of the
publication-release evidence and requires the profile test to pass.
