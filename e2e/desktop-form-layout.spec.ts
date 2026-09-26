import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('desktop forms use intrinsic widths instead of stretching across the page', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  await dialog.getByRole('button', { name: 'Contributors', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add contributor', exact: true }).click();

  const content = dialog.locator('.studio-menu-content');
  const card = content.locator('.contributor-card').first();
  const givenName = card.getByLabel('Given name');
  const familyName = card.getByLabel('Family name');
  const orcid = card.getByLabel('ORCID');

  await expect(card).toBeVisible();
  await expect(orcid).toBeVisible();

  const widths = await Promise.all([
    givenName.evaluate((node) => node.getBoundingClientRect().width),
    familyName.evaluate((node) => node.getBoundingClientRect().width),
    orcid.evaluate((node) => node.getBoundingClientRect().width),
    card.evaluate((node) => node.getBoundingClientRect().width),
  ]);

  expect(widths[0]).toBeLessThanOrEqual(300);
  expect(widths[1]).toBeLessThanOrEqual(300);
  expect(widths[2]).toBeLessThanOrEqual(250);
  expect(widths[3]).toBeGreaterThan(widths[2] * 2);

  const overflow = await content.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
});

test('desktop manuscript metadata packs controls into content-sized columns', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
  await dialog.getByRole('button', { name: 'Manuscript data', exact: true }).click();

  const content = dialog.locator('.studio-menu-content');
  const metadataCard = content.locator('.studio-metadata-card');
  await expect(metadataCard).toBeVisible();

  const controls = metadataCard.locator('input:not([type="checkbox"]), select, textarea');
  const count = await controls.count();
  expect(count).toBeGreaterThan(4);

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    const box = await control.boundingBox();
    if (!box) continue;
    expect(box.width).toBeLessThanOrEqual(620);
  }

  const overflow = await content.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
