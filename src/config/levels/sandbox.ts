import type { LevelDef } from '../../types';

// Dev-only playground for trying every radiation and monster: open the game with ?sandbox.
// Add ?sandbox&room=2 to start in a later room (room 6 has a chest and a secret wall).
// Not part of the shipped game.
export const sandbox: LevelDef = {
    name: 'Sandbox',
    style: 'goldenAge',
    radiations: ['radio', 'infrared', 'ultraviolet', 'gamma'],
    rooms: [
        // 1. Pathing: chasers have to come round the walls and through the gaps
        {
            layout: [
                '####################',
                '#..................#',
                '#..o............o..#',
                '#......#....#......#',
                '#......#....#......#',
                '#......#..P.#......#',
                '#......######......#',
                '#..o............o..#',
                '#..................#',
                '####################',
            ],
            waves: [
                {
                    spawns: [
                        { monster: 'swarmlet', count: 6 },
                        { monster: 'frostling', count: 2 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'swarmlet', count: 10 },
                        { monster: 'frostling', count: 3 },
                    ],
                },
            ],
        },
        // 2. Shades: one alone to learn on, then several with a distraction
        {
            layout: [
                '####################',
                '#..................#',
                '#..................#',
                '#....##......##....#',
                '#..................#',
                '#.........P........#',
                '#....##......##....#',
                '#..................#',
                '#..................#',
                '####################',
            ],
            waves: [
                { spawns: [{ monster: 'shade', count: 1 }] },
                {
                    spawns: [
                        { monster: 'shade', count: 3 },
                        { monster: 'swarmlet', count: 5 },
                    ],
                },
            ],
        },
        // 3. Ironclads: walls to hide behind, and to shoot Gamma through
        {
            layout: [
                '####################',
                '#..................#',
                '#......#....#......#',
                '#......#....#......#',
                '#..o............o..#',
                '#.........P........#',
                '#......#....#......#',
                '#......#....#......#',
                '#..................#',
                '####################',
            ],
            waves: [
                { spawns: [{ monster: 'ironclad', count: 1 }] },
                {
                    spawns: [
                        { monster: 'ironclad', count: 2 },
                        { monster: 'frostling', count: 2 },
                    ],
                },
            ],
        },
        // 4. Everything at once: the right tool for each job
        {
            layout: [
                '####################',
                '#..................#',
                '#..##..........##..#',
                '#..#............#..#',
                '#........oo........#',
                '#.........P........#',
                '#..#............#..#',
                '#..##..........##..#',
                '#..................#',
                '####################',
            ],
            waves: [
                {
                    spawns: [
                        { monster: 'swarmlet', count: 8 },
                        { monster: 'shade', count: 1 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'ironclad', count: 1 },
                        { monster: 'frostling', count: 2 },
                        { monster: 'shade', count: 1 },
                    ],
                },
                {
                    spawns: [
                        { monster: 'ironclad', count: 2 },
                        { monster: 'swarmlet', count: 10 },
                        { monster: 'frostling', count: 2 },
                    ],
                },
            ],
        },
        // 5. The Prism
        {
            layout: [
                '####################',
                '#..................#',
                '#..................#',
                '#...o..........o...#',
                '#..................#',
                '#..................#',
                '#...o..........o...#',
                '#.........P........#',
                '#..................#',
                '####################',
            ],
            waves: [{ spawns: [{ monster: 'prism', count: 1 }] }],
        },
        // 6. Progression: a chest once the room is cleared, and a secret wall with a health
        // upgrade behind it. Every radiation is already owned here, so the chest opens without
        // an item card; clear "progress.radiations" in the registry to see the card.
        {
            layout: [
                '####################',
                '#..............#...#',
                '#..............#.H.#',
                '#..o...........#...#',
                '#..............#SS##',
                '#.........P........#',
                '#..................#',
                '#..o......C........#',
                '#..................#',
                '####################',
            ],
            waves: [{ spawns: [{ monster: 'swarmlet', count: 4 }] }],
            reward: 'gamma',
            secret: 'infrared',
        },
    ],
};
