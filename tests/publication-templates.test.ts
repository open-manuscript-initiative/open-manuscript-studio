import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { applyPublicationTemplate, getAppliedPublicationTemplate, PUBLICATION_TEMPLATE_EXTENSION } from '../src/model/publicationTemplates.ts';
import { resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import { createPublicationMatter, getPublicationMatter, PUBLICATION_MATTER_EXTENSION } from '../src/model/publicationMatter.ts';
import { createPublicationMatterFrame } from '../src/model/publicationMatterFrames.ts';
import { defaultSpineCalculation, publicationSpineWidth } from '../src/model/publicationSpine.ts';
import { createAssetMetadata } from '../src/model/assets.ts';
import { inspectRevisionStateIntegrity } from '../src/model/revisionIntegrity.ts';
import { builtinPublicationTemplates, capturePublicationTemplate, prepareTemplatedPublication, validatePublicationTemplate } from '../src/services/publicationTemplates.ts';
import { clonePublicationStyleTemplate, loadPublicationStyle, buildPublicationStyleCss, renderStyleBasedHtml, normalizePublicationStyle } from '../src/services/publicationStyleExport.ts';
import { capturePublicationPageStyle } from '../src/model/publicationPageStyles.ts';
import { getAssetPayload, putAssetPayload } from '../src/services/assetRepository.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { stageAppliedPublicationStyle, stagePublicationTemplate } from '../src/app/publicationTemplateActions.ts';

const rich = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'italic' }] }] }] });
function source() {
  const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'First issue',
    titleMatter: { publisherName: 'University Press', publicationPlace: 'Eger', publicationYear: '2025', isbn: '978-0-306-40615-7', doi: '10.1234/first', issn: '1234-5679', eissn: '2049-3630' } });
  const matter = createPublicationMatter(manuscript); matter.publicationKind = 'journal-issue';
  matter.pages[0]!.enabled = true;
  matter.pages[0]!.content = rich('First issue / 2025 / 978-0-306-40615-7 / 10.1234/first');
  manuscript.extensions = { ...manuscript.extensions, [PUBLICATION_MATTER_EXTENSION]: matter };
  return { manuscript, matter };
}

test('built-in templates are valid and initialize complete revision snapshots and the new imprint', async () => {
  for (const template of builtinPublicationTemplates()) {
    await validatePublicationTemplate(template);
    const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: template.kind, publicationTemplate: template,
      title: 'New publication', titleMatter: { isbn: '978-3-16-148410-0', doi: '10.1234/new' } });
    assert.equal(getPublicationMatter(manuscript)?.publicationKind, template.kind);
    assert.equal(getAppliedPublicationTemplate(manuscript)?.style.page.width, template.kind === 'volume' ? 148 : 150);
    assert.match(getPublicationMatter(manuscript)!.pages.find((page) => page.kind === 'title-page')!.content, /New publication/);
    const imprint = getPublicationMatter(manuscript)!.pages.find((page) => page.kind === 'imprint-page')!.content;
    assert.match(imprint, /ISBN 978-3-16-148410-0/); assert.match(imprint, /DOI 10.1234\/new/);
    assert.doesNotMatch(JSON.stringify(getPublicationMatter(manuscript)), /"text":""/);
    assert.equal(inspectRevisionStateIntegrity(manuscript.revisionHistory.revisions[0]!).status, 'verified');
    const restored = parseOmiJson(serializeOmiJson(manuscript));
    assert.equal(JSON.stringify(getAppliedPublicationTemplate(restored)), JSON.stringify(getAppliedPublicationTemplate(manuscript)));
    assert.equal(JSON.stringify(loadPublicationStyle(restored)), JSON.stringify(getAppliedPublicationTemplate(restored)!.style));
    assert.match(buildPublicationStyleCss(loadPublicationStyle(restored)), new RegExp(`${template.kind === 'volume' ? 148 : 150}mm`));
  }
});

test('template exports use the portable format and brand instead of the device journal defaults', async () => {
  const template = builtinPublicationTemplates()[0]!;
  template.association = 'University history series';
  const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: 'volume', publicationTemplate: template, title: 'Portable volume', author: { displayName: 'Test Author', email: 'author@example.test' } });
  const html = await renderStyleBasedHtml(manuscript, resolvePublicationProfile(manuscript), 'print');
  assert.match(html, /148mm 210mm/);
  assert.match(html, /University history series/);
  assert.doesNotMatch(html, /egyhaztortenetiszemle\.hu|Egyháztörténeti Szemle/);
});

