export const OMI_JATS_CONFORMANCE_MATRIX_VERSION = '1.0.0' as const;
export const OMI_JATS_CONFORMANCE_STANDARD = 'NISO JATS' as const;
export const OMI_JATS_CONFORMANCE_VERSION = '1.4' as const;
export const OMI_JATS_CONFORMANCE_TAG_SET = 'articleauthoring' as const;
export const OMI_JATS_CONFORMANCE_DTD =
  'JATS-articleauthoring1-4-mathml3.dtd' as const;
export const OMI_JATS_CONFORMANCE_RENDERER_VERSION =
  '0.1.0-alpha.1' as const;

export type JatsConformanceStatus =
  | 'stable'
  | 'conditional'
  | 'fallback'
  | 'unsupported';

export type JatsConformanceReleaseGate =
  | 'required'
  | 'advisory'
  | 'blocks-on-use';

export interface JatsConformanceCapability {
  id: string;
  area:
    | 'document'
    | 'front'
    | 'body'
    | 'inline'
    | 'objects'
    | 'references'
    | 'notes'
    | 'validation'
    | 'provenance';
  omi: string;
  jats: string;
  status: JatsConformanceStatus;
  releaseGate: JatsConformanceReleaseGate;
  notes: string;
  blockingDiagnostics?: readonly string[];
  evidence: readonly string[];
}

/**
 * OMI -> JATS coverage matrix.
 *
 * "Stable" means Studio intentionally maps the semantic construct and guards it
 * with release evidence. "Conditional" means the mapping is supported only
 * under the stated constraints. "Fallback" preserves some information but is
 * not publication-release quality. "Unsupported" must never be advertised as
 * supported merely because the resulting XML happens to validate against the
 * broad JATS DTD.
 */
