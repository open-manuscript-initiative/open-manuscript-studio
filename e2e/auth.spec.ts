import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('a user can sign in to and sign out of Studio', async ({ page }) => {
  const api = await installMockStudioApi(page);

  await signInToStudio(page);

  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
  expect(api.loginRequests).toEqual([{
    email: 'editor@example.test',
    password: 'correct-horse-battery-staple',
  }]);
  expect(api.unhandledRequests).toEqual([]);

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
});

test('an OJS manuscript waits for sign-in and opens automatically afterwards', async ({ page }) => {
  const api = await installMockStudioApi(page);
  let handoffRequests = 0;

  await page.route('**/integrations/ojs/handoff/pending-login-token', async (route) => {
    handoffRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocol: 'omi-integration/1',
        profile: 'omi-integration/1/ojs',
        submission: {
          externalId: '115',
          primaryLocale: 'en',
          title: { en: 'Pending OJS article' },
        },
        sourceDocument: {
          kind: 'docx',
          paragraphs: [{ text: 'Opened after Studio sign-in.' }],
        },
      }),
    });
  });

  await page.goto('/?omiOjsLaunch=pending-login-token');
  await expect(page.getByText('OJS manuscript waiting to open', { exact: true })).toBeVisible();
  expect(handoffRequests).toBe(0);

  await page.getByLabel('Email address').fill('editor@example.test');
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('Opened after Studio sign-in.', { exact: true })).toBeVisible();
  expect(handoffRequests).toBe(1);
  await expect(page).not.toHaveURL(/omiOjsLaunch/);
  expect(api.unhandledRequests).toEqual([]);
});

test('a pending OJS launch survives an external authentication round trip', async ({ page }) => {
  await installMockStudioApi(page);

  await page.goto('/?omiOjsLaunch=pending-federated-token');
  await expect(page.getByText('OJS manuscript waiting to open', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    sessionStorage.getItem('omi:pending-external-launch'),
  )).not.toBeNull();

  // Simulate a federated provider returning to the Studio origin without the
  // original OJS query string. Bootstrap must restore the pending launch before
  // AuthGate and StudioApplication inspect the URL.
  await page.goto('/');

  await expect(page).toHaveURL(/omiOjsLaunch=pending-federated-token/);
  await expect(page.getByText('OJS manuscript waiting to open', { exact: true })).toBeVisible();
});
