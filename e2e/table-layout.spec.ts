import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

async function openTables(page: Page, rows: number) {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async (rows) => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createTableBlock } = await import('/src/model/visualBlocks.ts');
    const manuscript = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({
      ...manuscript, title: 'Responsive tables', abstract: '',
      sections: [{ id: 'tables', title: '', blocks: [
        createTableBlock([['Name', 'Description'], ...Array.from({ length: rows }, (_, i) => [`Row ${i}`, 'Cell text wraps at the available width. '.repeat(3)])], {}, 'layout-table'),
        { id: 'after-table', type: 'paragraph', content: 'Paragraph after the table.' },
      ] }],
    });
  }, rows);
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  return menu.locator('.publication-document-canvas');
}

test('tables wrap, resize, accept line breaks and retain formatting across views', async ({ page }) => {
  const canvas = await openTables(page, 2);
  const table = canvas.locator('.omi-table-editor');
  const cell = canvas.getByRole('textbox', { name: 'Cell 2, 2', exact: true });
  await cell.fill('First line\nSecond line with a longer description.');
  await expect(cell).toHaveValue('First line\nSecond line with a longer description.');
  const handle = canvas.getByRole('separator', { name: 'Resize column 1' });
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '51');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 35, handleBox!.y + handleBox!.height / 2, { steps: 3 });
  await page.mouse.up();
  await expect.poll(() => handle.getAttribute('aria-valuenow')).not.toBe('51');
  await canvas.getByRole('combobox', { name: 'Table font size' }).selectOption('0');
  await canvas.getByRole('button', { name: 'HTML5 visual editor', exact: true }).click();
  await page.setViewportSize({ width: 480, height: 900 });
  await expect.poll(() => table.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(canvas.getByRole('combobox', { name: 'Table font size' })).toHaveCount(0);
  await expect(canvas.locator('.omi-table-cell-text').filter({ hasText: 'First line' })).toContainText('Second line with a longer description.');
  await expect(canvas.getByRole('textbox')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(canvas.getByRole('combobox', { name: 'Table font size' })).toHaveValue('0');
  await expect(cell).toHaveValue('First line\nSecond line with a longer description.');
  await expect.poll(() => cell.evaluate((element: HTMLTextAreaElement) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
});

test('long tables split between rows and reflow after zoom', async ({ page }) => {
  const canvas = await openTables(page, 22);
  await expect(canvas.locator('.omi-table-page-break')).not.toHaveCount(0);
  const audit = () => canvas.evaluate((root) => {
    const paper = root.querySelector<HTMLElement>('.publication-document-paper')!;
    const styles = getComputedStyle(paper);
    const stride = parseFloat(styles.getPropertyValue('--omi-publication-page-height')) + parseFloat(styles.getPropertyValue('--omi-publication-page-gap'));
    const guide = getComputedStyle(root.querySelector('.publication-document-page-guide')!);
    const top = parseFloat(guide.getPropertyValue('--omi-publication-page-top-margin'));
    const bottom = parseFloat(guide.getPropertyValue('--omi-publication-page-bottom-margin'));
    const pageHeight = parseFloat(styles.getPropertyValue('--omi-publication-page-height'));
    const origin = paper.getBoundingClientRect().top;
    if (![stride, top, bottom, pageHeight].every(Number.isFinite)) return ['Missing page geometry'];
    const boxes = Array.from(root.querySelectorAll('.omi-table-editor tr:not(.omi-table-page-break)'))
      .map((row) => row.getBoundingClientRect());
    const following = root.querySelector('.omi-continuous-tiptap-editor > p[data-block-id="after-table"]');
    if (following) {
      const walker = document.createTreeWalker(following, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        boxes.push(...Array.from(range.getClientRects()).filter((rect) => rect.height > 0));
      }
    }
    return boxes.flatMap((box, i) => {
      const start = (box.top - origin) % stride;
      return start < top - 1 || start + box.height > pageHeight - bottom + 1 ? [`Row ${i} crosses a page margin: top ${start}, height ${box.height}, body ${top}..${pageHeight - bottom}`] : [];
    });
  });
  await expect.poll(audit).toEqual([]);
  await canvas.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('50');
  await expect.poll(audit).toEqual([]);
  await canvas.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('100');
  await expect.poll(audit).toEqual([]);
  await expect(canvas.locator('.omi-table-editor textarea')).toHaveCount(46);
});

test('page gaps stay visible over a spanning table on desktop and mobile', async ({ page }, testInfo) => {
  const canvas = await openTables(page, 22);
  await expect(canvas.locator('.omi-table-page-break')).not.toHaveCount(0);
  const separator = canvas.locator('.publication-document-page-separator').first();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await separator.scrollIntoViewIfNeeded();
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute('data-page-label', 'Page 1');
    await expect.poll(() => separator.evaluate((element: HTMLElement) => {
      const gap = element.getBoundingClientRect();
      const paper = element.closest('.publication-document-paper')!.getBoundingClientRect();
      const table = element.closest('article')!.querySelector('.omi-table-editor')!.getBoundingClientRect();
      const styles = getComputedStyle(element);
      // Hit testing with pointer events temporarily enabled verifies the painted
      // stacking order above the table, including its white card background.
      const original = element.style.pointerEvents;
      let aboveTable: boolean;
      try {
        element.style.pointerEvents = 'auto';
        aboveTable = document.elementFromPoint(gap.x + gap.width / 2, gap.y + gap.height / 2) === element;
      } finally {
        element.style.pointerEvents = original;
      }
      return {
        fullWidth: Math.abs(gap.width - paper.width) < 1,
        clearGap: gap.height >= 28 && styles.backgroundColor === 'rgb(203, 213, 225)',
        tableSpansGap: table.top < gap.top && table.bottom > gap.bottom,
        aboveTable,
        ignoresInput: getComputedStyle(element).pointerEvents === 'none',
      };
    })).toEqual({
      fullWidth: true, clearGap: true, tableSpansGap: true, aboveTable: true, ignoresInput: true,
    });
    await testInfo.attach(`page-gap-${width}`, {
      body: await canvas.screenshot(), contentType: 'image/png',
    });
  }

  await page.emulateMedia({ media: 'print' });
  await expect(separator).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await canvas.getByRole('button', { name: 'HTML5 visual editor', exact: true }).click();
  await expect(canvas.locator('.publication-document-page-separator')).toHaveCount(0);
});

test('cell rotation and writing direction persist through mobile preview and HTML/print views', async ({ page }, testInfo) => {
  const canvas = await openTables(page, 2);
  await canvas.getByRole('textbox', { name: 'Cell 1, 1', exact: true }).fill('Rotated heading');
  await canvas.getByText('Cell formatting', { exact: true }).click();
  const rotation = canvas.getByRole('combobox', { name: 'Text rotation' });
  const direction = canvas.getByRole('combobox', { name: 'Writing direction' });
  const text = canvas.locator('.omi-table-editor tr').first().locator('.omi-table-cell-text').first();
  for (const value of ['90', '-90', '180']) {
    await rotation.selectOption(value);
    await expect(text).toHaveAttribute('data-text-rotation', value);
    await expect(text).toContainText('Rotated heading');
    await expect.poll(() => text.evaluate((element) => getComputedStyle(element).writingMode)).toBe(value === '180' ? 'horizontal-tb' : 'vertical-rl');
  }
  await rotation.selectOption('90');
  await direction.selectOption('rtl');
  const selectedCellEditor = canvas.getByRole('textbox', { name: 'Selected cell text', exact: true });
  await expect(selectedCellEditor).toBeVisible();
  await selectedCellEditor.fill('שלום rotated heading');
  await expect(text).toContainText('שלום rotated heading');
  await expect(text).toHaveAttribute('data-text-rotation', '90');
  await expect(text).toHaveAttribute('dir', 'rtl');
  await expect.poll(() => text.evaluate((element) => element.getBoundingClientRect().height > element.getBoundingClientRect().width)).toBe(true);
  await page.setViewportSize({ width: 480, height: 900 });
  await expect(page.locator('.publication-mobile-preview-note')).toBeVisible();
  await expect(page.locator('.publication-style-ribbon')).toHaveCount(0);
  await expect(canvas.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(canvas.getByRole('textbox')).toHaveCount(0);
  await expect(canvas.getByRole('separator')).toHaveCount(0);
  await expect(text).toHaveAttribute('data-text-rotation', '90');
  await expect(text).toHaveAttribute('dir', 'rtl');
  await page.screenshot({ path: testInfo.outputPath('mobile-publication-preview.png') });
  await canvas.getByRole('button', { name: 'HTML5 visual editor', exact: true }).click();
  await expect(text).toHaveAttribute('data-text-rotation', '90');
  await expect(text).toContainText('שלום rotated heading');
  await expect(canvas.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(canvas.getByRole('textbox')).toHaveCount(0);
  await canvas.getByRole('button', { name: 'Print layout', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await canvas.getByText('Cell formatting', { exact: true }).click();
  await expect(rotation).toHaveValue('90');
  await expect(direction).toHaveValue('rtl');
});

test('row handles resize by pointer and keyboard and reset without altering cell text', async ({page})=>{
  const canvas=await openTables(page,2);
  const handle=canvas.getByRole('separator',{name:'Resize row 1',exact:true});
  const row=canvas.locator('.omi-table-editor > tbody > tr').first();
  await expect(handle).toBeVisible();
  await expect(row).toHaveAttribute('data-omi-row-height','auto');
  await handle.focus();
  await page.keyboard.press('ArrowDown');
  await expect(row).toHaveAttribute('data-omi-row-height','minimum');
  const before=Number(await handle.getAttribute('aria-valuenow'));
  await page.keyboard.press('Shift+ArrowDown');
  await expect(handle).toHaveAttribute('aria-valuenow',String(Math.round((before+10)*20)/20));
  const box=await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2+24,{steps:4});
  await page.mouse.up();
  await expect.poll(async()=>Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(before+10);
  await expect(canvas.getByRole('textbox',{name:'Cell 1, 1',exact:true})).toHaveValue('Name');
  await handle.focus();
  await page.keyboard.press('Home');
  await expect(row).toHaveAttribute('data-omi-row-height','auto');
  await expect(handle).toHaveAttribute('aria-valuenow','0');
  await page.setViewportSize({width:480,height:900});
  await expect(canvas.getByRole('separator',{name:'Resize row 1',exact:true})).toHaveCount(0);
});

test('format a rectangular range, whole column and return to single cell editing', async ({page})=>{
  const canvas=await openTables(page,2);
  const table=canvas.locator('.omi-table-editor').first();
  await canvas.getByRole('textbox',{name:'Cell 1, 1',exact:true}).click();
  await canvas.getByText('Cell formatting',{exact:true}).click();
  await canvas.getByRole('button',{name:'Cell range',exact:true}).click();
  await canvas.getByRole('spinbutton',{name:'Last row',exact:true}).fill('2');
  await canvas.getByRole('spinbutton',{name:'Last column',exact:true}).fill('2');
  await expect(table.locator('[data-cell-range="true"]')).toHaveCount(4);
  await canvas.getByRole('combobox',{name:'Horizontal alignment',exact:true}).selectOption('center');
  await expect(table.locator('[data-cell-range="true"][style*="text-align: center"]')).toHaveCount(4);
  await expect(table.locator('tr').last().locator('td[style*="text-align: center"]')).toHaveCount(0);
  await canvas.getByRole('button',{name:'Cell range',exact:true}).click();
  await expect(table.locator('[data-cell-range="true"]')).toHaveCount(0);
  await expect(canvas.getByRole('textbox',{name:'Selected cell text',exact:true})).toBeVisible();
  await canvas.getByRole('button',{name:'Select column',exact:true}).click();
  await expect(table.locator('[data-cell-range="true"]')).toHaveCount(3);
  await expect(canvas.getByRole('combobox',{name:'Horizontal alignment',exact:true})).toHaveValue('mixed');
  await canvas.getByRole('combobox',{name:'Horizontal alignment',exact:true}).selectOption('right');
  await expect(table.locator('[data-cell-range="true"][style*="text-align: right"]')).toHaveCount(3);
  await canvas.getByRole('button',{name:'Cell range',exact:true}).click();
  await expect(canvas.getByRole('textbox',{name:'Cell 1, 1',exact:true})).toHaveValue('Name');
  await page.setViewportSize({width:480,height:900});
  await expect(table.locator('[data-cell-range="true"]')).toHaveCount(0);
  await expect(canvas.getByRole('button',{name:'Cell range',exact:true})).toHaveCount(0);
});

test('reorder selected table rows and columns without moving header into body',async({page})=>{
  const canvas=await openTables(page,2);
  await canvas.getByRole('textbox',{name:'Cell 2, 1',exact:true}).click();
  await canvas.getByText('Reorder rows and columns',{exact:true}).click();
  await expect(canvas.getByRole('button',{name:'Move row up',exact:true})).toBeDisabled();
  await canvas.getByRole('button',{name:'Move row down',exact:true}).click();
  await expect(canvas.getByRole('textbox',{name:'Cell 2, 1',exact:true})).toHaveValue('Row 1');
  await expect(canvas.getByRole('textbox',{name:'Cell 3, 1',exact:true})).toHaveValue('Row 0');
  await expect(canvas.getByRole('button',{name:'Move row down',exact:true})).toBeDisabled();
  await canvas.getByRole('button',{name:'Move column right',exact:true}).click();
  await expect(canvas.getByRole('textbox',{name:'Cell 1, 1',exact:true})).toHaveValue('Description');
  await expect(canvas.getByRole('textbox',{name:'Cell 1, 2',exact:true})).toHaveValue('Name');
  await expect(canvas.getByRole('textbox',{name:'Cell 3, 2',exact:true})).toHaveValue('Row 0');
  await canvas.getByRole('button',{name:'Move column left',exact:true}).click();
  await canvas.getByRole('button',{name:'Move row up',exact:true}).click();
  await expect(canvas.getByRole('textbox',{name:'Cell 2, 1',exact:true})).toHaveValue('Row 0');
  await page.setViewportSize({width:480,height:900});
  await expect(canvas.getByRole('button',{name:'Move row up',exact:true})).toHaveCount(0);
});

test('apply built-in table appearance and save a reusable local cell style',async({page})=>{
  const canvas=await openTables(page,2);
  const table=canvas.locator('.omi-table-editor').first();
  const summary=canvas.getByText('Table and cell styles',{exact:true});
  const panel=summary.locator('..');
  await summary.click();
  const stylePicker=panel.getByRole('combobox',{name:'Table style',exact:true});
  await expect(stylePicker).toBeVisible();
  await stylePicker.selectOption('builtin:banded');
  await panel.getByRole('button',{name:'Apply style',exact:true}).click();
  await expect(table.locator('tr').first().locator('th').first()).toHaveCSS('background-color','rgb(220, 230, 241)');
  await expect(table.locator('tr').nth(2).locator('td').first()).toHaveCSS('background-color','rgb(241, 244, 247)');
  await canvas.getByRole('textbox',{name:'Cell 1, 1',exact:true}).click();
  await panel.getByRole('combobox',{name:'Save as',exact:true}).selectOption('cell');
  await panel.getByRole('textbox',{name:'Style name',exact:true}).fill('Journal header');
  await panel.getByRole('button',{name:'Save style',exact:true}).click();
  await expect(panel.getByRole('combobox',{name:'Table style',exact:true})).toHaveValue('custom:Journal header');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('omi.table-appearance-presets.v1'))).toContain('Journal header');
  await canvas.getByRole('textbox',{name:'Cell 2, 1',exact:true}).click();
  await panel.getByRole('button',{name:'Apply style',exact:true}).click();
  await expect(table.locator('tr').nth(1).locator('td').first()).toHaveCSS('background-color','rgb(220, 230, 241)');
  await expect(canvas.getByRole('textbox',{name:'Cell 2, 1',exact:true})).toHaveValue('Row 0');
  await panel.getByRole('button',{name:'Delete saved style',exact:true}).click();
  await expect(panel.getByRole('combobox',{name:'Table style',exact:true})).toHaveValue('builtin:grid');
});

test('cell note toolbar creates a shared note annotation and note card deletes it atomically',async({page})=>{
  const canvas=await openTables(page,2);
  const cell=canvas.locator('.omi-table-editor').first().locator('tr:not(.omi-table-page-break)').nth(1).locator('td').first();
  await canvas.getByRole('textbox',{name:'Cell 2, 1',exact:true}).click();
  await canvas.getByText('Cell formatting',{exact:true}).click();
  const editor=canvas.getByRole('textbox',{name:'Selected cell text',exact:true});
  await editor.click();
  await editor.press('End');
  await canvas.getByRole('button',{name:'Footnote',exact:true}).click();
  const card=canvas.locator('.omi-note-editor-card').first();
  await expect(card).toBeVisible();
  await expect(editor.locator('[data-omi-note]')).toHaveCount(1);
  const snapshot=()=>page.evaluate(async()=>{
    const {useStudioStore}=await import('/src/app/useStudioStore.ts');
    const state=useStudioStore.getState();
    const visual=state.manuscript.sections[0]?.blocks.find(block=>block.id==='layout-table')?.visual;
    const table=visual?.kind==='table'?visual:undefined;
    return {annotations:state.manuscript.annotations,events:state.pendingChangeSet?.events??[],cellText:table?.cells[1]?.[0],cellDocument:table?.cellContent?.['1:0']};
  });
  const added=await snapshot();
  expect(added.annotations.some(n=>n.targetBlockId==='layout-table'&&n.noteKind==='footnote')).toBeTruthy();
  expect(added.events.some(e=>e.operation==='annotation.create')).toBeTruthy();
  expect(added.events.some(e=>e.operation==='block.update'&&e.targetId==='layout-table')).toBeTruthy();
  const deleteNote=card.getByRole('button',{name:'Delete note',exact:true});
  await expect(deleteNote).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await deleteNote.click();
  await expect(card).toHaveCount(0);
  await expect(editor.locator('[data-omi-note]')).toHaveCount(0);
  await expect.poll(async()=>(await snapshot()).annotations.filter(n=>n.targetBlockId==='layout-table').length).toBe(0);
  // A rich cell remains a rich cell after deleting its last note; it does not
  // revert to the plain-text textarea. Verify both rendered and stored content.
  await expect(cell.locator('.omi-table-rich-preview')).toHaveText('Row 0');
  await expect(editor).toHaveText('Row 0');
  const removed=await snapshot();
  expect(removed.cellText).toBe('Row 0');
  expect(removed.cellDocument).toBeDefined();
  expect(JSON.parse(removed.cellDocument!)).toMatchObject({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Row 0'}]}]});
  expect(removed.cellDocument).not.toContain('omiNote');
});

test('apply character and paragraph formatting to selected cells only',async({page})=>{
  const canvas=await openTables(page,2);
  await canvas.getByRole('textbox',{name:'Cell 1, 1',exact:true}).click();
  await canvas.getByText('Cell formatting',{exact:true}).click();
  await canvas.getByRole('button',{name:'Select row',exact:true}).click();
  await canvas.getByText('Selected cell text formatting',{exact:true}).click();
  const panel=canvas.getByText('Selected cell text formatting',{exact:true}).locator('..');
  const bold=canvas.getByRole('button',{name:'Bold / strong',exact:true});
  await expect(bold).toHaveAttribute('aria-pressed','false');
  await bold.click();
  await expect(bold).toHaveAttribute('aria-pressed','true');
  const table=canvas.locator('.omi-table-editor').first();
  await expect(table.locator('tr').first().locator('strong')).toHaveCount(2);
  await expect(table.locator('tr').nth(1).locator('strong')).toHaveCount(0);
  await canvas.getByRole('spinbutton',{name:'Font size (pt)',exact:true}).fill('13');
  await canvas.getByRole('button',{name:'Apply: Font size (pt)',exact:true}).click();
  await expect(table.locator('tr').first().locator('[style*="font-size"]')).toHaveCount(2);
  await panel.getByText('Paragraph formatting',{exact:true}).click();
  await panel.getByRole('spinbutton',{name:'Space after (pt)',exact:true}).fill('8');
  await panel.getByRole('button',{name:'Apply: Space after (pt)',exact:true}).click();
  await expect(table.locator('tr').first().locator('p[style*="margin-bottom"]')).toHaveCount(2);
  await expect(table.locator('tr').nth(1).locator('p[style*="margin-bottom"]')).toHaveCount(0);
  await canvas.getByRole('button',{name:'Reset: Font size (pt)',exact:true}).click();
  await expect(table.locator('tr').first().locator('[style*="font-size"]')).toHaveCount(0);
  await expect(table.locator('tr').first().locator('strong')).toHaveCount(2);
  await bold.click();
  await expect(table.locator('tr').first().locator('strong')).toHaveCount(0);
});
