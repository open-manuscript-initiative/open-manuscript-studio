import { devices, expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

for (const layout of ['desktop', 'mobile'] as const) {
  test.describe(`${layout} manuscript-menu selection`, () => {
    if (layout === 'mobile') {
      const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
      test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
    }

    test('switching built-in and external views leaves exactly one selected destination', async ({ page }) => {
      test.setTimeout(90_000);
      await installMockStudioApi(page);
      await signInToStudio(page);
      await page.getByRole('button', { name: /^New OMI study/ }).click();
      await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();

      const dialog = page.getByRole('dialog', { name: 'Manuscript menu' });
      const navigation = dialog.getByRole('navigation', { name: 'Manuscript menu' });
      const toggle = dialog.getByRole('button', { name: 'Manuscript menu', exact: true });
      const content = dialog.locator('.studio-menu-content');

      // Exercise both directions and every externally rendered destination,
      // including the pairs reported from Android Chrome.
      for (const label of [
        'Contributors', 'Lists', 'Translations', 'Lists', 'Manuscript data',
        'Lists', 'Notes', 'Lists', 'Tools', 'Integrations', 'Tools', 'OMI Agents',
        'Settings', 'Research modules', 'Settings', 'Help', 'Settings',
        'Publication editor', 'Integrations',
      ]) {
        await test.step(label, async () => {
          if (await navigation.isHidden()) await toggle.click();
          await navigation.getByRole('button', { name: label, exact: true }).click();
          await expect(navigation).toBeHidden();
          await expect(content).toBeVisible();
          if (['Lists', 'Integrations', 'OMI Agents', 'Research modules', 'Help'].includes(label)) {
            await expect(content.locator(':scope > :visible')).toHaveCount(1);
            await expect(content.locator('.studio-help-portal')).toBeVisible();
            await expect(content).not.toHaveClass(/studio-menu-content--publication-editor/);
          }
          await toggle.click();

          const selected = navigation.locator('.studio-menu-nav-button--active');
          const current = navigation.locator('[aria-current="page"]');
          await expect(selected).toHaveCount(1);
          await expect(selected).toHaveText(label);
          await expect(current).toHaveCount(1);
          await expect(current).toHaveText(label);

          // Verify the rendered tile styling as well as accessible selection.
          const staleHighlights = await navigation.locator('.studio-menu-nav-button')
            .evaluateAll((buttons) => buttons
              .filter((button) => button.getAttribute('aria-current') !== 'page')
              .filter((button) => getComputedStyle(button).boxShadow !== 'none')
              .map((button) => button.textContent));
          expect(staleHighlights).toEqual([]);
        });
      }
    });
  });
}