test('metadata tokens prefer the document title over an identical half-title and never read inherited properties', async () => {
  const { manuscript, matter } = source();
  manuscript.titleMatter!.halfTitle = manuscript.title;
  matter.pages[0]!.content = rich('First issue / University Press / {{constructor}} / {{subtitle}}');
  const template = await capturePublicationTemplate(manuscript, clonePublicationStyleTemplate(), 'Metadata', '');
  assert.match(template.matter.pages[0]!.content, /\{\{title\}\}/);
  const target = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'New title', titleMatter: { publisherName: 'New publisher' } });
  const applied = getPublicationMatter(applyPublicationTemplate(target, template))!;
  assert.match(applied.pages[0]!.content, /New title \/ New publisher/);
  assert.doesNotMatch(applied.pages[0]!.content, /function|University Press/);
});

test('portable OMI input rejects malformed applied template styles', () => {
  const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: 'volume', title: 'Valid title', publicationTemplate: builtinPublicationTemplates()[0] });
  const json = JSON.parse(serializeOmiJson(manuscript));
  json.extensions[PUBLICATION_TEMPLATE_EXTENSION].style = { page: null };
  assert.throws(() => parseOmiJson(JSON.stringify(json)));
});

test('captures all journal metadata and substitutes variable text without changing marks or frame geometry', async () => {
  const { manuscript, matter } = source();
  const frame = createPublicationMatterFrame('text', 150, 240); frame.content = rich('First issue'); frame.rotation = 21;
  matter.pages[0]!.frames = [frame];
  const template = await capturePublicationTemplate(manuscript, clonePublicationStyleTemplate(), 'Review format', 'Review');
  assert.deepEqual(template.defaults, manuscript.titleMatter);
  assert.match(template.matter.pages[0]!.content, /\{\{title\}\}.*\{\{publicationYear\}\}.*\{\{isbn\}\}.*\{\{doi\}\}/);
  assert.match(template.matter.pages[0]!.frames![0]!.content!, /\{\{title\}\}/);
  assert.equal(template.matter.pages[0]!.frames![0]!.rotation, 21);
  assert.match(template.matter.pages[0]!.content, /italic/);
  assert.match(matter.pages[0]!.content, /First issue/);
});

test('applies a detached format while preserving scholarly content, identities, current identifiers and explicit metadata', async () => {
  const { manuscript } = source();
  const template = await capturePublicationTemplate(manuscript, clonePublicationStyleTemplate(), 'Review format', 'Review');
  const target = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'Second issue', titleMatter: { isbn: '978-3-16-148410-0', doi: '10.1234/second', publicationYear: '2026', publisherName: 'Local publisher' } });
  const before = structuredClone(target);
  const applied = applyPublicationTemplate(target, template);
  assert.equal(applied.id, target.id); assert.equal(applied.title, 'Second issue');
  assert.deepEqual(applied.sections, target.sections); assert.deepEqual(applied.agents, target.agents);
  assert.equal(applied.titleMatter!.publisherName, 'Local publisher'); assert.equal(applied.titleMatter!.issn, '1234-5679');
  assert.equal(applied.titleMatter!.isbn, '978-3-16-148410-0'); assert.equal(applied.titleMatter!.doi, '10.1234/second');
  const text = getPublicationMatter(applied)!.pages[0]!.content;
  assert.match(text, /Second issue.*2026.*978-3-16-148410-0.*10.1234\/second/);
  assert.doesNotMatch(text, /First issue|2025|10.1234\/first/);
  template.matter.pages[0]!.appearance.background = '#abcdef';
  template.profile.publicationStyle!.page.width = 99;
  assert.notEqual(getPublicationMatter(applied)!.pages[0]!.appearance.background, '#abcdef');
  assert.notEqual(getAppliedPublicationTemplate(applied)!.style.page.width, 99);
  assert.deepEqual(target, before);
});

test('rejects mismatched template kinds and templates on standalone studies', () => {
  const [volume, journal] = builtinPublicationTemplates();
  assert.throws(() => applyPublicationTemplate(createBlankManuscript({ kind: 'volume', publicationKind: 'volume' }), journal!), /type does not match/);
  assert.throws(() => applyPublicationTemplate(createBlankManuscript({ kind: 'study' }), volume!), /requires a volume/);
});

