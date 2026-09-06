import { defineConfig } from 'vite';
import { terrainTileMiddleware } from './server/terrain-tiles.js';

export default defineConfig({
  plugins: [{
    name: 'public-terrain-tiles',
    configureServer(server) { server.middlewares.use(terrainTileMiddleware); },
    configurePreviewServer(server) { server.middlewares.use(terrainTileMiddleware); },
  }],
  build: {
    rollupOptions: { output: { manualChunks: { maps: ['leaflet'], graphics: ['three'] } } },
    chunkSizeWarningLimit: 600,
  },
});
