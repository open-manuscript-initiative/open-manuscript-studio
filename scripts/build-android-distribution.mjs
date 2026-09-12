import { mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const channel = process.argv[2];
if (!['play', 'direct'].includes(channel) || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/build-android-distribution.mjs play|direct');
}

const manifest = resolve('src-tauri/gen/android/app/src/release/AndroidManifest.xml');
if (!existsSync(resolve('src-tauri/gen/android/app/build.gradle.kts'))) {
  throw new Error('Run npm run android:init and configure signing first.');
}
// Never overwrite a developer-owned release manifest.
if (existsSync(manifest)) {
  throw new Error('A release manifest already exists; inspect it before building.');
}

try {
  if (channel === 'play') {
    mkdirSync(dirname(manifest), { recursive: true });
    writeFileSync(manifest, `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" tools:node="remove" />
    <application>
        <provider android:name="org.openmanuscript.studio.updater.OmiUpdateFileProvider" tools:node="remove" />
    </application>
</manifest>
`);
  }
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'tauri', '--', 'android', 'build', channel === 'play' ? '--aab' : '--apk', '--ci'],
    {
      stdio: 'inherit',
      env: { ...process.env, VITE_ANDROID_DISTRIBUTION: channel },
      shell: process.platform === 'win32',
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (channel === 'play') rmSync(manifest, { force: true });
}