test('cover images survive portable template JSON and are copied into the target asset repository', async () => {
  const { manuscript, matter } = source();
  const payload = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const asset = await createAssetMetadata(payload, { mediaType: 'image/png', fileName: 'logo.png', role: 'figure' });
  manuscript.assets = [asset];
  await putAssetPayload(manuscript.id, asset.id, payload);
  matter.pages[0]!.image = { assetId: asset.id, alt: 'Logo', fit: 'contain' };
  const template = await capturePublicationTemplate(manuscript, clonePublicationStyleTemplate(), 'With logo', '');
  assert.notEqual(template.assets[0]!.metadata.id, asset.id);
  const imported = await validatePublicationTemplate(JSON.parse(JSON.stringify(template)));
  const target = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'Next issue' });
  const applied = await prepareTemplatedPublication(target, imported);
  const id = getPublicationMatter(applied)!.pages[0]!.image!.assetId;
  assert.deepEqual(await getAssetPayload(target.id, id), payload);
  assert.equal(applied.assets!.find((item) => item.id === id)!.checksum.value, asset.checksum.value);
  assert.equal(applyPublicationTemplate(applied, imported).assets!.length, 1);
  imported.assets[0]!.base64 = btoa('corrupted');
  await assert.rejects(validatePublicationTemplate(imported));
});

test('missing image payloads abort capture, and malformed portable templates fail validation', async () => {
  const { manuscript, matter } = source();
  matter.pages[0]!.image = { assetId: 'missing', alt: 'Missing', fit: 'cover' };
  await assert.rejects(capturePublicationTemplate(manuscript, clonePublicationStyleTemplate(), 'Broken', ''), /unavailable/);
  for (const mutate of [
    (t: any) => { t.defaults.doi = 123; },
    (t: any) => { t.defaults.isbn = '978-0-306-40615-7'; },
    (t: any) => { t.textDefaults = { unknown: 'text' }; },
    (t: any) => { t.textDefaults = { subtitle: 123 }; },
    (t: any) => { t.structureDefaults = { noteNumberingScope: 'invalid' }; },
    (t: any) => { t.kind = 'study'; },
    (t: any) => { t.profile.publicationStyle = { page: null }; },
    (t: any) => { t.matter.pages[0].content = '<script>'; },
    (t: any) => { t.matter.pages[0].image = { assetId: 'missing', alt: '', fit: 'cover' }; },
  ]) {
    const template = builtinPublicationTemplates()[0]!; mutate(template);
    await assert.rejects(validatePublicationTemplate(template));
  }
});

test('automatic spine templates keep paper stock and switch to the target layout count', async () => {
  const { manuscript, matter } = source();
  matter.spineCalculation = { ...defaultSpineCalculation(400), mode: 'automatic', pageCountSource: 'layout' };
  const template = await capturePublicationTemplate(manuscript, clonePublicationStyleTemplate(), 'Paper', '');
  const target = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue' });
  const applied = getPublicationMatter(applyPublicationTemplate(target, template))!;
  assert.equal(applied.spineCalculation!.paperId, matter.spineCalculation.paperId);
  assert.equal(applied.spineCalculation!.pageCount, 1); assert.equal(applied.spineCalculation!.pageCountSource, 'layout');
  assert.ok(publicationSpineWidth(applied) < 1);
});

