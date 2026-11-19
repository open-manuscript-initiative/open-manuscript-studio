import { expect, test, type Page } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

async function openNotes(page: Page) {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createNoteAnnotation } = await import('/src/model/notes.ts');
    const manuscript = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({
      ...manuscript,
      title: 'Aligned manuscript notes',
      sections: [{
        id: 'notes-section', title: '', blocks: [{
          id: 'notes-paragraph', type: 'paragraph',
          content: JSON.stringify({ type: 'doc', content: [{
            type: 'paragraph', content: [
              { type: 'text', text: 'A manuscript paragraph with a note' },
              { type: 'omiNote', attrs: {
                noteId: 'layout-note', anchorId: 'layout-anchor',
                label: '1', noteType: 'footnote',
              } },
              { type: 'text', text: '.' },
            ],
          }] }),
        }],
      }],
      annotations: [createNoteAnnotation({
        id: 'layout-note', anchorId: 'layout-anchor',
        targetBlockId: 'notes-paragraph',
        body: 'A note that stays attached to the manuscript. '.repeat(120),
      })],
    });
  });
  await page.locator('.focus-current-notes-button').click();
  await expect(page.locator('#omi-current-study-notes')).toBeVisible();
}

async function expectAlignedNotes(page: Page, mobile = false) {
  await expect.poll(() => page.evaluate((isMobile) => {
    const paper = document.querySelector('.omi-manuscript-page')!;
    const footer = document.querySelector('#omi-current-study-notes')!;
    const pageBox = paper.getBoundingClientRect();
    const footerBox = footer.getBoundingClientRect();
    const style = getComputedStyle(footer);
    const expectedLeft = isMobile ? 0 : pageBox.left;
    const expectedRight = isMobile ? innerWidth : pageBox.right;
    return {
      alignedLeft: Math.abs(footerBox.left - expectedLeft) < 1,
      alignedRight: Math.abs(footerBox.right - expectedRight) < 1,
      bottomGap: Math.abs(innerHeight - footerBox.bottom) < 1,
      squareCorners: style.borderTopLeftRadius === '0px'
        && style.borderTopRightRadius === '0px',
      cappedHeight: footerBox.height <= innerHeight / 2 + 1,
    };
  }, mobile)).toEqual({
    alignedLeft: true, alignedRight: true, bottomGap: true,
    squareCorners: true, cappedHeight: true,
  });
}

