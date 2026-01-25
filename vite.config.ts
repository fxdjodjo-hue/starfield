import { defineConfig } from 'vite';
import path from 'path';
import pkg from './package.json';

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
      '/shared': path.resolve(__dirname, 'shared'),
    },
  },
});