test('journal template JSON retains text, both ISSNs, complete styles, bindings and manually configured spine settings', async () => {
  const { manuscript, matter } = source();
  manuscript.subtitle = 'Journal subtitle'; manuscript.motto = 'Recurring motto';
  manuscript.titleMatter = { ...manuscript.titleMatter, halfTitle: 'Review', responsibilityStatement: 'Editorial board', editionStatement: 'Annual edition', copyrightStatement: 'All rights reserved', colophon: 'Publisher and editor\nPrinted in Eger', otherIdentifiers: 'Archive identifier' };
  manuscript.documentStructure!.noteNumberingScope = 'section';
  manuscript.documentStructure!.referencesPlacement = 'volume-end';
  matter.pages[0]!.content = rich('Custom text / {{subtitle}} / {{motto}} / {{colophon}} / {{issn}} / {{eissn}}');
  matter.spineCalculation = { ...defaultSpineCalculation(400), mode: 'automatic', pageCountSource: 'manual' };
  const style = clonePublicationStyleTemplate();
  style.page.facingPages = true;
  style.runningHeaders.odd.left = 'Editorial header';
  style.pageStyles = { version: 1, styles: [capturePublicationPageStyle(style, 'opening', 'Opening')], sections: [{ sectionId: 'source-section', styleId: 'opening', startNewPage: true }], pages: [{ from: 1, to: 3, styleId: 'opening' }] };
  const saved = await capturePublicationTemplate(manuscript, style, 'Review', 'Review journal');
  const template = await validatePublicationTemplate(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(template.profile.publicationStyle, JSON.parse(JSON.stringify(normalizePublicationStyle(style))));
  const target = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'Next issue', publicationTemplate: template });
  assert.deepEqual(target.titleMatter, manuscript.titleMatter);
  assert.equal(target.subtitle, manuscript.subtitle); assert.equal(target.motto, manuscript.motto);
  assert.equal(target.documentStructure!.noteNumberingScope, 'section');
  assert.equal(target.documentStructure!.referencesPlacement, 'volume-end');
  assert.deepEqual(getPublicationMatter(target)!.spineCalculation, matter.spineCalculation);
  assert.match(getPublicationMatter(target)!.pages[0]!.content, /Custom text.*Journal subtitle.*Recurring motto.*Publisher and editor/);
  assert.match(getPublicationMatter(target)!.pages[0]!.content, /1234-5679.*2049-3630/);
  const reopened = parseOmiJson(serializeOmiJson(target));
  assert.deepEqual(reopened.titleMatter, manuscript.titleMatter);
  assert.deepEqual(getAppliedPublicationTemplate(reopened)!.style, { ...template.profile.publicationStyle!, id: `publication-template:${template.id}`, name: template.name });
  assert.equal(inspectRevisionStateIntegrity(target.revisionHistory.revisions[0]!).status, 'verified');
});

test('book series retain entered text and series title, but never copy print or electronic ISBNs', async () => {
  const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: 'volume', title: 'First volume', titleMatter: { seriesTitle: 'Studies in church history', publisherName: 'University Press', isbn: '978-0-306-40615-7', electronicIsbn: '978-3-16-148410-0', colophon: 'Series editors\nPermanent imprint' } });
  manuscript.subtitle = 'Retained subtitle';
  const matter = getPublicationMatter(manuscript)!;
  matter.pages.find((page) => page.kind === 'series-page')!.enabled = true;
  const template = await capturePublicationTemplate(manuscript, clonePublicationStyleTemplate(), 'Series', '');
  assert.equal(template.association, 'Studies in church history');
  assert.equal(template.defaults.isbn, undefined); assert.equal(template.defaults.electronicIsbn, undefined);
  assert.doesNotMatch(JSON.stringify(template), /978-0-306-40615-7|978-3-16-148410-0/);
  const applied = createBlankManuscript({ kind: 'volume', publicationKind: 'volume', title: 'Second volume', publicationTemplate: template, author: { displayName: 'Next volume author', email: 'author@example.test' } });
  assert.equal(applied.titleMatter!.seriesTitle, 'Studies in church history');
  assert.equal(applied.titleMatter!.colophon, manuscript.titleMatter!.colophon);
  assert.equal(applied.subtitle, manuscript.subtitle);
  assert.equal(applied.titleMatter!.isbn, undefined); assert.equal(applied.titleMatter!.electronicIsbn, undefined);
  assert.match(getPublicationMatter(applied)!.pages.find((page) => page.kind === 'series-page')!.content, /Studies in church history/);
  const html = await renderStyleBasedHtml(applied, resolvePublicationProfile(applied), 'print');
  assert.match(html, /Studies in church history/);
  assert.doesNotMatch(html, /978-0-306-40615-7|978-3-16-148410-0/);
  const updated = createBlankManuscript({ kind: 'volume', publicationKind: 'volume', publicationTemplate: template, title: 'Third volume', titleMatter: { isbn: '978-1-4028-9462-6', electronicIsbn: '978-0-596-52068-7', seriesTitle: 'Revised series' } });
  assert.equal(updated.titleMatter!.isbn, '978-1-4028-9462-6');
  assert.equal(updated.titleMatter!.electronicIsbn, '978-0-596-52068-7');
  assert.match(getPublicationMatter(updated)!.pages.find((page) => page.kind === 'series-page')!.content, /Revised series/);
});

test('older templates without expanded defaults remain usable', async () => {
  const { manuscript } = source();
  const template = await capturePublicationTemplate(manuscript, clonePublicationStyleTemplate(), 'Legacy', '');
  delete template.textDefaults; delete template.structureDefaults;
  template.defaults = { issn: '1234-5679', colophon: 'Saved imprint' };
  const imported = await validatePublicationTemplate(JSON.parse(JSON.stringify(template)));
  const applied = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'Current title', publicationTemplate: imported });
  assert.equal(applied.title, 'Current title'); assert.equal(applied.titleMatter!.issn, '1234-5679');
  assert.equal(applied.titleMatter!.colophon, 'Saved imprint');
});

