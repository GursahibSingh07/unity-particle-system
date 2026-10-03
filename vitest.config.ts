import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Unit tests only cover modules that do not import Phaser, so no DOM is needed
        environment: 'node',
        include: ['tests/**/*.test.ts'],
    },
});
