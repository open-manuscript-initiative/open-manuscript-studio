import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const tauriDevHost = process.env.TAURI_DEV_HOST;

const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version?: string };

// The web deployment exports these variables explicitly. Native Tauri builds
// run in a separate GitHub Actions workflow, so derive equivalent metadata
// from GitHub's standard environment when VITE_* values were not pre-set.
process.env.VITE_APP_VERSION ??= packageMetadata.version ?? 'dev';
process.env.VITE_BUILD_NUMBER ??= process.env.GITHUB_RUN_NUMBER ?? '-';
process.env.VITE_COMMIT_SHA ??=
  process.env.GITHUB_SHA?.slice(0, 7) ?? '-';
process.env.VITE_BUILD_DATE ??= process.env.GITHUB_ACTIONS
  ? new Date().toISOString()
  : '-';

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
