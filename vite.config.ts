import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/Starfield/' : '/',
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
