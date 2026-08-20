import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const tauriDevHost = process.env.TAURI_DEV_HOST;

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
