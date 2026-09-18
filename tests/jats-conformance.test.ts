import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';

import {
  isJatsReleaseBlockingDiagnostic,
  OMI_JATS_CONFORMANCE_MATRIX,
  OMI_JATS_CONFORMANCE_MATRIX_VERSION,
  OMI_JATS_CONFORMANCE_RENDERER_VERSION,
  OMI_JATS_CONFORMANCE_TAG_SET,
  OMI_JATS_CONFORMANCE_VERSION,
} from '../src/model/jatsConformance.ts';
import {
  renderJatsArticle,
  OMI_JATS_RENDERER_VERSION,
  OMI_JATS_TAGSET,
  OMI_JATS_VERSION,
} from '../src/services/exportJats.ts';
import {
  evaluateJatsPublicationRelease,
  jatsPublicationReleaseFailureMessage,
} from '../src/services/jatsReleaseGate.ts';
import type { JatsSchemaValidationResult } from '../src/services/jatsValidationApi.ts';
import type { OmiAnnotation } from '../src/types/omi.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

const VALID_SCHEMA: JatsSchemaValidationResult = {
  standard: 'NISO JATS',
  version: '1.4',
  tagSet: 'articleauthoring',
  schema: 'DTD',
  schemaVariant: 'MathML3',
  schemaPackage: '@jats4r/dtds@0.0.10',
  engine: 'libxml2-wasm@0.7.2',
  valid: true,
  diagnostics: [],
};

test('JATS conformance matrix is internally consistent and backed by repository evidence', async () => {
  assert.equal(OMI_JATS_CONFORMANCE_MATRIX_VERSION, '1.0.0');
  assert.equal(OMI_JATS_CONFORMANCE_VERSION, OMI_JATS_VERSION);
  assert.equal(OMI_JATS_CONFORMANCE_TAG_SET, OMI_JATS_TAGSET);
  assert.equal(
    OMI_JATS_CONFORMANCE_RENDERER_VERSION,
    OMI_JATS_RENDERER_VERSION,
  );

  const ids = OMI_JATS_CONFORMANCE_MATRIX.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'conformance capability ids must be unique');

  const blockingCodes = new Set<string>();
  for (const capability of OMI_JATS_CONFORMANCE_MATRIX) {
    assert.ok(capability.evidence.length > 0, `${capability.id} needs release evidence`);
    for (const path of capability.evidence) await access(path);

    if (capability.releaseGate === 'blocks-on-use') {
      assert.ok(
        (capability.blockingDiagnostics?.length ?? 0) > 0,
        `${capability.id} needs a detectable blocking diagnostic`,
      );
      for (const code of capability.blockingDiagnostics ?? []) {
        assert.equal(
          blockingCodes.has(code),
          false,
          `blocking diagnostic must have one conformance owner: ${code}`,
        );
        blockingCodes.add(code);
        assert.equal(isJatsReleaseBlockingDiagnostic(code), true);
      }
    }

    if (capability.releaseGate === 'required') {
      assert.notEqual(
        capability.status,
        'unsupported',
        `required capability cannot be unsupported: ${capability.id}`,
      );
      assert.notEqual(
        capability.status,
        'fallback',
        `required capability cannot be fallback-only: ${capability.id}`,
      );
    }
  }
});

test('public contributor ORCID and affiliation ROR map to JATS without exposing private identity data', () => {
  const manuscript = createTestManuscript();
  const author = manuscript.agents[0];
  assert.ok(author);
  author.identifiers = [
    {
      id: 'orcid-public',
      scheme: 'orcid',
      value: '0000-0002-1825-0097',
      normalizedValue: '0000-0002-1825-0097',
      verificationStatus: 'verified',
      visibility: 'public',
    },
    {
      id: 'orcid-private',
      scheme: 'orcid-private',
      value: 'private-identifier',
      normalizedValue: 'private-identifier',
      verificationStatus: 'verified',
      visibility: 'private',
    },
  ];
  const affiliation = author.affiliations[0];
  assert.ok(affiliation);
  affiliation.organizationIdentifier = {
    id: 'ror-public',
    scheme: 'ror',
    value: 'https://ror.org/01jsq2704',
    normalizedValue: 'https://ror.org/01jsq2704',
    verificationStatus: 'verified',
    visibility: 'public',
  };

  const result = renderJatsArticle(manuscript);

  assert.match(
    result.xml,
    /<contrib-id contrib-id-type="orcid">https:\/\/orcid\.org\/0000-0002-1825-0097<\/contrib-id>/,
  );
  assert.match(
    result.xml,
    /<ext-link ext-link-type="uri" xlink:href="https:\/\/ror\.org\/01jsq2704">https:\/\/ror\.org\/01jsq2704<\/ext-link>/,
  );
  assert.doesNotMatch(result.xml, /private-identifier/);
});

