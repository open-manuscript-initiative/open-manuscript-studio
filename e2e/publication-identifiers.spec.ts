import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const width of [1440, 393]) {
  test(`journal issues keep ISBN and ISSNs together through creation, editing and reload (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI edited volume/ }).click();
    const form = page.locator('.omi-new-publication-form');
    await form.getByLabel('Publication type').selectOption('journal-issue');
    await form.getByLabel('Volume or journal issue title').fill('Special issue');
    await form.getByLabel('ISBN (print)', { exact: true }).fill('978-0-306-40615-7');
    await form.getByLabel('ISBN (electronic)', { exact: true }).fill('978-3-16-148410-0');
    await form.getByLabel('ISSN (print)', { exact: true }).fill('1234-5679');
    await form.getByLabel('ISSN (electronic, eISSN)', { exact: true }).fill('2049-3630');
    await form.getByLabel('DOI of the whole publication').fill('10.1234/whole-issue');
    await form.getByLabel('Publication type').selectOption('volume');
    await expect(form.getByLabel('ISSN (print)', { exact: true })).toHaveValue('1234-5679');
    await form.getByLabel('Publication type').selectOption('journal-issue');
    await expect(form.getByLabel('ISBN (print)', { exact: true })).toHaveValue('978-0-306-40615-7');
    expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await form.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('tab', { name: 'Title matter', exact: true }).click();
    const isbn = page.getByLabel('ISBN (print)', { exact: true });
    await expect(isbn).toHaveValue('978-0-306-40615-7');
    await expect(page.getByLabel('ISSN (print)', { exact: true })).toHaveValue('1234-5679');
    // A trimmed store update must not eat Enter before the next ISBN is typed.
    await isbn.press('End');
    await isbn.press('Enter');
    await isbn.pressSequentially('978-1-4028-9462-6');
    await isbn.press('Tab');
    await expect(isbn).toHaveValue('978-0-306-40615-7\n978-1-4028-9462-6');
    await page.getByRole('tab', { name: 'Covers and title pages', exact: true }).click();
    await expect(page.getByLabel('Publication type')).toHaveValue('journal-issue');
    await page.evaluate(async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      useStudioStore.getState().checkpoint('manual');
      const { resumeLastSessionPersistence } = await import('/src/app/lastSessionPersistence.ts');
      await resumeLastSessionPersistence();
    });
    await page.reload();
    await page.getByRole('tab', { name: 'Title matter', exact: true }).click();
    await expect(page.getByLabel('ISBN (print)', { exact: true })).toHaveValue('978-0-306-40615-7\n978-1-4028-9462-6');
    await expect(page.getByLabel('ISSN (electronic, eISSN)', { exact: true })).toHaveValue('2049-3630');
  });
}
