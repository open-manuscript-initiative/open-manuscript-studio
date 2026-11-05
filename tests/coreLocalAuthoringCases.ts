import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { useAuthStore } from '../src/store/authStore.ts';
import { createStudioDocumentSessions } from '../src/app/documentSessions.ts';
import { stageInsertBlocks, stageRemoveBlock } from '../src/app/visualBlockActions.ts';
import { setScholarlyLocalizedText } from '../src/app/scholarlyMetadataActions.ts';
import { attachImportedDocumentSource, selfAuthoredExternalBlockOrigin } from '../src/model/importedDocumentSource.ts';
import { MANUSCRIPT_IMPORT_ORIGIN, manuscriptImportOrigin } from '../src/model/manuscriptImportOrigin.ts';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning.ts';
import { walkManuscriptStructure } from '../src/model/manuscriptTreeTraversal.ts';
import { removeEmptyHeadingTransaction } from '../src/editor/emptyHeadingDeletion.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { validateStudioManuscript } from '../src/services/manuscriptValidation.ts';
import type { OmiManuscript, OmiSection } from '../src/types/omi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

export const localAuthoringSpecifications = { 'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-100': '0.2.0' };
const T0 = '2026-11-05T00:00:00Z';
const paragraph = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
function versioned(source: OmiManuscript) {
  const state = extractManuscriptState(source);
  return { ...state, ...createInitialVersioningEnvelope(state, { timestamp: T0, summary: 'Local imported fixture', completeness: 'complete' }) };
}
function fixture(nested = false): OmiManuscript {
  const source = createVersionedTestManuscript();
  const imported: OmiSection = { id: 'imported-study', title: 'Imported study', ...(nested ? { parentSectionId: 'container-study' } : {}), blocks: [
    { id: 'imported-heading', type: 'heading', content: paragraph('Imported heading') },
    { id: 'imported-body', type: 'paragraph', content: paragraph('Original manuscript text 中文') },
    { id: 'unrelated-body', type: 'paragraph', content: paragraph('Keep this text') },
  ] };
  const sourced = attachImportedDocumentSource([imported], 'Synthetic archive source', 'Forrás', () => 'visible-source')[0]!;
  source.sections = nested ? [{ id: 'container-study', title: 'Container', blocks: [], children: [sourced] }] : [sourced];
  source.annotations = [selfAuthoredExternalBlockOrigin('imported-heading', T0, () => 'origin-heading'),
    { ...selfAuthoredExternalBlockOrigin('imported-body', T0, () => 'origin-body'), body: 'Synthetic source annotation' }];
  source.extensions = manuscriptImportOrigin('docx', T0);
  source.bibliographicRecords = [{ id: 'source-record', type: 'other', title: 'Synthetic archive source', contributors: [], identifiers: [], status: 'provisional' }];
  source.sourceAttributions = [{ id: 'source-link', sourceObjectId: 'imported-body', targetBibliographicRecordId: 'source-record', predicate: 'prov:wasDerivedFrom', assertionStatus: 'author-confirmed' }];
  source.contributions = source.contributions.map(item => ({ ...item, targetId: source.id }));
  return versioned(source);
}
function blocks(source: OmiManuscript) { return [...walkManuscriptStructure(source.sections)].flatMap(item => item.kind === 'block' ? [item.block] : []); }
function saved(): OmiManuscript { useStudioStore.getState().checkpoint('manual'); return parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript)); }
async function locally(run: () => void | Promise<void>) {
  const previous = useStudioStore.getState(), previousAuth = useAuthStore.getState();
  const restores: Array<() => void> = [], calls: string[] = [];
  const deny = (name: string) => function () { calls.push(name); throw new Error(`NETWORK_DISABLED:${name}`); };
  function replace(target: object, key: string, value: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { value, writable: true, configurable: true });
    restores.push(() => { if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key); });
  }
  for (const key of ['fetch', 'WebSocket', 'XMLHttpRequest']) replace(globalThis, key, deny(key));
  for (const [name, module] of [['http', http], ['https', https]] as const) for (const key of ['request', 'get']) replace(module, key, deny(`${name}.${key}`));
  useAuthStore.setState({ users: [], session: null, isInitialized: true, isLoading: false, error: null });
  try { await run(); assert.deepEqual(calls, [], 'Local model operations must not attempt central/network access'); }
  finally { for (const restore of restores.reverse()) restore(); useStudioStore.setState(previous); useAuthStore.setState(previousAuth); }
}
function load(source = fixture()) { useStudioStore.getState().loadManuscript(source); return source; }
export const coreLocalAuthoringCases = [
  { id: 'local-create-edit-checkpoint-and-portable-reopen-without-account', requirements: ['REQ-DOC-010'], run: () => locally(() => {
    const source = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Helyi kézirat' }); load(source);
    useStudioStore.getState().setTitle('Helyben szerkesztve'); useStudioStore.getState().setAbstract('Szerzői összefoglaló');
    assert.ok(stageInsertBlocks(source.sections[0]!.id, 0, [{ id: 'local-body', type: 'paragraph', content: paragraph('Helyi szöveg') }]));
    const result = saved(); assert.equal(result.title, 'Helyben szerkesztve'); assert.equal(result.abstract, 'Szerzői összefoglaló');
    assert.ok(blocks(result).some(item => item.id === 'local-body')); assert.equal(useAuthStore.getState().session, null);
  }) },
  { id: 'local-validation-keeps-import-provenance-editable', requirements: ['REQ-DOC-010', 'REQ-PRI-007'], run: () => locally(async () => {
    load(); const before = structuredClone(useStudioStore.getState().manuscript);
    const report = await validateStudioManuscript(before);
    assert.ok(report.checks.length); assert.deepEqual(useStudioStore.getState().manuscript, before);
    useStudioStore.getState().updateBlock('imported-body', paragraph('Edited after inspection'));
    assert.equal(blocks(saved()).find(item => item.id === 'imported-body')?.content, paragraph('Edited after inspection'));
  }) },
  { id: 'local-document-session-switch-retains-pending-edits-and-history', requirements: ['REQ-DOC-010'], run: () => locally(() => {
    const a = load(), b = createBlankManuscript({ kind: 'study', locale: 'en', title: 'Second local document' });
    const manager = createStudioDocumentSessions(null), stop = manager.connect();
    try {
      useStudioStore.getState().setTitle('Pending A'); const first = manager.getSnapshot().activeTabId;
      load(b); useStudioStore.getState().setTitle('Pending B'); const second = manager.getSnapshot().activeTabId;
      manager.activate(first); assert.equal(useStudioStore.getState().manuscript.id, a.id); assert.equal(useStudioStore.getState().manuscript.title, 'Pending A');
      manager.activate(second); assert.equal(useStudioStore.getState().manuscript.title, 'Pending B');
      assert.equal(manager.getSnapshot().tabs.find(item => item.id === first)?.pendingChangeSet, null);
      assert.equal(manager.getSnapshot().tabs.length, 2);
    } finally { stop(); }
  }) },
  { id: 'imported-first-heading-is-editable-and-removable', requirements: ['REQ-DOC-011', 'REQ-PRI-007'], run: () => locally(() => {
    load(); useStudioStore.getState().updateBlock('imported-heading', paragraph('Changed heading'));
    assert.equal(blocks(useStudioStore.getState().manuscript)[0]!.content, paragraph('Changed heading'));
    assert.ok(stageRemoveBlock('imported-heading')); const result = saved();
    assert.ok(!blocks(result).some(item => item.id === 'imported-heading'));
    assert.ok(blocks(result).some(item => item.id === 'visible-source')); assert.ok(!result.annotations.some(item => item.id === 'origin-heading'));
  }) },
  { id: 'visible-import-source-notice-is-ordinary-editable-prose', requirements: ['REQ-DOC-011', 'REQ-PRI-007'], run: () => locally(() => {
    load(); useStudioStore.getState().updateBlock('visible-source', paragraph('Szerző által pontosított forrás'));
    assert.equal(blocks(saved()).find(item => item.id === 'visible-source')?.content, paragraph('Szerző által pontosított forrás'));
    assert.ok(stageRemoveBlock('visible-source')); const result = saved();
    assert.ok(!blocks(result).some(item => item.id === 'visible-source')); assert.ok(blocks(result).some(item => item.id === 'imported-body'));
    assert.equal(result.sourceAttributions?.[0]?.id, 'source-link');
  }) },
  { id: 'source-metadata-can-be-corrected-and-cleared-without-content-lock', requirements: ['REQ-DOC-011', 'REQ-PRI-007'], run: () => locally(() => {
    load(); setScholarlyLocalizedText('source', 'hu', 'Pontosított jelzet');
    assert.equal(saved().metadata?.source?.hu, 'Pontosított jelzet');
    setScholarlyLocalizedText('source', 'hu', ''); const result = saved();
    assert.equal(result.metadata?.source?.hu, undefined); assert.ok(blocks(result).some(item => item.id === 'imported-body'));
    assert.equal(result.sourceAttributions?.[0]?.assertionStatus, 'author-confirmed');
  }) },
  { id: 'confirmed-source-relationship-does-not-block-body-edit', requirements: ['REQ-PRI-007', 'REQ-DOC-011'], run: () => locally(() => {
    const source = load(); useStudioStore.getState().updateBlock('imported-body', paragraph('Author revision العربية'));
    const result = saved(); assert.deepEqual(result.sourceAttributions, source.sourceAttributions);
    assert.equal(blocks(result).find(item => item.id === 'imported-body')?.content, paragraph('Author revision العربية'));
  }) },
  { id: 'attributed-body-deletion-cleans-active-links-and-retains-restorable-history', requirements: ['REQ-PRI-007', 'REQ-DOC-011'], run: () => locally(() => {
    const source = load(), original = source.headRevisionId;
    assert.ok(stageRemoveBlock('imported-body')); let result = saved();
    assert.deepEqual(result.sourceAttributions, []); assert.ok(!result.annotations.some(item => item.id === 'origin-body'));
    assert.equal(result.revisionHistory.revisions[0]?.snapshot.state.sourceAttributions?.[0]?.id, 'source-link');
    load(result); useStudioStore.getState().revertRevision(original); result = saved();
    assert.equal(result.sourceAttributions?.[0]?.id, 'source-link'); assert.ok(blocks(result).some(item => item.id === 'imported-body'));
  }) },
  { id: 'document-import-origin-does-not-pin-the-first-heading', requirements: ['REQ-DOC-011', 'REQ-PRI-007'], run: () => locally(() => {
    const source = load(); assert.ok(stageRemoveBlock('imported-heading')); const result = saved();
    assert.deepEqual(result.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], source.extensions?.[MANUSCRIPT_IMPORT_ORIGIN]);
    assert.ok(!blocks(result).some(item => item.id === 'imported-heading'));
    assert.ok(blocks(result).some(item => item.id === 'unrelated-body'));
  }) },
  { id: 'embedded-imported-section-heading-and-body-remain-editable', requirements: ['REQ-DOC-010', 'REQ-DOC-011', 'REQ-PRI-007'], run: () => locally(() => {
    const source = load(fixture(true));
    useStudioStore.getState().updateBlock('imported-heading', paragraph('Nested heading edit'));
    useStudioStore.getState().updateBlock('imported-body', paragraph('Nested body edit'));
    const result = saved();
    assert.equal(blocks(result).find(item => item.id === 'imported-heading')?.content, paragraph('Nested heading edit'));
    assert.equal(blocks(result).find(item => item.id === 'imported-body')?.content, paragraph('Nested body edit'));
    assert.deepEqual(result.sourceAttributions, source.sourceAttributions);
  }) },
  { id: 'nested-import-source-targets-can-be-deleted-at-both-tree-depths', requirements: ['REQ-DOC-011', 'REQ-PRI-007'], run: () => locally(() => {
    for (const nestedSection of [false, true]) {
      const source = fixture(nestedSection);
      if (!nestedSection) {
        const section = source.sections[0]!, heading = section.blocks.shift()!;
        section.blocks.push({ id: 'parent-block', type: 'paragraph', content: paragraph('Parent remains'), children: [heading] });
      }
      load(versioned(source)); assert.ok(stageRemoveBlock('imported-heading'));
      const result = saved(); assert.ok(!blocks(result).some(item => item.id === 'imported-heading'));
      assert.ok(!result.annotations.some(item => item.id === 'origin-heading'));
      assert.ok(blocks(result).some(item => item.id === 'imported-body'));
    }
  }) },
  { id: 'empty-first-editor-heading-removal-keeps-following-text-editable', requirements: ['REQ-DOC-011', 'REQ-PRI-007'], run: () => locally(() => {
    const schema = new Schema({ nodes: { doc: { content: 'block+' }, paragraph: { content: 'inline*', group: 'block' },
      heading: { content: 'inline*', group: 'block' }, text: { group: 'inline' } } });
    load(); const doc = schema.node('doc', null, [schema.node('heading'), schema.node('paragraph', null, schema.text('Following author text'))]);
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, 1) });
    const transaction = removeEmptyHeadingTransaction(state, 'Backspace'); assert.ok(transaction);
    useStudioStore.getState().updateBlock('imported-heading', JSON.stringify(transaction.doc.toJSON()));
    const content = blocks(saved()).find(item => item.id === 'imported-heading')!.content;
    assert.equal(JSON.parse(content).content[0].type, 'paragraph'); assert.ok(content.includes('Following author text'));
  }) },
];
export async function runCoreLocalAuthoringCases() {
  const results = [];
  for (const item of coreLocalAuthoringCases) {
    await item.run(); results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const });
  }
  return results;
}
