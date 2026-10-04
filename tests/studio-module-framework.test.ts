import assert from 'node:assert/strict';
import test from 'node:test';

import { StudioModuleRegistry } from '../src/modules/registry.ts';
import {
  resolveStudioModuleActivationState,
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../src/modules/types.ts';

function manifest(overrides: Partial<StudioModuleManifest> = {}): StudioModuleManifest {
  return {
    id: 'org.example.research-tools',
    version: '1.0.0',
    apiVersion: STUDIO_MODULE_API_VERSION,
    titleKey: 'modules.research.title',
    descriptionKey: 'modules.research.description',
    disciplines: ['history'],
    requiredCapabilities: ['archives.search'],
    contributions: [
      {
        id: 'search',
        slot: 'workspace-tools',
        titleKey: 'modules.research.search',
      },
    ],
    ...overrides,
  };
}

test('registers, snapshots, and sorts valid manifests', () => {
  const registry = new StudioModuleRegistry();
  const source = manifest();
  registry.register(source);
  registry.register(manifest({ id: 'org.example.citation-tools' }));

  source.requiredCapabilities.push('admin');
  assert.deepEqual(
    registry.list().map(({ id }) => id),
    ['org.example.citation-tools', 'org.example.research-tools'],
  );
  assert.deepEqual(
    registry.get('org.example.research-tools')?.requiredCapabilities,
    ['archives.search'],
  );
  assert.equal(Object.isFrozen(registry.get('org.example.research-tools')), true);
});

test('rejects duplicate module IDs and unsupported API versions', () => {
  const registry = new StudioModuleRegistry();
  registry.register(manifest());
  assert.throws(() => registry.register(manifest()), /already registered/);
  assert.throws(
    () => registry.register(manifest({ apiVersion: 'omi-studio-module/2' as typeof STUDIO_MODULE_API_VERSION })),
    /unsupported API/,
  );
});

test('rejects malformed identifiers, duplicate contributions, and invalid permission names', () => {
  const registry = new StudioModuleRegistry();
  assert.throws(() => registry.register(manifest({ id: 'Research Module' })), /Invalid Studio module id/);
  assert.throws(
    () => registry.register(manifest({
      requiredCapabilities: ['archives.search', 'archives.search'],
    })),
    /Duplicate capability/,
  );
  assert.throws(
    () => registry.register(manifest({
      contributions: [
        { id: 'search', slot: 'workspace-tools', titleKey: 'modules.search' },
        { id: 'search', slot: 'workspace-home', titleKey: 'modules.search' },
      ],
    })),
    /Duplicate contribution/,
  );
});

test('installation administrators gate availability; workspace preferences only activate available modules', () => {
  const installation = {
    revision: 4,
    enabledModuleIds: ['org.example.research-tools'],
  };
  const workspace = {
    workspaceId: 'workspace-1',
    activeModuleIds: ['org.example.research-tools'],
  };

  assert.equal(
    resolveStudioModuleActivationState('org.example.research-tools', installation, workspace),
    'active',
  );
  assert.equal(
    resolveStudioModuleActivationState('org.example.research-tools', installation, {
      ...workspace,
      activeModuleIds: [],
    }),
    'available',
  );
  assert.equal(
    resolveStudioModuleActivationState('org.example.citation-tools', installation, workspace),
    'disabled-by-installation',
  );
});
