import assert from 'node:assert/strict';
import test from 'node:test';
import { capturePublicationPageStyle, publicationPageStyles, removePublicationPageStyle, resolvePublicationPageStyle, validatePublicationPageStyles, withoutPublicationPageAssignments } from '../src/model/publicationPageStyles.ts';
import { clonePublicationStyleTemplate, clonePublicationPublisherTemplate, renderStyleBasedHtml, loadPublicationStyle, withPrintRunningHeader } from '../src/services/publicationStyleExport.ts';
import { paginatePublicationBlocks } from '../src/components/publicationPageLayout.ts';
import { buildPublicationPageStylesCss } from '../src/services/publicationPageStyleCss.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { stageAppliedPublicationStyle } from '../src/app/publicationTemplateActions.ts';
import { capturePublicationTemplate } from '../src/services/publicationTemplates.ts';
import { getAppliedPublicationTemplate } from '../src/model/publicationTemplates.ts';
import { resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import { withParentSectionId } from '../src/model/sectionStructure.ts';

const sections = [{ id: 'article-a', title: 'First article', blocks: [] }, withParentSectionId({ id: 'child', title: 'Subsection', blocks: [] }, 'article-a'), { id: 'article-b', title: 'Second article', blocks: [] }];
function configured() {
  const style = clonePublicationStyleTemplate();
  const master = capturePublicationPageStyle(style, 'opening', 'Article opening');
  master.page.margins.top = 40; master.runningHeaders.odd.left = '{{sectionTitle}}'; master.showFirstPage = false;
  style.pageStyles = { version: 1, styles: [master], sections: [{ sectionId: 'article-a', styleId: master.id, startNewPage: true }], pages: [] };
  return style;
}

test('legacy styles keep their default geometry and headers without materializing assignments', () => {
  const style = clonePublicationStyleTemplate();
  assert.deepEqual(publicationPageStyles(style), { version: 1, styles: [], sections: [], pages: [] });
  assert.deepEqual(resolvePublicationPageStyle(style, sections, 0).page, style.page);
  assert.equal(style.pageStyles, undefined);
});
test('section masters and custom headers inherit through flat and nested subsections', () => {
  const style = configured();
  assert.equal(resolvePublicationPageStyle(style, sections, 1, 'child').page.margins.top, 40);
  assert.equal(resolvePublicationPageStyle(style, sections, 1, 'child').headerSectionId, 'article-a');
  style.pageStyles!.sections.push({ sectionId: 'child', startNewPage: true, runningHeaders: { ...structuredClone(style.runningHeaders), odd: { left: 'Subsection', right: '{{pageNumber}}' } }, showFirstPage: true });
  const resolved = resolvePublicationPageStyle(style, sections, 1, 'child');
  assert.equal(resolved.page.margins.top, 40); assert.equal(resolved.runningHeaders.odd.left, 'Subsection'); assert.equal(resolved.showFirstPage, true);
  assert.equal(resolvePublicationPageStyle(style, sections, 1, 'article-b').page.margins.top, style.page.margins.top);
  assert.equal(resolvePublicationPageStyle(style, [{ ...sections[0]!, children: [{ id: 'nested', title: '', blocks: [] }] }], 1, 'nested').id, 'opening');
});
test('inclusive printed-page assignments override section masters, with the latest assignment winning', () => {
  const style = configured(); style.page.pageNumberStart = 11;
  const exception = capturePublicationPageStyle(style, 'exception', 'Plate'); exception.page.margins.bottom = 32;
  style.pageStyles!.styles.push(exception); style.pageStyles!.pages = [{ from: 12, to: 14, styleId: 'exception' }, { from: 14, to: 14, styleId: 'opening' }];
  assert.equal(resolvePublicationPageStyle(style, sections, 0, 'article-a').id, 'opening');
  assert.equal(resolvePublicationPageStyle(style, sections, 1, 'child').id, 'exception');
  assert.equal(resolvePublicationPageStyle(style, sections, 3, 'child').id, 'opening');
  assert.equal(resolvePublicationPageStyle(style, sections, 4, 'article-b').id, 'default');
});
test('deleting a master removes references and retains independent section header settings', () => {
  const style = configured(); style.pageStyles!.pages.push({ from: 1, to: 2, styleId: 'opening' });
  style.pageStyles!.sections[0]!.runningHeaders = structuredClone(style.runningHeaders);
  const next = removePublicationPageStyle(style.pageStyles!, 'opening'); validatePublicationPageStyles(next);
  assert.equal(next.styles.length, 0); assert.equal(next.pages.length, 0);
  assert.equal(next.sections[0]!.styleId, undefined); assert.ok(next.sections[0]!.runningHeaders);
});
test('portable validation rejects malformed geometry, references, duplicate IDs, ranges and unbounded headers', () => {
  const collection = configured().pageStyles!; validatePublicationPageStyles(collection);
  for (const mutate of [
    (c: typeof collection) => { c.styles[0]!.page.margins.top = 1000; },
    (c: typeof collection) => { c.styles[0]!.runningHeaders.fontSize = NaN; },
    (c: typeof collection) => { c.styles.push(structuredClone(c.styles[0]!)); },
    (c: typeof collection) => { c.sections[0]!.styleId = 'missing'; },
    (c: typeof collection) => { c.pages.push({ from: 4, to: 2, styleId: 'opening' }); },
    (c: typeof collection) => { c.styles[0]!.runningHeaders.odd.left = 'x'.repeat(1001); },
  ]) { const next = structuredClone(collection); mutate(next); assert.throws(() => validatePublicationPageStyles(next)); }
});
test('import validation bounds the section/page selector cross product before CSS allocation', () => {
  const collection = configured().pageStyles!;
  collection.sections = Array.from({ length: 100 }, (_, index) => ({ sectionId: `section-${index}`, startNewPage: true, styleId: 'opening' }));
  collection.pages = Array.from({ length: 50 }, (_, index) => ({ from: index + 1, to: index + 1, styleId: 'opening' }));
  assert.throws(() => validatePublicationPageStyles(collection));
});
test('variable page heights place content after a section break at its own top margin', () => {
  const layout = paginatePublicationBlocks([
    { sectionId: 'article-a', top: 0, height: 40 },
    { sectionId: 'article-b', top: 40, height: 30, forcePageBreakBefore: true },
    { sectionId: 'article-b', top: 70, height: 50 },
  ], 100, 20, undefined, (page) => ({ bodyHeight: page === 1 ? 60 : 100, bodyTop: page === 0 ? 0 : page === 1 ? 150 : 260 }));
  assert.equal(layout.pageCount, 3);
  assert.deepEqual(layout.pageSectionIds, ['article-a', 'article-b', 'article-b']);
  assert.equal(layout.placements[1]!.translateY + 40, 150);
  assert.equal(layout.placements[2]!.translateY + 70, 260);
});
test('styled pagination carries long footnotes and keeps each fragment within its page capacity', () => {
  const layout = paginatePublicationBlocks([{ sectionId: 'article-a', top: 0, height: 30, noteIds: ['note'] }], 100, 20,
    { heights: new Map([['note', 140]]), lineHeight: 10, separatorHeight: 5 },
    (page) => ({ bodyHeight: page === 1 ? 80 : 100, bodyTop: page * 120 }));
  assert.equal(layout.pageNotes!.flat().reduce((sum, note) => sum + note.height, 0), 140);
  for (const [index, fragments] of layout.pageNotes!.entries()) assert.ok(fragments.reduce((sum, note) => sum + note.height, 0) <= (index === 1 ? 30 : 50));
  assert.equal(layout.pageCount, layout.pageSectionIds!.length);
});
test('PDF CSS uses named section groups, section-first suppression, counter tokens and bounded page ranges', () => {
  const style = configured(); style.page.pageNumberStart = 11;
  style.pageStyles!.pages.push({ from: 12, to: 13, styleId: 'opening' });
  const css = buildPublicationPageStylesCss(style, sections, 'Issue', clonePublicationPublisherTemplate(), '2026');
  assert.match(css, /data-omi-section-id="article-a"\]\{page:omi_section_0;[^}]*break-before:page/);
  assert.match(css, /data-omi-section-id="child"\]\{page:omi_section_0;/);
  assert.match(css, /:nth\(1 of omi_section_0\)/); assert.match(css, /"First article"/);
  assert.match(css, /counter\(page\)/); assert.match(css, /:nth\(n\+2\):nth\(-n\+3\)/);
  assert.equal(buildPublicationPageStylesCss(clonePublicationStyleTemplate(), sections, '', clonePublicationPublisherTemplate(), '2026'), '');
});
test('page styles and section rules persist in OMI even without a previously applied template', async () => {
  const previous = useStudioStore.getState();
  try {
    const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'New issue', author: { displayName: 'Test Author', email: 'author@example.test' } });
    manuscript.sections = sections;
    useStudioStore.getState().loadManuscript(manuscript);
    stageAppliedPublicationStyle(configured()); useStudioStore.getState().checkpoint('manual');
    const restored = parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    assert.deepEqual(loadPublicationStyle(restored).pageStyles, configured().pageStyles);
    assert.equal(getAppliedPublicationTemplate(restored)!.source, 'document-style');
    const template = await capturePublicationTemplate(restored, loadPublicationStyle(restored), 'Journal format', 'Review');
    assert.equal(template.profile.publicationStyle!.pageStyles!.styles.length, 1);
    assert.deepEqual(template.profile.publicationStyle!.pageStyles!.sections, []);
    assert.deepEqual(template.profile.publicationStyle!.pageStyles!.pages, []);
    const html = await renderStyleBasedHtml(restored, resolvePublicationProfile(restored), 'print');
    assert.match(html, /@page omi_section_0/);
    assert.ok(html.includes(`© ${restored.updatedAt.slice(0, 4)} Egyháztörténeti Szemle`));
    const responsive = await renderStyleBasedHtml(restored, resolvePublicationProfile(restored), 'html');
    assert.doesNotMatch(responsive, /@page omi_section_0/);
  } finally { useStudioStore.setState(previous, true); }
});

