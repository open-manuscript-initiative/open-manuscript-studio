import { expect, test } from '@playwright/test';
import { installMockStudioApi } from './support/mockStudioApi';

test('Help explains how authors invite, accept, and join live collaboration', async ({ page }) => {
  await installMockStudioApi(page, { authenticated: true, collaboration: { enabled: false } });

  await page.goto('/');
  await page.getByRole('button', { name: 'Help' }).click();
  const help = page.locator('.studio-help-portal');
  await expect(help.getByRole('searchbox', { name: 'Search Help' })).toBeVisible();
  await help.getByRole('searchbox', { name: 'Search Help' }).fill('invited author');

  const topic = help.locator('details.studio-help-topic');
  await expect(topic).toHaveCount(1);
  await expect(topic.locator('summary')).toHaveText('21. Inviting an author to collaborate');
  await expect(topic).toContainText('Start shared editing');
  await expect(topic).toContainText('accepts or declines');
  await expect(topic).toContainText('does not transfer the OMI file');
});