test('applying and then editing a template records complete portable working revisions', async () => {
  const previous = useStudioStore.getState();
  try {
    const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: 'volume', title: 'Working publication' });
    useStudioStore.getState().loadManuscript(manuscript);
    const template = builtinPublicationTemplates()[0]!;
    template.defaults.seriesTitle = 'Working series';
    template.textDefaults = { subtitle: 'Saved subtitle', motto: 'Saved motto' };
    template.structureDefaults = { noteNumberingScope: 'section', referencesPlacement: 'volume-end', listsPlacement: 'study-end' };
    const style = await stagePublicationTemplate(template);
    assert.equal(style.page.width, 148);
    assert.equal(useStudioStore.getState().manuscript.title, 'Working publication');
    assert.equal(useStudioStore.getState().pendingChangeSet, null);
    const next = structuredClone(style); next.page.width = 162;
    stageAppliedPublicationStyle(next);
    assert.ok(useStudioStore.getState().pendingChangeSet);
    useStudioStore.getState().checkpoint('manual');
    const committed = useStudioStore.getState().manuscript;
    const restored = parseOmiJson(serializeOmiJson(committed));
    assert.equal(restored.titleMatter!.seriesTitle, 'Working series');
    assert.equal(restored.subtitle, 'Saved subtitle'); assert.equal(restored.motto, 'Saved motto');
    assert.equal(restored.documentStructure!.noteNumberingScope, 'section');
    assert.equal(restored.documentStructure!.listsPlacement, 'study-end');
    assert.equal(loadPublicationStyle(restored).page.width, 162);
    assert.equal(restored.embeddedPublicationProfile!.publicationStyle!.page.width, 162);
    assert.equal(inspectRevisionStateIntegrity(restored.revisionHistory.revisions[0]!).status, 'verified');
    assert.ok(restored.revisionHistory.revisions.every((revision) => inspectRevisionStateIntegrity(revision).status !== 'mismatch'));
    const head = restored.revisionHistory.revisions.find((revision) => revision.id === restored.headRevisionId)!;
    assert.equal(getAppliedPublicationTemplate(head.snapshot.state)!.style.page.width, 162);
  } finally { useStudioStore.setState(previous, true); }
});

test('portable publication template retains table and cell style catalog and applies the default only to new blank tables',async()=>{
  const {BUILTIN_TABLE_STYLES,putPublicationTablePreset,removePublicationTablePreset,applyDefaultPublicationTableStyle,validatePublicationTableStyles}=await import('../src/model/tableAppearancePresets.ts');
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {manuscript}=source();
  const originalStyle=clonePublicationStyleTemplate();
  const grid=putPublicationTablePreset(undefined,{...BUILTIN_TABLE_STYLES.banded,name:'Journal banded'});
  assert.ok(grid);
  const both=putPublicationTablePreset(grid,{kind:'cell',name:'Numeric',format:{horizontalAlign:'right',paddingPt:{right:4}}});
  assert.ok(both);
  const catalog={...both,defaultTableStyle:'Journal banded'};
  validatePublicationTableStyles(catalog);
  assert.equal(putPublicationTablePreset(catalog,BUILTIN_TABLE_STYLES.banded)?.items.length,3);
  assert.equal(putPublicationTablePreset(catalog,{...BUILTIN_TABLE_STYLES.banded,name:'Journal banded'}),undefined);
  const template=await capturePublicationTemplate(manuscript,{...originalStyle,tableStyles:catalog},'Journal table styles','Journal');
  const imported=await validatePublicationTemplate(JSON.parse(JSON.stringify(template)));
  const next=createBlankManuscript({kind:'volume',publicationKind:'journal-issue',title:'Next issue',publicationTemplate:imported});
  const reopened=parseOmiJson(serializeOmiJson(next));
  const applied=getAppliedPublicationTemplate(reopened)?.style.tableStyles;
  assert.deepEqual(applied,catalog);
  assert.deepEqual(loadPublicationStyle(reopened).tableStyles,catalog);
  const blank=createTableBlock([['',''],['',''],['','']],{headerRows:1}).visual;
  assert.ok(blank?.kind==='table');
  const styled=applyDefaultPublicationTableStyle(blank,applied);
  assert.equal(styled.cellFormats?.['0:0']?.backgroundColor,'#DCE6F1');
  assert.equal(styled.cellFormats?.['2:1']?.backgroundColor,'#F1F4F7');
  assert.deepEqual(styled.cells,blank.cells);
  assert.equal(blank.cellFormats,undefined);
  const data={...blank,cells:[['Existing','data'],['',''],['','']]};
  assert.equal(applyDefaultPublicationTableStyle(data,applied),data);
  const importedBlank={...blank,provenance:{sourceFormat:'idml',importedAt:'2026-11-25T00:00:00Z'}};
  assert.equal(applyDefaultPublicationTableStyle(importedBlank,applied),importedBlank);
  assert.equal(applyDefaultPublicationTableStyle(styled,applied),styled);
  const removed=removePublicationTablePreset(catalog,'Journal banded');
  assert.equal(removed.defaultTableStyle,undefined);
  assert.equal(removed.items.length,1);
  assert.equal(applyDefaultPublicationTableStyle(blank,removed),blank);
  assert.deepEqual(getAppliedPublicationTemplate(reopened)?.style.tableStyles,catalog);
  for(const invalid of [
    {...catalog,defaultTableStyle:'Numeric'},
    {...catalog,items:[...catalog.items,catalog.items[0]]},
    {...catalog,items:[{...catalog.items[0],cells:[['private']]}]},
    {...catalog,items:[{kind:'table',name:'bad',header:{backgroundColor:'red;display:none'},body:{}}],defaultTableStyle:'bad'}
  ]){
    const bad=structuredClone(template);
    bad.profile.publicationStyle!.tableStyles=invalid as typeof catalog;
    await assert.rejects(validatePublicationTemplate(bad),/Invalid publication table styles/);
  }
});

