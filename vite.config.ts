import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: mode === 'production' ? '/pi-visualization/' : '/',
    plugins: [react(), tailwindcss(), wasm()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Prevent Vite from pre-bundling gmp-wasm — it embeds a large WASM binary
    // inline in its ESM bundle that esbuild's pre-bundler doesn't need to touch.
    optimizeDeps: {
      exclude: ['gmp-wasm'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

