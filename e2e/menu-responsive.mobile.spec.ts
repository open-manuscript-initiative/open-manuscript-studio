import { expect, test, type Locator } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('every manuscript-menu view stays inside the mobile viewport', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  const content = dialog.locator('.studio-menu-content');
  await expect(dialog).toBeVisible();

  const navButtons = dialog.locator('.studio-menu-nav-button');
  const navCount = await navButtons.count();

  for (let index = 0; index < navCount; index += 1) {
    const button = navButtons.nth(index);
    const label = (await button.innerText()).trim() || `menu item ${index + 1}`;

    await test.step(label, async () => {
      const toggle = dialog.getByRole('button', { name: 'Manuscript menu', exact: true });
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      await button.click();
      await expect(dialog.getByRole('navigation', { name: 'Manuscript menu' })).toBeHidden();
      await expect(toggle).toBeFocused();
      await settleLayout(content);
      await expectNoMenuOverflow(content);
    });
  }

  await dialog.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  await dialog.getByRole('button', { name: 'References', exact: true }).click();
  const computedCrossReference = dialog.locator('[data-computed-cross-reference-target]');
  await expect(computedCrossReference).toBeVisible();
  await computedCrossReference.scrollIntoViewIfNeeded();

  const box = await computedCrossReference.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
});

async function settleLayout(content: Locator): Promise<void> {
  await expect(content).toBeVisible();
  await content.page().evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function expectNoMenuOverflow(content: Locator): Promise<void> {
  const audit = await content.evaluate((root) => {
    const rootElement = root as HTMLElement;
    const rootRect = rootElement.getBoundingClientRect();
    const selector = [
      'input:not([type="hidden"])',
      'select',
      'textarea',
      'button',
      '[role="button"]',
      '.studio-tool-card',
      '.studio-settings-card',
      '.omi-xref-picker',
      '.omi-xref-editor-card',
      '.omi-xref-status-panel',
    ].join(',');

    const offenders = Array.from(rootElement.querySelectorAll(selector))
      .filter((element) => {
        const node = element as HTMLElement;
        const style = getComputedStyle(node);
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && node.getClientRects().length > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: (element as HTMLElement).className,
          text: (element.textContent ?? '').trim().slice(0, 80),
          left: rect.left,
          right: rect.right,
        };
      })
      .filter((item) => item.left < rootRect.left - 1 || item.right > rootRect.right + 1);

    return {
      clientWidth: rootElement.clientWidth,
      scrollWidth: rootElement.scrollWidth,
      offenders,
    };
  });

  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth + 1);
  expect(audit.offenders).toEqual([]);
}
