import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const tauriDevHost = process.env.TAURI_DEV_HOST;

const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version?: string };

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function gitValue(args: string[]): string | undefined {
  try {
    return nonEmpty(
      execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
  } catch {
    return undefined;
  }
}

// GitHub Actions remains the canonical source for release build numbers. When
// the web application is built manually on the production server, fall back to
// the repository's monotonically increasing commit count so the footer never
// loses the number after "Build #".
process.env.VITE_APP_VERSION =
  nonEmpty(process.env.VITE_APP_VERSION) ?? packageMetadata.version ?? 'dev';
process.env.VITE_BUILD_NUMBER =
  nonEmpty(process.env.VITE_BUILD_NUMBER) ??
  nonEmpty(process.env.GITHUB_RUN_NUMBER) ??
  gitValue(['rev-list', '--count', 'HEAD']) ??
  '0';
process.env.VITE_COMMIT_SHA =
  nonEmpty(process.env.VITE_COMMIT_SHA) ??
  nonEmpty(process.env.GITHUB_SHA)?.slice(0, 7) ??
  gitValue(['rev-parse', '--short=7', 'HEAD']) ??
  '-';
process.env.VITE_BUILD_DATE =
  nonEmpty(process.env.VITE_BUILD_DATE) ??
  (process.env.GITHUB_ACTIONS ? new Date().toISOString() : '-');

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: tauriDevHost || true,
    proxy: tauriDevHost
      ? {
          '/api': {
            target: 'https://studio.openmanuscript.org',
            changeOrigin: true,
            secure: true,
          },
        }
      : undefined,
    watch: {
      ignored: [
        '**/src-tauri/target/**',
        '**/src-tauri/gen/**',
      ],
    },
    hmr: tauriDevHost
      ? {
          protocol: 'ws',
          host: tauriDevHost,
          port: 5174,
        }
      : undefined,
  },
});
