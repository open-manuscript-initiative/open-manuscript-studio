import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUILTIN_PUBLICATION_PROFILES,
  applyPublicationProfileDefaults,
  createPublicationProfileReference,
  getPublicationProfile,
  profileSupportsOutput,
  publicationProfileOverrides,
  publicationReadinessSummary,
  resolvePublicationProfile,
  serializePublicationProfile,
  validateManuscriptForPublication,
} from '../src/model/publicationProfile.ts';
import type {
  OmiManuscript,
  OmiManuscriptState,
} from '../src/types/omi.ts';

function baseState(): OmiManuscriptState {
  return {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: 'manuscript-1',
    version: '0.1.0-alpha.1',
    identityModelVersion: 'OMI-SPEC-150@0.1.0',
    locale: 'en',
    title: 'A manuscript',
    abstract: 'An abstract',
    keywords: ['one', 'two', 'three'],
    sectionNumberingStyle: 'none',
    citationStyle: 'apa-7',
    crossReferenceNumbering: 'document',
    agents: [],
    contributions: [],
    tombstones: [],
    sections: [
      {
        id: 'section-1',
        title: 'Introduction',
        blocks: [],
      },
    ],
    annotations: [],
    bibliographicRecords: [],
    citations: [],
    citationClusters: [],
    crossReferences: [],
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
  };
}

function asManuscript(state: OmiManuscriptState): OmiManuscript {
  return state as unknown as OmiManuscript;
}

test('registers built-in publication profiles with unique versioned identities', () => {
  assert.ok(BUILTIN_PUBLICATION_PROFILES.length >= 3);
  const identities = BUILTIN_PUBLICATION_PROFILES.map(
    (profile) => `${profile.id}@${profile.version}`,
  );
  assert.equal(new Set(identities).size, identities.length);
  assert.ok(
    BUILTIN_PUBLICATION_PROFILES.every(
      (profile) => profile.model === 'omi-publication-profile-alpha-0.1',
    ),
  );
});

test('falls back to the generic profile for manuscripts without a profile reference', () => {
  const profile = resolvePublicationProfile(baseState());
  assert.equal(profile.id, 'omi-generic-scholarly');
});

test('applies a profile reference and presentation defaults without changing scholarly sections', () => {
  const state = baseState();
  const sectionsBefore = JSON.stringify(state.sections);
  const profile = getPublicationProfile('omi-humanities-notes');
  assert.ok(profile);

  const next = applyPublicationProfileDefaults(state, profile);

  assert.deepEqual(next.publicationProfile, createPublicationProfileReference(profile));
  assert.equal(next.sectionNumberingStyle, 'none');
  assert.equal(next.citationStyle, 'chicago-notes-bibliography');
  assert.equal(next.crossReferenceNumbering, 'document');
  assert.equal(JSON.stringify(next.sections), sectionsBefore);
});

test('strict journal profile reports missing author metadata and accessibility requirements', () => {
  const profile = getPublicationProfile('omi-journal-author-date');
  assert.ok(profile);
  const state = baseState();
  state.abstract = '';
  state.keywords = ['only-one'];
  state.agents = [
    {
      id: 'agent-1',
      type: 'person',
      names: [
        {
          id: 'name-1',
          value: 'Ada Example',
          givenName: 'Ada',
          familyName: 'Example',
          preferred: true,
          visibility: 'public',
        },
      ],
      identifiers: [],
      affiliations: [],
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    },
  ];
  state.contributions = [
    {
      id: 'contribution-1',
      agentId: 'agent-1',
      targetId: state.id,
      roles: ['author'],
      order: 1,
      visibility: 'public',
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    },
  ];
  state.sections[0]!.blocks = [
    {
      id: 'figure-1',
      type: 'image',
      content: '',
      visual: {
        kind: 'image',
        src: 'data:image/png;base64,AA==',
        mediaType: 'image/png',
        alt: '',
      },
    },
    {
      id: 'table-1',
      type: 'table',
      content: '',
      visual: {
        kind: 'table',
        cells: [['A', 'B']],
        headerRows: 0,
      },
    },
  ];

  const issues = validateManuscriptForPublication(asManuscript(state), profile);
  const codes = new Set(issues.map((issue) => issue.code));

  assert.ok(codes.has('missing-abstract'));
  assert.ok(codes.has('too-few-keywords'));
  assert.ok(codes.has('missing-affiliation'));
  assert.ok(codes.has('missing-orcid'));
  assert.ok(codes.has('missing-figure-alt'));
  assert.ok(codes.has('missing-table-header'));
  assert.equal(publicationReadinessSummary(issues).ready, false);
});

test('detects unresolved semantic citations and cross-references as publication errors', () => {
  const state = baseState();
  state.citations = [
    {
      id: 'citation-1',
      target: 'missing-record',
      anchorId: 'citation-anchor-1',
      targetBlockId: 'block-1',
    },
  ];
  state.crossReferences = [
    {
      id: 'xref-1',
      anchorId: 'xref-anchor-1',
      sourceBlockId: 'block-1',
      targetId: 'missing-target',
      targetKind: 'figure',
      displayStyle: 'label-number',
    },
  ];

  const issues = validateManuscriptForPublication(asManuscript(state));
  assert.ok(issues.some((issue) => issue.code === 'unresolved-citation'));
  assert.ok(issues.some((issue) => issue.code === 'unresolved-cross-reference'));
});

test('reports explicit authoring presentation differences as profile overrides', () => {
  const profile = getPublicationProfile('omi-journal-author-date');
  assert.ok(profile);
  const state = applyPublicationProfileDefaults(baseState(), profile);

  assert.deepEqual(publicationProfileOverrides(state, profile), []);

  state.sectionNumberingStyle = 'upper-roman';
  assert.deepEqual(
    publicationProfileOverrides(state, profile),
    ['sections.numberingStyle'],
  );
});

test('profile export is deterministic JSON and advertises only configured output targets', () => {
  const profile = getPublicationProfile('omi-humanities-notes');
  assert.ok(profile);
  const serialized = serializePublicationProfile(profile);

  assert.equal(JSON.parse(serialized).id, profile.id);
  assert.equal(profileSupportsOutput(profile, 'jats'), true);
  assert.equal(profileSupportsOutput(profile, 'html'), true);
  assert.ok(serialized.endsWith('\n'));
});
