import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('mobile workspace keeps multiple manuscripts open and switches without replacing them', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  // MobileLayout is selected for the native Android/iOS shell, not a narrow web viewport.
  await page.addInitScript(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36',
      configurable: true,
    });
  });
  await installMockStudioApi(page);
  await signInToStudio(page);

  const firstId = await page.evaluate(async () => {
    const { createAndOpenBlankOmiDocument } = await import('/src/app/newDocumentActions.ts');
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const manuscript = createAndOpenBlankOmiDocument({ kind: 'study', locale: 'en' });
    useStudioStore.getState().setTitle('First mobile manuscript');
    return manuscript.id;
  });
  await expect(page.getByRole('tab', { name: /First mobile manuscript/ })).toBeVisible();

  const secondId = await page.evaluate(async () => {
    const { createAndOpenBlankOmiDocument } = await import('/src/app/newDocumentActions.ts');
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const manuscript = createAndOpenBlankOmiDocument({ kind: 'study', locale: 'en' });
    useStudioStore.getState().setTitle('Second mobile manuscript');
    return manuscript.id;
  });

  const tabs = page.getByRole('tab');
  const strip = page.locator('.mobile-document-tab-strip');
  await expect(strip).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const strip = document.querySelector('.mobile-document-tab-strip')?.getBoundingClientRect();
    const workspace = document.querySelector('.mobile-workspace')?.getBoundingClientRect();
    return Boolean(strip && workspace && strip.bottom <= workspace.top + 1 &&
      document.documentElement.scrollWidth <= window.innerWidth);
  })).toBe(true);
  await expect(tabs).toHaveCount(2);
  await expect(page.getByRole('tab', { name: /First mobile manuscript/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Second mobile manuscript/ })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: /First mobile manuscript/ }).click();
  await expect(page.getByRole('tab', { name: /First mobile manuscript/ })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.id;
  })).toBe(firstId);

  await page.getByRole('tab', { name: /Second mobile manuscript/ }).click();
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.id;
  })).toBe(secondId);
});
