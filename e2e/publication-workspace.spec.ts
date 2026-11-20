import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 820, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`publication task groups retain drafts and fit a ${viewport.width}px viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const api = await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
    await menu.getByRole('button', { name: 'Publication', exact: true }).click();
    const workspace = menu.locator('.publication-profile-view');
    const navigation = workspace.getByRole('navigation', { name: 'Publication tasks' });
    const groups = [
      'Profiles and publisher',
      'Styles and templates',
      'Publication checks',
      'Files and export',
      'Submission and publishing',
    ];
    await expect(navigation.getByRole('button')).toHaveText(groups);
    await expect(navigation.getByRole('button', { name: groups[0], exact: true })).toHaveAttribute('aria-pressed', 'true');
    const candidate = workspace.getByRole('radio').nth(1);
    await candidate.check();
    const profileName = workspace.locator('#publication-workspace-profiles .publisher-profile-editor input').first();
    await profileName.fill('Unfinished publisher profile');

    for (const name of groups) {
      const button = navigation.getByRole('button', { name, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      const group = workspace.locator('.publication-workspace-group:not([hidden])');
      await expect(group).toHaveCount(1);
      await expect(group.getByRole('heading', { name, exact: true })).toBeVisible();
      await expect(workspace.locator('.publication-workspace-group[hidden]')).toHaveCount(4);
      await expect.poll(() => workspace.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const outside = await group.locator('input:not([type="file"]), select, textarea, button').evaluateAll((controls) => controls
        .filter((control) => control.getClientRects().length > 0)
        .filter((control) => {
          const bounds = control.getBoundingClientRect();
          return bounds.left < -1 || bounds.right > window.innerWidth + 1;
        }).map((control) => control.outerHTML.slice(0, 150)));
      expect(outside).toEqual([]);
    }

    await navigation.getByRole('button', { name: 'Files and export', exact: true }).click();
    const format = workspace.getByLabel('Export format', { exact: true });
    await format.selectOption('omi-json');
    await navigation.getByRole('button', { name: 'Profiles and publisher', exact: true }).click();
    await expect(candidate).toBeChecked();
    await expect(profileName).toHaveValue('Unfinished publisher profile');
    await navigation.getByRole('button', { name: 'Files and export', exact: true }).click();
    await expect(format).toHaveValue('omi-json');
    await navigation.getByRole('button', { name: 'Publication checks', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(navigation.getByRole('button', { name: 'Publication checks', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(api.unhandledRequests).toEqual([]);
  });
}
