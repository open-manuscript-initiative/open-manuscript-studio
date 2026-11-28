import { expect, test } from '@playwright/test';
import { installMockStudioApi } from './support/mockStudioApi';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

for (const width of [1440, 393]) test(`OMP handoff exposes native task assignment and editorial closure at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await installMockStudioApi(page, { authenticated: true });
  const requests: Record<string, unknown>[] = [];
  await page.route('**/integrations/omp/handoff/assignment-token', route => route.fulfill({ json: {
    protocol: 'omi-integration/1', profile: 'omi-integration/1/omp', actorMode: 'editor',
    submission: { externalId: '217', primaryLocale: 'en', title: { en: 'Volume' } },
    sourceDocument: { kind: 'docx', paragraphs: [{ text: 'OMP assignment manuscript.' }] },
    assignmentContext: { platform: 'omp', grant: 'signed-omp-grant', publicationLanguages: ['hu'],
      candidates: [{ externalId: '20', email: 'translator@example.test', fullName: 'Translator' }],
      manuscript: { title: 'Volume', blocks: [{ id: 'p1', type: 'paragraph', text: 'Source' }] } },
  } }));
  const existing = { id: '11111111-1111-4111-8111-111111111111', assignmentType: 'language_review', status: 'submitted', reviewerAlias: 'Language reviewer', reviewer: { userId: 'reviewer', email: 'reviewer@example.test', fullName: 'Language reviewer' } };
  await page.route('**/api/reviews/omp/assignments**', async route => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: { actorMode: 'editor', assignments: [existing] } });
    const body = request.postDataJSON(); requests.push({ path: new URL(request.url()).pathname, ...body });
    if (request.url().endsWith('/complete')) return route.fulfill({ json: { completed: true } });
    return route.fulfill({ json: { assignment: { ...existing, id: '22222222-2222-4222-8222-222222222222', assignmentType: 'translation', status: 'invited', sourceLanguage: body.sourceLanguage, targetLanguage: body.targetLanguage } } });
  });
  await page.goto('/?omiOmpLaunch=assignment-token');
  await expect(page.locator('section.editor').getByText('OMP assignment manuscript.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Assignments', exact: true }).click();
  await expect(menu.getByText('OMP reviewers', { exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Restore OMP connection', exact: true })).toBeVisible();
  await menu.getByRole('button', { name: 'Accept and complete work', exact: true }).click();
  await expect(menu.getByText('Language reviewer · completed', { exact: false })).toBeVisible();
  await menu.getByRole('combobox', { name: 'Role', exact: true }).selectOption('translation');
  await menu.getByLabel('Source language', { exact: true }).fill('hu');
  await menu.getByLabel('Target language', { exact: true }).fill('en');
  await menu.getByRole('button', { name: 'Add assignment', exact: true }).click();
  await expect(menu.getByRole('status')).toHaveText('The assignment was created.');
  expect(requests).toHaveLength(2);
  expect(requests[0].path).toMatch(/\/omp\/assignments\/.+\/complete$/);
  expect(requests[1]).toMatchObject({ path: '/api/reviews/omp/assignments', grant: 'signed-omp-grant', sourceLanguage: 'hu', targetLanguage: 'en', assignmentType: 'TRANSLATION', publicationLanguages: ['hu'] });
});
