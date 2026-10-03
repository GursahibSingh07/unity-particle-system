import type { LevelDef } from '../../types';

// Level 2, "Noir". Radio and Infrared, then Ultraviolet from the chest in room 1.
// Room notes, timings and the secret are written up in docs/LEVELS.md.
export const level2: LevelDef = {
    name: 'Noir',
    style: 'noir',
    radiations: ['radio', 'infrared'],
    introText: [
        'Night falls. The colour drains out of the streets.',
        'Something moves here that the eye cannot follow.',
        'The Handler needs a light that tells the truth.',
    ],
    rooms: [
        // 1. Four Corners: city blocks cut every sight line. A mixed crowd with the two
        // tools already owned: pulse the flocks, find a clear street for the beam.
        {
            layout: [
                '####################',
                '#..................#',
                '#...###...C..###...#',
                '#...###......###...#',
                '#..................#',
                '#........P.........#',
                '#...###......###...#',
                '#...###......###...#',
                '#..................#',
                '####################',
            ],
            waves: [
                {
                    spawns: [
                        { monster: 'swarmlet', count: 8 },
                        { monster: 'frostling', count: 2 },
                    ],
                },
                { spawns: [{ monster: 'frostling', count: 4 }] },
                {
                    spawns: [
                        { monster: 'swarmlet', count: 12 },
                        { monster: 'frostling', count: 3 },
                    ],
                },
            ],
            reward: 'ultraviolet',
        },
        // 2. Lamplight: wide open, four lamp posts, nothing to block the flash.
        // One Shade alone, then two, then two with a flock to split the player's attention.
        {
            layout: [
                '####################',
                '#..................#',
                '#.....o......o.....#',
                '#..................#',
                '#........,,........#',
                '#.........P........#',
                '#..................#',
                '#.....o......o.....#',
                '#..................#',
                '####################',
            ],
            waves: [
                { spawns: [{ monster: 'shade', count: 1 }] },
                {
                    spawns: [
                        { monster: 'shade', count: 1 },
                        { monster: 'swarmlet', count: 4 },
                    ],
                },
                { spawns: [{ monster: 'shade', count: 2 }] },
                {
                    spawns: [
                        { monster: 'shade', count: 2 },
                        { monster: 'swarmlet', count: 6 },
                    ],
                },
            ],
        },
        // 3. Round the Block: a loop around one building. Shades need a clear line to dash,
        // so corners are safety, and trouble comes from both ways round.
        // Secret: the cracked wall on the building's south face, by the start (Ultraviolet).
        {
            layout: [
                '####################',
                '#..................#',
                '#..o............o..#',
                '#.......####.......#',
                '#.......#H##.......#',
                '#.......#S##.......#',
                '#........,.........#',
                '#..o......P.....o..#',
                '#..................#',
                '####################',
            ],
            waves: [
                {
                    spawns: [
                        { monster: 'shade', count: 1 },
                        { monster: 'frostling', count: 2 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'shade', count: 2 },
                        { monster: 'swarmlet', count: 6 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'shade', count: 2 },
                        { monster: 'frostling', count: 1 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'shade', count: 2 },
                        { monster: 'frostling', count: 2 },
                        { monster: 'swarmlet', count: 4 },
                    ],
                },
            ],
            secret: 'ultraviolet',
        },
    ],
};
