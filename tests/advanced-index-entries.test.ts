import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createIndexSubentry,
  createManualIndexEntry,
  groupIndexEntries,
  indexEntryDisplayLabel,
  validateIndexEntries,
} from '../src/model/indexing.ts';

test('creates hierarchical main and subentries with stable parent identity', () => {
  const main = createManualIndexEntry({
    id: 'main',
    term: 'Bethlen Gábor',
    indexId: 'persons',
    targetBlockId: 'block-1',
  });
  const child = createIndexSubentry({
    parent: main,
    term: 'politikai kapcsolatai',
    targetBlockId: 'block-2',
  });

  assert.equal(child.parentEntryId, 'main');
  assert.deepEqual(child.terms, ['Bethlen Gábor', 'politikai kapcsolatai']);
  assert.equal(indexEntryDisplayLabel(child), 'Bethlen Gábor — politikai kapcsolatai');
});

test('represents See and See also with stable related entry identities', () => {
  const target = createManualIndexEntry({ id: 'target', term: 'Erdély fejedelmei', indexId: 'subject' });
  const see = createManualIndexEntry({
    id: 'see', term: 'Fejedelmek', indexId: 'subject', relation: 'see', relatedEntryId: target.id,
  });
  const seeAlso = createManualIndexEntry({
    id: 'also', term: 'Bethlen Gábor', indexId: 'subject', relation: 'see-also', relatedEntryId: target.id,
  });

  assert.equal(see.relation, 'see');
  assert.equal(see.relatedEntryId, 'target');
  assert.equal(seeAlso.relation, 'see-also');
  assert.deepEqual(validateIndexEntries({ entries: [target, see, seeAlso] }), []);
});

test('stores text ranges structurally instead of page numbers', () => {
  const entry = createManualIndexEntry({
    term: 'Mikes család',
    indexId: 'persons',
    range: {
      startBlockId: 'a', startOffset: 4,
      endBlockId: 'b', endOffset: 18,
      text: 'Mikes család története',
    },
  });

  assert.equal(entry.targetBlockId, 'a');
  assert.equal(entry.targetTextOffset, 4);
  assert.equal(entry.range?.endBlockId, 'b');
  assert.equal('page' in (entry.range ?? {}), false);
});

test('validates broken hierarchy, relations and text ranges', () => {
  const entries = [
    createManualIndexEntry({ id: 'broken-parent', term: 'A', parentEntryId: 'missing', targetBlockId: 'a' }),
    createManualIndexEntry({ id: 'self', term: 'B', relation: 'see', relatedEntryId: 'self' }),
    createManualIndexEntry({ id: 'range', term: 'C', range: { startBlockId: 'a', startOffset: 9, endBlockId: 'a', endOffset: 2 } }),
  ];
  const issues = validateIndexEntries({ entries, blockIds: new Set(['a']) });
  assert.ok(issues.some((issue) => issue.entryId === 'broken-parent' && issue.type === 'missing-parent'));
  assert.ok(issues.some((issue) => issue.entryId === 'self' && issue.type === 'self-reference'));
  assert.ok(issues.some((issue) => issue.entryId === 'range' && issue.type === 'invalid-range'));
});

test('keeps hierarchical labels alphabetically sortable', () => {
  const entries = [
    createManualIndexEntry({ id: 'z', term: 'Zrínyi Miklós', targetBlockId: 'z1' }),
    createManualIndexEntry({ id: 'b', term: 'Bethlen Gábor', targetBlockId: 'b1' }),
    createManualIndexEntry({ id: 'b2', term: 'Bethlen Gábor', subterm: 'levelezése', targetBlockId: 'b2' }),
  ];
  assert.deepEqual(groupIndexEntries(entries).map((group) => group.label), [
    'Bethlen Gábor',
    'Bethlen Gábor — levelezése',
    'Zrínyi Miklós',
  ]);
});