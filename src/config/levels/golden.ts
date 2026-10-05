import type { LevelDef } from '../../types';
import { squareWithCrack } from './crack';

// Era 1, "Golden Age". The tutorial: the full wheel (Blue, Red, Green), no dash, four waves.
// Each wave brings one new thing and the ray that suits it. Timings are in docs/LEVELS.md.
export const golden: LevelDef = {
    name: 'Golden Age',
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
            waves: [
                // 1. Rats, as a cluster of six and one of four. One Blue flash kills every rat in the
                // cone, so the first thing the player learns is that Blue is for packs.
                { spawns: [{ monster: 'rat', count: 10 }], delay: 800 },
                // 2. Slimes hop round the fountain while bats fly straight over it. A slime takes
                // three Blue flashes: the first enemy that does not just vanish.
                {
                    spawns: [
                        { monster: 'slime', count: 5 },
                        { monster: 'bat', count: 8 },
                    ],
                    delay: 1500,
                },
                // 3. Two Ironclads that keep their distance and throw, with three slimes to keep
                // the player moving. Blue only chips at them; Red makes the big words.
                {
                    spawns: [
                        { monster: 'ironclad', count: 2 },
                        { monster: 'slime', count: 3 },
                    ],
                    delay: 1500,
                },
                // 4. The Golem rolls in with company. Rays stop at it, so the pack and the Ironclad
                // behind it are safe until the player steps round: the era's exam.
                {
                    spawns: [
                        { monster: 'golem', count: 1 },
                        { monster: 'ironclad', count: 1 },
                        { monster: 'rat', count: 12 },
                        { monster: 'bat', count: 6 },
                    ],
                    delay: 1800,
                },
            ],
        },
    ],
};
