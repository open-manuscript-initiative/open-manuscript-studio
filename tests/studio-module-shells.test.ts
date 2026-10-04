import assert from 'node:assert/strict';
import test from 'node:test';

import {
  builtinModuleManifests,
  historyArchivesModule,
  studioModules,
  defaultModuleInstallationPolicy,
} from '../src/modules/catalog.ts';
import {
  getModulePreferencesStorageKey,
  readStudioModulePreferences,
  writeStudioModulePreferences,
  type ModulePreferenceStorage,
} from '../src/modules/preferences.ts';
import { getModuleShellCopy } from '../src/modules/moduleShellTranslations.ts';
import { resolveStudioModuleActivationState } from '../src/modules/types.ts';

const expectedModuleIds = [
  'org.omi.history-archives',
  'org.omi.religious-texts',
  'org.omi.critical-text-edition',
  'org.omi.corpus-linguistics',
  'org.omi.musicology',
  'org.omi.cultural-heritage',
  'org.omi.social-research-methods',
  'org.omi.legal-sources',
  'org.omi.research-reproducibility',
];

function createStorage(): ModulePreferenceStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test('registers all planned discipline shells with empty navigation contributions', () => {
  assert.deepEqual(
    studioModules.list().map(({ id }) => id),
    [...expectedModuleIds].sort(),
  );
  assert.deepEqual(
    defaultModuleInstallationPolicy.enabledModuleIds,
    expectedModuleIds,
  );
  assert.equal(builtinModuleManifests.length, expectedModuleIds.length);
  assert.ok(builtinModuleManifests.every(
    (module) => module.contributions.some(({ slot }) => slot === 'research-navigation'),
  ));
  assert.ok(builtinModuleManifests.every(
    (module) => module.requiredCapabilities.length === 0,
  ));
});

test('provides a translated title and description for every registered module shell', () => {
  for (const locale of ['en', 'de', 'hu']) {
    const copy = getModuleShellCopy(locale);
    for (const moduleId of expectedModuleIds) {
      assert.ok(copy.modules[moduleId]?.title, `Missing ${locale} title for ${moduleId}`);
      assert.ok(copy.modules[moduleId]?.description, `Missing ${locale} description for ${moduleId}`);
      assert.ok(copy.modules[moduleId]?.overview, `Missing ${locale} overview for ${moduleId}`);
    }
  }
});

test('stores active module selections separately by user and workspace', () => {
  const storage = createStorage();
  writeStudioModulePreferences('user-a', {
    workspaceId: 'workspace-a',
    activeModuleIds: [historyArchivesModule.id, historyArchivesModule.id],
  }, storage);

  assert.deepEqual(
    readStudioModulePreferences('user-a', 'workspace-a', storage),
    { workspaceId: 'workspace-a', activeModuleIds: [historyArchivesModule.id] },
  );
  assert.deepEqual(
    readStudioModulePreferences('user-b', 'workspace-a', storage),
    { workspaceId: 'workspace-a', activeModuleIds: [] },
  );
  assert.deepEqual(
    readStudioModulePreferences('user-a', 'workspace-b', storage),
    { workspaceId: 'workspace-b', activeModuleIds: [] },
  );
  assert.notEqual(
    getModulePreferencesStorageKey('user-a', 'workspace-a'),
    getModulePreferencesStorageKey('user-b', 'workspace-a'),
  );
});

test('ignores malformed stored module preference data', () => {
  const storage = createStorage();
  const key = getModulePreferencesStorageKey('user-a', 'workspace-a');
  storage.values.set(key, '{ broken json');

  assert.deepEqual(
    readStudioModulePreferences('user-a', 'workspace-a', storage),
    { workspaceId: 'workspace-a', activeModuleIds: [] },
  );

  storage.values.set(key, JSON.stringify({ version: 2, activeModuleIds: ['future'] }));
  assert.deepEqual(
    readStudioModulePreferences('user-a', 'workspace-a', storage),
    { workspaceId: 'workspace-a', activeModuleIds: [] },
  );
});

test('workspace activation state remains bounded by the enabled module policy', () => {
  assert.equal(
    resolveStudioModuleActivationState(
      historyArchivesModule.id,
      defaultModuleInstallationPolicy,
      { workspaceId: 'default', activeModuleIds: [] },
    ),
    'available',
  );
  assert.equal(
    resolveStudioModuleActivationState(
      historyArchivesModule.id,
      { revision: 2, enabledModuleIds: [] },
      { workspaceId: 'default', activeModuleIds: [historyArchivesModule.id] },
    ),
    'disabled-by-installation',
  );
  assert.equal(
    resolveStudioModuleActivationState(
      historyArchivesModule.id,
      defaultModuleInstallationPolicy,
      { workspaceId: 'default', activeModuleIds: [historyArchivesModule.id] },
    ),
    'active',
  );
});
