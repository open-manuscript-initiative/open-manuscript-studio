# JATS 1.4 conformance matrix

Open Manuscript Studio targets **NISO JATS 1.4 Article Authoring** with the
**MathML 3** DTD. The matrix describes the OMI-to-JATS subset that Studio
intentionally supports. It is not a claim that Studio implements every element
or attribute permitted by JATS.

The machine-readable source of truth is
`src/model/jatsConformance.ts`. CI verifies that every listed capability has
repository test evidence and that release-blocking fallbacks have a detectable
diagnostic.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| Stable | Studio has an intentional semantic mapping and release evidence for the construct. |
| Conditional | The mapping is supported under documented constraints. |
| Fallback | Studio preserves some information, but the result is not publication-release quality. |
| Unsupported | No supported semantic mapping is claimed. |

A broad DTD can accept XML that has lost source semantics. For that reason,
**DTD validity is necessary but not sufficient** for a publication release.
A release must also pass the semantic-fidelity gate.

## Conformance matrix

| Capability | OMI semantic source | JATS mapping | Status | Release policy |
| --- | --- | --- | --- | --- |
| Article Authoring shell | Committed scholarly manuscript | `article/front/body/back`, `processing-meta` | Stable | Required |
| Title and subtitle | Title metadata | `title-group/article-title/subtitle` | Stable | Required |
| Contributors and ORCID | Public author contributions | `contrib-group/contrib/name/contrib-id/role` | Stable | Required |
| Affiliations and ROR | Public affiliation assertions | `contrib/aff` plus organization `ext-link` | Conditional | Required |
| Abstract, keywords, language | Publication metadata | `abstract`, `kwd-group`, `content-language` | Stable | Required |
| Section hierarchy and paragraphs | Semantic sections and text blocks | Nested `sec/title/p` | Stable | Required |
| Lists, quotations and code | Structured rich-text blocks | `list`, `disp-quote`, `preformat` | Stable | Required |
| Inline semantics | Bold, italic, strike, underline, small caps, code, super/subscript | `bold`, `italic`, `strike`, `underline`, `sc`, `monospace`, `sup`, `sub` | Stable | Required |
| Inline language and links | Language marks and safe external links | `named-content@xml:lang`, `ext-link` | Stable | Required |
| Unknown inline marks | Future/unknown inline semantics | Text preserved, mark omitted | Fallback | Blocks release when used |
| Citations and bibliography | Semantic citation occurrences and records | `xref@ref-type=bibr`, `ref-list/element-citation` | Conditional | Required |
| Internal cross-references | Sections, figures, tables, equations | Typed `xref@rid` | Stable | Required |
| Plain-text scholarly notes | Note annotations | `xref@ref-type=fn`, `fn-group/fn` | Conditional | Required |
| Rich note content and note citations | Rich note body | Plain-text note projection | Fallback | Blocks release when used |
| Figures | Image, caption, alt text | `fig/caption/graphic/alt-text` | Conditional | Blocks release for missing/data-URI media |
| Tables | Structured cell matrix | `table-wrap` with XHTML table model | Stable | Required |
| Equations | LaTeX or safe MathML | `disp-formula` with MathML 3 | Conditional | Blocks release on text/unsafe fallback |
| Charts | Structured chart data | `fig/media` with OMI chart JSON | Fallback | Blocks release |
| Music scores | MusicXML/MIDI semantic block | Textual note-sequence `fig` fallback | Fallback | Blocks release |
| Unknown rich-text blocks | Unknown block node | Flattened `p` | Fallback | Blocks release |
| Full schema validation | Generated JATS | Pinned JATS 1.4 Article Authoring MathML 3 DTD | Stable | Required |
| Build provenance | Committed revision + artifact | `<artifact>.omi-build.json` | Stable | Required |

## Release-blocking fallback diagnostics

The following diagnostics are intentionally stronger than ordinary renderer
warnings. A document may still be previewed and inspected, but Studio will not
deliver it as a publication-release JATS artifact until these conditions are
resolved:

- `unsupported-inline-mark`
- `jats-note-rich-text-fallback`
- `jats-note-citations-fallback`
- `missing-image-source`
- `embedded-image-data-uri`
- `equation-representation-fallback`
- `unsafe-or-unsupported-mathml`
- `chart-semantic-media`
- `music-score-semantic-fallback`
- `unsupported-rich-text-block`

Ordinary publication-profile warnings, such as a recommended-but-missing ORCID,
do not automatically become JATS conformance blockers. Profile requirements
that are configured as mandatory already surface as renderer errors and fail a
separate release gate.

## Mandatory publication release gates

A JATS artifact is releasable only when all of these gates pass:

1. **Renderer diagnostics** — no error-level renderer/publication-profile
   diagnostics.
2. **Semantic fidelity** — no active diagnostic owned by a
   `blocks-on-use` conformance capability.
3. **JATS4R publication profile** — the generated XML passes the pinned,
   offline reuse-oriented profile for Studio's Article Authoring output.
4. **Pinned target** — validation evidence identifies JATS 1.4 Article
   Authoring, DTD, MathML 3.
5. **DTD validation** — the exact generated XML passes the pinned offline DTD.
6. **Build provenance** — the artifact is delivered with a publication-build
   sidecar tied to the committed head revision.

The first five gates run before JATS delivery. The provenance sidecar is created
from the exact released bytes and is part of the same export workflow.

## Privacy boundary

Only publication-facing semantic data is eligible for JATS. In particular,
review comments, editorial annotations and other non-note annotations are not
serialized into `fn-group`. Contributor identity output continues to use only
public contribution/name/identifier/affiliation assertions.

## CI and 1.0 release evidence

The primary CI pipeline must pass:

```text
npm test
npm run test:jats-validation
npm run test:jats4r-profile
npm run test:publication-release
```

The 1.0 readiness workflow also writes
`publication-release.json` and `publication-release.md` into its evidence
artifact. The release-gate report verifies matrix consistency, test-evidence
paths, workflow enforcement and both runtime JATS export boundaries.
