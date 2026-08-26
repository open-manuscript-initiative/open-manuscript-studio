import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCategorizedReferenceGroups,
  createCategorizedReferenceList,
  createReferenceListCategory,
  validateCategorizedReferenceLists,
} from '../src/model/categorizedReferenceLists.ts';

const records = [
  {
    id: 'archive-1', type: 'archival-source', title: 'Acta 1642', contributors: [], identifiers: [], status: 'verified', issued: '1642',
  },
  {
    id: 'law-1', type: 'standard', title: 'Act XLII', contributors: [], identifiers: [], status: 'verified', issued: '1895',
  },
  {
    id: 'book-1', type: 'book', title: 'Secondary Book', contributors: [{ id: 'p1', role: 'author', familyName: 'Scholar', givenName: 'Anna' }], identifiers: [], status: 'verified', issued: '2020',
  },
] as any[];

const citations = [
  { id: 'c1', target: 'archive-1', anchorId: 'a1', targetBlockId: 'b1', intent: 'primary-source' },
  { id: 'c2', target: 'law-1', anchorId: 'a2', targetBlockId: 'b2', intent: 'legislation' },
  { id: 'c3', target: 'book-1', anchorId: 'a3', targetBlockId: 'b3' },
] as any[];

test('groups records by semantic resource type and citation intent', () => {
  const list = createCategorizedReferenceList({
    title: 'Sources',
    id: 'list-1',
    categories: [
      createReferenceListCategory({ id: 'archival', title: 'Archival', kind: 'archival-sources', resourceTypes: ['archival-source'] }),
      createReferenceListCategory({ id: 'laws', title: 'Laws', kind: 'legislation', citationIntents: ['legislation'] }),
    ],
  }, '2026-08-26T00:00:00.000Z');
  const groups = buildCategorizedReferenceGroups({ bibliographicRecords: records, citations }, list);
  assert.deepEqual(groups.map((group) => group.entries.map((entry) => entry.recordId)), [['archive-1'], ['law-1']]);
  assert.equal(groups[0].entries[0].citationCount, 1);
});

test('explicit membership supports categories not inferable from resource type', () => {
  const list = createCategorizedReferenceList({
    title: 'Special',
    categories: [createReferenceListCategory({ id: 'special', title: 'Special sources', recordIds: ['book-1'] })],
  });
  const groups = buildCategorizedReferenceGroups({ bibliographicRecords: records, citations }, list);
  assert.deepEqual(groups[0].entries.map((entry) => entry.recordId), ['book-1']);
});

test('uncited records are excluded unless explicitly enabled', () => {
  const category = createReferenceListCategory({ id: 'books', title: 'Books', resourceTypes: ['book'] });
  const withoutCitation = { bibliographicRecords: records, citations: citations.filter((citation) => citation.target !== 'book-1') };
  const hidden = createCategorizedReferenceList({ title: 'Hidden', categories: [category] });
  const shown = createCategorizedReferenceList({ title: 'Shown', categories: [category], includeUncited: true });
  assert.equal(buildCategorizedReferenceGroups(withoutCitation, hidden)[0].entries.length, 0);
  assert.equal(buildCategorizedReferenceGroups(withoutCitation, shown)[0].entries.length, 1);
});

test('validation reports duplicate categories and missing explicit records', () => {
  const manuscript = {
    bibliographicRecords: records,
    categorizedReferenceLists: [{
      id: 'list', title: 'Authorities', categories: [
        createReferenceListCategory({ id: 'a', title: 'Sources', recordIds: ['missing'] }),
        createReferenceListCategory({ id: 'b', title: 'sources' }),
      ],
    }],
  };
  const issues = validateCategorizedReferenceLists(manuscript as any);
  assert.ok(issues.some((issue) => issue.type === 'missing-record'));
  assert.ok(issues.some((issue) => issue.type === 'duplicate-category'));
});

test('author-title sorting uses semantic contributor data', () => {
  const list = createCategorizedReferenceList({
    title: 'Books', includeUncited: true, categories: [createReferenceListCategory({ id: 'books', title: 'Books', resourceTypes: ['book'], sort: 'author-title' })],
  });
  const extra = { id: 'book-2', type: 'book', title: 'Earlier', contributors: [{ id: 'p2', role: 'author', familyName: 'Alpha', givenName: 'Béla' }], identifiers: [], status: 'verified' } as any;
  const groups = buildCategorizedReferenceGroups({ bibliographicRecords: [...records, extra], citations }, list);
  assert.deepEqual(groups[0].entries.map((entry) => entry.recordId), ['book-2', 'book-1']);
});
