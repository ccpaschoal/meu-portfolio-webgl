import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/three/examples/')) return 'three-addons';
          if (id.includes('/node_modules/three/')) return 'three-core';
          if (id.includes('/node_modules/gsap/')) return 'gsap';
        }
      },
      input: {
        main: resolve(__dirname, 'src/index.html')
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: true
  }
});
