import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
test(`mathematics inserts and edits validated equations at ${viewport.width}px`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await installMockStudioApi(page);
  await page.addInitScript(() => {
    localStorage.setItem('omi:studio-module-preferences:v1:user%3Ae2e-editor:default',
      JSON.stringify({ version: 1, activeModuleIds: ['org.omi.mathematics'] }));
  });
  await page.goto('/');
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  const popover = page.locator('.focus-insert-menu-popover');
  await popover.locator('summary').filter({ hasText: /^Research modules$/ }).click();
  await popover.locator('summary').filter({ hasText: /^Mathematics$/ }).click();
  const input = popover.getByLabel('LaTeX equation');
  await input.fill('x_{');
  await expect(popover.getByRole('alert')).toContainText('Invalid or unsupported LaTeX');
  await expect(popover.getByRole('button', { name: 'Insert equation' })).toBeDisabled();
  await input.fill('x_i^2');
  await expect(popover.locator('msubsup')).toHaveCount(1);
  await popover.getByRole('button', { name: 'Insert equation' }).click();
  await expect(popover).toBeHidden();
  const equation = page.locator('.omi-equation-block').first();
  await expect(equation.getByLabel('LaTeX equation')).toHaveValue('x_i^2');
  await equation.getByLabel('LaTeX equation').fill('\\sqrt[3]{x}');
  await expect(equation.locator('mroot')).toHaveCount(1);
});

}

test('mathematics insertion follows module activation instead of the generic equation button', async ({ page }) => {
  await installMockStudioApi(page);
  await page.goto('/');
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  const popover = page.locator('.focus-insert-menu-popover');
  await expect(popover.getByRole('button', { name: 'Equation', exact: true })).toHaveCount(0);
  await expect(popover.getByRole('button', { name: 'Insert equation' })).toHaveCount(0);
});
