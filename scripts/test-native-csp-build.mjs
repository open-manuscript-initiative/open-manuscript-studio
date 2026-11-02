import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

// Exercise the actual production bundle: dev mode injects scripts for React HMR
// which are intentionally incompatible with the native production policy.
const { app: { security: { csp } } } = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const policy = Object.entries(csp).map(([name, value]) => `${name} ${value}`).join('; ');
const server = await preview({
  preview: { host: '127.0.0.1', port: 0, headers: { 'Content-Security-Policy': policy } },
  plugins: [{
    name: 'native-csp-probe',
    configurePreviewServer(server) {
      server.middlewares.use('/__native-csp-probe.js', (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript');
        // Execute in a real script. DevTools page.evaluate can bypass the page's
        // string-compilation policy, so it cannot prove CSP enforcement itself.
        response.end('try { new Function("return true"); window.__nativeEvalBlocked = false; } catch { window.__nativeEvalBlocked = true; }');
      });
    },
  }],
});
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const page = await browser.newPage({ viewport: { width: 393, height: 851 }, isMobile: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = `http://127.0.0.1:${address.port}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.headers()['content-security-policy'], policy);
  await page.locator('.auth-card').waitFor({ state: 'visible', timeout: 30_000 });
  assert.deepEqual(errors, [], 'Native-policy production startup must not throw');
  await page.addScriptTag({ url: `${url}/__native-csp-probe.js` });
  assert.equal(await page.evaluate(() => globalThis.__nativeEvalBlocked), true, 'The test must keep unsafe-eval blocked');
  console.log('Production Studio mounts at mobile size with the native CSP; unsafe-eval stays blocked.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => {
    server.httpServer.close((error) => error ? reject(error) : resolve());
  });
}
