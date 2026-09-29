import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('Help explains automatic author invitations and joining live collaboration', async ({ page }) => {
  await installMockStudioApi(page, { collaboration: { enabled: true } });
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await expect(page.locator('.omi-collaboration-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Help', exact: true }).click();
  const help = page.locator('.studio-help-portal');
  await expect(help.getByRole('searchbox', { name: 'Search Help' })).toBeVisible();
  await help.getByRole('searchbox', { name: 'Search Help' }).fill('inviting an author');

  const topic = help.locator('details.studio-help-topic');
  await expect(topic).toHaveCount(1);
  await expect(topic.locator('summary')).toHaveText('Inviting an author to collaborate');
  await expect(topic).toContainText('sends the invitation automatically');
  await expect(topic).toContainText('accepts the invitation');
  await expect(topic).toContainText('does not transfer the OMI file');
  await expect(topic).toContainText('enables live collaboration by default');
  await expect(topic).toContainText('/collaboration/ws');
});
