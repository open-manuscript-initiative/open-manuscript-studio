import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { auditCoreSources, scanCoreSource } from '../scripts/check-core-import-boundaries.mjs';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { splitParagraphBlock, mergeParagraphForward } from '../src/app/paragraphBlockActions.ts';
import { createInitialCollaborationDocument } from '../src/editor/collaborationDocument.ts';
import { paginatePublicationBlocks } from '../src/components/publicationPageLayout.ts';
import { migrateVersioningModel } from '../src/document/migrateVersioningModel.ts';
import { capabilityStatement, runModelAssessment, isAssessmentCurrent } from '../src/model/conformance.ts';
import { CORE_SPECIFICATIONS, validateCoreSnapshot } from '../src/model/coreSnapshotValidator.mjs';
import { createInitialVersioningEnvelope, extractManuscriptState, commitManuscriptRevision } from '../src/model/versioning.ts';
import { createCheckpointDescriptor } from '../src/model/workingState.ts';
import { calculateManuscriptStateDigestValue } from '../src/model/stateDigest.ts';
import { partitionManuscriptStudies } from '../src/model/sectionStructure.ts';
import { getPublicationProfile } from '../src/model/publicationProfile.ts';
import { buildPublicationRenderingContext } from '../src/model/publicationRendering.ts';
import { getTranslationModel, translationProgress } from '../src/model/translation.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson, toPortableOmiManuscript, OmiPortableFormatError } from '../src/services/omiPortableFormat.ts';
import { requestMachineTranslationSuggestions, selectedMachineTranslationSegments } from '../src/services/machineTranslationSuggestions.ts';
import { createTranslationCommands, type TranslationWorkingState } from '../src/services/translationCommands.ts';
import { runCoreModelReview } from '../src/services/coreModelReview.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { buildXtgExport } from '../src/services/exportXtg.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import type { OmiManuscript } from '../src/types/omi.ts';

export const remainingSpecifications = {
  'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-100': '0.2.0', 'OMI-SPEC-120': '0.3.0',
};
export const remainingRequirementIds = [
  'REQ-DOC-001', 'REQ-DOC-009', 'REQ-DOC-016', 'REQ-OBJ-010', 'REQ-OBJ-011',
  'REQ-PRI-001', 'REQ-PRI-002', 'REQ-PRI-010', 'REQ-PRI-011', 'REQ-PRI-012', 'REQ-PRI-014',
];
const MAPPING = 'https://openmanuscript.org/extensions/block-identity-mapping/1';
const TEXT = 'Árvíztűrő tükörfúrógép 中文 العربية e\u0301 😀';
const paragraph = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
function fixture(): OmiManuscript {
  const m = createVersionedTestManuscript();
  m.locale = 'hu'; m.title = TEXT;
  m.sections[0]!.blocks[0]!.content = paragraph(TEXT);
  const state = extractManuscriptState(m);
  return { ...state, ...createInitialVersioningEnvelope(state, { summary: 'Remaining core requirement fixture', timestamp: state.createdAt }) };
}
function withStore(run: (m: OmiManuscript) => void | Promise<void>) {
  const previous = useStudioStore.getState(), m = fixture();
  useStudioStore.setState({ manuscript: m, pendingChangeSet: null, selectedSectionId: m.sections[0]!.id });
  return Promise.resolve().then(() => run(m)).finally(() => useStudioStore.setState(previous));
}
function identity() { return { name: 'Core remaining suite', version: 'test', build: 'test', revision: 'fixture', dependencies: 'fixture-lock' }; }
function xml(source: string) { return new DOMParser().parseFromString(source, 'application/xml'); }
function accessibleFixture() {
  const m = fixture();
  m.sections[0]!.blocks.push({ id: 'accessible-image', type: 'image', content: '', visual: {
    kind: 'image', src: 'data:image/png;base64,AA==', mediaType: 'image/png', alt: 'Történeti térkép 中文', caption: 'Ábra',
  } }, { id: 'accessible-table', type: 'table', content: '', visual: {
    kind: 'table', cells: [['Év', 'Érték'], ['2026', '12']], headerRows: 1, caption: 'Adatok',
  } });
  return m;
}

