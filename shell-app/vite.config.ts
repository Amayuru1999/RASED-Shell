import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve @ras/shared to the local workspace package
      '@ras/shared': path.resolve(__dirname, '../../shared/src/index.ts'),
      // Resolve @/ to src/ for internal imports
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 9000,
    cors: true,
  },
  build: {
    rollupOptions: {
      // React is bundled in shell — MFEs share it via import map pointing to same CDN URL
    },
  },
});
