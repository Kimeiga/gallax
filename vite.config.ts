import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'ES2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'pixi': ['pixi.js'],
          'mapbox': ['mapbox-gl'],
          'vendor': ['@simonwep/pickr', 'emoji-picker-element'],
        }
      }
    }
  }
});