export const OMI_JATS_CONFORMANCE_MATRIX: readonly JatsConformanceCapability[] = [
  {
    id: 'document.article-authoring-shell',
    area: 'document',
    omi: 'Committed OMI scholarly manuscript',
    jats: 'article/front/body/back + processing-meta',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Targets JATS 1.4 Article Authoring with the MathML 3 DTD.',
    evidence: ['tests/jats-export.test.ts', 'tests/jats-schema-validation.test.ts'],
  },
  {
    id: 'front.title-subtitle',
    area: 'front',
    omi: 'Title and optional subtitle',
    jats: 'article-meta/title-group/article-title + subtitle',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Title text is XML escaped and emitted in deterministic order.',
    evidence: ['tests/jats-export.test.ts'],
  },
  {
    id: 'front.contributors-identifiers',
    area: 'front',
    omi: 'Public author contributions, names, ORCID, roles',
    jats: 'contrib-group/contrib/name|string-name/contrib-id/role',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Only public contributor identity assertions are eligible for publication output.',
    evidence: ['tests/jats-export.test.ts', 'tests/publication-rendering.test.ts'],
  },
  {
    id: 'front.affiliations-ror',
    area: 'front',
    omi: 'Public affiliation assertions and optional ROR identifier',
    jats: 'contrib/aff with ext-link for the organization identifier',
    status: 'conditional',
    releaseGate: 'required',
    notes: 'Article Authoring placement rules are respected; only public affiliation data is emitted.',
    evidence: ['tests/jats-export.test.ts', 'tests/publication-rendering.test.ts'],
  },
  {
    id: 'front.abstract-keywords-language',
    area: 'front',
    omi: 'Abstract, keywords, manuscript locale',
    jats: 'abstract, kwd-group/kwd, content-language',
    status: 'stable',
    releaseGate: 'required',
    notes: 'An empty abstract element is emitted when the profile does not require abstract text.',
    evidence: ['tests/jats-export.test.ts', 'tests/publication-profile.test.ts'],
  },
  {
    id: 'body.sections-paragraphs',
    area: 'body',
    omi: 'Hierarchical sections and text blocks',
    jats: 'sec/title/p',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Semantic section hierarchy is represented by nested sec elements.',
    evidence: ['tests/jats-export.test.ts', 'tests/hierarchical-cross-references.test.ts'],
  },
  {
    id: 'body.lists-quotes-code',
    area: 'body',
    omi: 'Ordered/bullet lists, block quotations, code blocks',
    jats: 'list/list-item, disp-quote, preformat',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Nested list structure is retained.',
    evidence: ['tests/jats-conformance.test.ts'],
  },
  {
    id: 'inline.semantic-formatting',
    area: 'inline',
    omi: 'Bold, italic, strike, underline, small caps, code, super/subscript',
    jats: 'bold, italic, strike, underline, sc, monospace, sup, sub',
    status: 'stable',
    releaseGate: 'required',
    notes: 'OMI semantic marks are represented as JATS inline semantic elements.',
    evidence: ['tests/jats-conformance.test.ts', 'tests/inline-semantics.test.ts'],
  },
  {
    id: 'inline.unknown-mark',
    area: 'inline',
    omi: 'Unknown or future inline semantic mark',
    jats: 'No guaranteed mapping',
    status: 'fallback',
    releaseGate: 'blocks-on-use',
    notes: 'Unknown marks are preserved as text but cannot be silently claimed as semantically conformant.',
    blockingDiagnostics: ['unsupported-inline-mark'],
    evidence: ['tests/jats-conformance.test.ts'],
  },
  {
    id: 'inline.language-links',
    area: 'inline',
    omi: 'Inline language and external HTTP(S)/mailto link',
    jats: 'named-content@xml:lang and ext-link@xlink:href',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Active/non-web protocols are not emitted.',
    evidence: ['tests/jats-export.test.ts'],
  },
  {
    id: 'references.citations-bibliography',
    area: 'references',
    omi: 'Semantic citations and bibliographic records',
    jats: 'xref@ref-type=bibr + ref-list/ref/element-citation',
    status: 'conditional',
    releaseGate: 'required',
    notes: 'Core bibliographic fields and supported publication types are mapped; unknown record types use publication-type=other.',
    evidence: ['tests/jats-export.test.ts', 'tests/citation-model.test.ts'],
  },
  {
    id: 'references.cross-references',
    area: 'references',
    omi: 'Semantic cross-references to sections and scholarly objects',
    jats: 'xref with sec/table/disp-formula/fig targets',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Release requires every rid target to resolve.',
    evidence: ['tests/jats-export.test.ts', 'tests/cross-references.test.ts'],
  },
  {
    id: 'notes.plain-text-footnotes',
    area: 'notes',
    omi: 'Semantic note annotations with plain-text body',
    jats: 'xref@ref-type=fn + back/fn-group/fn',
    status: 'conditional',
    releaseGate: 'required',
    notes: 'Only annotations of type note are exported; non-note review/editorial annotations are excluded.',
    evidence: ['tests/jats-conformance.test.ts', 'tests/jats-export.test.ts'],
  },
  {
    id: 'notes.rich-content',
    area: 'notes',
    omi: 'Rich-text note bodies and semantic citations inside notes',
    jats: 'Structured fn body',
    status: 'fallback',
    releaseGate: 'blocks-on-use',
    notes: 'Current JATS output uses the plain-text note projection; rich note content must not be silently released at reduced fidelity.',
    blockingDiagnostics: [
      'jats-note-rich-text-fallback',
      'jats-note-citations-fallback',
    ],
    evidence: ['tests/jats-conformance.test.ts'],
  },
  {
    id: 'objects.figures',
    area: 'objects',
    omi: 'Image block with caption and alt text',
    jats: 'fig/caption/graphic/alt-text',
    status: 'conditional',
    releaseGate: 'blocks-on-use',
    notes: 'A release-quality JATS figure requires a non-empty portable graphic reference; data URIs remain exportable previews but are not release-quality interchange.',
    blockingDiagnostics: [
      'missing-image-source',
      'embedded-image-data-uri',
    ],
    evidence: ['tests/jats-conformance.test.ts'],
  },
  {
    id: 'objects.tables',
    area: 'objects',
    omi: 'Structured table cells and header rows',
    jats: 'table-wrap with XHTML table/thead/tbody',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Cell text and header-row semantics are preserved.',
    evidence: ['tests/jats-export.test.ts'],
  },
  {
    id: 'objects.equations',
    area: 'objects',
    omi: 'LaTeX or safe MathML equation',
    jats: 'disp-formula with MathML 3',
    status: 'conditional',
    releaseGate: 'blocks-on-use',
    notes: 'LaTeX is converted to MathML; unsafe or non-MathML fallback text is not release-quality.',
    blockingDiagnostics: [
      'equation-representation-fallback',
      'unsafe-or-unsupported-mathml',
    ],
    evidence: ['tests/jats-export.test.ts', 'tests/jats-conformance.test.ts'],
  },
  {
    id: 'objects.charts',
    area: 'objects',
    omi: 'Structured chart data',
    jats: 'fig/media containing OMI chart JSON',
    status: 'fallback',
    releaseGate: 'blocks-on-use',
    notes: 'Source data is retained, but a final publication graphic is not yet generated.',
    blockingDiagnostics: ['chart-semantic-media'],
    evidence: ['tests/jats-conformance.test.ts'],
  },
  {
    id: 'objects.music-score',
    area: 'objects',
    omi: 'Music score block',
    jats: 'fig with textual score fallback',
    status: 'fallback',
    releaseGate: 'blocks-on-use',
    notes: 'A compact textual note sequence is retained; MusicXML/graphic publication packaging remains future work.',
    blockingDiagnostics: ['music-score-semantic-fallback'],
    evidence: ['tests/jats-conformance.test.ts'],
  },
  {
    id: 'body.unknown-rich-text',
    area: 'body',
    omi: 'Unknown rich-text block node',
    jats: 'Flattened paragraph fallback',
    status: 'fallback',
    releaseGate: 'blocks-on-use',
    notes: 'Unknown block semantics are flattened for preview but block a publication release.',
    blockingDiagnostics: ['unsupported-rich-text-block'],
    evidence: ['tests/jats-conformance.test.ts'],
  },
  {
    id: 'validation.dtd',
    area: 'validation',
    omi: 'Generated JATS artifact',
    jats: 'Pinned JATS 1.4 Article Authoring MathML 3 DTD',
    status: 'stable',
    releaseGate: 'required',
    notes: 'Release evidence requires full offline DTD validation through the pinned libxml2-wasm engine.',
    evidence: ['tests/jats-schema-validation.test.ts'],
  },
  {
    id: 'provenance.build-sidecar',
    area: 'provenance',
    omi: 'Committed source revision and generated JATS bytes',
    jats: '<artifact>.omi-build.json',
    status: 'stable',
    releaseGate: 'required',
    notes: 'The release artifact is paired with a deterministic publication-build provenance sidecar.',
    evidence: ['tests/publication-build.test.ts'],
  },
];

export const OMI_JATS_RELEASE_BLOCKING_DIAGNOSTICS = Object.freeze(
  OMI_JATS_CONFORMANCE_MATRIX.flatMap((capability) =>
    capability.releaseGate === 'blocks-on-use'
      ? [...(capability.blockingDiagnostics ?? [])]
      : [],
  ),
);

export function isJatsReleaseBlockingDiagnostic(code: string): boolean {
  return OMI_JATS_RELEASE_BLOCKING_DIAGNOSTICS.includes(code);
}
