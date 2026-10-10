import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API and the WebSocket live on the Python backend. In development Vite
// proxies both so the browser sees a single origin and no CORS is involved.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The themes live outside this directory, at the repository's own
    // `themes/`, because a theme is a thing of Sonora's rather than a thing
    // of the frontend build's. The production build follows the imports there
    // without being told; the dev server has to be let out of its root.
    fs: { allow: ['..'] },
    // The browser's Host (localhost:5173) is passed through unchanged. The
    // backend refuses a write whose Origin does not match its Host, and
    // rewriting Host to the backend's address would make every write fail.
    proxy: {
      '/api': { target: 'http://127.0.0.1:50205' },
      '/ws': { target: 'ws://127.0.0.1:50205', ws: true },
    },
  },
  // The themes import React from outside this directory. Vite 8's bundler
  // looks for it beside the importing file and finds nothing there, so the
  // one copy in this directory's node_modules is named for every import.
  resolve: { dedupe: ['react', 'react-dom', 'hls.js', '@material/material-color-utilities'] },
  // Relative, so the page loads its bundle wherever it is served from:
  // at / on its own, or under Home Assistant's ingress path (lib/base.js).
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
})
