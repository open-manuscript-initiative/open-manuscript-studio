import assert from 'node:assert/strict';
import test from 'node:test';

import { downloadBlobInBrowser } from '../src/services/browserBlobDownload.ts';

interface BrowserHarness {
  observedBlob: Blob | undefined;
  href: string;
  filename: string;
  rel: string;
  clicked: number;
  appended: number;
  removed: number;
  revoked: string[];
  release: () => void;
  restore: () => void;
}

/** Minimal, side-effect-free mock of the browser download DOM. */
function mockBrowser(throwOnClick = false): BrowserHarness {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalTimeout = globalThis.setTimeout;
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  const state: BrowserHarness = {
    observedBlob: undefined, href: '', filename: '', rel: '',
    clicked: 0, appended: 0, removed: 0, revoked: [],
    release: () => {}, restore: () => {},
  };

  const anchor = {
    set href(value: string) { state.href = value; },
    get href() { return state.href; },
    set download(value: string) { state.filename = value; },
    get download() { return state.filename; },
    set rel(value: string) { state.rel = value; },
    get rel() { return state.rel; },
    click() {
      state.clicked += 1;
      if (throwOnClick) throw new Error('simulated download failure');
    },
    remove() { state.removed += 1; },
  };

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'a');
        return anchor;
      },
      body: {
        appendChild(element: unknown) {
          assert.equal(element, anchor);
          state.appended += 1;
        },
      },
    },
  });

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (value: Blob) => {
      state.observedBlob = value;
      return 'blob:https://studio.example.test/secure-download';
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (value: string) => { state.revoked.push(value); },
  });
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    assert.equal(delay, 30_000);
    state.release = callback;
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  state.restore = () => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
    globalThis.setTimeout = originalTimeout;
  };
  return state;
}

test('CodeQL #74: authored HTML exports are delivered as inert, byte-identical downloads', async () => {
  const browser = mockBrowser();
  try {
    const html = '<!DOCTYPE html><html><body><img src=x onerror=alert(1)> &amp; é</body></html>';
    const source = new Blob([html], { type: 'text/html' });
    downloadBlobInBrowser(source, 'kézirat.html');

    assert.equal(source.type, 'text/html', 'do not mutate the canonical export');
    assert.notEqual(browser.observedBlob, source);
    assert.equal(browser.observedBlob?.type, 'application/octet-stream');
    assert.equal(await browser.observedBlob?.text(), html, 'do not strip or rewrite authored markup');
    assert.equal(browser.href, 'blob:https://studio.example.test/secure-download');
    assert.equal(browser.filename, 'kézirat.html');
    assert.equal(browser.rel, 'noopener noreferrer');
    assert.equal(browser.appended, 1);
    assert.equal(browser.clicked, 1);
    assert.equal(browser.removed, 1);
    assert.deepEqual(browser.revoked, []);
    browser.release();
    assert.deepEqual(browser.revoked, ['blob:https://studio.example.test/secure-download']);
  } finally {
    browser.restore();
  }
});

test('temporary object URLs are revoked and anchors removed even after failed download', () => {
  const browser = mockBrowser(true);
  try {
    assert.throws(
      () => downloadBlobInBrowser(new Blob(['{"valid":true}'], { type: 'application/json' }), 'result.json'),
      /simulated download failure/,
    );
    assert.equal(browser.removed, 1);
    assert.equal(browser.observedBlob?.type, 'application/octet-stream');
    browser.release();
    assert.equal(browser.revoked.length, 1);
  } finally {
    browser.restore();
  }
});

test('binary OMI package exports remain byte-for-byte identical', async () => {
  const browser = mockBrowser();
  try {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x80, 0x00]);
    downloadBlobInBrowser(new Blob([bytes], { type: 'application/zip' }), 'manuscript.omi');
    assert.deepEqual(new Uint8Array(await browser.observedBlob!.arrayBuffer()), bytes);
    assert.equal(browser.observedBlob?.type, 'application/octet-stream');
    assert.equal(browser.filename, 'manuscript.omi');
  } finally {
    browser.restore();
  }
});
