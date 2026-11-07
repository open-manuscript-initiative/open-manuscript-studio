import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

// Use Tauri's installed mock IPC/event implementation before any app modules
// execute. A marker-only __TAURI_INTERNALS__ cannot service native commands.
const tauriMocks = readFileSync(new URL('../../node_modules/@tauri-apps/api/mocks.js', import.meta.url), 'utf8')
  .replace(/^export \{[^\n]+\};?$/m, '');

export async function installMockAndroidRuntime(page: Page, options: {
  pending?: string[];
  files?: Record<string, number[]>;
} = {}): Promise<void> {
  await page.addInitScript({ content: `(() => {
    ${tauriMocks}
    const files = ${JSON.stringify(options.files ?? {})};
    let pending = ${JSON.stringify(options.pending ?? [])};
    const commands = [];
    mockIPC((command, args) => {
      commands.push(command);
      if (command === 'take_opened_documents') {
        const result = pending;
        pending = [];
        return result;
      }
      if (command === 'plugin:fs|read_file') {
        const bytes = files[args.path];
        if (!bytes) throw new Error('No mock document at ' + args.path);
        return bytes;
      }
      throw new Error('Unexpected Android IPC command: ' + command);
    }, { shouldMockEvents: true });
    mockWindows('main');
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36',
      configurable: true,
    });
    window.__OMI_MOCK_ANDROID__ = {
      commands,
      async deliver(uri) {
        pending.push(uri);
        await window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {
          event: 'omi-opened-documents', payload: null,
        });
      },
    };
  })();` });
}
