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

test('menu font size can be personalized independently from Settings', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  const dialog = await openStudioMenu(page);
  const firstMenuItem = dialog.locator('.studio-menu-nav-button').first();

  const defaultSize = await firstMenuItem.evaluate(
    (node) => Number.parseFloat(getComputedStyle(node).fontSize),
  );
  const defaultHeight = await firstMenuItem.evaluate(
    (node) => node.getBoundingClientRect().height,
  );

  await dialog.getByRole('button', { name: 'Settings', exact: true }).click();
  const slider = dialog.getByRole('slider', { name: 'Menu font size' });
  await expect(slider).toHaveValue('100');

  await slider.fill('130');

  await expect.poll(async () =>
    page.evaluate(() => localStorage.getItem('omi-studio-menu-font-scale')),
  ).toBe('130');

  await openMenuNavigation(dialog);

  await expect.poll(async () =>
    firstMenuItem.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThan(defaultSize);

  await expect.poll(async () =>
    firstMenuItem.evaluate((node) => node.getBoundingClientRect().height),
  ).toBeGreaterThan(defaultHeight);

  const enlargedSize = await firstMenuItem.evaluate(
    (node) => Number.parseFloat(getComputedStyle(node).fontSize),
  );

  await slider.fill('80');

  await expect.poll(async () =>
    page.evaluate(() => localStorage.getItem('omi-studio-menu-font-scale')),
  ).toBe('80');

  await expect.poll(async () =>
    firstMenuItem.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  ).toBeLessThan(enlargedSize);
});

test('interface text size scales controls and live publication editor chrome but not publication content', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  const dialog = await openStudioMenu(page);

  await dialog.getByRole('button', { name: 'Live publication editor', exact: true }).click();
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
  await dialog.getByRole('button', { name: 'Live publication editor', exact: true }).click();

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
