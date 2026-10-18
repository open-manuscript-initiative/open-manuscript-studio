import assert from 'node:assert/strict';
import test from 'node:test';
import { studioApiFetch } from '../src/platform/studioApiTransport.ts';
import { persistNativeServerSelection } from '../src/platform/nativeServerSelection.ts';

test('integration transport resolves each native origin anew and never carries the old bearer across a switch', async () => {
  const descriptors = ['location','localStorage','fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const values = new Map<string,string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value: string) => { values.set(key,value); }, removeItem: (key: string) => { values.delete(key); } };
  const calls: Array<{ url: string; headers: Headers }> = [];
  try {
    Object.defineProperty(globalThis, 'location', { configurable:true, value:{ protocol:'tauri:',hostname:'localhost' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:storage });
    Object.defineProperty(globalThis, 'fetch', { configurable:true, value:async (url: string, init: RequestInit) => { calls.push({url,headers:new Headers(init.headers)}); return new Response('{}'); } });
    persistNativeServerSelection('https://one.example', storage);
    storage.setItem('omi_native_session_token','synthetic-old-token');
    await studioApiFetch('/api/v1/eurooffice/status');
    persistNativeServerSelection('https://two.example', storage);
    await studioApiFetch('/api/v1/integrations/transkribus/connection');
    assert.equal(calls[0].url, 'https://one.example/api/v1/eurooffice/status');
    assert.equal(calls[0].headers.get('authorization'), 'Bearer synthetic-old-token');
    assert.equal(calls[1].url, 'https://two.example/api/v1/integrations/transkribus/connection');
    assert.equal(calls[1].headers.has('authorization'), false);
  } finally {
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key); }
  }
});
