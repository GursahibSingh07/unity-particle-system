import type { LevelDef } from '../../types';
import { squareWithCrack } from './crack';

// Era 1, "Golden Era". The tutorial: the full wheel (Blue, Red, Green), no dash. Two minutes on
// the clock; waves keep coming until it runs out, each new arrival suited to a different ray.
export const golden: LevelDef = {
    name: 'Golden Era',
    style: 'goldenAge',
    radiations: ['blue', 'red', 'green'],
    grants: ['blue', 'red', 'green'],
    introText: [
        'Noon in the city square. The sun on every window!',
        'And monsters, in broad daylight. Only one man sees them.',
        'Turn the wheel, Light Handler. Find the colour that bites!',
    ],
    rooms: [
        {
            // Secret: the shop front left of the town hall (north wall, lower row)
            layout: squareWithCrack(4, 1),
            secret: 'blue',
            waves: [],
            continuous: {
                duration: 120,
                // A wave every 4.5 s at the start, every 2.6 s by the end
                spawnEvery: [4500, 2600],
                maxAlive: 20,
                surge: 20,
                checkpointEvery: 45,
                table: [
                    // 0:00 Rats in packs: one Blue flash clears a pack, so Blue is for crowds
                    { monster: 'rat', weight: 5, group: 6 },
                    // 0:18 Slimes hop round the fountain: the first thing that does not just vanish
                    { monster: 'slime', weight: 3, group: 3, from: 18 },
                    // 0:30 Bats fly straight over the fountain
                    { monster: 'bat', weight: 3, group: 5, from: 30 },
                    // 0:50 Just past the first checkpoint: an Ironclad. Blue chips at it; Red bites.
                    { monster: 'ironclad', weight: 2, from: 50 },
                    // 1:25 The Golem rolls in and shields whatever is behind it
                    { monster: 'golem', weight: 1, from: 85 },
                    { monster: 'rat', weight: 2, group: 8, from: 85 },
                ],
            },
        },
    ],
};