export const coreRemainingCases = [
  { id: 'canonical-root-is-independent-of-editor-selection-and-rendering-state', requirements: ['REQ-PRI-001'], run: () => withStore(m => {
    const original = serializeOmiJson(m), originalHead = m.headRevisionId;
    useStudioStore.setState({ selectedSectionId: 'local-selection-only' });
    const profile = getPublicationProfile('omi-generic-scholarly'); assert.ok(profile);
    const context = buildPublicationRenderingContext(m, profile);
    assert.equal(context.headRevisionId, originalHead);
    assert.equal(serializeOmiJson(useStudioStore.getState().manuscript), original);
    assert.ok(!original.includes('local-selection-only'));
    const state = extractManuscriptState(m);
    assert.ok(!Object.hasOwn(state, 'headRevisionId') && !Object.hasOwn(state, 'revisionHistory'));
    assert.ok(!Object.hasOwn(state, 'session') && !Object.hasOwn(state, 'selectedSectionId'));
  }) },
  { id: 'core-architecture-gate-rejects-operational-runtime-imports', requirements: ['REQ-PRI-001'], run() {
    const violations = scanCoreSource('src/model/synthetic.ts', "import { create } from 'zustand'; import { send } from '../services/authApi'; import { Editor } from '@tauri-apps/api/core';");
    assert.equal(violations.length, 3);
    const paths = execFileSync('git', ['ls-files', '--', 'src/model'], { encoding: 'utf8' }).split('\n').filter(p => /\.tsx?$/.test(p));
    assert.ok(paths.length > 10);
    assert.deepEqual(auditCoreSources(paths.map(path => ({ path, text: readFileSync(path, 'utf8') }))), []);
  } },
  { id: 'portable-snapshot-is-readable-by-standalone-node-processor', requirements: ['REQ-PRI-002'], run() {
    const source = fixture(), raw = serializeOmiJson(source);
    const result = execFileSync(process.execPath, ['--input-type=module', '--eval', `
      import {readFileSync} from 'node:fs';
      import {validateCoreSnapshot} from './src/model/coreSnapshotValidator.mjs';
      const m=JSON.parse(readFileSync(0,'utf8'));
      const {revisionHistory,headRevisionId,versioningModelVersion,...snapshot}=m;
      process.stdout.write(JSON.stringify({id:m.id,text:m.sections[0].blocks[0].content,result:validateCoreSnapshot(snapshot)}));
    `], { input: raw, encoding: 'utf8' });
    const checked = JSON.parse(result);
    assert.equal(checked.id, source.id); assert.equal(checked.text, source.sections[0]!.blocks[0]!.content);
    assert.notEqual(checked.result.outcome, 'invalid');
    assert.equal(checked.result.profile, 'urn:omi:profile:core-snapshot-review:0.1.0');
  } },
  { id: 'local-model-roundtrip-never-invokes-hosted-or-renderer-services', requirements: ['REQ-PRI-002'], async run() {
    const previous = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('No hosted service permitted'); };
    try {
      const m = fixture(), before = structuredClone(m), result = parseOmiJson(serializeOmiJson(m));
      assert.equal(result.id, m.id); assert.deepEqual(result.sections, m.sections);
      assert.notEqual(runCoreModelReview(result).result.outcome, 'invalid');
      assert.deepEqual(m, before); assert.equal(calls, 0);
    } finally { globalThis.fetch = previous; }
  } },
  { id: 'machine-proposal-cannot-mutate-source-or-approve-publication', requirements: ['REQ-PRI-010'], async run() {
    const m = fixture(), before = structuredClone(m);
    const proposal = await requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'en', undefined,
      async req => ({ providerId: 'deepl', targetLanguage: req.targetLanguage, scope: req.scope, segments: req.segments.map(s => ({ ...s, text: 'Proposed '+s.text })) }));
    assert.ok(proposal.suggestions.length > 0); assert.deepEqual(m, before);
    assert.equal(getTranslationModel(m).variants.length, 0);
    proposal.suggestions.forEach(s => { s.included = false; });
    assert.throws(() => selectedMachineTranslationSegments(proposal), /nonempty/);
    assert.equal(m.headRevisionId, before.headRevisionId);
  } },
  { id: 'explicit-machine-acceptance-keeps-provider-and-human-attribution-as-draft', requirements: ['REQ-PRI-010'], async run() {
    const m = fixture(); let state: TranslationWorkingState = { manuscript: m, pendingChangeSet: null };
    const proposal = await requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'en', undefined,
      async req => ({ providerId: 'deepl', targetLanguage: req.targetLanguage, scope: req.scope, segments: req.segments.map(s => ({ ...s, text: 'Reviewed '+s.text })) }));
    const commands = createTranslationCommands({ update: f => { state = f(state); }, checkpoint() {}, actorAgentId: () => 'agent-author' });
    commands.addManuscriptTranslation(proposal.scope, 'en', selectedMachineTranslationSegments(proposal), proposal.basis,
      { method: 'machine', provider: 'DeepL', actorAgentId: 'agent-author', createdAt: proposal.createdAt });
    const v = getTranslationModel(state.manuscript).variants[0]!;
    assert.ok(v.alignments.every(a => a.origin.method === 'machine' && a.origin.provider === 'DeepL' && a.status === 'draft'));
    assert.equal(translationProgress(state.manuscript, v).ready, false);
    assert.equal(state.pendingChangeSet?.actorAgentId, 'agent-author');
    const checkpoint = createCheckpointDescriptor(state.pendingChangeSet!);
    const committed = commitManuscriptRevision(m, extractManuscriptState(state.manuscript), checkpoint);
    assert.equal(committed.revisionHistory.revisions.at(-1)?.actorAgentId, 'agent-author');
    assert.equal(committed.title, m.title); assert.deepEqual(committed.sections, m.sections);
    assert.equal(getTranslationModel(parseOmiJson(serializeOmiJson(committed))).variants[0]?.alignments[0]?.origin.provider, 'DeepL');
  } },
  { id: 'html-and-jats-preserve-unicode-language-image-alt-and-table-roles', requirements: ['REQ-PRI-011'], run() {
    const m = accessibleFixture(), before = structuredClone(m);
    const html = new DOMParser().parseFromString(renderHtmlArticle(m).html, 'text/html'), jats = xml(renderJatsArticle(m).xml);
    assert.equal(html.documentElement.getAttribute('lang'), 'hu');
    assert.equal(jats.documentElement.getAttribute('xml:lang'), 'hu');
    assert.ok(html.documentElement.textContent?.includes(TEXT)); assert.ok(jats.documentElement.textContent?.includes(TEXT));
    assert.equal(html.getElementsByTagName('img')[0]?.getAttribute('alt'), 'Történeti térkép 中文');
    assert.equal(jats.getElementsByTagName('alt-text')[0]?.textContent, 'Történeti térkép 中文');
    assert.equal(html.getElementsByTagName('th')[0]?.getAttribute('scope'), 'col');
    assert.ok(jats.getElementsByTagName('thead').length > 0); assert.deepEqual(m, before);
  } },
  { id: 'text-only-projection-discloses-degraded-visual-object-semantics', requirements: ['REQ-PRI-011'], run() {
    const m = accessibleFixture(), before = structuredClone(m), output = buildXtgExport(m);
    assert.ok(output.warnings.some(w => w.includes('visual-object-projected-as-text')));
    assert.deepEqual(m, before);
    assert.equal(parseOmiJson(serializeOmiJson(m)).sections[0]!.blocks.find(b => b.id === 'accessible-image')?.visual?.kind, 'image');
  } },
  { id: 'support-claims-name-exact-draft-versions-profiles-and-limitations', requirements: ['REQ-PRI-012'], run() {
    const s = capabilityStatement(identity(), 'node-test');
    assert.equal(s.assertionLevel, 'disclosure'); assert.equal(s.outcome, 'indeterminate');
    assert.equal(s.verification, 'not-independent');
    for (const c of s.capabilities) { assert.match(c.specification, /^OMI-SPEC-\d{3}$/); assert.equal(c.specVersion, '0.1.0'); assert.ok(c.component && c.limitations.length); }
    const review = runCoreModelReview(fixture());
    assert.deepEqual(review.result.specifications, CORE_SPECIFICATIONS);
    assert.equal(review.result.profile, 'urn:omi:profile:core-snapshot-review:0.1.0');
    assert.equal(review.conformance, 'not-assessed'); assert.ok(review.result.exclusions.length > 0);
  } },
  { id: 'stale-tampered-or-overstated-self-assessments-are-rejected', requirements: ['REQ-PRI-012'], run() {
    const i = identity(), report = runModelAssessment(i, 'node-test');
    assert.equal(isAssessmentCurrent(report, i, 'node-test'), true);
    assert.equal(isAssessmentCurrent(report, { ...i, revision: 'different' }, 'node-test'), false);
    for (const mutate of [
      (r: typeof report) => { r.evidence.complete = true as false; },
      (r: typeof report) => { r.evidence.suite.approved = true; },
      (r: typeof report) => { r.evidence.results[0]!.status = 'fail'; },
    ]) { const changed = structuredClone(report); mutate(changed); assert.equal(isAssessmentCurrent(changed, i, 'node-test'), false); }
  } },
  { id: 'unsupported-wire-versions-and-schemas-fail-without-silent-migration', requirements: ['REQ-PRI-014'], run() {
    for (const mutation of [
      (p: any) => { p.omi.version = '99.0.0'; },
      (p: any) => { p.schema = 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json'; },
    ]) {
      const p = toPortableOmiManuscript(fixture()); mutation(p); const raw = JSON.stringify(p);
      assert.throws(() => parseOmiJson(raw), (e: unknown) => e instanceof OmiPortableFormatError && ['unsupported-version', 'unsupported-schema'].includes(e.code));
      assert.equal(JSON.stringify(p), raw);
    }
  } },
  { id: 'explicit-legacy-history-migration-discloses-shallow-lineage', requirements: ['REQ-PRI-014'], run() {
    const { headRevisionId: _head, revisionHistory: _history, versioningModelVersion: _v, ...legacy } = fixture();
    const before = structuredClone(legacy), migrated = migrateVersioningModel(legacy);
    assert.deepEqual(legacy, before); assert.equal(migrated.revisionHistory.completeness, 'shallow');
    assert.equal(migrated.revisionHistory.revisions.length, 1);
    assert.match(migrated.revisionHistory.revisions[0]!.summary, /Imported legacy/);
    const portable = toPortableOmiManuscript(migrated);
    assert.equal(portable.omi.version, '0.3.0'); assert.match(portable.revisionHistory.omissionNotice ?? '', /shallow/i);
    assert.equal(parseOmiJson(JSON.stringify(portable)).id, legacy.id);
  } },
  { id: 'paragraph-split-retains-explicit-old-to-new-identity-provenance', requirements: ['REQ-OBJ-010'], run: () => withStore(m => {
    const oldId = m.sections[0]!.blocks[0]!.id;
    const created = splitParagraphBlock(oldId, paragraph('Left'), paragraph('Right')); assert.ok(created);
    const reopened = parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    const revision = reopened.revisionHistory.revisions.at(-1)!;
    assert.equal(revision.parentRevisionIds[0], m.headRevisionId);
    const event = revision.changeSet.events.find(e => (e as any).extensions?.[MAPPING]);
    assert.ok(event, 'Split must disclose an explicit identity map in retained history');
    assert.deepEqual((event as any).extensions[MAPPING], { version: '0.1.0', operation: 'split', sourceBlockIds: [oldId], targetBlockIds: [oldId, created], preservedBlockId: oldId });
    assert.deepEqual(reopened.sections[0]!.blocks.map(b => b.id), [oldId, created]);
    assert.equal(m.sections[0]!.blocks.length, 1);
  }) },
  { id: 'paragraph-merge-retains-source-ids-survivor-and-prior-snapshot', requirements: ['REQ-OBJ-010'], run: () => withStore(m => {
    m.sections[0]!.blocks.push({ id: 'merge-source', type: 'paragraph', content: paragraph('Second') });
    // Load a genuinely committed pre-merge state, rather than rewriting a retained snapshot.
    const state = extractManuscriptState(m), source = { ...state, ...createInitialVersioningEnvelope(state, { summary: 'Merge source', timestamp: state.createdAt }) };
    useStudioStore.setState({ manuscript: source, pendingChangeSet: null });
    const first = source.sections[0]!.blocks[0]!.id; assert.ok(mergeParagraphForward(first));
    const reopened = parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    const revision = reopened.revisionHistory.revisions.at(-1)!;
    const event = revision.changeSet.events.find(e => (e as any).extensions?.[MAPPING]);
    assert.ok(event, 'Merge must disclose which removed identity maps to the survivor');
    assert.deepEqual((event as any).extensions[MAPPING], { version: '0.1.0', operation: 'merge', sourceBlockIds: [first, 'merge-source'], targetBlockIds: [first], preservedBlockId: first });
    assert.equal(reopened.sections[0]!.blocks.length, 1);
    assert.equal(reopened.revisionHistory.revisions[0]!.snapshot.state.sections[0]!.blocks.length, 2);
  }) },
  { id: 'blocks-are-addressable-while-unicode-text-remains-embedded-values', requirements: ['REQ-OBJ-011'], run() {
    const m = fixture(), reopened = parseOmiJson(serializeOmiJson(m));
    assert.ok(reopened.id && reopened.sections[0]!.id && reopened.sections[0]!.blocks[0]!.id);
    const node = JSON.parse(reopened.sections[0]!.blocks[0]!.content).content[0].content[0];
    assert.equal(node.type, 'text'); assert.equal(node.text, TEXT); assert.ok(!Object.hasOwn(node, 'id'));
    assert.notEqual(validateCoreSnapshot(extractManuscriptState(reopened)).outcome, 'invalid');
  } },
  { id: 'duplicate-addressable-block-ids-are-rejected-without-reidentifying-text', requirements: ['REQ-OBJ-011'], run() {
    const m = fixture(); m.sections[0]!.blocks.push(structuredClone(m.sections[0]!.blocks[0]!));
    const before = structuredClone(m), checked = validateCoreSnapshot(extractManuscriptState(m));
    assert.equal(checked.outcome, 'invalid'); assert.ok(checked.diagnostics.some(d => d.code === 'DUPLICATE_ID'));
    assert.throws(() => serializeOmiJson(m)); assert.deepEqual(m, before);
  } },
  { id: 'portable-root-identifies-manuscript-schema-and-profiles', requirements: ['REQ-DOC-001'], run() {
    const m = fixture(), p = toPortableOmiManuscript(m), reopened = parseOmiJson(JSON.stringify(p));
    assert.equal(p.id, m.id); assert.equal(p.omi.format, 'manuscript'); assert.equal(p.omi.version, '0.3.0');
    assert.equal(p.schema, 'https://openmanuscript.org/schemas/omi-manuscript-0.3.schema.json');
    assert.deepEqual(p.omi.profiles, ['core-snapshot', 'history-exchange']); assert.equal(reopened.id, m.id);
  } },
  { id: 'missing-root-envelope-id-or-profile-is-rejected-before-opening', requirements: ['REQ-DOC-001'], run() {
    for (const key of ['id', 'omi', 'schema']) {
      const p = toPortableOmiManuscript(fixture()) as any; delete p[key]; assert.throws(() => parseOmiJson(JSON.stringify(p)));
    }
    const p = toPortableOmiManuscript(fixture()); p.omi.profiles = [];
    assert.throws(() => parseOmiJson(JSON.stringify(p))); assert.throws(() => parseOmiJson('[]'));
  } },
  { id: 'pagination-changes-page-count-without-changing-scholarly-content-or-history', requirements: ['REQ-DOC-009'], run() {
    const m = fixture(), before = structuredClone(m), digest = calculateManuscriptStateDigestValue(extractManuscriptState(m));
    const flow = [{ top: 0, height: 240 }, { top: 240, height: 240 }, { top: 480, height: 240 }];
    const a = paginatePublicationBlocks(flow, 300, 32), b = paginatePublicationBlocks(flow, 900, 16);
    assert.notEqual(a.pageCount, b.pageCount); assert.deepEqual(m, before);
    assert.equal(calculateManuscriptStateDigestValue(extractManuscriptState(m)), digest);
    assert.equal(m.revisionHistory.revisions.length, 1);
  } },
  { id: 'publication-projections-and-style-context-do-not-stage-content-edits', requirements: ['REQ-DOC-009'], run: () => withStore(m => {
    const before = structuredClone(m), profile = getPublicationProfile('omi-generic-scholarly'); assert.ok(profile);
    const custom = { ...profile, id: 'temporary-presentation-profile', label: 'Test presentation context' };
    buildPublicationRenderingContext(m, custom); renderHtmlArticle(m); renderJatsArticle(m);
    assert.deepEqual(useStudioStore.getState().manuscript, before);
    assert.equal(useStudioStore.getState().pendingChangeSet, null);
    assert.equal(parseOmiJson(serializeOmiJson(m)).headRevisionId, m.headRevisionId);
  }) },
  { id: 'yjs-initialization-sync-and-presence-do-not-create-scholarly-revisions', requirements: ['REQ-DOC-016'], run: () => withStore(m => {
    const before = structuredClone(m), doc = createInitialCollaborationDocument(partitionManuscriptStudies(m.sections), new Map());
    const remote = new Y.Doc(), awareness = new Awareness(doc);
    try {
      Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
      awareness.setLocalStateField('user', { name: 'Synthetic presence', color: '#123456' });
      assert.ok(remote.getXmlFragment(m.sections[0]!.id).length > 0);
      assert.deepEqual(useStudioStore.getState().manuscript, before);
      assert.equal(useStudioStore.getState().pendingChangeSet, null);
      assert.equal(parseOmiJson(serializeOmiJson(m)).revisionHistory.revisions.length, 1);
    } finally { awareness.destroy(); remote.destroy(); doc.destroy(); }
  }) },
  { id: 'received-yjs-update-remains-transport-until-explicit-authoring-checkpoint', requirements: ['REQ-DOC-016'], run: () => withStore(m => {
    const before = structuredClone(m), doc = createInitialCollaborationDocument(partitionManuscriptStudies(m.sections), new Map()), remote = new Y.Doc();
    try {
      Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
      const node = new Y.XmlElement('paragraph'); const value = new Y.XmlText(); value.insert(0, 'Remote proposal'); node.insert(0, [value]);
      remote.getXmlFragment(m.sections[0]!.id).insert(0, [node]); Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote));
      assert.match(doc.getXmlFragment(m.sections[0]!.id).toString(), /Remote proposal/);
      assert.deepEqual(useStudioStore.getState().manuscript, before);
      useStudioStore.getState().updateBlock(m.sections[0]!.blocks[0]!.id, paragraph('Explicit author edit'));
      assert.equal(useStudioStore.getState().manuscript.headRevisionId, before.headRevisionId);
      assert.ok(useStudioStore.getState().pendingChangeSet);
      useStudioStore.getState().checkpoint('manual');
      const revised = useStudioStore.getState().manuscript;
      assert.equal(revised.revisionHistory.revisions.length, 2);
      assert.ok(revised.revisionHistory.revisions.at(-1)!.changeSet.events.every(e => !/approval|publish/.test(e.operation)));
    } finally { remote.destroy(); doc.destroy(); }
  }) },
];
export async function runCoreRemainingCases() {
  const results = [];
  for (const item of coreRemainingCases) { await item.run(); results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const }); }
  return results;
}
