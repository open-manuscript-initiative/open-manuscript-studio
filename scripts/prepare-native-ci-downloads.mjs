import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
  const embeddedVersion = await prepareBundledKotlinCompiler(destination);
  try {
    const rootBuild = await readFile(resolve(dirname(properties), '../../build.gradle.kts'), 'utf8');
    const pluginVersion = /org\.jetbrains\.kotlin:kotlin-gradle-plugin:(\d+\.\d+\.\d+)/.exec(rootBuild)?.[1];
    if (pluginVersion && pluginVersion !== embeddedVersion) await prepareKotlinCompiler(pluginVersion);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
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
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected an exact Kotlin compiler version.');
  const artifact = `kotlin-compiler-embeddable-${version}.jar`;
  const destination = join(temporaryRoot(), 'omi-native-downloads', artifact);
  await downloadReleaseAsset({ repository: 'JetBrains/kotlin', tag: `v${version}`,
    assetName: artifact, destination });
  await seedKotlinCompiler(destination, version);
}

export async function prepareBundledKotlinCompiler(distribution) {
  // The enclosing Gradle archive has already passed official SHA-256 validation.
  const result = spawnSync('python3', ['-c', `
import json, re, sys, zipfile
from pathlib import Path
with zipfile.ZipFile(sys.argv[1]) as archive:
    pattern = re.compile(r'^gradle-[^/]+/lib/kotlin-compiler-embeddable-(\\d+\\.\\d+\\.\\d+)\\.jar$')
    matches = [(name, pattern.match(name)) for name in archive.namelist() if pattern.match(name)]
    if len(matches) != 1:
        raise RuntimeError('Expected exactly one bundled Kotlin compiler')
    name, match = matches[0]
    destination = Path(sys.argv[2]) / Path(name).name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(archive.read(name))
    print(json.dumps({'path': str(destination), 'version': match.group(1)}))
`, distribution, join(temporaryRoot(), 'omi-native-downloads')], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Bundled Kotlin compiler extraction failed: ${result.stderr}`);
  const compiler = JSON.parse(result.stdout);
  await seedKotlinCompiler(compiler.path, compiler.version);
  return compiler.version;
}

// Gradle's SHA-256-verified distribution includes Kotlin compiler 2.3.21.
// Copying it to ~/.gradle/caches alone does not provide Maven module metadata.
// A local, narrowly scoped Maven repository prevents a redundant remote HEAD
// request that repeatedly returned HTTP 504 during the Android CI build.
export function verifiedKotlinCompilerPom(version) {
  if (version !== '2.3.21') throw new Error('Kotlin compiler metadata requires explicit review for a new version.');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<project xmlns="http://maven.apache.org/POM/4.0.0">',
    '<modelVersion>4.0.0</modelVersion>',
    '<groupId>org.jetbrains.kotlin</groupId>',
    '<artifactId>kotlin-compiler-embeddable</artifactId>',
    '<version>' + version + '</version><packaging>jar</packaging>',
    '<dependencies>',
    '<dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-stdlib</artifactId><version>2.3.21</version><scope>runtime</scope></dependency>',
    '<dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-script-runtime</artifactId><version>2.3.21</version><scope>runtime</scope></dependency>',
    '<dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-reflect</artifactId><version>1.6.10</version><scope>runtime</scope><exclusions><exclusion><groupId>*</groupId><artifactId>*</artifactId></exclusion></exclusions></dependency>',
    '<dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-daemon-embeddable</artifactId><version>2.3.21</version><scope>runtime</scope></dependency>',
    '<dependency><groupId>org.jetbrains.kotlinx</groupId><artifactId>kotlinx-coroutines-core-jvm</artifactId><version>1.8.0</version><scope>runtime</scope><exclusions><exclusion><groupId>*</groupId><artifactId>*</artifactId></exclusion></exclusions></dependency>',
    '</dependencies></project>',
  ].join('\n') + '\n';
}

export async function mirrorVerifiedKotlinCompiler(destination, version) {
  const gradleHome = process.env.GRADLE_USER_HOME || join(homedir(), '.gradle');
  const root = join(gradleHome, 'omi-verified-kotlin-maven');
  const module = join(root, 'org', 'jetbrains', 'kotlin', 'kotlin-compiler-embeddable', version);
  await mkdir(module, { recursive: true });
  await cp(destination, join(module, 'kotlin-compiler-embeddable-' + version + '.jar'));
  await writeFile(join(module, 'kotlin-compiler-embeddable-' + version + '.pom'), verifiedKotlinCompilerPom(version));

  const scriptDir = join(gradleHome, 'init.d');
  await mkdir(scriptDir, { recursive: true });
  const repoUri = JSON.stringify(pathToFileURL(root).href);
  const script = [
    '// Isolated CI-only repository, seeded from a verified official Gradle distribution.',
    'def verifiedKotlinRepo = new URI(' + repoUri + ')',
    'def addVerifiedKotlin = { repositories ->',
    '  repositories.exclusiveContent {',
    '    forRepository {',
    '      maven {',
    "        name = 'OMIVerifiedKotlinCompiler'",
    '        url = verifiedKotlinRepo',
    '        metadataSources { mavenPom() }',
    '      }',
    '    }',
    "    filter { includeModule('org.jetbrains.kotlin', 'kotlin-compiler-embeddable') }",
    '  }',
    '}',
    'gradle.settingsEvaluated { settings ->',
    '  addVerifiedKotlin(settings.dependencyResolutionManagement.repositories)',
    '}',
    'gradle.beforeProject { project ->',
    '  addVerifiedKotlin(project.repositories)',
    '}',
  ].join('\n') + '\n';
  await writeFile(join(scriptDir, 'omi-verified-kotlin.init.gradle'), script);
  console.log('Prepared verified local Maven Kotlin compiler module for Android CI.');
}

async function seedKotlinCompiler(destination, version) {
  const artifact = `kotlin-compiler-embeddable-${version}.jar`;
  // Gradle's shared artifact store addresses files by their SHA-1. The downloaded
  // bytes have already passed SHA-256 verification against the official release.
  const hash = createHash('sha1');
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
  const directory = join(process.env.GRADLE_USER_HOME || join(homedir(), '.gradle'),
    'caches/modules-2/files-2.1/org.jetbrains.kotlin/kotlin-compiler-embeddable', version, hash.digest('hex'));
  await mkdir(directory, { recursive: true });
  await cp(destination, join(directory, artifact));
  // Only the Gradle-embedded 2.3.21 artifact has a reviewed local POM.
  // A different Kotlin plugin version is still preloaded from its verified
  // official release without changing its remote Maven resolution metadata.
  if (version === '2.3.21') await mirrorVerifiedKotlinCompiler(destination, version);
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
    for (const [repository, tag, assetName, filename] of [
      ['tauri-apps/binary-releases', 'apprun-old', 'AppRun-x86_64', 'AppRun-x86_64'],
      ['tauri-apps/binary-releases', 'linuxdeploy-07333c6', 'linuxdeploy-x86_64.AppImage', 'linuxdeploy-07333c6-x86_64.AppImage'],
      ['linuxdeploy/linuxdeploy-plugin-appimage', 'continuous', 'linuxdeploy-plugin-appimage-x86_64.AppImage', 'linuxdeploy-plugin-appimage.AppImage'],
    ]) {
      const destination = join(tools, filename);
      await downloadReleaseAsset({ repository, tag, assetName, destination });
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
