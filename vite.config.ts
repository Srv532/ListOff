import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],

    // SECURITY (#14 Source Map Exposure):
    // Disable source maps in production to prevent leaking original source code.
    build: {
      sourcemap: false,
      // SECURITY (#21 Dependency Confusion): pin exact output target
      target: 'es2020',
    },

    // SECURITY (#4 Exposed Env Vars):
    // Do NOT expose GROQ_API_KEY or Firebase keys via define — they stay server-side only.
    // Only expose strictly necessary public env vars with VITE_ prefix.
    define: isProd
      ? {}
      : {
          // Only expose Gemini key in dev if needed (currently unused)
          ...(env.GEMINI_API_KEY
            ? { 'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY) }
            : {}),
        },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
