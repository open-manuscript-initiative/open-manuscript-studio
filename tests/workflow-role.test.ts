import assert from 'node:assert/strict';
import test from 'node:test';
import { isWorkflowTaskVisible, normalizeWorkflowRole, resolveWorkflowRole, workflowContextFromHandoff, workflowRoles } from '../src/model/workflowRole.ts';
import { getWorkflowRoleCopy } from '../src/i18n/workflowRoleTranslations.ts';
import { workflowRolePreferences } from '../server/src/services/workflowRolePreference.ts';

test('old profiles and unrecognized preferences retain the complete workspace', () => {
  for (const value of [undefined, null, '', 'admin', 'OWNER', { role: 'editor' }]) {
    assert.equal(normalizeWorkflowRole(value), 'general');
    assert.equal(isWorkflowTaskVisible(normalizeWorkflowRole(value), 'publication-editor'), true);
  }
});

test('role menus prioritize writing, translation, review and production tasks', () => {
  assert.equal(isWorkflowTaskVisible('author', 'manuscript'), true);
  assert.equal(isWorkflowTaskVisible('author', 'editorial-workflow'), true);
  assert.equal(isWorkflowTaskVisible('author', 'assignments'), true);
  assert.equal(isWorkflowTaskVisible('author', 'publication-editor'), false);
  assert.equal(isWorkflowTaskVisible('translator', 'translations'), true);
  assert.equal(isWorkflowTaskVisible('reviewer', 'editorial-workflow'), true);
  assert.equal(isWorkflowTaskVisible('editor', 'assignments'), true);
  assert.equal(isWorkflowTaskVisible('copyeditor', 'validation'), true);
  assert.equal(isWorkflowTaskVisible('layout-editor', 'publication-editor'), true);
  assert.equal(isWorkflowTaskVisible('layout-editor', 'translations'), false);
});

test('every role retains document opening, settings, tools and the full-menu escape hatch', () => {
  for (const role of workflowRoles) {
    for (const task of ['document', 'settings', 'tools'] as const) assert.equal(isWorkflowTaskVisible(role, task), true);
    assert.equal(isWorkflowTaskVisible(role, 'publication-editor', true), true);
    assert.equal(isWorkflowTaskVisible(role, 'assignments', true), true);
  }
});

test('verified OJS/OMP roles override the preference only for the matching manuscript', () => {
  for (const source of ['ojs', 'omp'] as const) {
    for (const role of ['author', 'editor'] as const) {
      const context = workflowContextFromHandoff('article', source, role);
      assert.deepEqual(resolveWorkflowRole('translator', context, 'article'), { role, source });
      assert.deepEqual(resolveWorkflowRole('translator', context, 'other-article'), { role: 'translator', source: 'profile' });
      assert.equal(context?.manuscriptId, 'article');
    }
  }
});

test('review launches map to reviewer and unknown actor modes never imply editor', () => {
  assert.equal(workflowContextFromHandoff('article', 'ojs', 'review')?.role, 'reviewer');
  for (const mode of [undefined, null, 'admin', 'manager', 'OWNER', '']) {
    assert.equal(workflowContextFromHandoff('article', 'omp', mode), null);
  }
  assert.deepEqual(resolveWorkflowRole('author', null, 'article'), { role: 'author', source: 'profile' });
});

test('client preferences match the API role vocabulary without institutional privilege roles', () => {
  assert.deepEqual(workflowRoles, workflowRolePreferences);
  assert.equal((workflowRoles as readonly string[]).includes('ADMIN'), false);
});

test('primary languages label every role and explain document-scoped external roles', () => {
  for (const locale of ['en', 'hu', 'de']) {
    const copy = getWorkflowRoleCopy(locale);
    for (const role of workflowRoles) assert.ok(copy.roles[role]);
    assert.ok(copy.showAll && copy.sources.ojs && copy.sources.omp && copy.hint);
  }
});
