import { expect, test } from '@playwright/test';
import { installMockAndroidRuntime } from './support/mockAndroidRuntime';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
import { createVersionedTestManuscript } from '../tests/testManuscriptFixture';
import { serializeOmiJson } from '../src/services/exportOmi';
import { buildOmiContainer } from '../src/services/omiContainer';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning';

const jsonUri = 'content://downloads/synthetic-json';
const packageUri = 'content://downloads/synthetic-package';

for (const coldStart of [true, false]) {
  test(`Android OS document opens during ${coldStart ? 'cold start' : 'an existing session'}`, async ({ page }) => {
    const manuscript = createVersionedTestManuscript();
    const json = Array.from(new TextEncoder().encode(serializeOmiJson(manuscript)));
    const packageState = { ...extractManuscriptState(manuscript), title: 'Android package reopened' };
    const packageManuscript = { ...packageState, ...createInitialVersioningEnvelope(packageState, {
      summary: 'Synthetic package opening', timestamp: '2026-08-07T12:00:00.000Z', completeness: 'complete',
    }) };
    const packed = Array.from((await buildOmiContainer(packageManuscript)).bytes);
    await page.setViewportSize({ width: 393, height: 851 });
    await installMockAndroidRuntime(page, {
      pending: coldStart ? [jsonUri] : [],
      files: { [jsonUri]: json, [packageUri]: packed },
    });
    await installMockStudioApi(page);
    if (coldStart) {
      // A startup file can replace the closed-document screen immediately after
      // authentication, so do not wait for that screen in the normal login helper.
      await page.goto('/');
      await page.getByLabel('Email address').fill('editor@example.test');
      await page.getByLabel('Password').fill('correct-horse-battery-staple');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    } else {
      await signInToStudio(page);
      await page.evaluate(async (uri) => {
        await window.__OMI_MOCK_ANDROID__.deliver(uri);
      }, jsonUri);
    }
    const tab = page.locator('.mobile-document-tab-strip').getByRole('tab', { name: 'Test manuscript', exact: true });
    await expect(tab).toBeVisible();
    await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // Re-deliver a ZIP package for the same identity to exercise the running-app
    // event route and the shared strict package reader through actual SDK mocks.
    await page.evaluate(async (uri) => {
      await window.__OMI_MOCK_ANDROID__.deliver(uri);
    }, packageUri);
    await expect.poll(() => page.evaluate(() => window.__OMI_MOCK_ANDROID__.commands
      .filter((command) => command === 'plugin:fs|read_file').length)).toBe(2);
    await expect(page.locator('.mobile-document-tab-strip').getByRole('tab', { name: 'Android package reopened', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

declare global {
  interface Window {
    __OMI_MOCK_ANDROID__: {
      commands: string[];
      deliver(uri: string): Promise<void>;
    };
  }
}
