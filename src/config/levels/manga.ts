import type { LevelDef } from '../../types';
import { squareWithCrack } from './crack';

// Era 4, "White Page". 120 seconds of bullet hell with one tool: White (ERA_RULES.manga), a ring
// that pushes everything away and sends thrown things back. Snowmen ice the floor, acid slimes
// pool it. White is 1.5x against throwers and swarm and 0.25x against everything else, so there
// is no armour, speed or stealth here at all: only throwers, and swarm to be pushed about.
// The arc and the arithmetic behind these numbers are in docs/LEVELS.md.
export const manga: LevelDef = {
    name: 'White Page',
    style: 'manga',
    radiations: ['white'],
    grants: ['white'],
    introText: ['No colour left.', 'Only white light.'],
    rooms: [
        {
            // Secret: the pharmacy's wall, low on the east side
            layout: squareWithCrack(19, 7),
            secret: 'white',
            waves: [],
            continuous: {
                duration: 120,
                // One arrival every 4.6 s at the start, every 2.6 s at the end
                spawnEvery: [4600, 2600],
                // Throwers are slow to kill with White (four rings each), so this cap is what
                // keeps the air readable: at worst about five things thrown a second
                maxAlive: 14,
                surge: 20,
                checkpointEvery: 45,
                table: [
                    // 0:00 One snowman at a time: learn that the ring sends the snowball back
                    { monster: 'snowman', weight: 4 },
                    // 0:05 Fodder: one ring kills a pack that gets close
                    { monster: 'rat', weight: 4, group: 5, from: 5 },
                    // 0:22 Acid: a marker on the floor, then a pool. Not a thing to push back.
                    { monster: 'acidSlime', weight: 2, from: 22 },
                    { monster: 'bat', weight: 3, group: 4, from: 35 },
                    // 0:50 Just past the first checkpoint: something that takes two rings
                    { monster: 'slime', weight: 2, group: 2, from: 50 },
                    // 1:20 Throwers in pairs: ice and acid on the floor together
                    { monster: 'snowman', weight: 2, group: 2, from: 80 },
                    { monster: 'acidSlime', weight: 1, group: 2, from: 100 },
                ],
            },
        },
    ],
};
