import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        detection: resolve(__dirname, './detection/detection.js'),
        popup: resolve(__dirname, './popup/popup.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules/@tensorflow')) {
            return 'tensorflow';
          }
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false
      }
    }
  },
  optimizeDeps: {
    include: ['@tensorflow/tfjs']
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '@detection': resolve(__dirname, './detection')
    }
  }
});