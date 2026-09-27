import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('session endpoint rejects wrong code and issues a signed room-scoped token', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'omi-collab-server-'));
  const port = 32000 + Math.floor(Math.random() * 1000);
  const appDir = fileURLToPath(new URL('../', import.meta.url));
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: appDir,
    env: {
      ...process.env,
      DEMO_ACCESS_CODE: 'test-access-code-123456',
      DEMO_TOKEN_SECRET: 'test-signing-secret-with-32-bytes-minimum',
      DEMO_HTTP_PORT: String(port),
      DEMO_WS_PORT: String(port + 1),
      DEMO_ALLOWED_ORIGIN: 'http://127.0.0.1:5173',
      DEMO_STORAGE_DIR: directory,
    },
    stdio: 'ignore',
  });
  let exit;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        if ((await fetch('http://127.0.0.1:' + port + '/healthz')).ok) { ready = true; break; }
      } catch {}
      await new Promise((resolve) => { setTimeout(resolve, 100); });
    }
    assert.equal(ready, true, 'server should become ready');

    const denied = await fetch('http://127.0.0.1:' + port + '/api/session', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ accessCode: 'wrong-code', displayName: 'Ada' }),
    });
    assert.equal(denied.status, 401);

    const accepted = await fetch('http://127.0.0.1:' + port + '/api/session', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ accessCode: 'test-access-code-123456', displayName: 'Ada' }),
    });
    assert.equal(accepted.status, 200);
    const session = await accepted.json();
    assert.match(session.token, /^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/);
    assert.equal(session.room, 'omi-sponsor-demo-synthetic-manuscript-v1');
  } finally {
    exit = new Promise((resolve) => { child.once('exit', resolve); });
    child.kill('SIGTERM');
    await Promise.race([exit, new Promise((resolve) => { setTimeout(resolve, 3000); })]);
    child.kill('SIGKILL');
    await rm(directory, { recursive: true, force: true });
  }
});