test('physical page exceptions exclude cover/title sheets and both PDF export paths retain the same section rules', async () => {
  const { buildPdfPrintDocument } = await import('../src/services/exportPdf.ts');
  const style = configured(); style.pageStyles!.pages.push({ from: 1, to: 1, styleId: 'opening' });
  const prefix = '<section class="omi-publication-matter-page"></section>'.repeat(3);
  const html = withPrintRunningHeader(`<html><head></head><body>${prefix}<article class="omi-scholarly-article"></article></body></html>`,
    { title: 'Issue', updatedAt: '2026-11-20', sections }, style, clonePublicationPublisherTemplate());
  assert.match(html, /:nth\(n\+4\):nth\(-n\+4\)/);
  assert.match(html, /@page omi_section_0:nth\(1 of omi_section_0\)/);
  const manuscript = createBlankManuscript({ kind: 'volume', publicationKind: 'journal-issue', title: 'Issue', author: { displayName: 'Author', email: 'author@example.test' } });
  manuscript.sections = sections;
  const profile = { ...resolvePublicationProfile(manuscript), publicationStyle: style };
  const publication = buildPdfPrintDocument(manuscript, profile);
  assert.match(publication, /@page omi_section_0/);
  const editorial = buildPdfPrintDocument(manuscript, profile, 'print', 'editorial');
  assert.doesNotMatch(editorial, /@page omi_section_0/);
  const reusable = withoutPublicationPageAssignments(style);
  assert.equal(reusable.pageStyles!.sections.length, 0); assert.equal(reusable.pageStyles!.pages.length, 0);
  assert.equal(style.pageStyles!.sections.length, 1); assert.equal(style.pageStyles!.pages.length, 1);
});