test('publication table bindings refresh named styles without touching unrelated tables or direct overrides',async()=>{
  const {BUILTIN_TABLE_STYLES,bindPublicationTableStyle,detachPublicationTableStyle,refreshPublicationTableStyle,replacePublicationTablePreset,removePublicationTablePreset}=await import('../src/model/tableAppearancePresets.ts');
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const block=createTableBlock([['Header','B'],['Body','C'],['Alternate','D']],{headerRows:1});
  assert.ok(block.visual?.kind==='table');
  const original={items:[BUILTIN_TABLE_STYLES.banded],defaultTableStyle:'banded'};
  const bound=bindPublicationTableStyle(block.visual,original,'banded');
  assert.equal(bound.publicationTableStyle,'banded');
  const overridden={...bound,cellFormats:{...bound.cellFormats,'1:0':{...bound.cellFormats?.['1:0'],backgroundColor:'#ABCDEF',textRotation:90 as const}}};
  const next=replacePublicationTablePreset(original,{...BUILTIN_TABLE_STYLES.banded,header:{backgroundColor:'#123456'},body:{backgroundColor:'#654321'},alternate:{backgroundColor:'#AABBCC'}});
  assert.ok(next);
  const refreshed=refreshPublicationTableStyle(overridden,original,next);
  assert.equal(refreshed.cellFormats?.['0:0']?.backgroundColor,'#123456');
  assert.equal(refreshed.cellFormats?.['1:1']?.backgroundColor,'#654321');
  assert.equal(refreshed.cellFormats?.['1:0']?.backgroundColor,'#ABCDEF');
  assert.equal(refreshed.cellFormats?.['1:0']?.textRotation,90);
  assert.equal(refreshed.cellFormats?.['2:1']?.backgroundColor,'#AABBCC');
  assert.equal(refreshed.cells,bound.cells);
  assert.equal(refreshPublicationTableStyle(block.visual,original,next),block.visual);
  assert.equal(refreshPublicationTableStyle(bound,original,original),bound);
  const detached=detachPublicationTableStyle(refreshed);
  assert.equal(detached.publicationTableStyle,undefined);
  assert.equal(detached.cellFormats,refreshed.cellFormats);
  assert.equal(refreshPublicationTableStyle(refreshed,next,removePublicationTablePreset(next,'banded')).publicationTableStyle,undefined);
});

