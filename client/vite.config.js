import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // relative asset paths so the built app also works from file:// and static hosts
  base: './',
  server: {
    port: 5173,
    fs: {
      // The client deliberately imports the REAL engine from ../server/src —
      // the Assignment Rule, priority matrix, rule schema, scoring and the seed
      // builder — so the offline engine is the same code as the API's rather
      // than a mock of it.
      //
      // `allow` is narrowed to that directory instead of the old blanket '..',
      // which exposed the entire parent tree (including .git) to the dev server.
      allow: ['.', '../server/src'],
    },
  },
});
