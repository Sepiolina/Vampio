import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'fengari': 'fengari-web',
        'os': path.resolve(__dirname, 'src/polyfills/os.ts'),
      },
    },
    clearScreen: false,
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
