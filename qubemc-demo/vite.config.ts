import { speechMiddleware } from './server/speech.mjs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { modelMiddleware } from './server/model.mjs';
import { boardMiddleware } from './server/board.mjs';
import { nemoclawMiddleware } from './server/nemoclaw-discord.mjs';

export default defineConfig({
  plugins: [react(), { name: 'local-model-service', configureServer(server) { server.middlewares.use(speechMiddleware); server.middlewares.use(modelMiddleware); server.middlewares.use(boardMiddleware); server.middlewares.use(nemoclawMiddleware); } }],
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
