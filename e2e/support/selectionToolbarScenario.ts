import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './mockStudioApi';

export function selectionToolbarScenario(): void {
  test('selection actions follow native selection changes and survive scrolling', async ({ page }) => {
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    const editor = page.locator('.omi-continuous-tiptap-editor[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.insertText('Select these words to format them.');
    const toolbar = page.locator('.omi-rich-text-toolbar');
    await expect(toolbar).toHaveCount(0);
    const select = async (start: number, end: number) => {
      await editor.evaluate((element, { start, end }) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let text: Node | null = null;
        while (walker.nextNode()) {
          if (walker.currentNode.textContent?.includes('Select these words')) {
            text = walker.currentNode;
            break;
          }
        }
        if (!text) throw new Error('Fixture text is missing');
        const range = document.createRange();
        range.setStart(text, start);
        range.setEnd(text, end);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      }, { start, end });
    };
    // Android can cancel the original pointer while handing off to native handles.
    await editor.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 50, clientY: 100 });
    await editor.dispatchEvent('pointercancel', { pointerType: 'touch' });
    await select(0, 6);
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveAttribute('data-selection-length', '6');
    // Dragging a native handle changes the selection without a new long press.
    await select(0, 18);
    await expect(toolbar).toHaveAttribute('data-selection-length', '18');
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await expect(toolbar).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.dispatchEvent(new Event('selectionchange')));
    await expect(toolbar).toHaveCount(0);
    await select(0, 12);
    await expect(toolbar).toBeVisible();
    // Focusing a toolbar field must not destroy the menu or the saved selection.
    await toolbar.getByRole('button', { name: 'External link', exact: true }).click();
    await expect(toolbar.locator('input[type="url"]')).toBeFocused();
    await toolbar.locator('input[type="url"]').fill('https://example.org');
    await expect(toolbar).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editor).toBeFocused();
    // Tiptap restores focus/selection on the next animation frame after a popover.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await editor.press('ArrowRight');
    await expect(toolbar).toHaveCount(0);
    await editor.press('Shift+F10');
    await expect(toolbar).toBeVisible();
  });
}
