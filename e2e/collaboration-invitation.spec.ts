import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installMockStudioApi } from './support/mockStudioApi';

const sharedPackageBase64 = readFile(new URL('./fixtures/shared-manuscript.omi', import.meta.url))
  .then((bytes) => bytes.toString('base64'));

test('an invited author must explicitly accept with the invited Studio account', async ({ page }) => {
  const api = await installMockStudioApi(page, {
    authenticated: true,
    collaboration: {
      packageBase64: await sharedPackageBase64,
      invitation: {
        email: 'editor@example.test',
        role: 'AUTHOR',
        documentId: 'manuscript-e2e',
        documentTitle: 'Shared E2E manuscript',
        status: 'pending',
      },
    },
  });

  await page.goto('/?collaborationInvite=one-time-invitation-token');
  await expect(page.getByRole('heading', { name: 'Manuscript collaboration invitation' })).toBeVisible();
  await expect(page.getByText('Shared E2E manuscript', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(page.getByText('Test manuscript', { exact: true }).first()).toBeVisible();
  expect(api.unhandledRequests).toEqual([]);
});

test('an invitation cannot be accepted from a different signed-in email', async ({ page }) => {
  await installMockStudioApi(page, {
    authenticated: true,
    collaboration: {
      invitation: {
        email: 'invited@example.test',
        role: 'AUTHOR',
        documentId: 'manuscript-e2e',
        documentTitle: 'Shared E2E manuscript',
        status: 'pending',
      },
    },
  });

  await page.goto('/?collaborationInvite=one-time-invitation-token');
  await expect(page.getByRole('button', { name: 'Accept invitation' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('invited email address');
});

test('the Studio inbox appears for a pending invitation and closes after acceptance', async ({ page }) => {
  const api = await installMockStudioApi(page, {
    authenticated: true,
    collaboration: {
      enabled: true,
      packageBase64: await sharedPackageBase64,
      pendingInvitations: [{
        id: '30000000-0000-4000-8000-000000000003',
        documentId: 'manuscript-e2e',
        documentTitle: 'Inbox manuscript',
        role: 'AUTHOR',
        status: 'pending',
        createdAt: '2026-09-27T00:00:00.000Z',
        expiresAt: '2026-10-04T00:00:00.000Z',
      }],
    },
  });

  await page.goto('/');
  const inbox = page.getByRole('complementary', { name: 'Manuscript invitations' });
  await expect(inbox.getByText('Inbox manuscript')).toBeVisible();
  await inbox.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(inbox).toHaveCount(0);
  expect(api.unhandledRequests).toEqual([]);
});

test('accepted shared documents do not keep the invitation popup visible', async ({ page }) => {
  const api = await installMockStudioApi(page, {
    authenticated: true,
    collaboration: {
      enabled: true,
      sharedDocuments: [{
        documentId: 'shared-manuscript-e2e',
        title: 'Already accepted manuscript',
        role: 'AUTHOR',
        packageUpdatedAt: '2026-09-29T00:00:00.000Z',
      }],
    },
  });

  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Manuscript invitations' })).toHaveCount(0);
  expect(api.unhandledRequests).toEqual([]);
});
