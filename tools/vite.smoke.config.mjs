import { mergeConfig } from 'vite';
import base from '../vite.config.ts';

// The dev server tools/smoke.mjs starts. Same as the project config, except that it never
// reloads the page: people edit src/ while the smoke test runs, and a reload halfway through
// a room would look like a failure.
export default mergeConfig(base, {
    clearScreen: false,
    // Its own cache, so it cannot disturb a dev server someone else has running
    cacheDir: 'node_modules/.vite-smoke',
    server: {
        hmr: false,
        watch: null,
    },
});
