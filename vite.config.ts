import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Ensures native Tauri CLI, Rollup, and CSS bindings are verified in CI/CD
 * before bundling to prevent 'Cannot find native binding' errors.
 */
function tauriNativeBindingsPlugin(): Plugin {
  return {
    name: 'tauri-native-bindings-verifier',
    buildStart() {
      if (process.env.CI || process.env.TAURI_ENV_PLATFORM) {
        try {
          const { ensureBindings } = require('./scripts/ensure-native-bindings.cjs');
          ensureBindings();
        } catch (err: any) {
          console.warn('[vite] Native bindings verification notice:', err?.message || err);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), tauriNativeBindingsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'fengari': 'fengari-web',
        'os': path.resolve(__dirname, 'src/polyfills/os.ts'),
      },
    },
    clearScreen: false,
    build: {
      rollupOptions: {
        external: (id) => id.endsWith('.node'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: ['**/src-tauri/**'],
            },
    },
  };
});
