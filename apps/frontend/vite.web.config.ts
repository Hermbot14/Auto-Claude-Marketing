import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Standalone Vite config for running renderer in browser (web app mode)
 * This bypasses the Electron main process to work around the electron import issue
 */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),

  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@features': resolve(__dirname, 'src/renderer/features'),
      '@components': resolve(__dirname, 'src/renderer/shared/components'),
      '@hooks': resolve(__dirname, 'src/renderer/shared/hooks'),
      '@lib': resolve(__dirname, 'src/renderer/shared/lib')
    }
  },

  server: {
    port: 3000,
    host: true,
    open: true,
    strictPort: false,
    // Allow external access for testing
    allowedHosts: 'all'
  },

  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true
  },

  // Define global constants that would normally come from Electron
  define: {
    '__SENTRY_DSN__': JSON.stringify(process.env.SENTRY_DSN || ''),
    '__SENTRY_TRACES_SAMPLE_RATE__': JSON.stringify('0.1'),
    '__SENTRY_PROFILES_SAMPLE_RATE__': JSON.stringify('0.1'),
  }
});
