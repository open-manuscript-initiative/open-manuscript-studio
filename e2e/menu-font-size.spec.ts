import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

async function openStudioMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  return page.getByRole('dialog', { name: 'Manuscript menu' });
}

async function openMenuNavigation(
  dialog: import('@playwright/test').Locator,
): Promise<void> {
  const navigation = dialog.getByRole('navigation', { name: 'Manuscript menu' });
  if (!(await navigation.isVisible())) {
    await dialog
      .getByRole('button', { name: 'Manuscript menu', exact: true })
      .click();
  }
  await expect(navigation).toBeVisible();
}

for (const layout of ['dashboard', 'sidebar'] as const) {
  test(`menu font size scales ${layout} controls independently from Settings`, async ({ page }) => {
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();

    const dialog = await openStudioMenu(page);
    if (layout === 'sidebar') {
      await dialog.getByRole('button', { name: 'Settings', exact: true }).click();
      await openMenuNavigation(dialog);
    }

    const home = dialog.locator('[data-home-navigation]');
    const menuItem = dialog.locator('.studio-menu-nav-group .studio-menu-nav-button').first();
    const readMetrics = async (item: import('@playwright/test').Locator) => item.evaluate(
      (node) => ({
        font: Number.parseFloat(getComputedStyle(node).fontSize),
        height: node.getBoundingClientRect().height,
      }),
    );
    const baseline = { home: await readMetrics(home), item: await readMetrics(menuItem) };

    for (const scale of [130, 80]) {
      await dialog.getByRole('button', { name: 'Settings', exact: true }).click();
      const slider = dialog.getByRole('slider', { name: 'Menu font size' });
      await expect(slider).toHaveValue(scale === 130 ? '100' : '130');
      await slider.fill(String(scale));
      await expect.poll(async () =>
        page.evaluate(() => localStorage.getItem('omi-studio-menu-font-scale')),
      ).toBe(String(scale));
      await openMenuNavigation(dialog);

      if (layout === 'dashboard') {
        // Home closes the active view; reopening restores the tile dashboard.
        await home.click();
        await expect(dialog).toBeHidden();
        await openStudioMenu(page);
      }
      await expect(dialog).toHaveClass(
        layout === 'dashboard' ? /--navigation-only/ : /^studio-menu-drawer$/,
      );

      // Compare each control in the same layout before and after scaling.
      for (const [item, normal] of [[home, baseline.home], [menuItem, baseline.item]] as const) {
        await expect.poll(async () => (await readMetrics(item)).font / normal.font)
          .toBeCloseTo(scale / 100, 1);
        const height = expect.poll(async () => (await readMetrics(item)).height);
        if (scale > 100) await height.toBeGreaterThan(normal.height);
        else await height.toBeLessThan(normal.height);
      }
    }
  });
}

test('interface text size scales controls and publication editor chrome but not publication content', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  const dialog = await openStudioMenu(page);

  await dialog.getByRole('button', { name: 'Publication editor', exact: true }).click();
  const ribbonButton = dialog.getByRole('button', { name: 'Paragraph styles', exact: true });
  const canvasToolbar = dialog.locator('.publication-document-canvas-toolbar');
  const documentTitle = dialog.locator('.publication-document-title');

  await expect(ribbonButton).toBeVisible();
  await expect(canvasToolbar).toBeVisible();
  await expect(documentTitle).toBeVisible();

  const baseline = {
    ribbonFont: await ribbonButton.evaluate(
      (node) => Number.parseFloat(getComputedStyle(node).fontSize),
    ),
    ribbonHeight: await ribbonButton.evaluate(
      (node) => node.getBoundingClientRect().height,
    ),
    toolbarFont: await canvasToolbar.evaluate(
      (node) => Number.parseFloat(getComputedStyle(node).fontSize),
    ),
    documentFont: await documentTitle.evaluate(
      (node) => Number.parseFloat(getComputedStyle(node).fontSize),
    ),
  };

  await openMenuNavigation(dialog);
  await dialog.getByRole('button', { name: 'Settings', exact: true }).click();

  const interfaceSlider = dialog.getByRole('slider', { name: 'Interface text size' });
  await expect(interfaceSlider).toHaveValue('100');

  const settingsControl = dialog.locator('.studio-language-compact-add select').first();
  await expect(settingsControl).toBeVisible();
  const baselineControlHeight = await settingsControl.evaluate(
    (node) => node.getBoundingClientRect().height,
  );

  await interfaceSlider.fill('130');

  await expect.poll(async () =>
    page.evaluate(() => localStorage.getItem('omi-studio-interface-font-scale')),
  ).toBe('130');

  await expect.poll(async () =>
    settingsControl.evaluate((node) => node.getBoundingClientRect().height),
  ).toBeGreaterThan(baselineControlHeight);

  await openMenuNavigation(dialog);
  await dialog.getByRole('button', { name: 'Publication editor', exact: true }).click();

  await expect.poll(async () =>
    ribbonButton.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThan(baseline.ribbonFont);

  await expect.poll(async () =>
    ribbonButton.evaluate((node) => node.getBoundingClientRect().height),
  ).toBeGreaterThan(baseline.ribbonHeight);

  await expect.poll(async () =>
    canvasToolbar.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThan(baseline.toolbarFont);

  await expect.poll(async () =>
    documentTitle.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeCloseTo(baseline.documentFont, 1);
});
