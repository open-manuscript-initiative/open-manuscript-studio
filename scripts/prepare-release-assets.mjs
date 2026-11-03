import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RELEASE_ASSETS = Object.freeze([
  ['linux-x86_64', '.AppImage', 'Open-Manuscript-Studio-Linux-x64.AppImage'],
  ['linux-x86_64', '.deb', 'Open-Manuscript-Studio-Linux-x64.deb'],
  ['windows-x86_64', '.exe', 'Open-Manuscript-Studio-Windows-x64-Setup.exe'],
  ['windows-x86_64', '.msi', 'Open-Manuscript-Studio-Windows-x64.msi'],
  ['android', 'Open-Manuscript-Studio-Android-universal.apk', 'Open-Manuscript-Studio-Android-universal.apk'],
  ['macos-aarch64', '.dmg', 'Open-Manuscript-Studio-macOS-Apple-Silicon.dmg'],
  ['macos-x86_64', '.dmg', 'Open-Manuscript-Studio-macOS-Intel.dmg'],
].map(row => Object.freeze(row)));

async function regularFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    // Native .app bundles may contain symlinks. Never follow them outside
    // the downloaded archive, and never select one as a release installer.
    if (entry.isDirectory()) result.push(...await regularFiles(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

export async function hashReleaseAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = RELEASE_ASSETS.map(row => row[2]).sort();
  const files = entries.filter(entry => entry.name !== 'SHA256SUMS.txt');
  if (files.some(entry => !entry.isFile()) ||
      JSON.stringify(files.map(entry => entry.name).sort()) !== JSON.stringify(names)) {
    throw new Error('RC_RELEASE_ASSET_SET_MISMATCH');
  }
  const hashes = {};
  for (const name of names) {
    const digest = createHash('sha256');
    let bytes = 0;
    for await (const chunk of createReadStream(join(directory, name))) {
      digest.update(chunk); bytes += chunk.length;
    }
    if (bytes === 0) throw new Error('RC_EMPTY_RELEASE_ASSET: ' + name);
    hashes[name] = digest.digest('hex');
  }
  return hashes;
}

export function checksumManifest(hashes) {
  return Object.keys(hashes).sort().map(name => hashes[name] + '  ' + name + '\n').join('');
}

export async function prepareReleaseAssets(inputDirectory, outputDirectory) {
  const inputs = new Map();
  const selected = [];
  for (const [platform, suffix, name] of RELEASE_ASSETS) {
    if (!inputs.has(platform)) inputs.set(platform,
      await regularFiles(join(inputDirectory, 'open-manuscript-studio-' + platform)));
    const matches = inputs.get(platform).filter(path => suffix.startsWith('.')
      ? path.endsWith(suffix) : basename(path) === suffix);
    if (matches.length !== 1) throw new Error('RC_ASSET_MISSING_OR_AMBIGUOUS: ' + name);
    selected.push([matches[0], name]);
  }
  // Require a fresh output directory: never overwrite previously reviewed bytes.
  await mkdir(outputDirectory);
  for (const [input, name] of selected) await copyFile(input, join(outputDirectory, name));
  const hashes = await hashReleaseAssets(outputDirectory);
  await writeFile(join(outputDirectory, 'SHA256SUMS.txt'), checksumManifest(hashes), { flag: 'wx' });
  return hashes;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: prepare-release-assets.mjs <download-directory> <new-output-directory>');
    await prepareReleaseAssets(resolve(process.argv[2]), resolve(process.argv[3]));
    console.log('Prepared 7 release assets and SHA256SUMS.txt; signatures require separate verification.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
