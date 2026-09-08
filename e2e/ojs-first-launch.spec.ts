import { expect, test } from '@playwright/test';
import { installMockStudioApi } from './support/mockStudioApi';

test('first OJS launch survives effect replay and a late saved-session restore', async ({ page }) => {
  await installMockStudioApi(page, { authenticated: true });
  await page.goto('/');
  await expect(page.locator('section.editor')).toBeVisible();
  // Seed the real session database with the blank document from this visit.
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('omi-studio-session', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('session', 'readwrite');
      transaction.objectStore('session').put({
        version: 1,
        manuscript: useStudioStore.getState().manuscript,
        selectedSectionId: null,
        savedAt: new Date().toISOString(),
      }, 'last-session');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });

  await page.addInitScript(() => {
    const originalGet = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      const request = originalGet.call(this, key);
      if (this.name === 'session' && key === 'last-session') {
        Object.defineProperty(request, 'onsuccess', {
          set(handler: (event: Event) => void) {
            request.addEventListener('success', () => {
              setTimeout(() => {
                handler.call(request, new Event('success'));
                document.documentElement.dataset.sessionRestoreFinished = 'true';
              }, 3500);
            });
          },
        });
      }
      return request;
    };
  });

  let requests = 0;
  await page.route('**/integrations/ojs/handoff/first-launch-token', async (route) => {
    requests += 1;
    await route.fulfill({
      status: requests === 1 ? 200 : 410,
      contentType: 'application/json',
      body: JSON.stringify(requests === 1 ? {
        protocol: 'omi-integration/1',
        profile: 'omi-integration/1/ojs',
        submission: { externalId: '42', primaryLocale: 'en', title: { en: 'Imported article' } },
        sourceDocument: { kind: 'docx', paragraphs: [{ text: 'First launch imported body.' }] },
      } : { error: { message: 'Token already consumed.' } }),
    });
  });

  await page.goto('/?omiOjsLaunch=first-launch-token');
  const body = page.locator('section.editor').getByText('First launch imported body.', { exact: true });
  await expect(body).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-session-restore-finished', 'true');
  await expect(body).toBeVisible();
  expect(requests).toBe(1);
  await expect(page).not.toHaveURL(/omiOjsLaunch/);
});
