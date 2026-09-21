import { expect, test, type Locator } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('every manuscript-menu view stays inside the mobile viewport', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  const content = dialog.locator('.studio-menu-content');
  const navigation = navigation;
  await expect(dialog).toBeVisible();
  await expect(navigation).toBeVisible();
  await expectFullScreenScrollFreeNavigation(dialog, navigation);

  const navButtons = dialog.locator('.studio-menu-nav-button:not([data-home-navigation="true"])');
  const navCount = await navButtons.count();

  for (let index = 0; index < navCount; index += 1) {
    const button = navButtons.nth(index);
    const label = (await button.innerText()).trim() || `menu item ${index + 1}`;

    await test.step(label, async () => {
      const toggle = dialog.getByRole('button', { name: 'Manuscript menu', exact: true });
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      await button.click();
      await expect(navigation).toBeHidden();
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

  const toggle = dialog.getByRole('button', { name: 'Manuscript menu', exact: true });
  await toggle.click();
  await expect(navigation).toBeVisible();
  await toggle.click();
  await expect(navigation).toBeHidden();
  await expect(computedCrossReference).toBeVisible();

  await toggle.click();
  await dialog.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
});

async function expectFullScreenScrollFreeNavigation(
  dialog: Locator,
  navigation: Locator,
): Promise<void> {
  const audit = await navigation.evaluate((node) => {
    const element = node as HTMLElement;
    const dialogElement = element.closest<HTMLElement>('.studio-menu-drawer');
    const header = dialogElement?.querySelector<HTMLElement>('.studio-menu-header');
    const rect = element.getBoundingClientRect();
    const dialogRect = dialogElement?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      top: rect.top,
      bottom: rect.bottom,
      dialogTop: dialogRect?.top ?? null,
      dialogBottom: dialogRect?.bottom ?? null,
      headerBottom: headerRect?.bottom ?? null,
    };
  });

  const viewport = navigation.page().viewportSize();
  expect(viewport).not.toBeNull();
  expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth + 1);
  expect(audit.scrollHeight).toBeLessThanOrEqual(audit.clientHeight + 1);
  expect(audit.dialogTop).toBeGreaterThanOrEqual(-1);
  expect(audit.dialogBottom).toBeLessThanOrEqual(viewport!.height + 1);
  expect(audit.top).toBeGreaterThanOrEqual((audit.headerBottom ?? 0) - 1);
  expect(audit.bottom).toBeLessThanOrEqual(viewport!.height + 1);

  const dialogAudit = await dialog.evaluate((node) => {
    const element = node as HTMLElement;
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  });
  expect(dialogAudit.width).toBeGreaterThanOrEqual(viewport!.width - 1);
  expect(dialogAudit.height).toBeGreaterThanOrEqual(viewport!.height - 1);
}

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
