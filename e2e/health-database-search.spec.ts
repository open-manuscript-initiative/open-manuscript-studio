import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
for (const width of [1440, 390]) {
  test(`health databases show real result cards and import reference metadata at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await page.addInitScript(() => localStorage.setItem('omi:studio-module-preferences:v1:user%3Ae2e-editor:default', JSON.stringify({ version: 1, activeModuleIds: ['org.omi.psychology'] })));
    const requests: Record<string, unknown>[] = [];
    await page.route('**/api/v1/modules/**', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.pathname.endsWith('/policy') || url.pathname.endsWith('/preferences')) {
        await route.fulfill({ json: { workspaceId: 'default', revision: 1, enabledModuleIds: ['org.omi.psychology'], activeModuleIds: ['org.omi.psychology'] } }); return;
      }
      const body = request.postDataJSON(); requests.push(body);
      const provider = body.provider;
      if (provider === 'clinical-trials') { await route.fulfill({ status: 502, json: { error: { code: 'HEALTH_SEARCH_FAILED' } } }); return; }
      await route.fulfill({ json: { totalResults: 2, nextCursor: body.cursor ? null : '12', items: [{
        provider, id: body.cursor ? '12346' : '12345', title: body.cursor ? 'Synthetic second result' : 'Synthetic public study', authors: ['Synthetic Author'], journal: 'Synthetic Journal', year: '2026',
        doi: body.cursor ? '10.9999/second' : '10.9999/synthetic', pmid: '12345', url: provider === 'pubmed' ? 'https://pubmed.ncbi.nlm.nih.gov/12345/' : 'https://europepmc.org/article/MED/12345', rights: '', status: '', kind: 'article',
      }] } });
    });
    await page.goto('/'); await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.getByRole('button', { name: 'Manuscript menu' }).click();
    await page.locator('[data-modules-navigation="true"]').click();
    const panel = page.locator('.health-research-search');
    await expect(panel.getByRole('heading', { name: 'International research databases' })).toBeVisible();
    await panel.getByLabel('Research search terms').fill('synthetic topic');
    await panel.getByRole('button', { name: 'Search databases', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('ClinicalTrials.gov');
    const pubmed = panel.getByRole('region', { name: 'PubMed', exact: true });
    await expect(pubmed).toContainText('Synthetic public study');
    await expect(pubmed.getByRole('link', { name: 'Open source record' })).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/12345/');
    await pubmed.getByRole('button', { name: 'Add bibliographic reference' }).click();
    await expect(pubmed.getByRole('button', { name: 'Reference already added' })).toBeDisabled();
    await expect(panel.getByRole('region', { name: 'Europe PMC', exact: true }).getByRole('button', { name: 'Reference already added' })).toBeDisabled();
    await pubmed.getByRole('button', { name: 'More results — PubMed' }).click();
    await expect(pubmed).toContainText('Synthetic second result');
    expect(requests.every(request => Object.keys(request).every(key => ['provider', 'query', 'cursor'].includes(key)))).toBe(true);
    await panel.getByRole('checkbox', { name: 'PubMed', exact: true }).uncheck();
    await panel.getByRole('checkbox', { name: 'Europe PMC', exact: true }).uncheck();
    await panel.getByRole('checkbox', { name: 'ClinicalTrials.gov', exact: true }).uncheck();
    await expect(panel.getByRole('button', { name: 'Search databases', exact: true })).toBeDisabled();
    await expect(panel.getByRole('link', { name: 'Search PsychArchives externally' })).toHaveAttribute('target', '_blank');
  });
}
