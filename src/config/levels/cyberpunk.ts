import type { LevelDef } from '../../types';
import { squareWithCrack } from './crack';

// Era 2, "Neon Dusk". 120 seconds on the clock. Blue is gone (ERA_RULES.cyberpunk), so packs are
// now a job for the Green blob, and the new dash is the way out of a corner. The speed class
// arrives: zig-zag bats from the first second, the skitter after the first checkpoint.
// The arc and the arithmetic behind these numbers are in docs/LEVELS.md.
export const cyberpunk: LevelDef = {
    name: 'Cyberpunk Era',
    style: 'cyberpunk',
    radiations: ['red', 'green'],
    grants: ['dash'],
    introText: [
        'Dusk. Neon. The Blue ray is gone from the wheel.',
        'Red and Green remain. The monsters are quicker.',
    ],
    rooms: [
        {
            // Secret: the bookshop's wall, low on the west side
            layout: squareWithCrack(0, 7),
            secret: 'green',
            waves: [],
            continuous: {
                duration: 120,
                // One arrival every 3.8 s at the start, every 2 s at the end
                spawnEvery: [3800, 2000],
                maxAlive: 16,
                surge: 20,
                checkpointEvery: 45,
                table: [
                    // 0:00 Only zig-zag bats, in pairs: the new class with nothing else to watch
                    { monster: 'zigbat', weight: 5, group: 2 },
                    // 0:12 The packs Blue used to clear. One Green blob does it now.
                    { monster: 'rat', weight: 3, group: 4, from: 12 },
                    { monster: 'slime', weight: 2, group: 2, from: 25 },
                    // 0:50 Just past the first checkpoint: the skitter, alone
                    { monster: 'skitter', weight: 4, from: 50 },
                    // 1:10 Armour, rarely: the one thing here that Red is for
                    { monster: 'ironclad', weight: 2, from: 55 },
                    { monster: 'golem', weight: 2, from: 75 },
                    // 1:35 Past the second checkpoint: bigger flocks, skitters in pairs
                    { monster: 'zigbat', weight: 3, group: 4, from: 95 },
                    { monster: 'skitter', weight: 2, group: 2, from: 105 },
                ],
            },
        },
    ],
};
