import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('mobile workspace keeps multiple manuscripts open and switches without replacing them', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await installMockStudioApi(page);
  await signInToStudio(page);

  const ids = await page.evaluate(async () => {
    const { createAndOpenBlankOmiDocument } = await import('/src/app/newDocumentActions.ts');
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const first = createAndOpenBlankOmiDocument({ kind: 'study', locale: 'en' });
    useStudioStore.getState().setTitle('First mobile manuscript');
    const second = createAndOpenBlankOmiDocument({ kind: 'study', locale: 'en' });
    useStudioStore.getState().setTitle('Second mobile manuscript');
    return [first.id, second.id];
  });

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(2);
  await expect(page.getByRole('tab', { name: /First mobile manuscript/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Second mobile manuscript/ })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: /First mobile manuscript/ }).click();
  await expect(page.getByRole('tab', { name: /First mobile manuscript/ })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.id;
  })).toBe(ids[0]);

  await page.getByRole('tab', { name: /Second mobile manuscript/ }).click();
  await expect.poll(() => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.id;
  })).toBe(ids[1]);
});
