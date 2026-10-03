import type { LevelDef } from '../../types';

// Level 3, "Manga". Radio, Infrared and Ultraviolet, then Gamma from the chest in room 1.
// Room notes, timings and the secret are written up in docs/LEVELS.md.
export const level3: LevelDef = {
    name: 'Manga',
    style: 'manga',
    radiations: ['radio', 'infrared', 'ultraviolet'],
    introText: [
        'Faster now! Speed lines tear across the page!',
        'They come in armour that shrugs off every ray.',
        'There must be a light that nothing can stop.',
    ],
    rooms: [
        // 1. Two Doors: the room is cut in half. An exam on the three tools owned so far,
        // with the chest waiting on the far side of the wall.
        {
            layout: [
                '####################',
                '#..................#',
                '#........C.........#',
                '#..................#',
                '#####..######..#####',
                '#..................#',
                '#...o..........o...#',
                '#.........P........#',
                '#..................#',
                '####################',
            ],
            waves: [
                {
                    spawns: [
                        { monster: 'swarmlet', count: 6 },
                        { monster: 'shade', count: 1 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'frostling', count: 2 },
                        { monster: 'shade', count: 2 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'swarmlet', count: 8 },
                        { monster: 'frostling', count: 2 },
                        { monster: 'shade', count: 1 },
                    ],
                },
            ],
            reward: 'gamma',
        },
        // 2. The Trenches: low walls stop what the Ironclad throws, and Gamma goes straight
        // through them. One Ironclad alone, then one with a flock, then two.
        // Secret: the cracked wall in the top-right corner (Gamma).
        {
            layout: [
                '####################',
                '#................#H#',
                '#.................S#',
                '#...###......###..,#',
                '#..................#',
                '#.........P........#',
                '#...###......###...#',
                '#..................#',
                '#..................#',
                '####################',
            ],
            waves: [
                { spawns: [{ monster: 'ironclad', count: 1 }] },
                {
                    spawns: [
                        { monster: 'ironclad', count: 1 },
                        { monster: 'swarmlet', count: 6 },
                    ],
                },
                { spawns: [{ monster: 'ironclad', count: 2 }] },
            ],
            secret: 'gamma',
        },
        // 3. Full Spread: every monster so far, four tools, broken cover on a diagonal.
        // The right ray for each job, and no time to dither.
        {
            layout: [
                '####################',
                '#..................#',
                '#.....#......o.....#',
                '#....##............#',
                '#..................#',
                '#.........P........#',
                '#............##....#',
                '#.....o......#.....#',
                '#..................#',
                '####################',
            ],
            waves: [
                {
                    spawns: [
                        { monster: 'swarmlet', count: 6 },
                        { monster: 'frostling', count: 2 },
                        { monster: 'shade', count: 1 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'ironclad', count: 1 },
                        { monster: 'shade', count: 1 },
                        { monster: 'frostling', count: 2 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'ironclad', count: 2 },
                        { monster: 'swarmlet', count: 6 },
                    ],
                },
            ],
        },
    ],
};
