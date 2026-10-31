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
  // The editor may expose unrelated accessible tabs. Scope all manuscript
  // assertions to the mobile document strip instead of counting every tab.
  const secondId = await page.evaluate(async () => {
    const { createAndOpenBlankOmiDocument } = await import('/src/app/newDocumentActions.ts');
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const manuscript = createAndOpenBlankOmiDocument({ kind: 'study', locale: 'en' });
    useStudioStore.getState().setTitle('Second mobile manuscript');
    return manuscript.id;
  });

  const strip = page.locator('.mobile-document-tab-strip');
  const firstTab = strip.getByRole('tab', { name: /First mobile manuscript/ });
  const secondTab = strip.getByRole('tab', { name: /Second mobile manuscript/ });
  await expect(strip).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const strip = document.querySelector('.mobile-document-tab-strip')?.getBoundingClientRect();
    const workspace = document.querySelector('.mobile-workspace')?.getBoundingClientRect();
    return Boolean(strip && workspace && strip.bottom <= workspace.top + 1 &&
      document.documentElement.scrollWidth <= window.innerWidth);
  })).toBe(true);
  expect(firstId).not.toBe(secondId);
  await expect(firstTab).toBeVisible();
  await expect(secondTab).toBeVisible();
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');

  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.id;
  })).toBe(firstId);

  await secondTab.click();
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.id;
  })).toBe(secondId);
});
