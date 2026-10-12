import assert from 'node:assert/strict';
import test from 'node:test';
import { stageInsertBlocks, stageRemoveBlock } from '../src/app/visualBlockActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { parseOmiJson, toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import type { OmiSourceAttribution } from '../src/types/omi.ts';
const relation = (id: string, sourceObjectId: string): OmiSourceAttribution => ({ id, sourceObjectId, targetBibliographicRecordId: 'synthetic-source', predicate: 'prov:wasDerivedFrom', assertionStatus: 'author-confirmed' });

test('insert → delete subtree → checkpoint → save/reopen retains prior source history and unrelated relationships', () => {
  const previous = useStudioStore.getState();
  try {
    useStudioStore.setState({ manuscript: createVersionedTestManuscript(), pendingChangeSet: null });
    const m = useStudioStore.getState().manuscript;
    const sectionId = m.sections[0].id;
    assert.ok(stageInsertBlocks(sectionId, m.sections[0].blocks.length,
      [{ id: 'synthetic-parent', type: 'paragraph', content: 'Synthetic', children: [{ id: 'synthetic-child', type: 'paragraph', content: 'Child' }] }, { id: 'synthetic-unrelated', type: 'paragraph', content: 'Unrelated' }],
      'Synthetic source import', [], [relation('parent-link', 'synthetic-parent'), relation('child-link', 'synthetic-child'), relation('unrelated-link', 'synthetic-unrelated')],
      [{ id: 'synthetic-source', type: 'dataset', title: 'Synthetic source', contributors: [], identifiers: [], status: 'provisional' }]));
    useStudioStore.getState().checkpoint();
    const insertedRevision = useStudioStore.getState().manuscript.headRevisionId;
    assert.ok(stageRemoveBlock('synthetic-parent'));
    assert.deepEqual(useStudioStore.getState().manuscript.sourceAttributions?.map(r => r.id), ['unrelated-link']);
    assert.ok(useStudioStore.getState().pendingChangeSet?.events.some(event => event.path === '/sourceAttributions'));
    useStudioStore.getState().checkpoint();
    const reopened = parseOmiJson(JSON.stringify(toPortableOmiManuscript(useStudioStore.getState().manuscript)));
    assert.deepEqual(reopened.sourceAttributions?.map(r => r.id), ['unrelated-link']);
    const historical = reopened.revisionHistory.revisions.find(r => r.id === insertedRevision);
    assert.deepEqual(historical?.snapshot.state.sourceAttributions?.map(r => r.id), ['parent-link', 'child-link', 'unrelated-link']);
    assert.ok(reopened.bibliographicRecords?.some(record => record.id === 'synthetic-source'));
    useStudioStore.setState({ manuscript: reopened, pendingChangeSet: null });
    useStudioStore.getState().revertRevision(insertedRevision);
    const restored = parseOmiJson(JSON.stringify(toPortableOmiManuscript(useStudioStore.getState().manuscript)));
    assert.deepEqual(restored.sourceAttributions?.map(r => r.id), ['parent-link', 'child-link', 'unrelated-link']);
    assert.ok(restored.sections[0].blocks.some(block => block.id === 'synthetic-parent'));
  } finally { useStudioStore.setState(previous); }
});

test('HTML/JATS explicitly report unsupported source relationships without fabricating citations or mutating OMI', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.sourceAttributions = [relation('synthetic-link', manuscript.sections[0].blocks[0].id)];
  manuscript.bibliographicRecords = [{ id: 'synthetic-source', type: 'dataset', title: 'Synthetic source', contributors: [], identifiers: [], status: 'provisional' }];
  const before = JSON.stringify(manuscript);
  for (const renderer of [renderHtmlArticle, renderJatsArticle]) {
    const result = renderer(manuscript);
    const warnings = result.diagnostics.filter(d => d.code === 'source-attribution-not-preserved');
    assert.equal(warnings.length, 1); assert.equal(warnings[0].severity, 'warning');
    assert.equal(warnings[0].targetId, 'synthetic-link'); assert.ok(result.validForExport);
    assert.equal(JSON.stringify(manuscript), before);
    const clean = { ...manuscript, sourceAttributions: [] };
    assert.equal(renderer(clean).diagnostics.some(d => d.code === 'source-attribution-not-preserved'), false);
  }
});
