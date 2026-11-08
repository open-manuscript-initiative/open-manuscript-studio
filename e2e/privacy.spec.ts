import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { AccountOverview } from '../src/api/privacyContract';
import { installMockStudioApi } from './support/mockStudioApi';

const notice = {
  version: '2026-11-07', language: 'en', controller: { name: 'Synthetic Controller', postalAddress: 'Synthetic address', email: 'privacy@example.test' },
  noticeUrl: 'https://example.test/privacy', authority: { name: 'Synthetic Authority', url: 'https://example.test/authority' },
  processing: [{ purpose: 'Account service', categories: 'Profile and email', legalBasis: 'Synthetic basis', retention: 'Synthetic retention', recipients: 'Synthetic processor', internationalTransfers: 'Synthetic safeguards' }],
  rights: 'Synthetic rights instructions', dataSources: 'Supplied by the user', requiredData: 'Synthetic requirements', automatedDecisions: 'No automated decisions', cookies: 'Necessary session storage', backups: 'Synthetic backup rotation', deletion: 'Pseudonymized shared references may remain',
};

test('public privacy notice works without sign-in and remains readable on mobile', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await page.route('**/api/v1/privacy', (route) => route.fulfill({ json: { configured: true, notice } }));
  await page.goto('/?privacy=1');
  await expect(page.getByRole('heading', { name: 'Privacy and personal data', exact: true })).toBeVisible();
  await expect(page.getByText('Controller: Synthetic Controller', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send a privacy request' })).toHaveAttribute('href', /^mailto:privacy%40example.test\?subject=/);
  await expect(page.getByRole('link', { name: 'Full privacy notice' })).toHaveAttribute('href', 'https://example.test/privacy');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`privacy-${width}.png`), fullPage: true });
  }
  expect(api.loginRequests).toEqual([]);
  expect(api.unhandledRequests).toEqual([]);
});

test('registration exposes absent operator information instead of an invented controller', async ({ page }) => {
  const api = await installMockStudioApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.locator('.privacy-notice > summary').click();
  await expect(page.getByText(/The operator has not supplied reviewed privacy information/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send a privacy request' })).toHaveCount(0);
  expect(api.unhandledRequests).toEqual([]);
});

test('notice content is text and unsafe external URLs are not turned into links', async ({ page }) => {
  await installMockStudioApi(page);
  await page.route('**/api/v1/privacy', (route) => route.fulfill({ json: { configured: true, notice: {
    ...notice, rights: '<img src=x onerror="window.privacyInjected=true">',
    noticeUrl: 'javascript:alert(1)', authority: { ...notice.authority, url: 'data:text/html,unsafe' },
    controller: { ...notice.controller, email: 'privacy@example.test?bcc=other@example.test' },
  } } }));
  await page.goto('/?privacy=1');
  await expect(page.getByText('<img src=x onerror="window.privacyInjected=true">', { exact: true })).toBeVisible();
  await expect(page.locator('.privacy-notice img')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Full privacy notice' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Send a privacy request' })).toHaveCount(0);
});


test('authenticated account copy downloads through v1 with its partial-scope disclosure', async ({ page }) => {
  const api = await installMockStudioApi(page, { authenticated: true });
  const copy: AccountOverview = { schema: 'omi-account-overview/1', exportedAt: '2026-11-08T00:00:00Z',
    scope: 'Not a complete subject access response or manuscript backup.',
    omitted: ['Manuscripts and confidential reviews'], incompleteSections: [],
    profile: { id: 'user:e2e-editor', email: 'editor@example.test', fullName: 'Synthetic editor',
      affiliation: null, affiliationRorId: null, country: null, website: null, orcid: null, bio: null, timeZone: null,
      interfaceLanguage: 'en', status: 'ACTIVE', workflowRole: 'general', createdAt: '2026-11-08T00:00:00Z',
      updatedAt: '2026-11-08T00:00:00Z', lastLoginAt: null },
    profileEmails: [], identities: [], institutionMemberships: [], sessions: [], passkeys: [],
  };
  let requests = 0;
  await page.route('**/api/v1/account/data', async route => {
    requests += 1;
    await route.fulfill({ json: copy, headers: { 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="omi-account-data.json"' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.locator('.focus-account-button').click();
  await expect(page.locator('.account-overlay').getByText(/For a full response covering manuscripts, reviews and logs/)).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download a copy of account data', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('omi-account-data.json');
  const path = await download.path();
  expect(JSON.parse(await readFile(path!, 'utf8'))).toEqual(copy);
  expect(requests).toBe(1);
  expect(api.unhandledRequests).toEqual([]);
});
