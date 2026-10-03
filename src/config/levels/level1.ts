import type { LevelDef } from '../../types';

// Starter waves for testing the core loop. Role E owns level data and balance.
export const level1: LevelDef = {
    name: 'Golden Age',
    style: 'goldenAge',
    radiations: ['radio', 'infrared'],
    rooms: [
        {
            waves: [
                { spawns: [{ monster: 'swarmlet', count: 6 }] },
                { spawns: [{ monster: 'frostling', count: 2 }] },
            ],
        },
        {
            walls: [
                { x: 280, y: 200, width: 40, height: 220 },
                { x: 880, y: 200, width: 40, height: 220 },
            ],
            waves: [
                { spawns: [{ monster: 'swarmlet', count: 10 }] },
                {
                    spawns: [
                        { monster: 'frostling', count: 3 },
                        { monster: 'swarmlet', count: 6 },
                    ],
                },
            ],
        },
        {
            walls: [{ x: 500, y: 290, width: 200, height: 40 }],
            waves: [
                { spawns: [{ monster: 'frostling', count: 4 }] },
                { spawns: [{ monster: 'swarmlet', count: 12 }] },
                {
                    spawns: [
                        { monster: 'frostling', count: 4 },
                        { monster: 'swarmlet', count: 8 },
                    ],
                },
            ],
        },
    ],
};
