import { defineConfig } from 'vite';

// Static PWA build -> /dist, deployable to Vercel via `npm run build`
export default defineConfig({
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
