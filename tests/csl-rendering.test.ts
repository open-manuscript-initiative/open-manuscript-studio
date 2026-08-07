import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCitationAnchors,
  createCitationCluster,
  removeCitationFromSections,
  synchronizeCitationLabels,
} from '../src/model/citationClusters.ts';
import {
  CITATION_STYLE_IDS,
  renderBibliography,
  renderCitationCluster,
  toCslJson,
} from '../src/model/cslRendering.ts';
import type {
  OmiBibliographicRecord,
  OmiCitation,
  OmiSection,
} from '../src/types/omi.ts';

const firstRecord: OmiBibliographicRecord = {
  id: 'bib-1',
  type: 'journal-article',
  title: 'Structured Scholarly Writing',
  contributors: [
    {
      id: 'person-1',
      role: 'author',
      givenName: 'Jane',
      familyName: 'Smith',
    },
  ],
  containerTitle: 'Journal of Open Manuscripts',
  issued: '2020',
  volume: '12',
  issue: '3',
  pages: '40-52',
  identifiers: [
    {
      scheme: 'doi',
      value: '10.1234/example.1',
    },
  ],
  status: 'resolved',
};

const secondRecord: OmiBibliographicRecord = {
  id: 'bib-2',
  type: 'book',
  title: 'Portable Research Objects',
  contributors: [
    {
      id: 'person-2',
      role: 'author',
      givenName: 'Alex',
      familyName: 'Jones',
    },
  ],
  issued: '2023',
  publisher: 'Open Press',
  place: 'Budapest',
  identifiers: [],
  status: 'resolved',
};

test('maps the portable OMI bibliographic model to CSL-JSON fields', () => {
  const csl = toCslJson(firstRecord);

  assert.equal(csl.id, 'bib-1');
  assert.equal(csl.type, 'article-journal');
  assert.equal(csl.author?.[0]?.family, 'Smith');
  assert.equal(csl.author?.[0]?.given, 'Jane');
  assert.deepEqual(csl.issued, { 'date-parts': [[2020]] });
  assert.equal(csl['container-title'], 'Journal of Open Manuscripts');
  assert.equal(csl.DOI, '10.1234/example.1');
  assert.equal(csl.URL, 'https://doi.org/10.1234/example.1');
});

test('renders the same semantic citation differently under built-in CSL profiles', () => {
  const citation: OmiCitation = {
    id: 'cit-1',
    target: firstRecord.id,
    anchorId: 'anchor-1',
    targetBlockId: 'block-1',
    locator: {
      type: 'page',
      value: '45',
    },
  };

  const apa = renderCitationCluster([citation], [firstRecord], 'apa-7', 'en');
  const chicago = renderCitationCluster(
    [citation],
    [firstRecord],
    'chicago-author-date',
    'en',
  );
  const mla = renderCitationCluster([citation], [firstRecord], 'mla-9', 'en');

  assert.equal(apa, '(Smith, 2020, p. 45)');
  assert.equal(chicago, '(Smith 2020, 45)');
  assert.equal(mla, '(Smith, 45)');
  assert.notEqual(apa, chicago);
  assert.notEqual(chicago, mla);
});

test('renders ordered citation clusters with independent locators', () => {
  const creation = createCitationCluster(
    [
      {
        target: firstRecord.id,
        locator: { type: 'page', value: '45' },
      },
      {
        target: secondRecord.id,
        locator: { type: 'page-range', value: '91-93' },
      },
    ],
    'block-1',
    '2026-08-07T07:00:00.000Z',
  );

  assert.equal(creation.citations.length, 2);
  assert.equal(creation.cluster.citationIds.length, 2);
  assert.equal(creation.citations[0]?.clusterId, creation.cluster.id);
  assert.equal(creation.citations[1]?.clusterId, creation.cluster.id);
  assert.equal(creation.citations[0]?.anchorId, creation.cluster.anchorId);
  assert.equal(creation.citations[1]?.anchorId, creation.cluster.anchorId);

  const rendered = renderCitationCluster(
    creation.citations,
    [firstRecord, secondRecord],
    'chicago-author-date',
    'en',
  );

  assert.equal(rendered, '(Smith 2020, 45; Jones 2023, 91-93)');
});

test('formats bibliography entries for every registered style profile', () => {
  const outputs = new Set(
    CITATION_STYLE_IDS.map((style) =>
      renderBibliography([firstRecord], style, 'en')[0]?.text,
    ),
  );

  assert.equal(outputs.size, CITATION_STYLE_IDS.length);
  assert.match(
    renderBibliography([firstRecord], 'apa-7', 'en')[0]?.text ?? '',
    /Smith, J\./,
  );
  assert.match(
    renderBibliography([firstRecord], 'iso-690', 'en')[0]?.text ?? '',
    /SMITH/,
  );
});

test('collects every semantic occurrence from one inline cluster marker', () => {
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
                      citationId: 'cit-1',
                      citationIds: ['cit-1', 'cit-2'],
                      clusterId: 'cluster-1',
                      anchorId: 'anchor-1',
                      label: '(Smith 2020; Jones 2023)',
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

  const anchors = collectCitationAnchors(sections);
  assert.deepEqual(
    anchors.map((anchor) => anchor.citationId),
    ['cit-1', 'cit-2'],
  );
  assert.ok(anchors.every((anchor) => anchor.anchorId === 'anchor-1'));
  assert.ok(anchors.every((anchor) => anchor.clusterId === 'cluster-1'));
});

test('removing one clustered citation preserves the inline marker for survivors', () => {
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
                      citationId: 'cit-1',
                      citationIds: ['cit-1', 'cit-2'],
                      clusterId: 'cluster-1',
                      anchorId: 'anchor-1',
                      label: '(Smith 2020; Jones 2023)',
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

  const next = removeCitationFromSections(sections, 'cit-1');
  const parsed = JSON.parse(next[0]!.blocks[0]!.content);
  const marker = parsed.content[0].content[0];

  assert.equal(marker.attrs.citationId, 'cit-2');
  assert.deepEqual(marker.attrs.citationIds, ['cit-2']);
  assert.equal(marker.attrs.clusterId, 'cluster-1');
});

test('synchronizes a cluster marker to the selected citation style', () => {
  const creation = createCitationCluster(
    [
      { target: firstRecord.id },
      { target: secondRecord.id },
    ],
    'block-1',
    '2026-08-07T07:00:00.000Z',
  );
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
                      citationId: creation.citations[0]!.id,
                      citationIds: creation.cluster.citationIds,
                      clusterId: creation.cluster.id,
                      anchorId: creation.cluster.anchorId,
                      label: '[citation]',
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

  const next = synchronizeCitationLabels(
    sections,
    creation.citations,
    [firstRecord, secondRecord],
    [creation.cluster],
    'apa-7',
    'en',
  );
  const parsed = JSON.parse(next[0]!.blocks[0]!.content);
  const marker = parsed.content[0].content[0];

  assert.equal(marker.attrs.label, '(Smith, 2020; Jones, 2023)');
});
