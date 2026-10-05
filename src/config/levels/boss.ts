import type { LevelDef } from '../../types';
import { SQUARE_LAYOUT } from '../square';

// Era 5, "The Final Page". The square, one wave, one Prism. It starts with everything
// (ERA_RULES.finalPage); every third attack it switches the era, and the machine obeys that
// era's rule until the next switch. No grants and no secret. Notes are in docs/LEVELS.md.
export const boss: LevelDef = {
    name: 'Boss Era',
    style: 'finalPage',
    radiations: ['blue', 'red', 'green', 'white', 'uv'],
    introText: [
        'It comes wailing up the street. Red, then blue.',
        'It changes the page. The machine changes with it.',
        'Watch the sign above its head.',
    ],
    rooms: [
        {
            layout: [...SQUARE_LAYOUT],
            waves: [{ spawns: [{ monster: 'prism', count: 1 }], delay: 1200 }],
        },
    ],
};
