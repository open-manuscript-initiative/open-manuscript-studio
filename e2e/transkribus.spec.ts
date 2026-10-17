import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=';

for (const width of [1440, 390]) {
  test(`Transkribus requires processing consent and reviewed sourced insertion at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await page.route('**/api/v1/modules/**', route => route.fulfill({ json: {
      workspaceId: 'default', revision: 1, enabledModuleIds: ['org.omi.critical-text-edition'], activeModuleIds: ['org.omi.critical-text-edition'],
    } }));
    let connected = false;
    await page.route('**/api/integrations/transkribus/connection', async route => {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({ username: 'synthetic@example.test', password: 'TRANSKRIBUS-PRIVATE-PASSWORD' });
        connected = true;
      }
      await route.fulfill({ json: { connected, accountLabel: connected ? 'synthetic@example.test' : '' } });
    });
    let submissions = 0;
    const job = { processId: 42, status: 'CREATED', text: '', handle: `42.${'a'.repeat(43)}` };
    await page.route('**/api/modules/critical-text-edition/transkribus/jobs**', async route => {
      if (route.request().method() === 'POST') {
        submissions++;
        expect(route.request().postDataJSON()).toEqual({ modelId: 38230, imageBase64: png, consent: true });
        await route.fulfill({ status: 201, json: job });
      } else if (new URL(route.request().url()).pathname.endsWith('/page')) {
        await route.fulfill({ contentType: 'application/xml', body: '<PcGts><Page/></PcGts>' });
      } else {
        await route.fulfill({ json: { ...job, status: 'FINISHED', text: 'Original synthetic transcription' } });
      }
    });
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).click();
    await page.locator('[data-modules-navigation="true"]').click();
    const panel = page.getByRole('region', { name: 'Transkribus text recognition', exact: true });
    await panel.getByLabel('Transkribus email / username', { exact: true }).fill('synthetic@example.test');
    await panel.getByLabel('Transkribus password', { exact: true }).fill('TRANSKRIBUS-PRIVATE-PASSWORD');
    await panel.getByRole('button', { name: 'Connect Transkribus', exact: true }).click();
    await expect(panel.getByText('Account connected: synthetic@example.test')).toBeVisible();
    await panel.getByLabel('Page image', { exact: true }).setInputFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await panel.getByLabel('Recognition model ID', { exact: true }).fill('38230');
    const start = panel.getByRole('button', { name: 'Start recognition (uses credits)', exact: true });
    await expect(start).toBeDisabled();
    await panel.getByRole('checkbox', { name: 'I authorise sending this page to Transkribus for processing and using credits from my Transkribus account.', exact: true }).check();
    await start.click();
    await expect(panel.getByText('Submitted · 42')).toBeVisible();
    await panel.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await expect(panel.getByRole('textbox', { name: 'Recognised transcription', exact: true })).toHaveValue('Original synthetic transcription');
    await panel.getByRole('textbox', { name: 'Recognised transcription', exact: true }).fill('Corrected transcription: árvíz, æ, œ.');
    await panel.getByLabel('Source', { exact: true }).fill('Archive A, MS 12, fol. 4r');
    await panel.getByRole('combobox', { name: 'Source rights / licence', exact: true }).selectOption('public-domain');
    const insert = panel.getByRole('button', { name: 'Insert reviewed transcription', exact: true });
    await expect(insert).toBeDisabled();
    await panel.getByRole('checkbox', { name: 'I checked the transcription, its source and the declared rights.', exact: true }).check();
    await insert.click();
    await expect(panel.getByText('The transcription was appended to the selected section with its provenance.', { exact: true })).toBeVisible();
    await expect(insert).toBeDisabled();
    expect(submissions).toBe(1);
    const saved = await page.evaluate(() => Object.values(localStorage).join('\n'));
    expect(saved).not.toContain('TRANSKRIBUS-PRIVATE-PASSWORD');
    expect(saved).not.toContain(png);
    const size = await panel.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
    expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
    await page.screenshot({ path: testInfo.outputPath('transkribus-result.png'), fullPage: true });
    const downloading = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download original PAGE XML', exact: true }).click();
    expect((await downloading).suggestedFilename()).toBe('transkribus-42.page.xml');
    page.once('dialog', dialog => dialog.accept());
    await panel.getByRole('button', { name: 'Clear saved job on this device', exact: true }).click();
    await expect(panel.getByRole('textbox', { name: 'Recognised transcription', exact: true })).toHaveCount(0);
    expect(submissions).toBe(1);
    await page.locator('.studio-menu-navigation-toggle').click();
    await page.locator('[data-home-navigation="true"]').click();
    await expect(page.locator('.tiptap').filter({ hasText: 'Corrected transcription: árvíz, æ, œ.' }).first()).toContainText('Archive A, MS 12, fol. 4r');
  });
}
