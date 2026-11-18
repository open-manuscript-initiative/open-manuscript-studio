import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  });

test('production task exposes an isolated proof and requires opening it before approval', async ({
  page,
}) => {
  await installMockStudioApi(page);
  const submissionId = '10000000-0000-4000-8000-000000000001';
  const proofId = '20000000-0000-4000-8000-000000000002';
  const sourceId = '30000000-0000-4000-8000-000000000003';
  const commands: unknown[] = [];
  const productionUrls: string[] = [];
  const production = {
    version: 4,
    actor: { userId: 'author', author: true, editor: false },
    published: false,
    files: [],
    state: {
      model: 'omi-editorial-production/1',
      stage: 'PROOFREADING',
      source: {
        fileId: sourceId,
        revisionId: 'revision-1',
        stateDigest: 'a'.repeat(64),
        publicationContentDigest: 'b'.repeat(64),
      },
      acceptedSource: {
        fileId: sourceId,
        revisionId: 'revision-1',
        stateDigest: 'a'.repeat(64),
        publicationContentDigest: 'b'.repeat(64),
      },
      sourceApprovals: {},
      assignments: [],
      corrections: [],
      events: [],
      proof: {
        fileId: proofId,
        revisionId: 'revision-1',
        stateDigest: 'a'.repeat(64),
        sha256: 'c'.repeat(64),
        buildId: 'build-1',
        fileName: 'article.html',
        mediaType: 'text/html;charset=utf-8',
      },
      proofApprovals: {} as Record<string, { userId: string; at: string }>,
    },
  };
  await page.route(/\/api\/(?:v1\/)?native-editorial\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/production/')) productionUrls.push(path);
    if (path.endsWith('/production/tasks'))
      return route.fulfill({
        json: {
          tasks: [
            {
              submissionId,
              title: 'Article awaiting proof approval',
              venueName: 'Test Journal',
            },
          ],
        },
      });
    if (path.endsWith('/submissions/mine') || path.endsWith('/inbox'))
      return route.fulfill({ json: { submissions: [] } });
    if (path.endsWith(`/files/${proofId}`))
      return route.fulfill({
        contentType: 'text/html;charset=utf-8',
        body: '<html><body><h1>Exact publication proof</h1><script>parent.document.body.dataset.proofExecuted="yes"</script></body></html>',
      });
    if (path.endsWith(`/production/${submissionId}`)) {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        commands.push(body);
        production.version++;
        production.state.proofApprovals.AUTHOR = {
          userId: 'author',
          at: new Date().toISOString(),
        };
      }
      return route.fulfill({ json: production });
    }
    return route.fulfill({
      status: 404,
      json: { error: { message: 'Unexpected editorial request' } },
    });
  });
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page
    .getByRole('button', { name: 'Manuscript menu', exact: true })
    .first()
    .click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu
    .getByRole('button', { name: 'Editorial workflow', exact: true })
    .click();
  await menu.getByLabel('My production assignments').selectOption(submissionId);
  const panel = menu.getByRole('region', { name: 'Copyediting and proofs' });
  const approve = panel.getByRole('button', {
    name: 'Author: approve this proof',
    exact: true,
  });
  await expect(approve).toBeDisabled();
  await panel
    .getByRole('button', { name: 'Open current proof', exact: true })
    .click();
  await expect(
    panel
      .frameLocator('iframe')
      .getByRole('heading', { name: 'Exact publication proof' }),
  ).toBeVisible();
  await expect(panel.locator('iframe')).toHaveAttribute('sandbox', '');
  expect(
    await page.evaluate(() => document.body.dataset.proofExecuted),
  ).toBeUndefined();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(approve).toBeDisabled();
  expect(productionUrls.length).toBeGreaterThan(0);
  expect(productionUrls.every(path => path.startsWith('/api/v1/native-editorial/production/'))).toBe(true);
  expect(commands).toEqual([
    {
      version: 4,
      command: { type: 'APPROVE_PROOF', role: 'AUTHOR', fileId: proofId },
    },
  ]);
  await page.setViewportSize({ width: 393, height: 851 });
  await expect(
    panel.getByRole('button', { name: 'Open current proof', exact: true }),
  ).toBeVisible();
});
