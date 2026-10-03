import type { LevelDef } from '../../types';

// Level 1, "Golden Age". Radio only, then Infrared from the chest in room 1.
// Room notes, timings and the secret are written up in docs/LEVELS.md.
export const level1: LevelDef = {
    name: 'Golden Age',
    style: 'goldenAge',
    radiations: ['radio'],
    introText: [
        'The city sleeps. The Light Handler does not!',
        'Monsters roam the square in broad daylight.',
        'Only one man can see them. So one man must act.',
    ],
    rooms: [
        // 1. The Square: an open, safe arena. Learn to move and pulse; flocks first,
        // then one Frostling that Radio only chips at, right before the chest gives Infrared.
        {
            layout: [
                '####################',
                '#..................#',
                '#.o......C.......o.#',
                '#..................#',
                '#.....,......,.....#',
                '#..................#',
                '#.....,......,.....#',
                '#.o......P.......o.#',
                '#..................#',
                '####################',
            ],
            waves: [
                { spawns: [{ monster: 'swarmlet', count: 4 }] },
                { spawns: [{ monster: 'swarmlet', count: 6 }] },
                { spawns: [{ monster: 'swarmlet', count: 10 }] },
                { spawns: [{ monster: 'frostling', count: 1 }] },
            ],
            reward: 'infrared',
        },
        // 2. The Counter: a row of crates stops feet but not the beam. One Frostling alone,
        // then several walking the long way round while the player burns them over the top.
        {
            layout: [
                '####################',
                '#..................#',
                '#..,............,..#',
                '#..................#',
                '#....oooooooooo....#',
                '#..................#',
                '#..................#',
                '#.........P........#',
                '#..................#',
                '####################',
            ],
            waves: [
                { spawns: [{ monster: 'frostling', count: 1 }] },
                { spawns: [{ monster: 'frostling', count: 3 }] },
                {
                    spawns: [
                        { monster: 'frostling', count: 2 },
                        { monster: 'swarmlet', count: 6 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'frostling', count: 4 },
                        { monster: 'swarmlet', count: 6 },
                    ],
                },
            ],
        },
        // 3. The Doorway: a wall stops the beam, so the two-tile door is the place to hold.
        // Secret: the cracked wall in the top-left corner, behind the player's back (Infrared).
        {
            layout: [
                '####################',
                '#HS....#...........#',
                '##,....#.....o.....#',
                '#......#...........#',
                '#..P...............#',
                '#..................#',
                '#......#...........#',
                '#......#.....o.....#',
                '#......#...........#',
                '####################',
            ],
            waves: [
                { spawns: [{ monster: 'frostling', count: 3 }] },
                {
                    spawns: [
                        { monster: 'swarmlet', count: 8 },
                        { monster: 'frostling', count: 2 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'frostling', count: 3 },
                        { monster: 'swarmlet', count: 6 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'frostling', count: 4 },
                        { monster: 'swarmlet', count: 10 },
                    ],
                },
            ],
            secret: 'infrared',
        },
    ],
};
