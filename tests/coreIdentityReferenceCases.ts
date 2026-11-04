import assert from 'node:assert/strict';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import {
  stageMoveSectionSibling, stageReparentSection, stageSectionLayoutChange,
  stageSectionTitleChange,
} from '../src/app/sectionActions.ts';
import { stageInsertBlocks, stageRemoveBlock } from '../src/app/visualBlockActions.ts';
import { createCrossReference, validateCrossReferences } from '../src/model/crossReferences.ts';
import { getActiveTombstone } from '../src/model/tombstone.ts';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning.ts';
import { parseOmiJson, toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { validateStudioManuscript } from '../src/services/manuscriptValidation.ts';
import type { OmiBlock, OmiManuscript, OmiSection } from '../src/types/omi.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

// These are observation targets, not new producer declarations or a conformance claim.
export const identityReferenceSpecifications = {
  'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-100': '0.2.0', 'OMI-SPEC-120': '0.3.0',
};
const TARGET = 'é';
const DECOY = 'e\u0301'; // A distinct opaque identifier, even though its glyph looks similar.
const paragraph = (text: string, bold = false) => JSON.stringify({ type: 'doc', content: [{
  type: 'paragraph', content: [{ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }],
}] });

function fixture(): OmiManuscript {
  const manuscript = createTestManuscript();
  manuscript.sections = [
    { id: 'section-a', title: 'Source', blocks: [{
      id: 'source', type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{
        type: 'paragraph', content: [{ type: 'text', text: 'See ' }, {
          type: 'omiCrossReference', attrs: { crossReferenceId: 'xref', anchorId: 'xref-anchor', label: 'Figure 1', unresolved: false },
        }],
      }] }),
    }] },
    { id: 'section-b', title: 'Target study', blocks: [
      { id: TARGET, type: 'image', content: '', visual: {
        kind: 'image', src: 'data:image/png;base64,AA==', mediaType: 'image/png', alt: 'Target figure', caption: 'Target',
      }, children: [{ id: 'caption-child', type: 'paragraph', content: paragraph('Caption child') }] },
      { id: 'body', type: 'paragraph', content: paragraph('Original text 中文') },
    ] },
    { id: 'section-child', parentSectionId: 'section-b', title: 'Child', blocks: [{ id: 'child-body', type: 'paragraph', content: paragraph('Child text') }] },
    { id: 'section-c', title: 'Unrelated study', blocks: [{
      id: DECOY, type: 'image', content: '', visual: {
        kind: 'image', src: 'data:image/png;base64,AA==', mediaType: 'image/png', alt: 'Unrelated figure', caption: 'Decoy',
      },
    }] },
  ];
  manuscript.crossReferences = [createCrossReference({
    id: 'xref', anchorId: 'xref-anchor', targetId: TARGET, targetKind: 'figure', sourceBlockId: 'source',
  })];
  const state = extractManuscriptState(manuscript);
  return { ...state, ...createInitialVersioningEnvelope(state, {
    summary: 'Synthetic identity/reference fixture', timestamp: state.createdAt, completeness: 'complete',
  }) };
}

function identities(manuscript: OmiManuscript): string[] {
  const ids = [manuscript.id];
  function blocks(items: OmiBlock[]) { for (const block of items) { ids.push(block.id); blocks(block.children ?? []); } }
  function sections(items: OmiSection[]) { for (const section of items) { ids.push(section.id); blocks(section.blocks); sections(section.children ?? []); } }
  sections(manuscript.sections);
  for (const objects of [manuscript.agents, manuscript.contributions, manuscript.annotations,
    manuscript.citations, manuscript.crossReferences ?? []]) ids.push(...objects.map(item => item.id));
  return ids.sort();
}

function reopenCurrent(): OmiManuscript {
  useStudioStore.getState().checkpoint();
  return parseOmiJson(JSON.stringify(toPortableOmiManuscript(useStudioStore.getState().manuscript)));
}

async function withFixture(run: (initial: OmiManuscript) => void | Promise<void>) {
  const previous = useStudioStore.getState();
  const initial = fixture();
  try {
    useStudioStore.setState({ manuscript: initial, pendingChangeSet: null, selectedSectionId: 'section-b' });
    await run(initial);
  } finally { useStudioStore.setState(previous); }
}

