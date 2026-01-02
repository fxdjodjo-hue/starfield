import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    target: 'ES2022',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