test('editing the working publication catalog updates bound tables in the portable revision',async()=>{
  const {BUILTIN_TABLE_STYLES,bindPublicationTableStyle,normalizePublicationTableStyles}=await import('../src/model/tableAppearancePresets.ts');
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {stageInsertBlocks}=await import('../src/app/visualBlockActions.ts');
  const previous=useStudioStore.getState();
  try{
    const manuscript=createBlankManuscript({kind:'volume',publicationKind:'volume',title:'Live table styles'});
    useStudioStore.getState().loadManuscript(manuscript);
    const initial={...clonePublicationStyleTemplate(),tableStyles:normalizePublicationTableStyles({items:[BUILTIN_TABLE_STYLES.banded],defaultTableStyle:'banded'})};
    stageAppliedPublicationStyle(initial);
    const block=createTableBlock([['Header'],['Body']],{headerRows:1});
    assert.ok(block.visual?.kind==='table');
    block.visual=bindPublicationTableStyle(block.visual,initial.tableStyles,'banded');
    useStudioStore.getState().addSection();
    const sectionId=useStudioStore.getState().manuscript.sections[0]!.id;
    assert.equal(stageInsertBlocks(sectionId,0,[block]),true);
    const changed={...initial,tableStyles:normalizePublicationTableStyles({items:[{...BUILTIN_TABLE_STYLES.banded,header:{backgroundColor:'#123456'}}],defaultTableStyle:'banded'})};
    stageAppliedPublicationStyle(changed);
    useStudioStore.getState().checkpoint('manual');
    const reopened=parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    const visual=reopened.sections.flatMap(section=>section.blocks).find(candidate=>candidate.id===block.id)?.visual;
    assert.ok(visual?.kind==='table');
    assert.equal(visual.publicationTableStyle,'banded');
    assert.equal(visual.cellFormats?.['0:0']?.backgroundColor,'#123456');
    assert.deepEqual(visual.cells,[['Header'],['Body']]);
    assert.ok(reopened.revisionHistory.revisions.every(revision=>inspectRevisionStateIntegrity(revision).status!=='mismatch'));
  }finally{useStudioStore.setState(previous,true);}
});

test('linked table geometry inherits new rows and columns and reflows bands without losing direct overrides',async()=>{
  const {BUILTIN_TABLE_STYLES,bindPublicationTableStyle,inheritPublicationTableGeometry}=await import('../src/model/tableAppearancePresets.ts');
  const {addTableRow,addTableColumn}=await import('../src/model/visualBlocks.ts');
  const {planTableAxisMove,reorderTableAxis}=await import('../src/model/tableLayout.ts');
  const catalog={items:[BUILTIN_TABLE_STYLES.banded],defaultTableStyle:'banded'};
  const bound=bindPublicationTableStyle({kind:'table',cells:[['H'],['A'],['B']],headerRows:1},catalog,'banded');
  const initial={...bound,cellFormats:{...bound.cellFormats,'1:0':{...bound.cellFormats?.['1:0'],horizontalAlign:'right' as const}}};
  const expanded=inheritPublicationTableGeometry(initial,{...initial,cells:addTableColumn(addTableRow(initial.cells))},catalog);
  assert.equal(expanded.cellFormats?.['0:1']?.backgroundColor,'#DCE6F1');
  assert.equal(expanded.cellFormats?.['2:1']?.backgroundColor,'#F1F4F7');
  assert.equal(expanded.cellFormats?.['3:0']?.backgroundColor,undefined);
  assert.equal(expanded.cellFormats?.['1:0']?.horizontalAlign,'right');
  const plan=planTableAxisMove(expanded,'row',1,1)!;
  const moved=reorderTableAxis(expanded,'row',1,1)!;
  const reflowed=inheritPublicationTableGeometry(expanded,moved.table,catalog,p=>({row:plan.order[p.row]!,column:p.column}));
  assert.equal(reflowed.cells[2]?.[0],'A');
  assert.equal(reflowed.cellFormats?.['2:0']?.backgroundColor,'#F1F4F7');
  assert.equal(reflowed.cellFormats?.['2:0']?.horizontalAlign,'right');
  assert.equal(reflowed.cellFormats?.['1:0']?.backgroundColor,undefined);
  assert.equal(reflowed.cellFormats?.['1:0']?.horizontalAlign,undefined);
  const unlinked={kind:'table' as const,cells:[['X']]};
  const more={...unlinked,cells:[['X'],['']]};
  assert.equal(inheritPublicationTableGeometry(unlinked,more,catalog),more);
});

