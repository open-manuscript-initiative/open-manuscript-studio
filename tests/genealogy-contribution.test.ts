import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphDiagramContribution, diagramSourceSuggestion } from '../src/modules/genealogy/manuscriptContribution.ts';
import { createGraphWorkspace } from '../src/modules/genealogy/model.ts';
import { stageInsertBlocks, stageRemoveBlock } from '../src/app/visualBlockActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
const input = { svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Reviewed diagram</text></svg>', title: 'Research diagram', width: 300, height: 150, source: 'Archive A, inventory 2', selfAuthored: false, approved: true, sourceLabel: 'Source', timestamp: '2026-11-13T10:00:00.000Z' };

test('a contribution requires explicit review and source or own-work declaration', () => {
  assert.throws(() => buildGraphDiagramContribution({ ...input, approved: false }));
  assert.throws(() => buildGraphDiagramContribution({ ...input, source: ' ' }));
  assert.throws(() => buildGraphDiagramContribution({ ...input, source: 'x'.repeat(20001) }));
  const workspace = createGraphWorkspace();
  // Research notes and import bytes must never enter the suggested citation.
  Object.assign(workspace, { notes: 'PRIVATE NOTES', imports: [{ originalBase64: 'PRIVATE RAW GEDCOM' }], nodes: [{ source: 'Archive A', notes: 'PRIVATE NOTES' }, { source: 'Archive A', notes: '' }], edges: [{ source: 'Archive B', notes: 'PRIVATE NOTES' }] });
  assert.equal(diagramSourceSuggestion(workspace), 'Archive A; Archive B');
});

test('source, bibliography and reviewed diagram are one reversible manuscript insertion and survive history/save', () => {
  const previous = useStudioStore.getState();
  try {
    const m = createVersionedTestManuscript();
    useStudioStore.setState({ manuscript: m, pendingChangeSet: null });
    const c = buildGraphDiagramContribution(input);
    const id = c.blocks[0].id;
    assert.equal(c.sourceAttributions[0].sourceObjectId, id);
    assert.equal(c.sourceAttributions[0].assertionStatus, 'author-confirmed');
    assert.equal(c.sourceAttributions[0].targetBibliographicRecordId, c.bibliographicRecords[0].id);
    assert.ok(stageInsertBlocks(m.sections[0].id, m.sections[0].blocks.length, c.blocks, 'Reviewed diagram', c.annotations, c.sourceAttributions, c.bibliographicRecords));
    useStudioStore.getState().checkpoint();
    const inserted = parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    assert.deepEqual(inserted.sourceAttributions, c.sourceAttributions);
    assert.match(renderHtmlArticle(inserted).html, /Archive A, inventory 2/);
    assert.match(renderJatsArticle(inserted).xml, /Archive A, inventory 2/);
    const revision = inserted.headRevisionId;
    assert.ok(stageRemoveBlock(id)); useStudioStore.getState().checkpoint();
    assert.equal(useStudioStore.getState().manuscript.sourceAttributions?.length, 0);
    useStudioStore.getState().revertRevision(revision);
    assert.deepEqual(parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript)).sourceAttributions, c.sourceAttributions);
  } finally { useStudioStore.setState(previous); }
});

test('own-work declaration remains in OMI without publishing its private source text or claiming verification', () => {
  const c = buildGraphDiagramContribution({ ...input, source: 'PRIVATE OWN RESEARCH', selfAuthored: true });
  assert.equal(c.blocks.length, 1); assert.equal(c.sourceAttributions.length, 0);
  assert.equal(c.bibliographicRecords.length, 0);
  const m = createVersionedTestManuscript(); m.sections[0].blocks.push(...c.blocks); m.annotations.push(...c.annotations);
  const reopened = parseOmiJson(serializeOmiJson(m));
  assert.match(JSON.stringify(reopened.annotations), /author-declared:own-research-data/);
  assert.match(JSON.stringify(reopened.annotations), /PRIVATE OWN RESEARCH/);
  for (const output of [renderHtmlArticle(reopened).html, renderJatsArticle(reopened).xml]) {
    assert.doesNotMatch(output, /PRIVATE OWN RESEARCH|omi-research-origin|author-declared/);
  }
});