test('desktop notes follow manuscript edges while resizing and zooming', async ({ page }) => {
  await page.setViewportSize({ width: 1916, height: 908 });
  await openNotes(page);
  const zoom = page.getByRole('slider', { name: 'Zoom level', exact: true });

  for (const [width, percent] of [
    [1916, 100], [1916, 50], [1916, 150], [1916, 200],
    [1440, 100], [900, 150], [761, 100],
  ]) {
    await page.setViewportSize({ width, height: 908 });
    await zoom.fill(String(percent));
    await expect(zoom).toHaveValue(String(percent));
    await expectAlignedNotes(page);
  }

  await page.setViewportSize({ width: 1916, height: 908 });
  await page.getByRole('button', { name: 'Show document outline', exact: true }).click();
  await expect(page.locator('.desktop-document-outline')).toBeVisible();
  await expectAlignedNotes(page);
  await page.setViewportSize({ width: 1440, height: 908 });
  await expectAlignedNotes(page);
  await page.getByRole('button', { name: 'Hide document outline', exact: true }).first().click();
  await expectAlignedNotes(page);

  const anchor = page.locator('[data-omi-note][data-note-id="layout-note"]').first();
  await anchor.scrollIntoViewIfNeeded();
  const footer = page.locator('#omi-current-study-notes');
  await expect(footer).toContainText('A note that stays attached to the manuscript.');
  await expect.poll(() => footer.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await footer.getByRole('button', { name: 'Go to note: 1', exact: true }).click();
  await expect(anchor).toBeInViewport();
  await expectAlignedNotes(page);

  await page.locator('.focus-current-notes-button').click();
  await expect(footer).toHaveCount(0);
  await page.locator('.focus-current-notes-button').click();
  await expectAlignedNotes(page);
});

test('notes retain the full mobile width and realign when returning to desktop', async ({ page }) => {
  await openNotes(page);
  for (const width of [760, 393, 320]) {
    await page.setViewportSize({ width, height: 851 });
    await expectAlignedNotes(page, true);
  }
  await page.setViewportSize({ width: 1916, height: 908 });
  await expectAlignedNotes(page);
});

for (const mobile of [false, true]) {
  test(`notes can be edited and formatted in the footer (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 393, height: 851 });
    await openNotes(page);
    const footer = page.locator('#omi-current-study-notes');
    const body = footer.getByRole('textbox');
    await body.fill('Editable note');
    await expect(footer.locator('.omi-note-formatting, .omi-note-rich-actions')).toHaveCount(0);
    await page.locator('.focus-formatting-button').click();
    const formatting = page.locator('#omi-header-formatting');
    if (!mobile) {
      const pin = formatting.getByRole('button', { name: 'Pin toolbar position', exact: true });
      await pin.click();
      await expect(pin).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => page.evaluate(() => localStorage.getItem('omi.headerFormattingPinned.v1'))).toBe('true');
    }
    await body.press('ControlOrMeta+a');
    await formatting.getByRole('button', { name: 'Bold / strong', exact: true }).click();
    await expect(body.locator('strong')).toHaveText('Editable note');
    await expect(formatting.getByRole('button', { name: 'Bold / strong', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await formatting.getByRole('button', { name: 'Italic / emphasis', exact: true }).click();
    await expect(body.locator('em')).toHaveText('Editable note');
    await expect.poll(() => page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const note = useStudioStore.getState().manuscript.annotations.find((item) => item.id === 'layout-note')!;
      const content = JSON.parse(note.bodyContent!);
      return { body: note.body, marks: content.content[0].content[0].marks.map((mark: { type: string }) => mark.type) };
    })).toEqual({ body: 'Editable note', marks: ['bold', 'italic'] });

    // Resizing/scrolling can hide the source anchor while the keyboard is open.
    // A focused note must remain mounted, retaining its selection and text.
    await page.locator('[data-omi-note][data-note-id="layout-note"]').first().evaluate((anchor) => {
      (anchor as HTMLElement).style.visibility = 'hidden';
      (anchor as HTMLElement).style.transform = 'translateY(-10000px)';
      window.dispatchEvent(new Event('resize'));
    });
    await expect(body).toBeFocused();
    await expect(body).toHaveText('Editable note');
    await page.locator('[data-omi-note][data-note-id="layout-note"]').first().evaluate((anchor) => {
      (anchor as HTMLElement).style.visibility = '';
      (anchor as HTMLElement).style.transform = '';
      window.dispatchEvent(new Event('resize'));
    });

    await page.locator('.focus-current-notes-button').click();
    await page.locator('.focus-current-notes-button').click();
    await expect(body.locator('strong em')).toHaveText('Editable note');
    // Changes made in another note surface/undo must update the mounted footer.
    await page.evaluate(async () => {
      const { stageUpdateNoteRichText } = await import('/src/app/noteRichTextActions.ts');
      stageUpdateNoteRichText('layout-note', JSON.stringify({
        type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated elsewhere' }] }],
      }), 'Updated elsewhere', []);
    });
    await expect(body).toHaveText('Updated elsewhere');

    // The same header controls now act on the main text instead of the note.
    const main = page.locator('.omi-continuous-tiptap-editor[contenteditable="true"]').first();
    await main.click();
    await main.press('ControlOrMeta+Home');
    await main.press('ControlOrMeta+Shift+ArrowRight');
    await formatting.getByRole('button', { name: 'Underline', exact: true }).click();
    await expect(main.locator('u')).not.toHaveCount(0);
    await expect(body.locator('u')).toHaveCount(0);
    await body.click();
    await body.press('ControlOrMeta+a');
    await formatting.getByRole('button', { name: 'Underline', exact: true }).click();
    await expect(body.locator('u')).toHaveText('Updated elsewhere');
    await expect(page.locator('.omi-rich-text-toolbar')).toHaveCount(1);

    // Moving focus to a header URL field must keep the note and its selection.
    await formatting.getByRole('button', { name: 'External link', exact: true }).click();
    const url = formatting.locator('input[type="url"]');
    await expect(url).toBeFocused();
    await url.fill('https://source.example/note');
    await formatting.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(body.locator('a')).toHaveText('Updated elsewhere');
    await expect(body.locator('a')).toHaveAttribute('href', 'https://source.example/note');

    await formatting.getByRole('button', { name: 'Insert reference', exact: true }).click();
    await expect(footer.locator('.omi-citation-picker')).toBeVisible();
  });
}