test('nested publication bindings survive rich-cell normalization and update through unlinked parents',async()=>{
  const {BUILTIN_TABLE_STYLES,bindPublicationTableStyle,refreshPublicationTableTree,removePublicationTablePreset}=await import('../src/model/tableAppearancePresets.ts');
  const {cellNestedTable,tableCellDocument}=await import('../src/model/tableLayout.ts');
  const catalog={items:[BUILTIN_TABLE_STYLES.banded],defaultTableStyle:'banded'};
  const nested=bindPublicationTableStyle({kind:'table',cells:[['N']],headerRows:1},catalog,'banded');
  const parent={kind:'table' as const,cells:[['N']],cellContent:{'0:0':JSON.stringify({type:'doc',content:[{type:'omiCellTable',attrs:{table:nested}}]})}};
  const read=(table:typeof parent)=>cellNestedTable(tableCellDocument(table,0,0)!.content![0]!)!;
  assert.equal(read(parent).publicationTableStyle,'banded');
  const next={...catalog,items:[{...BUILTIN_TABLE_STYLES.banded,header:{backgroundColor:'#123456',borders:BUILTIN_TABLE_STYLES.banded.header.borders,paddingPt:BUILTIN_TABLE_STYLES.banded.header.paddingPt}}]};
  const refreshed=refreshPublicationTableTree(parent,catalog,next);
  assert.equal(refreshed.cells,parent.cells);
  assert.equal(read({...parent,...refreshed}).cellFormats?.['0:0']?.backgroundColor,'#123456');
  const detached=refreshPublicationTableTree(refreshed,next,removePublicationTablePreset(next,'banded'));
  assert.equal(read({...parent,...detached}).publicationTableStyle,undefined);
  assert.equal(read({...parent,...detached}).cellFormats?.['0:0']?.backgroundColor,'#123456');
});

test('named cell styles override table regions, refresh direct differences and reset selected overrides',async()=>{
  const {BUILTIN_TABLE_STYLES,bindPublicationTableStyle,bindPublicationCellStyle,refreshPublicationTableTree,resetInheritedCellAppearance,detachPublicationCellStyles,replacePublicationTablePreset,removePublicationTablePreset,inheritPublicationTableGeometry}=await import('../src/model/tableAppearancePresets.ts');
  const {planTableAxisMove,reorderTableAxis}=await import('../src/model/tableLayout.ts');
  const start={row:1,column:0};
  const cell={kind:'cell' as const,name:'Numeric',format:{horizontalAlign:'right' as const,backgroundColor:'#123456'}};
  const catalog={items:[BUILTIN_TABLE_STYLES.banded,cell]};
  const table=bindPublicationTableStyle({kind:'table',cells:[['H'],['A'],['B']],headerRows:1},catalog,'banded');
  const linked=bindPublicationCellStyle(table,catalog,'Numeric',start,start);
  assert.equal(linked.publicationCellStyles?.['1:0'],'Numeric');
  const direct={...linked,cellFormats:{...linked.cellFormats,'1:0':{...linked.cellFormats?.['1:0'],backgroundColor:'#ABCDEF'}}};
  const changed=replacePublicationTablePreset(catalog,{...cell,format:{horizontalAlign:'center',backgroundColor:'#654321'}})!;
  const refreshed=refreshPublicationTableTree(direct,catalog,changed);
  assert.equal(refreshed.cellFormats?.['1:0']?.horizontalAlign,'center');
  assert.equal(refreshed.cellFormats?.['1:0']?.backgroundColor,'#ABCDEF');
  const reset=resetInheritedCellAppearance(refreshed,changed,start,start);
  assert.equal(reset.cellFormats?.['1:0']?.backgroundColor,'#654321');
  const plan=planTableAxisMove(reset,'row',1,1)!;
  const moved=reorderTableAxis(reset,'row',1,1)!;
  const reflowed=inheritPublicationTableGeometry(reset,moved.table,changed,p=>({row:plan.order[p.row]!,column:p.column}));
  assert.equal(reflowed.publicationCellStyles?.['2:0'],'Numeric');
  assert.equal(reflowed.cellFormats?.['2:0']?.backgroundColor,'#654321');
  assert.equal(reflowed.cellFormats?.['1:0']?.backgroundColor,undefined);
  const detached=detachPublicationCellStyles(reset,start,start);
  assert.equal(detached.publicationCellStyles,undefined);
  assert.equal(detached.cellFormats,reset.cellFormats);
  const removed=refreshPublicationTableTree(reset,changed,removePublicationTablePreset(changed,'Numeric'));
  assert.equal(removed.publicationCellStyles,undefined);
  assert.equal(removed.cellFormats?.['1:0']?.backgroundColor,'#654321');
  const region=resetInheritedCellAppearance(detached,changed,start,start);
  assert.equal(region.cellFormats?.['1:0']?.backgroundColor,undefined);
  assert.equal(region.cells,table.cells);
});
