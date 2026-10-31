import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCitationAnchors,
  createBibliographicRecord,
  createCitationOccurrence,
  findLikelyDuplicateRecord,
  formatCitationLabel,
  getBibliographicIdentifier,
  getBibliographyRecords,
  normalizeDoi,
  removeCitationAnchorFromSections,
  setBibliographicIdentifier,
  synchronizeCitationLabels,
} from '../src/model/citations.ts';
import type { OmiSection } from '../src/types/omi.ts';

test('stores a work once and allows multiple citation occurrences to target it', () => {
  const record = createBibliographicRecord({
    type: 'book',
    title: 'History of Structured Scholarship',
    issued: '2026',
    contributors: [
      {
        id: 'creator-1',
        role: 'author',
        givenName: 'Ada',
        familyName: 'Example',
      },
    ],
  });
  const first = createCitationOccurrence({
    target: record.id,
    targetBlockId: 'block-1',
    locator: { type: 'page', value: '12' },
  });
  const second = createCitationOccurrence({
    target: record.id,
    targetBlockId: 'block-2',
    locator: { type: 'page-range', value: '45–47' },
  });

  assert.equal(first.target, record.id);
  assert.equal(second.target, record.id);
  assert.notEqual(first.id, second.id);
  assert.match(formatCitationLabel(record, first), /Example 2026, 12/);
  assert.match(formatCitationLabel(record, second), /Example 2026, 45–47/);
});

test('document bibliography includes cited records plus explicitly selected uncited works', () => {
  const cited = createBibliographicRecord({ title: 'Cited work' });
  cited.id = 'bib-cited';
  const selected = createBibliographicRecord({ title: 'Selected background work' });
  selected.id = 'bib-selected';
  const unused = createBibliographicRecord({ title: 'Unused library work' });
  unused.id = 'bib-unused';

  const records = getBibliographyRecords({
    bibliographicRecords: [cited, selected, unused],
    citations: [{
      id: 'cit-one',
      target: cited.id,
      anchorId: 'anchor-one',
      targetBlockId: 'block-one',
    }],
    bibliographyAdditionalRecordIds: [selected.id],
  });

  assert.deepEqual(
    records.map((record) => record.id),
    ['bib-cited', 'bib-selected'],
  );
});

test('normalizes DOI identifiers and detects exact DOI duplicates', () => {
  const first = setBibliographicIdentifier(
    createBibliographicRecord({ title: 'First metadata version' }),
    'doi',
    'https://doi.org/10.1234/Example.1',
  );
  const candidate = setBibliographicIdentifier(
    createBibliographicRecord({ title: 'Different title from another provider' }),
    'doi',
    'doi:10.1234/example.1',
  );

  assert.equal(normalizeDoi('https://doi.org/10.1234/Example.1'), '10.1234/Example.1');
  assert.equal(getBibliographicIdentifier(first, 'doi'), '10.1234/Example.1');
  assert.equal(findLikelyDuplicateRecord([first], candidate)?.id, first.id);
});

test('collects stable inline citation anchors from Tiptap content', () => {
  const sections: OmiSection[] = [
    {
      id: 'section-1',
      title: 'Introduction',
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          content: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Evidence ' },
                  {
                    type: 'omiCitation',
                    attrs: {
                      citationId: 'cit-1',
                      anchorId: 'anchor-1',
                      label: 'Example 2026',
                    },
                  },
                ],
              },
            ],
          }),
        },
      ],
    },
  ];

  assert.deepEqual(collectCitationAnchors(sections), [
    {
      citationId: 'cit-1',
      anchorId: 'anchor-1',
      targetBlockId: 'block-1',
    },
  ]);
});

test('removing a citation occurrence removes only its inline anchor', () => {
  const sections: OmiSection[] = [
    {
      id: 'section-1',
      title: 'Introduction',
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          content: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'omiCitation',
                    attrs: {
                      citationId: 'cit-remove',
                      anchorId: 'anchor-remove',
                      label: 'Remove 2026',
                    },
                  },
                  { type: 'text', text: ' keep text ' },
                  {
                    type: 'omiCitation',
                    attrs: {
                      citationId: 'cit-keep',
                      anchorId: 'anchor-keep',
                      label: 'Keep 2026',
                    },
                  },
                ],
              },
            ],
          }),
        },
      ],
    },
  ];
  const next = removeCitationAnchorFromSections(sections, 'cit-remove');
  const anchors = collectCitationAnchors(next);

  assert.equal(anchors.length, 1);
  assert.equal(anchors[0]?.citationId, 'cit-keep');
  assert.match(next[0]!.blocks[0]!.content, /keep text/);
});

