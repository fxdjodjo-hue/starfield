import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    target: 'ES2022',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '/src': path.resolve(__dirname, 'src'),
    },
  },
});
