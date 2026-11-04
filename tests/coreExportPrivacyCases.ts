import assert from 'node:assert/strict';
import { defaultCustomExportTemplate } from '../src/model/customExport.ts';
import { collectPublicationContributors } from '../src/model/publicationRendering.ts';
import { publicPublicationManuscript } from '../src/model/publicationAnnotations.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { buildOmiContainer } from '../src/services/omiContainer.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { buildIdmlExport } from '../src/services/exportIdml.ts';
import { buildEpubExport } from '../src/services/exportEpub.ts';
import { buildLatexExport } from '../src/services/exportLatex.ts';
import { buildMifExport } from '../src/services/exportMif.ts';
import { buildSlaExport } from '../src/services/exportSla.ts';
import { buildXtgExport } from '../src/services/exportXtg.ts';
import { buildPdfPrintDocument } from '../src/services/exportPdf.ts';
import { buildStandaloneHtmlExport } from '../src/services/exportStandaloneHtml.ts';
import { buildPublisherHtmlPackage } from '../src/services/exportPublisherHtmlPackage.ts';
import { buildCustomDocxExport, buildCustomPdfSource, renderCustomHtmlDocument } from '../src/services/exportCustom.ts';
import type { OmiManuscript } from '../src/types/omi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

export const exportPrivacySpecifications = { 'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-140': '0.2.0' };
const SECRET = 'SYNTHETIC_CREDENTIAL_VALUE_NEVER_OUTPUT';
const PRIVATE = /CONFIDENTIAL|PRIVATE_INLINE_LABEL/;
const aliases = ['access_token', 'refresh-token', 'session_id', 'session_identifier', 'SESSION-TOKEN',
  'client_secret', 'private_key', 'api_key', 'id_token', 'authorization_header', 'session_cookie'];

function denied(error: unknown) {
  assert.ok(error instanceof Error);
  assert.match(error.message, /credential/i);
  assert.ok(!error.message.includes(SECRET), 'diagnostics must not echo a credential value');
  return true;
}

export function storeZipText(bytes: Uint8Array): string {
  const decoder = new TextDecoder(), texts: string[] = [];
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
    if (view.getUint32(0, true) !== 0x04034b50) break;
    assert.equal(view.getUint16(8, true), 0, 'fixture outputs use ZIP STORE');
    const size = view.getUint32(18, true), nameLength = view.getUint16(26, true), extraLength = view.getUint16(28, true);
    const start = offset + 30 + nameLength + extraLength;
    texts.push(decoder.decode(bytes.subarray(start, start + size)));
    offset = start + size;
  }
  assert.ok(texts.length > 0);
  return texts.join('\n');
}

function privacyFixture(): OmiManuscript {
  const m = createVersionedTestManuscript(), block = m.sections[0]!.blocks[0]!;
  m.annotations = [
    { id: 'public-note', type: 'note', anchorId: 'anchor-public', targetBlockId: block.id, body: 'PUBLIC_NOTE_BODY', renderingHint: 'footnote' },
    { id: 'hidden-note', type: 'note', anchorId: 'anchor-hidden', targetBlockId: block.id, body: 'CONFIDENTIAL_HIDDEN_BODY', renderingHint: 'hidden' },
    { id: 'editor-note', type: 'note', anchorId: 'anchor-editor', targetBlockId: block.id, body: 'CONFIDENTIAL_EDITOR_BODY', renderingHint: 'footnote', visibility: 'editor_only' },
    { id: 'author-note', type: 'note', anchorId: 'anchor-author', targetBlockId: block.id, body: 'CONFIDENTIAL_AUTHOR_BODY', renderingHint: 'footnote', visibility: 'author_and_editor' },
  ];
  block.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'PUBLIC_BODY_TEXT ' },
    ...m.annotations.map(note => ({ type: 'omiNote', attrs: {
      noteId: note.id, anchorId: note.anchorId, label: note.id === 'public-note' ? '1' : 'PRIVATE_INLINE_LABEL', noteType: 'footnote',
    } })),
  ] }] });
  block.children = [{ id: 'nested-private', type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'PUBLIC_NESTED_TEXT ' },
    { type: 'omiNote', attrs: { noteId: 'nested-editor-note', anchorId: 'nested-anchor', label: 'PRIVATE_INLINE_LABEL', noteType: 'footnote' } },
  ] }] }) }];
  m.annotations.push({ id: 'nested-editor-note', type: 'note', anchorId: 'nested-anchor', targetBlockId: 'nested-private', body: 'CONFIDENTIAL_NESTED_BODY', renderingHint: 'hidden' });
  const agent = m.agents[0]!;
  agent.names.push({ id: 'legal-name', value: 'CONFIDENTIAL_LEGAL_NAME', preferred: true, visibility: 'private' });
  agent.affiliations.push({ id: 'private-affiliation', organizationName: 'CONFIDENTIAL_AFFILIATION', visibility: 'restricted' });
  agent.identifiers.push({ id: 'private-orcid', scheme: 'orcid', value: 'CONFIDENTIAL_ORCID', normalizedValue: 'CONFIDENTIAL_ORCID', visibility: 'withheld', verificationStatus: 'unverified' });
  agent.affiliations[0]!.organizationIdentifier = { id: 'private-ror', scheme: 'ror', value: 'CONFIDENTIAL_ROR', normalizedValue: 'CONFIDENTIAL_ROR', visibility: 'private', verificationStatus: 'self-asserted' };
  m.extensions = { 'urn:example:opaque-scholarly-data': { tokenCount: 42, text: 'public extension value' } };
  return m;
}

