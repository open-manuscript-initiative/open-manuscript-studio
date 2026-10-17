import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

// Reproduce DocsAPI's DOM contract: replace the placeholder, use a fixed mobile
// iframe, and restore a fresh placeholder when the editor is destroyed.
const docsApi = `window.DocsAPI = { DocEditor: function(id, config) {
  const target = document.getElementById(id);
  const iframe = document.createElement('iframe');
  iframe.name = 'frameEditor';
  iframe.width = config.width;
  iframe.height = config.height;
  iframe.frameBorder = '0';
  iframe.src = 'https://eurooffice.example.test/editor.html';
  if (config.type === 'mobile') iframe.style.position = 'fixed';
  target.parentNode.replaceChild(iframe, target);
  this.destroyEditor = function() {
    const placeholder = document.createElement('div');
    placeholder.id = id;
    iframe.parentNode?.replaceChild(placeholder, iframe);
  };
} };`;

const editorPage = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#222;color:white;font:16px sans-serif}
header{padding:16px}button{position:fixed;right:12px;bottom:12px;width:64px;height:64px;border-radius:50%;border:0;background:#2563eb;color:white}
</style></head><body><header>EuroOffice mobile editor</header><button aria-label="Edit document" data-edit-count="0" onclick="this.dataset.editCount=String(Number(this.dataset.editCount)+1)">Edit</button></body></html>`;

async function installEuroOffice(page: Page) {
  await installMockStudioApi(page);
  const sessionTypes: string[] = [];
  await page.route('**/api/eurooffice/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/status')) {
      await route.fulfill({ json: { enabled: true } });
    } else if (url.pathname.endsWith('/session')) {
      const type = url.searchParams.get('type') ?? 'desktop';
      sessionTypes.push(type);
      await route.fulfill({ json: {
        apiScriptUrl: 'https://eurooffice.example.test/web-apps/apps/api/documents/api.js',
        config: { type, width: '100%', height: '100%', token: 'synthetic-config-token',
          documentType: 'word', document: { title: 'Layout regression.docx', fileType: 'docx', key: 'layout-regression', url: 'https://eurooffice.example.test/source.docx' },
          editorConfig: { lang: 'en', user: { id: 'synthetic', name: 'Layout test' }, customization: { compactHeader: true } },
        }, expiresAt: '2099-01-01T00:00:00Z',
      } });
    } else {
      await route.fulfill({ json: { documents: [{ id: 'layout-document', title: 'Layout regression', revision: 1,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }] } });
    }
  });
  await page.route('https://eurooffice.example.test/**', route => route.fulfill({
    contentType: route.request().url().endsWith('/api.js') ? 'application/javascript' : 'text/html',
    body: route.request().url().endsWith('/api.js') ? docsApi : editorPage,
  }));
  return sessionTypes;
}

async function expectEditorInsideWorkspace(page: Page) {
  const frame = page.locator('iframe[name="frameEditor"]');
  const edit = page.frameLocator('iframe[name="frameEditor"]').getByRole('button', { name: 'Edit document' });
  await expect(edit).toBeVisible();
  const workspace = await page.locator('.plain-document-workspace').boundingBox();
  const bounds = await frame.boundingBox();
  const button = await edit.boundingBox();
  expect(workspace).not.toBeNull(); expect(bounds).not.toBeNull(); expect(button).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(workspace!.y);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(workspace!.y + workspace!.height + 1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(workspace!.x + workspace!.width + 1);
  expect(button!.y + button!.height).toBeLessThanOrEqual(workspace!.y + workspace!.height - 4);
  const before = Number(await edit.getAttribute('data-edit-count'));
  await edit.click();
  await expect(edit).toHaveAttribute('data-edit-count', String(before + 1));
}

for (const native of [false, true]) {
  test(`EuroOffice keeps the entire bottom action inside its host in ${native ? 'Android WebView' : 'mobile browser'}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 393, height: 873 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const sessionTypes = await installEuroOffice(page);
    await signInToStudio(page);
    await page.evaluate(isNative => { Object.assign(window, { isTauri: isNative }); }, native);
    // Browser emulation has no Android window insets. Model the status/navigation
    // areas explicitly so the test checks the frame against its usable host.
    await page.addStyleTag({ content: '.plain-document-workspace{top:24px!important;bottom:48px!important}' });
    await page.evaluate(() => {
      const navigation = document.createElement('div');
      navigation.style.cssText = 'position:fixed;bottom:0;left:0;right:0;height:48px;background:#ddd;z-index:2147483647';
      document.body.append(navigation);
    });
    await page.getByRole('button', { name: /^Everyday DOCX documents/ }).click();
    await page.getByRole('button', { name: /^Layout regression/ }).click();
    await expectEditorInsideWorkspace(page);
    await page.locator('iframe[name="frameEditor"]').evaluate(frame => { frame.setAttribute('data-original-frame', 'true'); });
    const sessionsBeforeResize = sessionTypes.length;
    for (const size of [{ width: 393, height: 500 }, { width: 873, height: 393 }, { width: 393, height: 873 }]) {
      await page.setViewportSize(size);
      await expectEditorInsideWorkspace(page);
      await expect(page.locator('iframe[name="frameEditor"]')).toHaveAttribute('data-original-frame', 'true');
    }
    expect(sessionTypes.length).toBe(sessionsBeforeResize);
    expect(sessionTypes.at(-1)).toBe('mobile');
    await page.screenshot({ path: testInfo.outputPath('eurooffice-bottom-control.png'), fullPage: true });
    await page.getByRole('button', { name: 'Document actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'My documents', exact: true }).click();
    await expect(page.locator('iframe[name="frameEditor"]')).toHaveCount(0);
    await page.getByRole('button', { name: /^Layout regression/ }).click();
    await expectEditorInsideWorkspace(page);
    await page.getByRole('button', { name: 'Document actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Close', exact: true }).click();
    await expect(page.locator('.plain-document-workspace')).toHaveCount(0);
    await expect(page.locator('iframe[name="frameEditor"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('EuroOffice also keeps the desktop editor inside its persistent host', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sessionTypes = await installEuroOffice(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^Everyday DOCX documents/ }).click();
  await page.getByRole('button', { name: /^Layout regression/ }).click();
  await expectEditorInsideWorkspace(page);
  expect(sessionTypes.at(-1)).toBe('desktop');
  await page.setViewportSize({ width: 1024, height: 700 });
  await expectEditorInsideWorkspace(page);
  await page.getByRole('button', { name: 'Document actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Close', exact: true }).click();
  await expect(page.locator('iframe[name="frameEditor"]')).toHaveCount(0);
});
