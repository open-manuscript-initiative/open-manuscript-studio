import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const width of [1440, 390]) {
  test(`health modules insert only sourced summaries at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await page.addInitScript(() => {
      const ids = ['org.omi.psychology', 'org.omi.medical-sciences'];
      localStorage.setItem('omi:studio-module-preferences:v1:user%3Ae2e-editor:default', JSON.stringify({ version: 1, activeModuleIds: ids }));
      const common = ['title', 'question', 'registration', 'population', 'method', 'analysis', 'ethics', 'consent', 'sharing', 'publicSummary', 'source'];
      for (const discipline of ['psychology', 'medical-sciences']) {
        const extra = discipline === 'psychology' ? ['instrument', 'rights', 'scoring', 'psychometrics'] : ['studyType', 'intervention', 'endpoints', 'outcomes'];
        const fields = Object.fromEntries([...common, ...extra].map(key => [key, '']));
        fields.title = 'Synthetic study'; fields.publicSummary = 'Synthetic aggregate methods';
        fields.ethics = 'CONFIDENTIAL-SYNTHETIC';
        localStorage.setItem(`omi:discipline-workspace:v1:user%3Ae2e-editor:default:org.omi.${discipline}`, JSON.stringify({ schemaVersion: 1, discipline, fields }));
      }
    });
    await page.goto('/');
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    const popover = page.locator('.focus-insert-menu-popover');
    await popover.locator('summary').filter({ hasText: /^Research modules$/ }).click();
    for (const title of ['Medical and Health Sciences', 'Psychology']) {
      await popover.getByRole('button', { name: `Select saved excerpt: ${title}`, exact: true }).click();
      await popover.getByRole('combobox', { name: 'Excerpt', exact: true }).selectOption('public-summary');
      await expect(popover).toContainText('Synthetic aggregate methods');
      await expect(popover).not.toContainText('CONFIDENTIAL-SYNTHETIC');
      await expect(popover.getByRole('button', { name: 'Insert excerpt with source' })).toBeDisabled();
    }
    await popover.getByLabel('Source (required)', { exact: true }).fill('Synthetic protocol');
    await popover.getByLabel('I checked the excerpt, source and permission to share.').check();
    await popover.getByRole('button', { name: 'Insert excerpt with source' }).click();
    await expect(popover).toBeHidden();
    await expect(page.locator('.tiptap').filter({ hasText: 'Synthetic aggregate methods' }).first()).toContainText('Synthetic protocol');
  });
}
