import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';

const ROOM = 'omi-sponsor-demo-synthetic-manuscript-v1';
const httpPort = Number(process.env.DEMO_HTTP_PORT || 3020);
const wsPort = Number(process.env.DEMO_WS_PORT || 3021);
const accessCode = process.env.DEMO_ACCESS_CODE || '';
const secret = process.env.DEMO_TOKEN_SECRET || '';
const allowedOrigin = process.env.DEMO_ALLOWED_ORIGIN || 'http://127.0.0.1:5173';
const wsUrl = process.env.DEMO_PUBLIC_WS_URL || 'ws://127.0.0.1:' + wsPort;
const storageDir = path.resolve(process.env.DEMO_STORAGE_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data'));
const stateFile = path.join(storageDir, ROOM + '.yjs');
const attempts = new Map();
let pendingWrite = Promise.resolve();

if (accessCode.length < 12) throw new Error('DEMO_ACCESS_CODE must have at least 12 characters.');
if (Buffer.byteLength(secret) < 32) throw new Error('DEMO_TOKEN_SECRET must have at least 32 bytes.');
if (!Number.isInteger(httpPort) || !Number.isInteger(wsPort) || httpPort === wsPort) throw new Error('HTTP and WebSocket ports must be distinct integers.');

const securityHeaders = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

function send(response, status, value) {
  response.writeHead(status, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function equalSecret(expected, supplied) {
  const left = Buffer.from(String(expected));
  const right = Buffer.from(String(supplied));
  return left.length === right.length && timingSafeEqual(left, right);
}

function issueToken(name) {
  const displayName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  if (displayName.length < 2) throw new Error('Enter a display name of at least two characters.');
  const payload = Buffer.from(JSON.stringify({
    name: displayName,
    room: ROOM,
    exp: Math.floor(Date.now() / 1000) + 7200,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + signature;
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = createHmac('sha256', secret).update(parts[0]).digest('base64url');
  const left = Buffer.from(expected);
  const right = Buffer.from(parts[1]);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (value.room !== ROOM || value.exp <= Math.floor(Date.now() / 1000)) return null;
    if (typeof value.name !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

async function bodyJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function allowAttempt(request) {
  const ip = request.headers['x-real-ip'] || request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || now - current.started > 300000) {
    attempts.set(ip, { started: now, count: 1 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

async function loadState() {
  try {
    return await readFile(stateFile);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function saveState(bytes) {
  pendingWrite = pendingWrite.then(async () => {
    await mkdir(storageDir, { recursive: true, mode: 0o700 });
    const temp = stateFile + '.' + randomUUID() + '.tmp';
    await writeFile(temp, Buffer.from(bytes), { mode: 0o600 });
    await rename(temp, stateFile);
  });
  return pendingWrite;
}

const api = createServer(async (request, response) => {
  const route = new URL(request.url || '/', 'http://localhost').pathname;
  if (request.method === 'GET' && route === '/healthz') {
    send(response, 200, { status: 'ok', profile: 'single-node-synthetic-demo' });
    return;
  }
  if (request.method !== 'POST' || route !== '/api/session') {
    send(response, 404, { error: 'Not found.' });
    return;
  }
  if (request.headers.origin !== allowedOrigin) {
    send(response, 403, { error: 'This origin is not allowed.' });
    return;
  }
  if (!allowAttempt(request)) {
    response.setHeader('retry-after', '300');
    send(response, 429, { error: 'Too many access attempts. Try again later.' });
    return;
  }
  try {
    const body = await bodyJson(request);
    if (!equalSecret(accessCode, body.accessCode || '')) {
      send(response, 401, { error: 'The access code is incorrect.' });
      return;
    }
    send(response, 200, { token: issueToken(body.displayName), expiresIn: 7200, room: ROOM, webSocketUrl: wsUrl });
  } catch (error) {
    send(response, 400, { error: error instanceof Error ? error.message : 'Invalid request.' });
  }
});

const collaboration = new Server({
  port: wsPort,
  address: process.env.DEMO_WS_BIND || '127.0.0.1',
  quiet: true,
  debounce: 750,
  maxDebounce: 3000,
  websocketOptions: { maxPayload: 1024 * 1024 },
  async onAuthenticate({ token, documentName, requestHeaders }) {
    const origin = requestHeaders?.origin;
    const session = verifyToken(token);
    if (origin !== allowedOrigin) throw new Error('Origin is not allowed.');
    if (!session || documentName !== ROOM) throw new Error('The demo session is invalid or expired.');
    return { user: { name: session.name } };
  },
  async onLoadDocument({ documentName, document }) {
    if (documentName !== ROOM) throw new Error('Unknown demo room.');
    const saved = await loadState();
    if (saved) Y.applyUpdate(document, saved);
  },
  async onStoreDocument({ documentName, document }) {
    if (documentName === ROOM) await saveState(Y.encodeStateAsUpdate(document));
  },
});

await mkdir(storageDir, { recursive: true, mode: 0o700 });
await new Promise((resolve, reject) => {
  api.once('error', reject);
  api.listen(httpPort, '127.0.0.1', resolve);
});
await collaboration.listen();

console.log('Synthetic collaboration demo is listening on loopback.');

async function shutdown() {
  api.close();
  await collaboration.destroy();
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
