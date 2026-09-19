import { mkdirSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

const OUTPUT = 'artifacts/studio-docs-screenshots';

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(OUTPUT, { recursive: true });
});

test('capture current desktop Studio surfaces for documentation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installMockStudioApi(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to OMI Studio!' })).toBeVisible();
  await page.screenshot({ path: `${OUTPUT}/01-sign-in.png`, fullPage: true });

  await signInToStudio(page);
  await expect(page.getByRole('heading', { name: 'No document is open' })).toBeVisible();
  await page.screenshot({ path: `${OUTPUT}/02-empty-workspace.png`, fullPage: true });

  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();

  const editor = page.locator('.omi-tiptap-editor[contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type('Open scholarship and structured manuscript publishing');
  await page.keyboard.press('Enter');
  await page.keyboard.type(
    'Open Manuscript Studio keeps scholarly structure close to the writing process while preserving portable, machine-readable publication data.',
  );
  await page.keyboard.press('Enter');
  await page.keyboard.type(
    'Authors can write, revise, manage metadata, review changes, and prepare publication artifacts from the same manuscript model.',
  );

  await page.screenshot({ path: `${OUTPUT}/03-manuscript-editor.png` });

  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await expect(menu).toBeVisible();
  await page.screenshot({ path: `${OUTPUT}/04-manuscript-menu.png` });

  await menu.getByRole('button', { name: 'Live publication editor', exact: true }).click();
  await expect(menu.getByRole('heading', { name: 'Live publication editor' })).toBeVisible();
  await expect(menu.locator('.publication-document-canvas')).toBeVisible();
  await page.screenshot({ path: `${OUTPUT}/05-live-publication-editor.png` });
});

test('capture current mobile Studio editor', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();

  const editor = page.locator('.omi-tiptap-editor[contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type('Mobile scholarly writing');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The same Studio document model is available on compact screens.');

  await page.screenshot({ path: `${OUTPUT}/06-mobile-editor.png` });
});
