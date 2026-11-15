import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createGraphWorkspace, newGraphNode, mergeGraphs } from '../src/modules/genealogy/model.ts';
import { createResearchProjectFile, parseResearchProjectFile, researchProjectGraph } from '../src/modules/genealogy/projectFile.ts';
import { createGraphStore } from '../src/modules/genealogy/workspaceStore.ts';
const golden = () => JSON.parse(readFileSync(new URL('../src/schemas/fixtures/research-project-0.1.json', import.meta.url), 'utf8'));
const now='2026-11-15T08:00:00.000Z';

test('canonical golden survives an unrelated graph edit with identity, createdAt, unknown fields and resources intact', () => {
  const p=parseResearchProjectFile(JSON.stringify(golden()));
  const g=researchProjectGraph(p);g.nodes.push({...newGraphNode('synthetic-person'),label:'Synthetic author'});
  const edited=createResearchProjectFile(g,now,p);
  assert.equal(edited.projectId,p.projectId); assert.equal(edited.createdAt,p.createdAt);assert.equal(edited.updatedAt,now);
  assert.deepEqual(edited.resources[1],p.resources[1]);assert.deepEqual(edited.extensions,p.extensions);
  assert.deepEqual(edited.resources[0].extensions,p.resources[0].extensions);
  assert.equal(researchProjectGraph(parseResearchProjectFile(JSON.stringify(edited))).nodes[0].label,'Synthetic author');
});

test('prototype and bare graph are explicit migration inputs; original prototype is retained', () => {
  const graph=createGraphWorkspace();graph.title='Old graph';
  const source=JSON.stringify({format:'org.omi.research-project',version:1,projectId:graph.projectId,title:graph.title,modifiedAt:now,resources:[{id:'org.omi.genealogy-graph',schema:graph.schema,data:graph}],future:{keep:true}},null,2);
  const result=parseResearchProjectFile(source,now);
  assert.equal(result.format,'omi-research-project');assert.equal(result.version,'0.1.0');assert.equal(result.projectId,graph.projectId);
  assert.equal((result.extensions as Record<string,{source:string}>)['https://openmanuscript.org/extensions/research-project-migration/1'].source,source);
  assert.equal(parseResearchProjectFile(JSON.stringify(graph),now).projectId,graph.projectId);
  const canonical=parseResearchProjectFile(JSON.stringify(result));assert.deepEqual(canonical,result);
});

test('invalid versions, timestamps, duplicate IDs, ambiguous/unresolved resources and unsupported graph schema are rejected without mutating source', () => {
  const base=golden();
  assert.throws(() => parseResearchProjectFile(JSON.stringify({ ...createGraphWorkspace(), format: 'omi-research-project', version: '9.0.0' })));
  for (const patch of [{version:'9.0.0'},{createdAt:'2026-02-30T00:00:00Z'},{updatedAt:'bad'},
    {resources:[base.resources[0],base.resources[0]]},
    {resources:[{...base.resources[0],path:'../escape',sizeBytes:1,sha256:'0'.repeat(64)}]},
    {resources:[{...base.resources[0],inline:undefined,path:'resources/data.json',sizeBytes:1,sha256:'0'.repeat(64)}]},
    {resources:[{...base.resources[0],schemaVersion:'future'}]},
    {resources:[{...base.resources[0],inline:{...base.resources[0].inline,projectId:'other'}}]}]) {
    const value={...base,...patch};const raw=JSON.stringify(value);
    assert.throws(()=>parseResearchProjectFile(raw));assert.equal(JSON.stringify(value),raw);
  }
});

test('opening, adding, undoing and reloading preserve distinct project identities and leave legacy keys unchanged', async () => {
  const legacy=createGraphWorkspace();legacy.nodes=[newGraphNode('existing')];delete legacy.projectId;
  const source=structuredClone(legacy);const values=new Map<string,unknown>([['user/workspace',legacy]]);
  const storage={read:async(k:string)=>values.get(k),write:async(k:string,v:unknown)=>{values.set(k,structuredClone(v));}};
  const s=createGraphStore(storage);await s.load('user/workspace');
  assert.deepEqual(values.get('user/workspace'),source);assert.equal(values.size,1);
  const destinationId=s.snapshot('user/workspace').workspace.projectId;
  const incoming=golden();s.openProject('user/workspace',incoming);await s.flush('user/workspace');
  assert.equal(s.snapshot('user/workspace').project.projectId,incoming.projectId);
  s.update('user/workspace',g=>({...g,nodes:[newGraphNode('new')]}));await s.flush('user/workspace');
  const reopened=createGraphStore(storage);await reopened.load('user/workspace');
  assert.deepEqual(reopened.snapshot('user/workspace').project.resources[1],incoming.resources[1]);
  assert.equal(reopened.snapshot('user/workspace').workspace.nodes[0].id,'new');
  s.undo('user/workspace');s.undo('user/workspace');await s.flush('user/workspace');
  assert.equal(s.snapshot('user/workspace').project.projectId,destinationId);
  const before=s.snapshot('user/workspace').project;
  s.update('user/workspace',g=>mergeGraphs(g,researchProjectGraph(incoming),()=>crypto.randomUUID()));await s.flush('user/workspace');
  assert.equal(s.snapshot('user/workspace').project.projectId,destinationId);
  assert.equal(s.snapshot('user/workspace').project.createdAt,before.createdAt);
  assert.deepEqual(values.get('user/workspace'),source);
});

test('a failed package write cannot advance the selected-project binding or claim a save', async () => {
  const values=new Map<string,unknown>();let fail=false;
  const storage={read:async(k:string)=>values.get(k),write:async(k:string,v:unknown)=>{if(fail)throw Error('quota');values.set(k,structuredClone(v));}};
  const s=createGraphStore(storage);await s.load('key');s.update('key',g=>({...g,title:'Before'}));await s.flush('key');
  const before=structuredClone(values.get('key:project-binding-v1'));fail=true;
  s.openProject('key',golden());await s.flush('key');
  assert.equal(s.snapshot('key').status,'error');assert.deepEqual(values.get('key:project-binding-v1'),before);
  assert.equal(s.snapshot('key').project.projectId,golden().projectId);
});
