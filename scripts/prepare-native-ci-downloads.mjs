import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { downloadReleaseAsset } from './download-github-release-asset.mjs';

const temporaryRoot = () => process.env.RUNNER_TEMP || tmpdir();

export function gradleRelease(source) {
  const value = /^distributionUrl\s*[=:](.*)$/m.exec(source)?.[1]?.trim().replaceAll('\\:', ':');
  const match = /^https:\/\/(?:services|downloads)\.gradle\.org\/distributions\/gradle-(\d+\.\d+(?:\.\d+)?)-(bin|all)\.zip$/.exec(value ?? '');
  if (!match) throw new Error('Expected an official generated Gradle distribution URL.');
  return { tag: `v${match[1]}`, assetName: `gradle-${match[1]}-${match[2]}.zip` };
}

export async function prepareGradle(properties = resolve('src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties')) {
  const source = await readFile(properties, 'utf8');
  const release = gradleRelease(source);
  const destination = join(temporaryRoot(), 'omi-native-downloads', release.assetName);
  const sha256 = await downloadReleaseAsset({ repository: 'gradle/gradle-distributions', ...release,
    destination, sha256: /^distributionSha256Sum\s*[=:](.*)$/m.exec(source)?.[1]?.trim() });
  let result = source.replace(/^distributionUrl\s*[=:].*$/m,
    `distributionUrl=${pathToFileURL(destination).href}`);
  result = /^distributionSha256Sum\s*[=:]/m.test(result)
    ? result.replace(/^distributionSha256Sum\s*[=:].*$/m, `distributionSha256Sum=${sha256}`)
    : `${result.trimEnd()}\ndistributionSha256Sum=${sha256}\n`;
  await writeFile(properties, result);
  console.log(`Prepared verified official Gradle distribution: ${release.assetName}`);
}

async function prepareCodeql(language) {
  if (!['actions', 'javascript', 'java', 'rust'].includes(language)) throw new Error('Unsupported CodeQL bundle language.');
  const version = process.env.CODEQL_BUNDLE_VERSION || '2.27.4';
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a pinned CodeQL bundle version.');
  const assetName = `codeql-bundle-${language}-linux64.tar.zst`;
  await downloadReleaseAsset({ repository: 'github/codeql-action', tag: `codeql-bundle-v${version}`,
    assetName, destination: join(temporaryRoot(), assetName) });
  console.log(`Prepared verified official CodeQL ${version} ${language} bundle.`);
}

export async function prepareKotlinCompiler(version) {
  if (!['2.2.0', '2.2.21'].includes(version)) throw new Error('Expected the compiler used by an AGP compatibility test.');
  const artifact = `kotlin-compiler-embeddable-${version}.jar`;
  const destination = join(temporaryRoot(), 'omi-native-downloads', artifact);
  await downloadReleaseAsset({ repository: 'JetBrains/kotlin', tag: `v${version}`,
    assetName: artifact, destination });
  // Gradle's shared artifact store addresses files by their SHA-1. The downloaded
  // bytes have already passed SHA-256 verification against the official release.
  const hash = createHash('sha1');
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
  const directory = join(process.env.GRADLE_USER_HOME || join(homedir(), '.gradle'),
    'caches/modules-2/files-2.1/org.jetbrains.kotlin/kotlin-compiler-embeddable', version, hash.digest('hex'));
  await mkdir(directory, { recursive: true });
  await cp(destination, join(directory, artifact));
  console.log(`Prepared verified Kotlin ${version} compiler in the Gradle artifact cache.`);
}

function expandZip(archive, destination) {
  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $env:OMI_TOOL_ARCHIVE -DestinationPath $env:OMI_TOOL_DESTINATION -Force"], {
    stdio: 'inherit', env: { ...process.env, OMI_TOOL_ARCHIVE: archive, OMI_TOOL_DESTINATION: destination },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Official bundler tool archive extraction failed.');
}

async function prepareBundler() {
  if (!['linux', 'win32'].includes(process.platform)) return;
  const cacheRoot = process.platform === 'win32'
    ? process.env.LOCALAPPDATA : process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  if (!cacheRoot) throw new Error('Tauri bundler cache directory is unavailable.');
  const tools = join(cacheRoot, 'tauri');
  await mkdir(tools, { recursive: true });
  if (process.platform === 'linux') {
    for (const [tag, assetName, filename] of [
      ['apprun-old', 'AppRun-x86_64', 'AppRun-x86_64'],
      ['linuxdeploy-07333c6', 'linuxdeploy-x86_64.AppImage', 'linuxdeploy-07333c6-x86_64.AppImage'],
    ]) {
      const destination = join(tools, filename);
      await downloadReleaseAsset({ repository: 'tauri-apps/binary-releases', tag, assetName, destination });
      await chmod(destination, 0o770);
    }
  } else {
    const downloads = join(temporaryRoot(), 'omi-native-downloads');
    const wix = join(downloads, 'wix314-binaries.zip');
    await downloadReleaseAsset({ repository: 'wixtoolset/wix3', tag: 'wix3141rtm',
      assetName: 'wix314-binaries.zip', destination: wix,
      // Same SHA-256 pinned by Tauri's MSI bundler.
      sha256: '6ac824e1642d6f7277d0ed7ea09411a508f6116ba6fae0aa5f2c7daa2ff43d31' });
    expandZip(wix, join(tools, 'WixTools314'));
    const nsis = join(downloads, 'nsis-3.13.zip');
    await downloadReleaseAsset({ repository: 'tauri-apps/binary-releases', tag: 'nsis-3.13',
      assetName: 'nsis-3.13.zip', destination: nsis });
    expandZip(nsis, join(downloads, 'nsis-expanded'));
    await cp(join(downloads, 'nsis-expanded', 'nsis-3.13'), join(tools, 'NSIS'), { recursive: true, force: true });
    await downloadReleaseAsset({ repository: 'tauri-apps/nsis-tauri-utils', tag: 'nsis_tauri_utils-v0.5.3',
      assetName: 'nsis_tauri_utils.dll',
      destination: join(tools, 'NSIS', 'Plugins', 'x86-unicode', 'additional', 'nsis_tauri_utils.dll') });
  }
  console.log('Prepared verified official Tauri bundler tools.');
}

async function main() {
  switch (process.argv[2]) {
    case 'gradle': return prepareGradle();
    case 'codeql': return prepareCodeql(process.argv[3]);
    case 'kotlin': return prepareKotlinCompiler(process.argv[3]);
    case 'bundler': return prepareBundler();
    default: throw new Error('Expected gradle, kotlin, codeql or bundler.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
