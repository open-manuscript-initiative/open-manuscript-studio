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
