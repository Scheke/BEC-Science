import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 5175,
    open: true,
    host: 'localhost',   // must be 'localhost' — Firebase Auth only whitelists this, not 127.0.0.1
  },
  build: {
    outDir: '../dist-admin',
    emptyOutDir: true,
  },
  preview: {
    port: 5175,
    host: 'localhost',
  },
});
