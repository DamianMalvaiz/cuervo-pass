/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// El panel de admin es una app web aparte (no la de estudiantes). Se construye a `../web-admin/dist`, que es lo que publica `web-admin/wrangler.jsonc`.
export default defineConfig({
  plugins: [react()],
  build: { outDir: '../web-admin/dist', emptyOutDir: true, sourcemap: false },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], globals: false },
});
