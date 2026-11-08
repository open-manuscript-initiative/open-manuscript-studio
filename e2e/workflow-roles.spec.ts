import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('saving a working role focuses the menu and all tools remain available on mobile', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  const user = await page.evaluate(async () => {
    const { getCurrentUser, useAuthStore } = await import('/src/store/authStore.ts');
    return getCurrentUser(useAuthStore.getState());
  });
  if (!user) throw new Error('Synthetic profile is unavailable.');
  const savedRoles: string[] = [];
  await page.route('**/api/auth/me', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const body = route.request().postDataJSON() as { workflowRole: string };
    savedRoles.push(body.workflowRole);
    await route.fulfill({ json: { user: { ...user, preferences: { ...user.preferences, workflowRole: body.workflowRole } } } });
  });
  await page.locator('.focus-account-button').click();
  const account = page.locator('.account-overlay');
  await account.getByRole('combobox', { name: /^Preferred working role/ }).selectOption('translator');
  await account.getByRole('button', { name: 'Save personal profile', exact: true }).click();
  await expect(account.getByText('Personal profile saved.', { exact: true })).toBeVisible();
  expect(savedRoles).toEqual(['translator']);
  await account.locator('.account-close').click();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await expect(menu.locator('.studio-menu-workflow-role')).toContainText('Translator');
  await expect(menu.getByRole('button', { name: 'Live publication editor', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 900 });
  await menu.getByRole('checkbox', { name: 'Show all tools' }).check();
  await expect(menu.getByRole('button', { name: 'Live publication editor', exact: true })).toBeVisible();
  await menu.getByRole('checkbox', { name: 'Show all tools' }).uncheck();
  await expect(menu.getByRole('button', { name: 'Live publication editor', exact: true })).toHaveCount(0);
});

for (const [source, actorMode, label] of [['ojs', 'author', 'Author'], ['omp', 'editor', 'Editor']] as const) {
  test(`${source.toUpperCase()} role overrides the profile only for the imported manuscript`, async ({ page }) => {
    await installMockStudioApi(page, { authenticated: true, workflowRole: 'translator' });
    await page.route(`**/integrations/${source}/handoff/role-token`, (route) => route.fulfill({ json: {
      protocol: 'omi-integration/1', profile: `omi-integration/1/${source}`, actorMode,
      submission: { externalId: '42', primaryLocale: 'en', title: { en: 'External role example' } },
      sourceDocument: { kind: 'docx', paragraphs: [{ text: 'Role-specific handoff body.' }] },
    } }));
    await page.goto(`/?${source === 'ojs' ? 'omiOjsLaunch' : 'omiOmpLaunch'}=role-token`);
    await expect(page.locator('section.editor').getByText('Role-specific handoff body.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
    const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
    await expect(menu.locator('.studio-menu-workflow-role')).toContainText(`Working role: ${label}`);
    await expect(menu.locator('.studio-menu-workflow-role')).toContainText(`Role for this ${source.toUpperCase()} manuscript`);
    await menu.getByRole('button', { name: 'Document', exact: true }).click();
    await menu.getByRole('button', { name: /^New OMI study/ }).click();
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
    await expect(menu.locator('.studio-menu-workflow-role')).toContainText('Working role: Translator');
    await expect(menu.locator('.studio-menu-workflow-role')).toContainText('Profile preference');
  });
}
