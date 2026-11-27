import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
import { ompIdentity, ompMetadataSnapshot } from '../tests/fixtures/ompEditorialSnapshot.mjs';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

const connectionId = '20000000-0000-4000-8000-000000000003';
async function openVolumePanel(page: Page, options: { unsupported?: boolean; stale?: boolean; lost?: boolean } = {}) {
  await installMockStudioApi(page);
  const requests: Record<string, unknown>[] = [];
  const snapshot = ompMetadataSnapshot();
  let inspections = 0;
  await page.route('**/api/integrations/catalog', route => route.fulfill({ json: { providers: [{
    id: 'omp', connections: [{ id: connectionId, providerId: 'omp', connectionKey: 'press',
      displayName: 'Test press', enabled: true }],
  }] } }));
  await page.route('**/api/v1/integrations/connections/*/editorial-capabilities', route => route.fulfill({ json: {
    protocol: 'omi-publishing-editorial/1', provider: 'omp', authority: 'OMP',
    features: { workflowRead: true, metadataReconcile: !options.unsupported,
      nativeCopyeditingWrite: false, nativeProofApproval: false, externalReviewAssurance: false },
  } }));
  await page.route('**/api/v1/integrations/connections/*/omp-metadata', async route => {
    const input = route.request().postDataJSON();
    requests.push(input);
    if (input.action === 'inspect') {
      inspections++;
      return route.fulfill({ json: { snapshot: { ...snapshot,
        stateToken: options.stale && inspections > 1 ? 'd'.repeat(64) : snapshot.stateToken } } });
    }
    if (options.lost) return route.abort('failed');
    return route.fulfill({ json: { snapshot, receipt: {
      ...ompIdentity, protocol: 'omi-omp-metadata/1', locale: input.locale,
      fields: Object.keys(input.fields), previousStateToken: input.expectedStateToken,
      stateToken: snapshot.stateToken, published: false,
    } } });
  });
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const state = useStudioStore.getState();
    state.loadManuscript({ ...state.manuscript, title: 'Local volume', locale: 'en',
      extensions: { ...state.manuscript.extensions, 'org.openmanuscript.omp.volume': {
        version: 1, mode: 'chapters', installationId: 'press-installation',
        contextExternalId: '1', submissionExternalId: '12', publicationExternalId: '13',
      } } });
  });
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication', exact: true }).click();
  await menu.getByRole('navigation', { name: 'Publication tasks' })
    .getByRole('button', { name: 'Submission and publishing', exact: true }).click();
  const panel = page.getByRole('region', { name: 'OMP–OMI volume metadata reconciliation', exact: true });
  await expect(panel).toHaveCount(1);
  await panel.getByRole('combobox', { name: 'OMP connection', exact: true }).selectOption(connectionId);
  await panel.getByRole('button', { name: 'Compare', exact: true }).click();
  return { panel, requests };
}

for (const width of [1440, 393]) {
  test(`OMP selected metadata write requires confirmation and exact volume identity at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { panel, requests } = await openVolumePanel(page);
    await expect(panel.getByRole('table')).toBeVisible();
    await panel.getByLabel('Title', { exact: true }).selectOption('push');
    const send = panel.getByRole('button', { name: 'Send to OMP', exact: true });
    await expect(send).toBeDisabled();
    await panel.getByLabel('I approve the selected changes').check();
    await send.click();
    await expect(panel.getByRole('status')).toHaveText('Selected fields reconciled.');
    expect(requests.filter(request => request.action === 'apply')).toEqual([{
      ...ompIdentity, action: 'apply', locale: 'en', fields: { title: 'Local volume' },
      expectedStateToken: 'a'.repeat(64), confirmed: true,
    }]);
    await expect(send).toHaveCount(0);
  });
}

test('OMP stale metadata cancels the proposal before any write', async ({ page }) => {
  const { panel, requests } = await openVolumePanel(page, { stale: true });
  await panel.getByLabel('Title', { exact: true }).selectOption('push');
  await panel.getByLabel('I approve the selected changes').check();
  await panel.getByRole('button', { name: 'Send to OMP', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Inspect again');
  expect(requests.filter(request => request.action === 'apply')).toEqual([]);
});

test('OMP missing capability explains the required update before inspecting metadata', async ({ page }) => {
  const { panel, requests } = await openVolumePanel(page, { unsupported: true });
  await expect(panel.getByRole('alert')).toContainText('Update the OMP integration plugin');
  expect(requests).toEqual([]);
});

test('OMP uncertain write clears confirmation and is never automatically repeated', async ({ page }) => {
  const { panel, requests } = await openVolumePanel(page, { lost: true });
  await panel.getByLabel('Title', { exact: true }).selectOption('push');
  await panel.getByLabel('I approve the selected changes').check();
  await panel.getByRole('button', { name: 'Send to OMP', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('No automatic retry');
  await expect(panel.getByRole('button', { name: 'Send to OMP', exact: true })).toHaveCount(0);
  expect(requests.filter(request => request.action === 'apply')).toHaveLength(1);
});

test('OMP selected import creates a revision while preserving chapter content and provenance', async ({ page }) => {
  const { panel, requests } = await openVolumePanel(page);
  const before = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const source = useStudioStore.getState().manuscript;
    return { head: source.headRevisionId, content: JSON.stringify([source.sections, source.agents, source.extensions]) };
  });
  await panel.getByLabel('Title', { exact: true }).selectOption('pull');
  await panel.getByLabel('I approve the selected changes').check();
  await panel.getByRole('button', { name: 'Import into OMI', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Selected fields reconciled.');
  const after = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const source = useStudioStore.getState().manuscript;
    return { title: source.title, head: source.headRevisionId, content: JSON.stringify([source.sections, source.agents, source.extensions]) };
  });
  expect(after.title).toBe('Volume');
  expect(after.head).not.toBe(before.head);
  expect(after.content).toBe(before.content);
  expect(requests.filter(request => request.action === 'apply')).toEqual([]);
});

test('OMP comparison becomes unusable after a local edit', async ({ page }) => {
  const { panel, requests } = await openVolumePanel(page);
  await panel.getByLabel('Title', { exact: true }).selectOption('push');
  await panel.getByLabel('I approve the selected changes').check();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    useStudioStore.getState().setTitle('New local edit');
  });
  await expect(panel.getByRole('alert')).toContainText('Inspect again');
  await expect(panel.getByRole('button', { name: 'Send to OMP', exact: true })).toHaveCount(0);
  expect(requests.filter(request => request.action === 'apply')).toEqual([]);
});
