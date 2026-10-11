import assert from 'node:assert/strict';
import test from 'node:test';
import { createHealthWorkspace, isHealthWorkspace, projectHealthSummary } from '../src/modules/health-research/model.ts';
import { readResearchExcerpts } from '../src/modules/researchModuleProjection.ts';
import { getDisciplineWorkspaceStorageKey } from '../src/modules/disciplineWorkspace.ts';

test('health workspace restores only its discipline and supported schema with complete string fields', () => {
  for (const discipline of ['psychology', 'medical-sciences'] as const) {
    const workspace = createHealthWorkspace(discipline);
    assert.ok(isHealthWorkspace(JSON.parse(JSON.stringify(workspace)), discipline));
    assert.equal(isHealthWorkspace({ ...workspace, schemaVersion: 2 }, discipline), false);
    assert.equal(isHealthWorkspace({ ...workspace, fields: { title: 'Synthetic' } }, discipline), false);
    assert.equal(isHealthWorkspace({ ...workspace, fields: { ...workspace.fields, ethics: 4 } }, discipline), false);
    assert.equal(isHealthWorkspace(workspace, discipline === 'psychology' ? 'medical-sciences' : 'psychology'), false);
  }
  assert.equal(isHealthWorkspace(null, 'psychology'), false);
});

test('health summary projection excludes synthetic confidential notes and requires an explicit summary', () => {
  const project = createHealthWorkspace('medical-sciences');
  project.fields.title = 'Synthetic study';
  project.fields.ethics = 'SYNTHETIC-CONFIDENTIAL';
  project.fields.outcomes = 'SYNTHETIC-PRIVATE-RESULTS';
  assert.equal(projectHealthSummary(project, 'medical-sciences'), null);
  project.fields.publicSummary = 'Aggregate methodology only';
  project.fields.source = 'Synthetic public protocol';
  assert.deepEqual(projectHealthSummary(project, 'medical-sciences'), {
    title: 'Synthetic study', text: 'Aggregate methodology only', source: 'Synthetic public protocol',
  });
  assert.equal(JSON.stringify(projectHealthSummary(project, 'medical-sciences')).includes('SYNTHETIC-'), false);
});

test('actual excerpt reader scopes health records by user and only returns approved summary fields', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => values.get(key) ?? null } } });
  try {
    for (const discipline of ['psychology', 'medical-sciences'] as const) {
      const moduleId = `org.omi.${discipline}`;
      const workspace = createHealthWorkspace(discipline);
      workspace.fields.title = 'Synthetic'; workspace.fields.publicSummary = 'Public methods';
      workspace.fields.source = 'Public protocol'; workspace.fields.consent = 'PRIVATE-SYNTHETIC-NOTE';
      values.set(getDisciplineWorkspaceStorageKey('researcher', 'default', moduleId), JSON.stringify(workspace));
      const excerpts = readResearchExcerpts(moduleId, 'researcher');
      assert.equal(excerpts.length, 1);
      assert.equal(excerpts[0].source, 'Public protocol');
      assert.equal(JSON.stringify(excerpts).includes('PRIVATE-SYNTHETIC-NOTE'), false);
      assert.deepEqual(readResearchExcerpts(moduleId, 'other'), []);
      values.set(getDisciplineWorkspaceStorageKey('researcher', 'default', moduleId), '{broken');
      assert.deepEqual(readResearchExcerpts(moduleId, 'researcher'), []);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
