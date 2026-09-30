import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        bible: resolve(import.meta.dirname, 'bible.html'),
        search: resolve(import.meta.dirname, 'search.html'),
        saved: resolve(import.meta.dirname, 'saved.html'),
      },
    },
  },
});
