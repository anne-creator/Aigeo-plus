import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { modelMiddleware } from './server/model.mjs';

export default defineConfig({
  plugins: [react(), { name: 'local-model-service', configureServer(server) { server.middlewares.use(modelMiddleware); } }],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('company-data.json')) return 'company-data';
        },
      },
    },
  },
});
