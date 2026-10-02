import { defineConfig } from 'vite';

export default defineConfig({
    // Relative paths so the built game works from any folder (itch.io, GitHub Pages, ...)
    base: './',
    build: {
        // Phaser alone is ~1.4 MB minified
        chunkSizeWarningLimit: 2000,
    },
});
