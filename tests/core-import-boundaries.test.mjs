import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCoreSources, classifyRuntimeCoreImport, scanCoreSource,
} from '../scripts/check-core-import-boundaries.mjs';

const file = 'src/model/example.ts';
function verdict(source) { return scanCoreSource(file, source); }

test('core model accepts pure domain imports and safe type-only integration interfaces', () => {
  const results = verdict(`
    import { OmiManuscript } from '../types/omi';
    import type { TranslationSegment } from '../services/integrationExecutionApi';
    export type { ClientResult } from '../services/integrationExecutionApi';
    import { sha256HexSync } from './stateDigest';
  `);
  assert.deepEqual(results, []);
});

test('core cannot import frontend UI, Zustand store or platform code at runtime', () => {
  const results = verdict(`
    import { BlockEditor } from '../components/BlockEditor';
    import { useStudioStore } from '../app/useStudioStore';
    import { doWork } from '../services/authApi';
    export { createPlatform } from '../platform/nativeServerSelection';
  `);
  assert.equal(results.length, 4);
  assert.deepEqual(results.map(item => item.line), [2, 3, 4, 5]);
  assert.ok(results.every(item => item.reason.includes('runtime')));
});

test('core cannot directly load native/UI packages or dynamic imports', () => {
  const results = verdict(`
    import React from 'react';
    import { create } from 'zustand';
    const load = () => import('../editor/BlockEditor');
    const open = () => require('@tauri-apps/api/core');
  `);
  assert.equal(results.length, 4);
  assert.deepEqual(results.map(item => item.import), [
    'react', 'zustand', '../editor/BlockEditor', '@tauri-apps/api/core',
  ]);
});

test('core value imports cannot hide behind import equals or reexports', () => {
  const results = verdict(`
    import Native = require('../platform/filePicker');
    export * from '../store/workspaceStore';
  `);
  assert.equal(results.length, 2);
});

test('audit is stable across multiple files and reports precise, non-content diagnostics', () => {
  const results = auditCoreSources([
    { path: 'src/model/z.ts', text: "import React from 'react';" },
    { path: 'src/model/a.ts', text: "import { x } from '../store/x';" },
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].file, 'src/model/a.ts');
  assert.equal(results[0].line, 1);
  assert.equal(results[1].file, 'src/model/z.ts');
});

test('path matching does not prohibit editor-neutral domain files or type-only paths', () => {
  assert.equal(classifyRuntimeCoreImport(file, '../types/omi'), null);
  assert.equal(classifyRuntimeCoreImport(file, './stateDigest'), null);
  assert.equal(classifyRuntimeCoreImport(file, 'nanoid'), null);
  assert.match(classifyRuntimeCoreImport(file, '../services/cloudStorageApi'), /services runtime/);
});
