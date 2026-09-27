import { expect, test } from '@playwright/test';
import { installMockStudioApi } from './support/mockStudioApi';

test('an invited author must explicitly accept with the invited Studio account', async ({ page }) => {
  const api = await installMockStudioApi(page, {
    authenticated: true,
    collaboration: {
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
  await expect(page.getByRole('heading', { name: 'No document is open' })).toBeVisible();
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

test('a signed-in author can accept or decline invitations in the Studio inbox', async ({ page }) => {
  const api = await installMockStudioApi(page, {
    authenticated: true,
    collaboration: {
      enabled: true,
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
  await expect(inbox.getByRole('status')).toContainText('Open that OMI manuscript');
  expect(api.unhandledRequests).toEqual([]);
});
