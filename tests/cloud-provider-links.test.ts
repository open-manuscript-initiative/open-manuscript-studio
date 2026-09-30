import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { OAuthCloudProvider } from '../server/src/cloud/providers/oauth/OAuthCloudProvider.ts';

const bytes = Buffer.from('omi package');

test('Google Drive upload resolves a web link when the upload response omits it', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (input) => {
    const url = String(input);
    if (url.includes('/upload/drive/v3/files')) {
      return new Response(JSON.stringify({ id: 'google-file-1', name: 'manuscript.omi.zip' }), { status: 200 });
    }
    if (url.includes('/drive/v3/files/google-file-1')) {
      return new Response(JSON.stringify({ webViewLink: 'https://drive.google.com/file/d/google-file-1/view' }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  try {
    const provider = new OAuthCloudProvider({ provider: 'google-drive', accessToken: 'token', rootPath: '' });
    const uploaded = await provider.upload({ path: 'manuscript.omi.zip', data: bytes });
    assert.equal(uploaded.webUrl, 'https://drive.google.com/file/d/google-file-1/view');
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally {
    fetchMock.mock.restore();
  }
});

test('Google Drive upload supplies a canonical link if metadata lookup also omits it', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (input) => {
    const url = String(input);
    if (url.includes('/upload/drive/v3/files')) return new Response(JSON.stringify({ id: 'google-file-2' }), { status: 200 });
    if (url.includes('/drive/v3/files/google-file-2')) return new Response(JSON.stringify({}), { status: 200 });
    throw new Error(`Unexpected request: ${url}`);
  });
  try {
    const provider = new OAuthCloudProvider({ provider: 'google-drive', accessToken: 'token', rootPath: '' });
    const uploaded = await provider.upload({ path: 'manuscript.omi.zip', data: bytes });
    assert.equal(uploaded.webUrl, 'https://drive.google.com/open?id=google-file-2');
  } finally {
    fetchMock.mock.restore();
  }
});

test('OneDrive upload resolves a web link when the upload response omits it', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (input) => {
    const url = String(input);
    if (url.includes('/content')) return new Response(JSON.stringify({ id: 'onedrive-file-1', name: 'manuscript.omi.zip' }), { status: 200 });
    if (url.includes('/drive/items/onedrive-file-1')) return new Response(JSON.stringify({ webUrl: 'https://onedrive.live.com/?id=onedrive-file-1' }), { status: 200 });
    throw new Error(`Unexpected request: ${url}`);
  });
  try {
    const provider = new OAuthCloudProvider({ provider: 'onedrive', accessToken: 'token', rootPath: '' });
    const uploaded = await provider.upload({ path: 'manuscript.omi.zip', data: bytes });
    assert.equal(uploaded.webUrl, 'https://onedrive.live.com/?id=onedrive-file-1');
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally {
    fetchMock.mock.restore();
  }
});
