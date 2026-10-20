import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Standalone web build of the management app (no extension APIs). */
export default defineConfig({
  root: 'web',
  base: './',
  publicDir: '../public',
  plugins: [react()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'app.js', chunkFileNames: '[name].js', assetFileNames: 'app.[ext]' },
    },
  },
});
