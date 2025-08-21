import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './src/manifest';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isFirefox = process.env.TARGET === 'firefox';
  
  return {
    plugins: [
      react(),
      crx({
        manifest: manifest({ 
          mode: mode as 'development' | 'production',
          browser: isFirefox ? 'firefox' : 'chrome'
        }),
        contentScripts: {
          injectCss: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@shared': resolve(__dirname, '../../packages/shared/src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          // UI entry points
          popup: resolve(__dirname, 'src/ui/popup/index.html'),
          options: resolve(__dirname, 'src/ui/options/index.html'),
          blocked: resolve(__dirname, 'src/ui/blocked/blocked.html'),
        },
      },
      // Ensure ML models and other assets are copied
      copyPublicDir: true,
    },
    publicDir: 'public',
    server: {
      port: 3000,
      hmr: {
        port: 3001,
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'webextension-polyfill',
      ],
      exclude: [
        '@tensorflow/tfjs',
        'nsfwjs',
      ],
    },
  };
});