function assertSameIdentities(initial: OmiManuscript, current: OmiManuscript) {
  assert.deepEqual(identities(current), identities(initial));
  assert.deepEqual(current.crossReferences, initial.crossReferences);
  assert.deepEqual(validateCrossReferences(current), []);
}

export const coreIdentityReferenceCases = [
  {
    id: 'text-edit-save-reopen', requirements: ['REQ-OBJ-004', 'REQ-DOC-002'],
    run: () => withFixture(initial => {
      useStudioStore.getState().updateBlock('body', paragraph('Edited text árvíztűrő 中文'));
      const reopened = reopenCurrent();
      assertSameIdentities(initial, reopened);
      assert.equal(reopened.sections[1]!.blocks[1]!.content, paragraph('Edited text árvíztűrő 中文'));
    }),
  },
  {
    id: 'formatting-preserves-identity', requirements: ['REQ-PRI-004', 'REQ-OBJ-004', 'REQ-DOC-002'],
    run: () => withFixture(initial => {
      useStudioStore.getState().updateBlock('body', paragraph('Original text 中文', true));
      const reopened = reopenCurrent();
      assertSameIdentities(initial, reopened);
      assert.equal(reopened.sections[1]!.blocks[1]!.content, paragraph('Original text 中文', true));
    }),
  },
  {
    id: 'rename-preserves-reference-targets', requirements: ['REQ-OBJ-004', 'REQ-DOC-002'],
    run: () => withFixture(initial => {
      stageSectionTitleChange('section-b', 'Renamed target study');
      const reopened = reopenCurrent();
      assertSameIdentities(initial, reopened);
      assert.equal(reopened.sections[1]!.title, 'Renamed target study');
    }),
  },
  {
    id: 'subtree-move-reading-order-round-trip', requirements: ['REQ-OBJ-004', 'REQ-DOC-002', 'REQ-DOC-003'],
    run: () => withFixture(initial => {
      assert.equal(stageMoveSectionSibling('section-b', 1), true);
      const reopened = reopenCurrent();
      assertSameIdentities(initial, reopened);
      assert.deepEqual(reopened.sections.map(section => section.id), ['section-a', 'section-c', 'section-b', 'section-child']);
      assert.equal(reopened.sections[3]!.parentSectionId, 'section-b');
      const source = JSON.parse(reopened.sections[0]!.blocks[0]!.content);
      assert.equal(source.content[0].content[1].attrs.label, 'Figure 2');
      assert.equal(reopened.crossReferences![0]!.targetId, TARGET);
      assert.deepEqual(reopened.sections[2]!.blocks, initial.sections[1]!.blocks);
    }),
  },
  {
    id: 'reparent-and-cycle-rejection', requirements: ['REQ-OBJ-004', 'REQ-DOC-002', 'REQ-DOC-003'],
    run: () => withFixture(initial => {
      assert.equal(stageReparentSection('section-child', 'section-a'), true);
      const reopened = reopenCurrent();
      assertSameIdentities(initial, reopened);
      assert.deepEqual(reopened.sections.map(section => section.id), ['section-a', 'section-child', 'section-b', 'section-c']);
      assert.equal(reopened.sections[1]!.parentSectionId, 'section-a');
      const before = useStudioStore.getState();
      assert.equal(stageReparentSection('section-a', 'section-child'), false);
      assert.equal(useStudioStore.getState(), before);
    }),
  },
  {
    id: 'layout-preserves-content-and-identity', requirements: ['REQ-PRI-004', 'REQ-OBJ-004'],
    run: () => withFixture(initial => {
      assert.equal(stageSectionLayoutChange('section-b', { columns: 2, columnGapMm: 10 }), true);
      const reopened = reopenCurrent();
      assertSameIdentities(initial, reopened);
      assert.deepEqual(reopened.sections.map(section => section.blocks), initial.sections.map(section => section.blocks));
      assert.deepEqual(reopened.sections[1]!.layout, { columns: 2, columnGapMm: 10 });
    }),
  },
  {
    id: 'delete-target-atomically-removes-dangling-relation', requirements: ['REQ-OBJ-009'],
    run: () => withFixture(async initial => {
      const observations: OmiManuscript[] = [];
      const unsubscribe = useStudioStore.subscribe(state => observations.push(state.manuscript));
      try { assert.equal(stageRemoveBlock(TARGET), true); } finally { unsubscribe(); }
      assert.equal(observations.length, 1);
      const changed = observations[0]!;
      assert.ok(!identities(changed).includes(TARGET));
      assert.ok(identities(changed).includes(DECOY));
      assert.deepEqual(changed.crossReferences, []);
      const marker = JSON.parse(changed.sections[0]!.blocks[0]!.content).content[0].content[1];
      assert.deepEqual(marker, { type: 'text', text: '[unresolved reference]' });
      assert.deepEqual(validateCrossReferences(changed), []);
      const report = await validateStudioManuscript(changed);
      assert.ok(!report.diagnostics.some(item => item.code === 'unresolved-reference' || item.code === 'invalid-cross-reference'));
      assert.ok(useStudioStore.getState().pendingChangeSet!.events.some(event => event.path === '/crossReferences'
        && JSON.stringify(event.previousValue) === JSON.stringify(initial.crossReferences)));
      const reopened = reopenCurrent();
      assert.deepEqual(reopened.crossReferences, []);
      assert.deepEqual(reopened.revisionHistory.revisions[0]!.snapshot.state.crossReferences, initial.crossReferences);
      assert.equal(reopened.sections.find(section => section.id === 'section-c')!.blocks[0]!.id, DECOY);
      assert.ok(identities(initial).includes(TARGET));
    }),
  },
  {
    id: 'unresolved-reference-reported-without-retargeting', requirements: ['REQ-OBJ-008'],
    run: () => withFixture(async initial => {
      const broken = structuredClone(initial);
      broken.crossReferences![0]!.targetId = 'deleted-or-unknown';
      const before = structuredClone(broken);
      const report = await validateStudioManuscript(broken);
      assert.ok(report.diagnostics.some(item => item.code === 'unresolved-reference'
        && item.path === '/crossReferences/0/targetId' && item.targetId === 'xref'));
      assert.deepEqual(broken, before);
      assert.equal(broken.crossReferences![0]!.targetId, 'deleted-or-unknown');
      assert.ok(identities(broken).includes(TARGET) && identities(broken).includes(DECOY));
      assert.throws(() => toPortableOmiManuscript(broken), /Unresolved OMI reference/);
    }),
  },
  {
    id: 'deletion-history-and-explicit-restoration', requirements: ['REQ-OBJ-009', 'REQ-OBJ-016'],
    run: () => withFixture(initial => {
      const originalRevision = initial.headRevisionId;
      assert.equal(stageRemoveBlock(TARGET), true);
      const deleted = reopenCurrent();
      assert.ok(getActiveTombstone(deleted.tombstones!, TARGET));
      assert.ok(getActiveTombstone(deleted.tombstones!, 'caption-child'));
      assert.ok(identities(initial).includes(TARGET));
      assert.ok(!identities(deleted).includes(TARGET));
      useStudioStore.setState({ manuscript: deleted, pendingChangeSet: null });
      useStudioStore.getState().revertRevision(originalRevision);
      const restored = reopenCurrent();
      assertSameIdentities(initial, restored);
      assert.notEqual(restored.headRevisionId, originalRevision);
      assert.equal(getActiveTombstone(restored.tombstones!, TARGET), undefined);
      assert.ok(restored.tombstones!.some(item => item.objectId === TARGET && item.restoredByRevisionId));
    }),
  },
  {
    id: 'source-deletion-removes-reference-record', requirements: ['REQ-OBJ-009'],
    run: () => withFixture(initial => {
      assert.equal(stageRemoveBlock('source'), true);
      const reopened = reopenCurrent();
      assert.deepEqual(reopened.crossReferences, []);
      assert.deepEqual(validateCrossReferences(reopened), []);
      assert.deepEqual(reopened.sections[1]!.blocks, initial.sections[1]!.blocks);
      assert.ok(getActiveTombstone(reopened.tombstones!, 'source'));
    }),
  },
  {
    id: 'subtree-deletion-cleans-dependent-collections', requirements: ['REQ-OBJ-009', 'REQ-OBJ-016'],
    run: () => withFixture(initial => {
      const state = extractManuscriptState(initial);
      state.annotations = [{ id: 'comment-child', type: 'comment', targetBlockId: 'caption-child', body: 'Comment', renderingHint: 'margin' }];
      state.bibliographicRecords = [{ id: 'record', type: 'book', title: 'Synthetic source', contributors: [], identifiers: [], status: 'resolved' }];
      state.citations = [{ id: 'citation-child', target: 'record', anchorId: 'citation-anchor', targetBlockId: 'caption-child', clusterId: 'cluster-child' }];
      state.citationClusters = [{ id: 'cluster-child', anchorId: 'citation-anchor', targetBlockId: 'caption-child', citationIds: ['citation-child'] }];
      state.namedAnchors = [{ id: 'bookmark-child', name: 'Caption', exportName: 'Caption', targetId: 'caption-child', targetKind: 'block' }];
      state.contributions = [...state.contributions, { ...state.contributions[0]!, id: 'contribution-child', targetId: 'caption-child' }];
      state.sourceAttributions = [{ id: 'derivation-child', sourceObjectId: 'caption-child', targetBibliographicRecordId: 'record', predicate: 'prov:wasDerivedFrom', assertionStatus: 'author-confirmed' }];
      state.sections[1]!.blocks[0]!.children![0]!.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{
        type: 'omiCitation', attrs: { citationId: 'citation-child', citationIds: ['citation-child'], clusterId: 'cluster-child', anchorId: 'citation-anchor', label: 'Source' },
      }] }] });
      const manuscript = { ...state, ...createInitialVersioningEnvelope(state, { summary: 'Related objects fixture', timestamp: state.createdAt, completeness: 'complete' }) };
      // First prove the extended fixture is structurally portable before deletion.
      toPortableOmiManuscript(manuscript);
      useStudioStore.setState({ manuscript, pendingChangeSet: null });
      assert.equal(stageRemoveBlock(TARGET), true);
      const reopened = reopenCurrent();
      for (const key of ['annotations', 'citations', 'citationClusters', 'namedAnchors', 'sourceAttributions', 'crossReferences'] as const) assert.deepEqual(reopened[key], []);
      assert.deepEqual(reopened.contributions.map(item => item.id), ['contribution-author']);
      assert.deepEqual(reopened.bibliographicRecords!.map(item => item.id), ['record']);
      for (const id of [TARGET, 'caption-child', 'comment-child', 'citation-child', 'contribution-child']) assert.ok(getActiveTombstone(reopened.tombstones!, id));
      assert.equal(reopened.revisionHistory.revisions[0]!.snapshot.state.annotations[0]!.id, 'comment-child');
    }),
  },
  {
    id: 'reject-deleted-identifier-before-state-change', requirements: ['REQ-OBJ-016'],
    run: () => withFixture(() => {
      assert.equal(stageRemoveBlock(TARGET), true);
      for (const committed of [false, true]) {
        if (committed) reopenCurrent();
        for (const id of [TARGET, 'caption-child']) {
          const replacement: OmiBlock = { id, type: 'paragraph', content: 'Unrelated replacement' };
          for (const block of [replacement, { id: 'new-parent', type: 'paragraph', content: '', children: [replacement] } as OmiBlock]) {
            const before = useStudioStore.getState();
            let notifications = 0;
            const unsubscribe = useStudioStore.subscribe(() => notifications++);
            try {
              assert.throws(() => stageInsertBlocks('section-b', 0, [block]), /reserved by deletion history/);
            } finally { unsubscribe(); }
            assert.equal(useStudioStore.getState(), before);
            assert.equal(notifications, 0);
          }
        }
      }
    }),
  },
];

export async function runCoreIdentityReferenceCases() {
  const results = [];
  for (const item of coreIdentityReferenceCases) {
    await item.run();
    results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const });
  }
  return results;
}
