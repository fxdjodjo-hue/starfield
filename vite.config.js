import { defineConfig } from 'vite';
import path from 'path';
export default defineConfig({
    base: '/',
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
//# sourceMappingURL=vite.config.js.map