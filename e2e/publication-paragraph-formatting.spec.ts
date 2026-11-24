import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('custom paragraph styles can be created, edited, inherited and reset in the publication editor', async ({ page }) => {
  test.setTimeout(90_000);
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const editor = menu.locator('.publication-style-editor');
  await editor.getByRole('button', { name: 'Paragraph styles', exact: true }).click();
  const panel = editor.locator('#publication-style-ribbon-panel-paragraphStyles');
  // Native select options share the same accessible names as style-list buttons.
  const styleList = panel.getByRole('listbox', { name: 'Paragraph styles', exact: true });
  const settings = panel.locator('.indesign-paragraph-style-settings');
  const category = (name: string) => settings.locator('nav').getByRole('button', { name, exact: true });
  const pane = settings.locator('.indesign-paragraph-style-category-pane');
  await panel.getByRole('button', { name: 'New paragraph style', exact: true }).click();
  await category('General').click();
  await pane.getByRole('textbox', { name: 'Style name', exact: true }).fill('QA base style');
  await expect(styleList.getByRole('option', { name: 'QA base style', exact: true })).toHaveAttribute('aria-selected', 'true');
  await category('Indents and spacing').click();
  await pane.getByRole('combobox', { name: 'Alignment', exact: true }).selectOption('right');
  await pane.getByRole('spinbutton', { name: /^Left indent/ }).fill('10');
  await pane.getByRole('spinbutton', { name: /^Right indent/ }).fill('6');
  await pane.getByRole('spinbutton', { name: /^Space before/ }).fill('8');
  await pane.getByRole('spinbutton', { name: /^Space after/ }).fill('12');
  await category('Hyphenation').click();
  await pane.getByRole('checkbox', { name: 'Hyphenation', exact: true }).check();
  await pane.getByRole('spinbutton', { name: 'Minimum word length', exact: true }).fill('8');

  await panel.getByRole('button', { name: 'New paragraph style', exact: true }).click();
  await category('General').click();
  await pane.getByRole('textbox', { name: 'Style name', exact: true }).fill('QA derived style');
  await expect(pane.getByRole('combobox', { name: 'Based on', exact: true }).locator('option:checked')).toHaveText('QA base style');
  await pane.getByRole('combobox', { name: 'Next style', exact: true }).selectOption({ label: 'QA base style' });
  await category('Indents and spacing').click();
  await expect(pane.getByRole('combobox', { name: 'Alignment', exact: true })).toHaveValue('right');
  await expect(pane.getByRole('spinbutton', { name: /^Left indent/ })).toHaveValue('10');
  await expect(pane.getByRole('spinbutton', { name: /^Right indent/ })).toHaveValue('6');
  await expect(pane.getByRole('spinbutton', { name: /^Space before/ })).toHaveValue('8');
  await expect(pane.getByRole('spinbutton', { name: /^Space after/ })).toHaveValue('12');
  await pane.getByRole('combobox', { name: 'Alignment', exact: true }).selectOption('center');
  await pane.getByRole('spinbutton', { name: /^Left indent/ }).fill('4');
  await category('Hyphenation').click();
  await expect(pane.getByRole('checkbox', { name: 'Hyphenation', exact: true })).toBeChecked();
  await expect(pane.getByRole('spinbutton', { name: 'Minimum word length', exact: true })).toHaveValue('8');
  await pane.getByRole('checkbox', { name: 'Hyphenation', exact: true }).uncheck();
  await category('Bullets and numbering').click();
  await pane.getByRole('combobox', { name: 'List type', exact: true }).selectOption('numbers');
  await pane.getByRole('spinbutton', { name: 'Level', exact: true }).fill('2');
  await pane.getByRole('textbox', { name: 'Number expression', exact: true }).fill('^1.^#)');
  await pane.getByRole('spinbutton', { name: 'Start at', exact: true }).fill('3');
  await pane.getByRole('spinbutton', { name: 'Restart after level', exact: true }).fill('1');
  await styleList.getByRole('option', { name: 'QA base style', exact: true }).click();
  await styleList.getByRole('option', { name: 'QA derived style', exact: true }).click();
  await category('Bullets and numbering').click();
  await expect(pane.getByRole('combobox', { name: 'List type', exact: true })).toHaveValue('numbers');
  await expect(pane.getByRole('spinbutton', { name: 'Level', exact: true })).toHaveValue('2');
  await expect(pane.getByRole('textbox', { name: 'Number expression', exact: true })).toHaveValue('^1.^#)');
  await expect(pane.getByRole('spinbutton', { name: 'Start at', exact: true })).toHaveValue('3');
  await expect(pane.getByRole('spinbutton', { name: 'Restart after level', exact: true })).toHaveValue('1');
  await panel.getByRole('button', { name: 'Clear local overrides', exact: true }).click();
  await category('Indents and spacing').click();
  await expect(pane.getByRole('combobox', { name: 'Alignment', exact: true })).toHaveValue('right');
  await expect(pane.getByRole('spinbutton', { name: /^Left indent/ })).toHaveValue('10');
  await category('Hyphenation').click();
  await expect(pane.getByRole('checkbox', { name: 'Hyphenation', exact: true })).toBeChecked();
  await category('General').click();
  await expect(pane.getByRole('combobox', { name: 'Next style', exact: true }).locator('option:checked')).toHaveText('QA base style');
});

test('print hyphenation respects inline language, disabled paragraphs and protected inline text in a browser DOM', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  const result = await page.evaluate(async () => {
    const { hyphenatePrintHtml } = await import('/src/services/printHyphenation.ts');
    const source = '<!doctype html><html lang="hu-HU"><body><article class="article-body"><p id="hu">tudományos <span lang="de-DE">Wissenschaftlichkeit</span> <a href="https://example.test">internationalization</a> <code>internationalization</code></p><p id="off">tudományos</p></article></body></html>';
    const rendered = await hyphenatePrintHtml(source, 'hu-HU', el => ({ enabled: !el.closest('#off') }));
    const doc = new DOMParser().parseFromString(rendered, 'text/html');
    const paragraph = doc.querySelector('#hu')!;
    return {
      hu: paragraph.firstChild?.textContent, de: paragraph.querySelector('span')?.textContent,
      huModule: paragraph.getAttribute('data-omi-hyphenation-module'),
      deModule: paragraph.querySelector('span')?.getAttribute('data-omi-hyphenation-module'),
      off: doc.querySelector('#off')?.textContent,
      link: paragraph.querySelector('a')?.textContent, code: paragraph.querySelector('code')?.textContent,
    };
  });
  expect(result.hu).toContain('\u00ad');
  expect(result.hu?.replaceAll('\u00ad', '')).toBe('tudományos ');
  expect(result.de).toContain('\u00ad');
  expect(result.de?.replaceAll('\u00ad', '')).toBe('Wissenschaftlichkeit');
  expect(result.huModule).toBe('hu');
  expect(result.deModule).toBe('de');
  expect(result.off).toBe('tudományos');
  expect(result.link).toBe('internationalization');
  expect(result.code).toBe('internationalization');
});