test('derived inline labels follow bibliographic and locator changes', () => {
  const record = createBibliographicRecord({
    title: 'Example Book',
    issued: '2025',
    contributors: [
      {
        id: 'creator-1',
        role: 'author',
        familyName: 'Smith',
      },
    ],
  });
  const citation = createCitationOccurrence({
    id: 'cit-1',
    anchorId: 'anchor-1',
    target: record.id,
    targetBlockId: 'block-1',
    locator: { type: 'page', value: '9' },
  });
  const sections: OmiSection[] = [
    {
      id: 'section-1',
      title: 'Introduction',
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          content: JSON.stringify({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'omiCitation',
                    attrs: {
                      citationId: citation.id,
                      anchorId: citation.anchorId,
                      label: 'stale',
                    },
                  },
                ],
              },
            ],
          }),
        },
      ],
    },
  ];
  const synchronized = synchronizeCitationLabels(
    sections,
    [citation],
    [record],
  );

  assert.match(synchronized[0]!.blocks[0]!.content, /Smith 2025, 9/);
  assert.doesNotMatch(synchronized[0]!.blocks[0]!.content, /stale/);
});


test('same title and contributor do not override two distinct explicit DOI identities', () => {
  const bibliographic = {
    title: 'Treatise on scholarly methods',
    type: 'journal-article' as const,
    issued: '2026',
    contributors: [{ id: 'author', role: 'author' as const, givenName: 'Ada', familyName: 'Example' }],
  };
  const first = setBibliographicIdentifier(createBibliographicRecord(bibliographic), 'doi', '10.1000/first');
  const different = setBibliographicIdentifier(createBibliographicRecord(bibliographic), 'doi', '10.1000/second');
  assert.equal(findLikelyDuplicateRecord([first], different), undefined);
  assert.equal(findLikelyDuplicateRecord([first], setBibliographicIdentifier(different, 'doi', '10.1000/first'))?.id, first.id);
});

test('legacy inline citation helpers operate inside embedded sections and blocks without rewriting author text', () => {
  const original = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Author passage: ' },
    { type: 'omiCitation', attrs: { citationId: 'cit-1', anchorId: 'anchor-1', label: 'Original' } },
    { type: 'text', text: ' remains editable.' },
  ] }] });
  const sections: OmiSection[] = [{
    id: 'parent', title: 'Root', blocks: [{ id: 'parent-block', type: 'paragraph', content: 'Unchanged parent',
      children: [{ id: 'nested-block', type: 'paragraph', content: original }] }],
    children: [{ id: 'nested-section', title: 'Nested', blocks: [{ id: 'section-block', type: 'paragraph', content: original }] }],
  }];
  const before = JSON.stringify(sections);
  assert.deepEqual(collectCitationAnchors(sections).map((a) => a.targetBlockId), ['nested-block', 'section-block']);
  const record = createBibliographicRecord({ title: 'Book of evidence', issued: '2026' });
  const citation = createCitationOccurrence({ id: 'cit-1', anchorId: 'anchor-1', target: record.id, targetBlockId: 'nested-block' });
  const updated = synchronizeCitationLabels(sections, [citation], [record]);
  assert.equal(collectCitationAnchors(updated).length, 2);
  assert.match(updated[0]!.blocks[0]!.children![0]!.content, /Author passage:/);
  assert.match(updated[0]!.children![0]!.blocks[0]!.content, /remains editable/);
  const removed = removeCitationAnchorFromSections(updated, 'cit-1');
  assert.deepEqual(collectCitationAnchors(removed), []);
  for (const content of [removed[0]!.blocks[0]!.children![0]!.content, removed[0]!.children![0]!.blocks[0]!.content]) {
    assert.match(content, /Author passage:/);
    assert.match(content, /remains editable/);
  }
  assert.equal(JSON.stringify(sections), before);
});
