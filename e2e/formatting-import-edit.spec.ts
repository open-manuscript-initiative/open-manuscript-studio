import { expect, test, type Locator, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
import { createStoreZip, textZipEntry } from '../src/services/simpleZip';

const formats = [
  { id: 'C01', property: '<w:b/>', button: 'Bold / strong', selector: 'strong' },
  { id: 'C02', property: '<w:i/>', button: 'Italic / emphasis', selector: 'em' },
  { id: 'C03', property: '<w:u w:val="single"/>', button: 'Underline', selector: 'u[data-omi-underline]' },
  { id: 'C07', property: '<w:strike/>', button: 'Strikethrough', selector: 's' },
  { id: 'C09', property: '<w:smallCaps/>', button: 'Small caps', selector: 'span[data-omi-small-caps]' },
  { id: 'C11', property: '<w:vertAlign w:val="superscript"/>', button: 'Superscript', selector: 'sup[data-omi-superscript]' },
  { id: 'C12', property: '<w:vertAlign w:val="subscript"/>', button: 'Subscript', selector: 'sub[data-omi-subscript]' },
];
const sample = (id: string) => 'CASE_' + id + '_TEXT';
function nativeFormattingDocx(): Buffer {
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const body = formats.map(item => '<w:p><w:r><w:rPr>' + item.property + '</w:rPr><w:t>' + sample(item.id) + '</w:t></w:r></w:p>').join('')
    + '<w:p><w:r><w:rPr><w:b/><w:i/><w:u w:val="single"/></w:rPr><w:t>COMPOUND_MARKS_TEXT</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t>UNFORMATTED_CONTROL</w:t></w:r></w:p>';
  return Buffer.from(createStoreZip([
    textZipEntry('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    textZipEntry('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    textZipEntry('word/document.xml', '<w:document xmlns:w="' + ns + '"><w:body>' + body + '<w:sectPr/></w:body></w:document>'),
  ]));
}
async function importFixture(page: Page, width: number): Promise<Locator> {
  await page.setViewportSize({ width, height: 851 });
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Manuscript menu' }).getByRole('button', { name: 'Document', exact: true }).click();
  await page.locator('input[type="file"][accept^=".docx"]').setInputFiles({
    name: 'native-character-formatting.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: nativeFormattingDocx(),
  });
  const review = page.getByRole('region', { name: 'Review import source', exact: true });
  if (width === 1440) await review.getByRole('combobox', { name: 'Import purpose' }).selectOption('own-work');
  else await review.getByRole('checkbox', { name: /^I checked the source/ }).check();
  const confirm = review.getByRole('button', { name: 'Create manuscript', exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  const editor = page.locator('section.editor');
  await expect(editor).toContainText('UNFORMATTED_CONTROL');
  return editor;
}
async function selectParagraph(paragraph: Locator): Promise<void> {
  await paragraph.scrollIntoViewIfNeeded();
  await paragraph.click();
  await paragraph.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
}

for (const width of [1440, 393]) {
  test('imported native character marks can be removed and reapplied (' + width + 'px)', async ({ page }) => {
    test.setTimeout(120_000);
    const editor = await importFixture(page, width);
    const toolbar = page.locator('.omi-rich-text-toolbar');
    for (const item of formats) {
      await test.step(item.id + ' ' + item.button, async () => {
        const text = sample(item.id);
        const paragraph = editor.locator('.tiptap p').filter({ hasText: text });
        const mark = paragraph.locator(item.selector);
        await expect(paragraph).toHaveText(text);
        await expect(mark).toHaveText(text);
        await selectParagraph(paragraph);
        const button = toolbar.locator('.omi-rich-text-toolbar-row').getByRole('button', { name: item.button, exact: true });
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await button.click();
        await expect(mark).toHaveCount(0);
        await expect(paragraph).toHaveText(text);
        await selectParagraph(paragraph);
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        await button.click();
        await expect(mark).toHaveText(text);
        await expect(paragraph).toHaveText(text);
      });
    }
    const compound = editor.locator('.tiptap p').filter({ hasText: 'COMPOUND_MARKS_TEXT' });
    for (const selector of ['strong', 'em', 'u[data-omi-underline]']) await expect(compound.locator(selector)).toHaveCount(1);
    await selectParagraph(compound);
    await toolbar.getByRole('button', { name: 'More text tools', exact: true }).click();
    await toolbar.getByRole('button', { name: 'Clear inline formatting', exact: true }).click();
    await expect(compound.locator('strong, em, u[data-omi-underline]')).toHaveCount(0);
    await expect(compound).toHaveText('COMPOUND_MARKS_TEXT');
    const control = editor.locator('.tiptap p').filter({ hasText: 'UNFORMATTED_CONTROL' });
    await expect(control.locator('strong, em, s, u, sup, sub, span[data-omi-small-caps]')).toHaveCount(0);
    await expect(control).toHaveText('UNFORMATTED_CONTROL');
    // Clearing a selected compound run must not affect any other paragraph.
    for (const item of formats) await expect(editor.locator('.tiptap p').filter({ hasText: sample(item.id) }).locator(item.selector)).toHaveText(sample(item.id));
  });
}
