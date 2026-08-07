import assert from 'node:assert/strict';
import test from 'node:test';

import { createSampleManuscript } from '../src/document/sampleManuscript.ts';
import { createCrossReference } from '../src/model/crossReferences.ts';
import { getPublicationProfile } from '../src/model/publicationProfile.ts';
import {
  renderJatsArticle,
  validateJatsStructure,
} from '../src/services/exportJats.ts';

test('renders deterministic JATS 1.4 authoring XML with title block and traceability metadata', () => {
  const manuscript = createSampleManuscript();
  manuscript.title = 'Meaning < Structure & Publication';
  manuscript.subtitle = 'A portable subtitle';
  manuscript.motto = 'Write naturally. Structure once.';
  const profile = getPublicationProfile('omi-generic-scholarly');
  assert.ok(profile);

  const first = renderJatsArticle(manuscript, profile);
  const second = renderJatsArticle(manuscript, profile);

  assert.equal(first.xml, second.xml);
  assert.match(first.xml, /dtd-version="1\.4"/);
  assert.match(first.xml, /base-tagset="authoring"/);
  assert.match(first.xml, /<article-title>Meaning &lt; Structure &amp; Publication<\/article-title>/);
  assert.match(first.xml, /<subtitle>A portable subtitle<\/subtitle>/);
  assert.match(first.xml, /<meta-name>omi-motto<\/meta-name>/);
  assert.match(first.xml, new RegExp(manuscript.headRevisionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('renders semantic citation, note and internal cross-reference markers as JATS xrefs', () => {
  const manuscript = createSampleManuscript();
  const section = manuscript.sections[0];
  const block = section?.blocks[0];
  assert.ok(section);
  assert.ok(block);

  const recordId = 'record-one';
  const citationId = 'citation-one';
  const citationAnchorId = 'anchor-citation';
  const noteId = 'note-one';
  const noteAnchorId = 'anchor-note';
  const xref = createCrossReference(
    {
      id: 'xref-one',
      anchorId: 'anchor-xref',
      sourceBlockId: block.id,
      targetId: section.id,
      targetKind: 'section',
    },
    '2026-08-07T12:00:00.000Z',
  );

  manuscript.bibliographicRecords = [
    {
      id: recordId,
      type: 'journal-article',
      title: 'Semantic publishing',
      contributors: [
        {
          id: 'bib-author',
          role: 'author',
          givenName: 'Ada',
          familyName: 'Scholar',
        },
      ],
      containerTitle: 'Journal of Structured Scholarship',
      issued: '2026',
      volume: '1',
      issue: '2',
      pages: '10-20',
      identifiers: [{ scheme: 'doi', value: '10.1234/example' }],
      status: 'verified',
    },
  ];
  manuscript.citations = [
    {
      id: citationId,
      target: recordId,
      anchorId: citationAnchorId,
      targetBlockId: block.id,
      locator: { type: 'page', value: '12' },
    },
  ];
  manuscript.annotations = [
    {
      id: noteId,
      type: 'note',
      noteKind: 'footnote',
      anchorId: noteAnchorId,
      targetBlockId: block.id,
      body: 'A semantic note body.',
      renderingHint: 'footnote',
    },
  ];
  manuscript.crossReferences = [xref];
  block.content = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'See ' },
          {
            type: 'omiCrossReference',
            attrs: {
              crossReferenceId: xref.id,
              anchorId: xref.anchorId,
              label: 'stale label',
            },
          },
          { type: 'text', text: ' and ' },
          {
            type: 'omiCitation',
            attrs: {
              citationId,
              citationIds: [citationId],
              anchorId: citationAnchorId,
              label: 'stale citation',
            },
          },
          {
            type: 'omiNote',
            attrs: {
              noteId,
              anchorId: noteAnchorId,
              label: '1',
              noteType: 'footnote',
            },
          },
        ],
      },
    ],
  });

  const result = renderJatsArticle(manuscript);

  assert.match(result.xml, new RegExp(`<xref ref-type="sec" rid="sec-${section.id}">Section 1<\\/xref>`));
  assert.match(result.xml, /<xref ref-type="bibr" rid="ref-record-one">\(Scholar, 2026, p\. 12\)<\/xref>/);
  assert.match(result.xml, /<xref ref-type="fn" rid="fn-note-one">1<\/xref>/);
  assert.match(result.xml, /<fn id="fn-note-one"/);
  assert.match(result.xml, /<ref id="ref-record-one">/);
  assert.match(result.xml, /<pub-id pub-id-type="doi">10\.1234\/example<\/pub-id>/);
  assert.equal(
    result.diagnostics.some((diagnostic) => diagnostic.code === 'unresolved-jats-rid'),
    false,
  );
});

test('renders structured rich text and scholarly visual objects instead of presentation HTML', () => {
  const manuscript = createSampleManuscript();
  const section = manuscript.sections[0];
  assert.ok(section);
  section.blocks = [
    {
      id: 'rich-block',
      type: 'paragraph',
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Latin',
                marks: [
                  { type: 'italic' },
                  { type: 'omiLanguage', attrs: { lang: 'la' } },
                ],
              },
              { type: 'text', text: ' H₂O', marks: [{ type: 'omiSubscript' }] },
              {
                type: 'text',
                text: ' source',
                marks: [{ type: 'omiLink', attrs: { href: 'https://example.org/' } }],
              },
            ],
          },
        ],
      }),
    },
    {
      id: 'table-one',
      type: 'table',
      content: '',
      visual: {
        kind: 'table',
        cells: [
          ['Year', 'Value'],
          ['2025', '10'],
        ],
        headerRows: 1,
        caption: 'Results',
      },
    },
    {
      id: 'equation-one',
      type: 'equation',
      content: '',
      visual: {
        kind: 'equation',
        notation: 'latex',
        source: 'E=mc^2',
        latex: 'E=mc^2',
      },
    },
  ];

  const result = renderJatsArticle(manuscript);

  assert.match(result.xml, /<italic><named-content xml:lang="la">Latin<\/named-content><\/italic>|<named-content xml:lang="la"><italic>Latin<\/italic><\/named-content>/);
  assert.match(result.xml, /<sub> H₂O<\/sub>/);
  assert.match(result.xml, /<ext-link ext-link-type="uri" xlink:href="https:\/\/example\.org\/"> source<\/ext-link>/);
  assert.match(result.xml, /<table-wrap id="tbl-table-one">/);
  assert.match(result.xml, /<thead><tr><th>Year<\/th><th>Value<\/th><\/tr><\/thead>/);
  assert.match(result.xml, /<disp-formula id="eq-equation-one">/);
  assert.match(result.xml, /<mml:math display="block">/);
});

test('structural validation rejects duplicate ids and unresolved rid targets', () => {
  const diagnostics = validateJatsStructure(
    '<?xml version="1.0"?><article dtd-version="1.4"><processing-meta base-tagset="authoring"/><front><article-meta><title-group><article-title>T</article-title></title-group></article-meta></front><body><sec id="sec-a"><p id="dup">A <xref ref-type="sec" rid="missing">missing</xref></p><p id="dup">B</p></sec></body></article>',
  );

  assert.equal(
    diagnostics.some((diagnostic) => diagnostic.code === 'duplicate-xml-id'),
    true,
  );
  assert.equal(
    diagnostics.some((diagnostic) => diagnostic.code === 'unresolved-jats-rid'),
    true,
  );
});
