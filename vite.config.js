import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // The landing page is small; one CSS file and one JS chunk keep the
    // request count minimal on a mobile network.
    cssCodeSplit: false,
    reportCompressedSize: true
  }
});
