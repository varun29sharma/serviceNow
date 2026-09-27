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
      // demoApi.js imports the real triage module from ../server/src
      allow: ['..'],
    },
  },
});