function assertPublic(output: string) {
  const text = output.replace(/\\_/g, '_');
  assert.doesNotMatch(text, PRIVATE);
  assert.match(text, /PUBLIC_BODY_TEXT/);
}

export const coreExportPrivacyCases = [
  {
    id: 'portable-json-rejects-credential-fields', requirements: ['REQ-PRI-009'],
    run() {
      for (const key of ['password', 'accessToken', 'refreshToken', 'sessionToken', 'sessionId', 'clientSecret', 'privateKey']) {
        const m = createVersionedTestManuscript();
        m.extensions = { 'urn:example:operational-test': { nested: [{ [key]: SECRET }] } };
        const before = JSON.stringify(m);
        assert.throws(() => serializeOmiJson(m), denied);
        assert.equal(JSON.stringify(m), before);
      }
    },
  },
  {
    id: 'portable-json-rejects-credential-aliases', requirements: ['REQ-PRI-009'],
    run() {
      for (const key of aliases) {
        const m = createVersionedTestManuscript();
        m.extensions = { 'urn:example:operational-test': [{ [key]: SECRET }] };
        assert.throws(() => serializeOmiJson(m), denied);
      }
    },
  },
  {
    id: 'json-history-credentials-are-rejected', requirements: ['REQ-PRI-009'],
    run() {
      const m = createVersionedTestManuscript();
      m.revisionHistory.revisions[0]!.snapshot.state.extensions = { 'urn:example:past-account': { accessToken: SECRET } };
      assert.throws(() => serializeOmiJson(m), denied);
    },
  },
  {
    id: 'container-history-credentials-are-rejected', requirements: ['REQ-PRI-009'],
    async run() {
      for (const location of ['snapshot', 'change-event']) {
        const m = createVersionedTestManuscript(), revision = m.revisionHistory.revisions[0]!;
        if (location === 'snapshot') revision.snapshot.state.extensions = { 'urn:example:past-account': { accessToken: SECRET } };
        else revision.changeSet.events[0]!.previousValue = { password: SECRET };
        const before = JSON.stringify(m);
        await assert.rejects(buildOmiContainer(m), denied);
        assert.equal(JSON.stringify(m), before);
      }
    },
  },
  {
    id: 'container-current-credentials-are-rejected', requirements: ['REQ-PRI-009'],
    async run() {
      const m = createVersionedTestManuscript();
      m.extensions = { 'urn:example:operational-test': { client_secret: SECRET } };
      await assert.rejects(buildOmiContainer(m), denied);
    },
  },
  {
    id: 'scholarly-text-and-benign-field-names-survive', requirements: ['REQ-PRI-009', 'REQ-MET-018'],
    run() {
      const m = createVersionedTestManuscript();
      const text = 'Research describes access_token, passwords and sessionCookie as technical vocabulary.';
      m.sections[0]!.blocks[0]!.content = text;
      m.extensions = { 'urn:example:linguistics': { tokenCount: 7, passwordPolicy: 'research topic', privateKeyAlgorithm: 'RSA' } };
      const before = JSON.stringify(m), reopened = parseOmiJson(serializeOmiJson(m));
      assert.equal(reopened.sections[0]!.blocks[0]!.content, text);
      assert.deepEqual(reopened.extensions, m.extensions);
      assert.equal(JSON.stringify(m), before);
    },
  },
  {
    id: 'standard-public-artifacts-filter-confidential-metadata', requirements: ['REQ-MET-013', 'REQ-PRI-003'],
    async run() {
      const m = privacyFixture(), before = JSON.stringify(m);
      const outputs = [renderHtmlArticle(m).html, renderJatsArticle(m).xml, buildPdfPrintDocument(m),
        storeZipText(buildDocxExport(m).bytes), storeZipText(buildOdtExport(m).bytes),
        storeZipText(buildIdmlExport(m).bytes), storeZipText(buildEpubExport(m).bytes),
        buildLatexExport(m).text, buildMifExport(m).text, buildSlaExport(m).text, buildXtgExport(m).text,
        (await buildStandaloneHtmlExport(m)).html, storeZipText((await buildPublisherHtmlPackage(m)).bytes)];
      for (const output of outputs) assertPublic(output);
      assert.equal(JSON.stringify(m), before);
    },
  },
  {
    id: 'custom-html-filters-private-notes-and-markers', requirements: ['REQ-MET-013', 'REQ-PRI-003'],
    run() {
      const m = privacyFixture(), before = JSON.stringify(m), template = defaultCustomExportTemplate(m);
      template.citationStyle!.enabled = true;
      const output = renderCustomHtmlDocument(m, template);
      assertPublic(output); assert.match(output, /PUBLIC_NOTE_BODY/);
      assert.equal(JSON.stringify(m), before);
    },
  },
  {
    id: 'custom-pdf-source-filters-private-notes', requirements: ['REQ-MET-013', 'REQ-PRI-003'],
    run() {
      const m = privacyFixture(), before = JSON.stringify(m);
      const output = buildCustomPdfSource(m, defaultCustomExportTemplate(m)).html;
      assertPublic(output); assert.match(output, /PUBLIC_NOTE_BODY/);
      assert.equal(JSON.stringify(m), before);
    },
  },
  {
    id: 'custom-docx-filters-private-notes', requirements: ['REQ-MET-013', 'REQ-PRI-003'],
    async run() {
      const m = privacyFixture(), before = JSON.stringify(m);
      const result = buildCustomDocxExport(m, defaultCustomExportTemplate(m));
      const output = storeZipText(new Uint8Array(await result.blob.arrayBuffer()));
      assertPublic(output); assert.match(output, /PUBLIC_NOTE_BODY/);
      assert.equal(JSON.stringify(m), before);
    },
  },
  {
    id: 'public-identity-policy-does-not-inherit-private-assertions', requirements: ['REQ-MET-013', 'REQ-PRI-003'],
    run() {
      const m = privacyFixture(), before = JSON.stringify(m);
      const contributors = collectPublicationContributors(m);
      assert.doesNotMatch(JSON.stringify(contributors), PRIVATE);
      assert.equal(contributors[0]!.displayName, 'Ada Scholar');
      const projection = publicPublicationManuscript(m);
      assert.deepEqual(projection.annotations.map(item => item.id), ['public-note']);
      assert.doesNotMatch(projection.sections[0]!.blocks[0]!.children![0]!.content, PRIVATE);
      assert.equal(JSON.stringify(m), before);
    },
  },
  {
    id: 'private-authoring-backup-is-distinct-from-public-output', requirements: ['REQ-MET-013', 'REQ-PRI-003'],
    async run() {
      const m = privacyFixture(), before = JSON.stringify(m);
      const backup = serializeOmiJson(m), reopened = parseOmiJson(backup);
      assert.match(backup, /CONFIDENTIAL_EDITOR_BODY/);
      assert.equal(reopened.annotations.length, m.annotations.length);
      const container = await buildOmiContainer(m);
      assert.match(storeZipText(container.bytes), /CONFIDENTIAL_EDITOR_BODY/);
      assertPublic(renderHtmlArticle(reopened).html);
      assert.equal(JSON.stringify(m), before);
    },
  },
];

export async function runCoreExportPrivacyCases() {
  const results = [];
  for (const item of coreExportPrivacyCases) {
    await item.run(); results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const });
  }
  return results;
}
