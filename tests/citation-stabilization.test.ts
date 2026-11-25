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


test('adding a similar bibliography work never silently retargets an existing source derivation claim', () => {
  const previous = useStudioStore.getState();
  try {
    const manuscript = createVersionedTestManuscript();
    const existing = setBibliographicIdentifier(
      createBibliographicRecord({ title: 'Edited archival collection', issued: '2026' }), 'doi', '10.2000/edition-a',
    );
    const incoming = setBibliographicIdentifier(
      createBibliographicRecord({ title: 'Edited archival collection', issued: '2026' }), 'doi', '10.2000/edition-b',
    );
    manuscript.bibliographicRecords = [existing];
    manuscript.sourceAttributions = [{
      id: 'source-link', sourceObjectId: manuscript.sections[0]!.blocks[0]!.id,
      targetBibliographicRecordId: existing.id, predicate: 'prov:wasDerivedFrom',
      assertionStatus: 'author-declared',
    }];
    useStudioStore.setState({ manuscript, pendingChangeSet: null });
    const citationsBefore = JSON.stringify(manuscript.citations);
    assert.equal(stageAddBibliographicRecords([incoming]).added, 1);
    const updated = useStudioStore.getState().manuscript;
    assert.deepEqual(updated.sourceAttributions, manuscript.sourceAttributions);
    assert.ok(updated.bibliographicRecords?.some((r) => r.id === incoming.id));
    assert.equal(JSON.stringify(updated.citations), citationsBefore);
    assert.equal(updated.sections[0]!.blocks[0]!.content, manuscript.sections[0]!.blocks[0]!.content);
  } finally { useStudioStore.setState(previous); }
});

test('table citation creation, shared metadata edits and cluster removal are atomic',async()=>{
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {createCitationCluster,collectCitationAnchors}=await import('../src/model/citationClusters.ts');
  const {stageCreateCitationCluster,stageUpdateCitation,stageRemoveCitation,stageRemoveCitationCluster}=await import('../src/app/citationActions.ts');
  const {stageUpdateVisualBlock}=await import('../src/app/visualBlockActions.ts');
  const {tableCellDocument}=await import('../src/model/tableLayout.ts');
  const previous=useStudioStore.getState();
  try{
    const manuscript=createVersionedTestManuscript();
    const first=createBibliographicRecord({title:'Archival source',issued:'2020'});
    const second=createBibliographicRecord({title:'Printed source',issued:'2022'});
    manuscript.bibliographicRecords=[first,second];
    const block=createTableBlock([['Before']],{headerRows:0},'citation-table');
    manuscript.sections[0]!.blocks.push(block);
    useStudioStore.setState({manuscript,pendingChangeSet:null});
    const table=block.visual;
    assert.ok(table?.kind==='table');
    const creation=createCitationCluster([{target:first.id,locator:{type:'page',value:'12'}},{target:second.id}],block.id);
    const marker={type:'omiCitation',attrs:{citationId:creation.cluster.citationIds[0],citationIds:creation.cluster.citationIds,clusterId:creation.cluster.id,anchorId:creation.cluster.anchorId,label:'[citation]'}};
    const next={...table,cellContent:{'0:0':JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Before'},marker]}]})}};
    assert.equal(stageUpdateVisualBlock(block.id,next),false);
    assert.equal(stageCreateCitationCluster(creation,{expected:{...table,cells:[['Stale']]},next}),false);
    assert.equal(stageCreateCitationCluster(creation,{expected:table,next}),true);
    const current=()=>useStudioStore.getState().manuscript;
    const visual=()=>{const v=current().sections[0]!.blocks.find(b=>b.id===block.id)?.visual;assert.ok(v?.kind==='table');return v;};
    assert.deepEqual(collectCitationAnchors(current().sections).filter(a=>a.targetBlockId===block.id).map(a=>a.citationId),creation.cluster.citationIds);
    assert.deepEqual(visual().cells,[['Before']]);
    assert.notEqual(tableCellDocument(visual(),0,0)?.content?.[0]?.content?.[1]?.attrs?.label,'[citation]');
    assert.ok(useStudioStore.getState().pendingChangeSet?.events.some(e=>e.operation==='block.update'&&e.targetId===block.id));
    assert.equal(stageUpdateVisualBlock(block.id,table),false);
    assert.equal(stageUpdateCitation(creation.citations[0]!.id,{locator:{type:'page',value:'99'}}),true);
    assert.match(String(tableCellDocument(visual(),0,0)?.content?.[0]?.content?.[1]?.attrs?.label),/99/);
    assert.equal(stageRemoveCitation(creation.citations[0]!.id),true);
    assert.deepEqual(collectCitationAnchors(current().sections).filter(a=>a.targetBlockId===block.id).map(a=>a.citationId),[creation.citations[1]!.id]);
    assert.equal(stageRemoveCitationCluster(creation.cluster.id),true);
    assert.deepEqual(collectCitationAnchors(current().sections).filter(a=>a.targetBlockId===block.id),[]);
    assert.deepEqual(visual().cells,[['Before']]);
    assert.equal(tableCellDocument(visual(),0,0)?.content?.[0]?.content?.length,1);
  }finally{useStudioStore.setState(previous);}
});
test('nested table citation traversal and label synchronization preserve matrix, notes and geometry',async()=>{
  const {createCitationCluster,collectCitationAnchors,synchronizeCitationLabels,removeCitationClusterFromSections}=await import('../src/model/citationClusters.ts');
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {tableCellPlainText,tableCellDocument,cellNestedTable}=await import('../src/model/tableLayout.ts');
  const record=createBibliographicRecord({title:'Nested citation',issued:'2025'});
  const creation=createCitationCluster([{target:record.id,locator:{type:'page',value:'42'}}],'outer');
  const atom={type:'omiCitation',attrs:{citationId:creation.citations[0]!.id,citationIds:creation.cluster.citationIds,clusterId:creation.cluster.id,anchorId:creation.cluster.anchorId,label:'[citation]'}};
  const inner={kind:'table',cells:[['Nested']],headerRows:0,cellContent:{'0:0':JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Nested'},atom]}]})}};
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Outer'}]},{type:'omiCellTable',attrs:{table:inner}}]};
  const block=createTableBlock([[tableCellPlainText(doc)]],{headerRows:0,cellContent:{'0:0':JSON.stringify(doc)}},'outer');
  const sections=[{id:'s',title:'',blocks:[block]}];
  assert.equal(collectCitationAnchors(sections)[0]?.targetBlockId,'outer');
  const updated=synchronizeCitationLabels(sections,creation.citations,[record],[creation.cluster]);
  const table=updated[0]!.blocks[0]!.visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(table.cells,[['Outer\nNested']]);
  const nested=cellNestedTable(tableCellDocument(table,0,0)!.content![1]!);
  assert.ok(nested);
  assert.match(String(tableCellDocument(nested,0,0)?.content?.[0]?.content?.[1]?.attrs?.label),/42/);
  assert.equal(collectCitationBlockContentChanges(sections,updated)[0]?.operation,'block.update');
  assert.equal(collectCitationAnchors(removeCitationClusterFromSections(updated,creation.cluster.id)).length,0);
  assert.equal(collectCitationAnchors(sections).length,1);
});