test('stable rich-text and block semantics map to explicit JATS elements', () => {
  const manuscript = createTestManuscript();
  const section = manuscript.sections[0];
  assert.ok(section);

  section.blocks = [
    {
      id: 'rich',
      type: 'paragraph',
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' italic', marks: [{ type: 'italic' }] },
              { type: 'text', text: ' strike', marks: [{ type: 'strike' }] },
              { type: 'text', text: ' underline', marks: [{ type: 'omiUnderline' }] },
              { type: 'text', text: ' small caps', marks: [{ type: 'omiSmallCaps' }] },
              { type: 'text', text: ' code', marks: [{ type: 'code' }] },
              { type: 'text', text: ' super', marks: [{ type: 'omiSuperscript' }] },
              { type: 'text', text: ' sub', marks: [{ type: 'omiSubscript' }] },
            ],
          },
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quote' }] }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }],
              },
            ],
          },
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      }),
    },
  ];

  const result = renderJatsArticle(manuscript);

  assert.match(result.xml, /<bold>Bold<\/bold>/);
  assert.match(result.xml, /<italic> italic<\/italic>/);
  assert.match(result.xml, /<strike> strike<\/strike>/);
  assert.match(result.xml, /<underline> underline<\/underline>/);
  assert.match(result.xml, /<sc> small caps<\/sc>/);
  assert.match(result.xml, /<monospace> code<\/monospace>/);
  assert.match(result.xml, /<sup> super<\/sup>/);
  assert.match(result.xml, /<sub> sub<\/sub>/);
  assert.match(result.xml, /<disp-quote/);
  assert.match(result.xml, /<list[^>]+list-type="bullet"/);
  assert.match(result.xml, /<preformat[^>]+preformat-type="code"/);

  const release = evaluateJatsPublicationRelease(result, VALID_SCHEMA);
  assert.equal(release.releasable, true, jatsPublicationReleaseFailureMessage(release));
});

test('non-note review annotations never leak into JATS fn-group', () => {
  const manuscript = createTestManuscript();
  manuscript.annotations = [
    {
      id: 'review-comment',
      type: 'comment',
      anchorId: 'comment-anchor',
      targetBlockId: manuscript.sections[0]?.blocks[0]?.id ?? 'block',
      body: 'Private review comment',
      renderingHint: 'margin',
    },
    {
      id: 'note-one',
      type: 'note',
      noteKind: 'footnote',
      anchorId: 'note-anchor',
      targetBlockId: manuscript.sections[0]?.blocks[0]?.id ?? 'block',
      body: 'Public scholarly note',
      renderingHint: 'footnote',
    },
  ] as OmiAnnotation[];

  const result = renderJatsArticle(manuscript);

  assert.doesNotMatch(result.xml, /review-comment/);
  assert.doesNotMatch(result.xml, /Private review comment/);
  assert.match(result.xml, /<fn id="fn-note-one"/);
  assert.match(result.xml, /Public scholarly note/);
});

test('known fidelity fallbacks block publication release even when DTD evidence is valid', () => {
  const manuscript = createTestManuscript();
  const section = manuscript.sections[0];
  assert.ok(section);

  section.blocks = [
    {
      id: 'unknown-mark',
      type: 'paragraph',
      content: JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'future semantic mark',
            marks: [{ type: 'futureMark' }],
          }],
        }],
      }),
    },
    {
      id: 'chart-one',
      type: 'chart',
      content: '',
      visual: {
        kind: 'chart',
        chartType: 'bar',
        cells: [['Label', 'Value'], ['A', '1']],
        title: 'Chart',
      },
    },
    {
      id: 'image-one',
      type: 'image',
      content: '',
      visual: {
        kind: 'image',
        src: 'data:image/png;base64,AA==',
        mediaType: 'image/png',
        fileName: 'figure.png',
        alt: 'Figure',
      },
    },
    {
      id: 'music-one',
      type: 'music-score',
      content: '',
      visual: {
        kind: 'music-score',
        format: 'musicxml',
        source: '<score-partwise/>',
        title: 'Score',
        notes: [
          {
            step: 'C',
            alter: 0,
            octave: 4,
            duration: 1,
            type: 'quarter',
            rest: false,
          },
        ],
      },
    },
  ];

  const note = {
    id: 'rich-note',
    type: 'note',
    noteKind: 'footnote',
    anchorId: 'rich-note-anchor',
    targetBlockId: 'unknown-mark',
    body: 'Plain projection',
    bodyContent: JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Rich projection' }],
      }],
    }),
    noteCitations: [{
      id: 'note-citation',
      target: 'record-not-present',
    }],
    renderingHint: 'footnote',
  } as OmiAnnotation;
  manuscript.annotations = [note];

  const result = renderJatsArticle(manuscript);
  const codes = new Set(result.diagnostics.map((item) => item.code));

  for (const code of [
    'unsupported-inline-mark',
    'chart-semantic-media',
    'embedded-image-data-uri',
    'music-score-semantic-fallback',
    'jats-note-rich-text-fallback',
    'jats-note-citations-fallback',
  ]) {
    assert.equal(codes.has(code), true, `expected conformance diagnostic: ${code}`);
    assert.equal(isJatsReleaseBlockingDiagnostic(code), true);
  }

  const release = evaluateJatsPublicationRelease(result, VALID_SCHEMA);
  assert.equal(release.releasable, false);
  assert.equal(
    release.gates.find((gate) => gate.id === 'semantic-fidelity')?.status,
    'fail',
  );
});

test('DTD failure and target mismatch are independent mandatory release gates', () => {
  const result = renderJatsArticle(createTestManuscript());
  const invalid: JatsSchemaValidationResult = {
    ...VALID_SCHEMA,
    version: '1.4',
    valid: false,
    diagnostics: [{
      code: 'dtd-validity-error',
      severity: 'error',
      message: 'Invalid structure',
    }],
  };
  const failed = evaluateJatsPublicationRelease(result, invalid);
  assert.equal(failed.releasable, false);
  assert.equal(
    failed.gates.find((gate) => gate.id === 'dtd-validation')?.status,
    'fail',
  );
});
