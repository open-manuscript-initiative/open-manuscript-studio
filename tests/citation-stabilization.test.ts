import assert from 'node:assert/strict';
import test from 'node:test';
import { collectCitationBlockContentChanges } from '../src/model/citationChangeHistory.ts';
import { stageAddBibliographicRecords } from '../src/app/citationActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { createBibliographicRecord, setBibliographicIdentifier } from '../src/model/citations.ts';
import type { OmiSection } from '../src/types/omi.ts';

test('nested derived-label changes are represented as versioned block.content events', () => {
  const sections: OmiSection[] = [{
    id: 'parent', title: 'Parent', blocks: [{
      id: 'parent-block', type: 'paragraph', content: 'Unchanged text',
      children: [{ id: 'nested-block', type: 'paragraph', content: 'Old citation label' }],
    }],
    children: [{ id: 'child-section', title: 'Child', blocks: [
      { id: 'section-block', type: 'paragraph', content: 'Same content' },
    ] }],
  }];
  const before = JSON.stringify(sections);
  const next = structuredClone(sections);
  next[0]!.blocks[0]!.children![0]!.content = 'New citation label';
  next[0]!.children![0]!.blocks[0]!.content = 'New section label';
  const events = collectCitationBlockContentChanges(sections, next);
  assert.deepEqual(events, [{
    operation: 'block.content.set', targetId: 'nested-block',
    path: '/blocks/nested-block/content', previousValue: 'Old citation label', nextValue: 'New citation label',
  }, {
    operation: 'block.content.set', targetId: 'section-block',
    path: '/blocks/section-block/content', previousValue: 'Same content', nextValue: 'New section label',
  }]);
  assert.equal(JSON.stringify(sections), before);
});

test('bulk reference import preserves DOI-distinct works and uncertain provenance for human reconciliation', () => {
  const previous = useStudioStore.getState();
  try {
    useStudioStore.setState({ manuscript: createVersionedTestManuscript(), pendingChangeSet: null });
    const original = createBibliographicRecord({ title: 'Identical title', issued: '2026' });
    const first = setBibliographicIdentifier(original, 'doi', '10.1000/distinct-a');
    const second = setBibliographicIdentifier(createBibliographicRecord({ title: 'Identical title', issued: '2026' }), 'doi', '10.1000/distinct-b');
    const uncertain = createBibliographicRecord({ title: 'Identical title', issued: '2026' });
    const outcome = stageAddBibliographicRecords([first, second, uncertain]);
    assert.equal(outcome.added, 3);
    const ids = useStudioStore.getState().manuscript.bibliographicRecords?.map((record) => record.id) ?? [];
    assert.ok(ids.includes(first.id));
    assert.ok(ids.includes(second.id));
    assert.ok(ids.includes(uncertain.id));
    const repeat = stageAddBibliographicRecords([{
      ...first, id: 'different-local-id', title: 'Alternate title, same DOI',
    }]);
    assert.equal(repeat.added, 0);
    assert.equal(repeat.skipped, 1);
  } finally {
    useStudioStore.setState(previous);
  }
});
