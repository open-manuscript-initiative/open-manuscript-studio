import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { fetchPinnedPublicUrl } from '../server/src/cloud/security/connectionPinnedHttp.ts';

test('user-configured outbound integration requests cannot connect to private literal endpoints', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    for (const target of [
      'https://127.0.0.1:3001/api/health',
      'https://169.254.169.254/latest/meta-data/',
      'https://10.0.0.8/',
      'https://[::1]/',
      'https://[::ffff:127.0.0.1]/',
    ]) {
      await assert.rejects(fetchPinnedPublicUrl(target, {
        headers: { Authorization: 'Bearer test-only-secret' },
      }), /private or reserved/);
    }
    await assert.rejects(
      fetchPinnedPublicUrl('http://example.com/path'),
      /HTTPS/,
    );
    await assert.rejects(
      fetchPinnedPublicUrl('https://public.example/path', { redirect: 'follow' }),
      /Automatic redirects/,
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('connection-pinned fetch preserves multipart bodies and never follows redirects', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const seen: Array<{ path: string; type: string; body: string }> = [];
  const http = createServer(async (req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/private' }).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk as Uint8Array));
    seen.push({
      path: req.url ?? '',
      type: String(req.headers['content-type'] ?? ''),
      body: Buffer.concat(chunks).toString('utf8'),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
  });
  try {
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const address = http.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const data = new FormData();
    data.set('description', 'test payload');
    data.set('manuscript', new Blob(['doc'], { type: 'text/plain' }), 'document.txt');
    const success = await fetchPinnedPublicUrl(base + '/upload', {
      method: 'POST',
      body: data,
    });
    assert.equal(success.status, 200);
    assert.equal(success.url, base + '/upload');
    assert.deepEqual(await success.json(), { ok: true });
    assert.equal(seen.length, 1);
    assert.match(seen[0]!.type, /^multipart\/form-data; boundary=/);
    assert.match(seen[0]!.body, /test payload/);
    assert.match(seen[0]!.body, /document.txt/);

    await assert.rejects(
      fetchPinnedPublicUrl(base + '/redirect', { redirect: 'error' }),
      /redirects are not permitted/,
    );
    const manual = await fetchPinnedPublicUrl(base + '/redirect', { redirect: 'manual' });
    assert.equal(manual.status, 302);
    assert.equal(manual.headers.get('location'), '/private');
    assert.equal(seen.length, 1, 'redirect must not be automatically followed');
  } finally {
    await new Promise<void>((resolve, reject) => http.close((err) => err ? reject(err) : resolve()));
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('all user-controlled PKP, publishing and AI outbound calls use pinned transport', () => {
  for (const path of [
    'server/src/integrations/ojs/ojsClient.ts',
    'server/src/integrations/omp/ompClient.ts',
    'server/src/integrations/ojs/reviewWriteback.ts',
    'server/src/integrations/omp/nativeWriteback.ts',
    'server/src/integrations/ojs/reviewForm.ts',
    'server/src/integrations/omp/reviewForm.ts',
    'server/src/integrations/ojs/reviewRecommendations.ts',
    'server/src/integrations/ojs/ojsAssignmentContext.ts',
    'server/src/routes/directSubmissionRoutes.ts',
    'server/src/routes/publicationVenueRoutes.ts',
    'server/src/integrations/publishing/webPublication.ts',
    'server/src/integrations/aiProviderClient.ts',
  ]) {
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.match(source, /fetchPinnedPublicUrl\(/, path);
    assert.doesNotMatch(source, /\bawait fetch\(/, path);
  }
});
