import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';

const REPOSITORIES = new Set(['github/codeql-action', 'tauri-apps/binary-releases',
  'tauri-apps/nsis-tauri-utils', 'wixtoolset/wix3', 'gradle/gradle-distributions',
  'JetBrains/kotlin', 'linuxdeploy/linuxdeploy-plugin-appimage']);

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function downloadReleaseAsset({ repository, tag, assetName, destination,
  sha256, fetchImpl = fetch, wait = delay }) {
  if (!REPOSITORIES.has(repository) || !tag || !assetName || !destination) {
    throw new Error('Expected a supported official release asset.');
  }
  const headers = { 'User-Agent': 'Open-Manuscript-CI', Accept: 'application/vnd.github+json' };
  async function request(url, accept, alternatives = []) {
    const sources = [url, ...alternatives];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const source = sources[(attempt - 1) % sources.length];
      let response;
      try {
        response = await fetchImpl(source, {
          headers: { ...headers, Accept: accept }, signal: AbortSignal.timeout(180_000),
        });
      } catch (error) {
        if (attempt === 4) throw error;
        await wait(attempt * 5000);
        continue;
      }
      if (response.ok) return response;
      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      await response.body?.cancel();
      if (!retryable || attempt === 4) throw new Error(`Official asset download failed at ${new URL(source).origin}: HTTP ${response.status}`);
      await wait(attempt * 5000);
    }
  }

  const release = await (await request(
    `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
    headers.Accept,
  )).json();
  const asset = release.assets?.find(item => item.name === assetName);
  if (!asset || !Number.isSafeInteger(asset.id) || asset.id <= 0) throw new Error('Official release asset is missing.');
  const publishedHash = /^sha256:([a-f0-9]{64})$/i.exec(asset.digest ?? '')?.[1]?.toLowerCase();
  if (sha256 && !/^[a-f0-9]{64}$/i.test(sha256)) throw new Error('Invalid pinned SHA-256.');
  const expectedHash = sha256?.toLowerCase() ?? publishedHash;
  if (!expectedHash || (publishedHash && publishedHash !== expectedHash)) throw new Error('Official asset SHA-256 is missing or inconsistent.');
  try {
    if (await hashFile(destination) === expectedHash) return expectedHash;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(destination), { recursive: true });
  const partial = `${destination}.partial`;
  try {
    // Use GitHub's asset API, which redirects to the same official release bytes.
    const response = await request(
      `https://api.github.com/repos/${repository}/releases/assets/${asset.id}`,
      'application/octet-stream',
      [
        `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`,
        ...(repository === 'gradle/gradle-distributions'
          ? [`https://downloads.gradle.org/distributions/${encodeURIComponent(assetName)}`] : []),
      ],
    );
    const hash = createHash('sha256');
    await pipeline(response.body, new Transform({ transform(chunk, encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    } }), createWriteStream(partial, { mode: 0o600 }));
    if (hash.digest('hex') !== expectedHash) throw new Error('Official release asset SHA-256 mismatch.');
    await rm(destination, { force: true });
    await rename(partial, destination);
    return expectedHash;
  } finally {
    await rm(partial, { force: true });
  }
}
