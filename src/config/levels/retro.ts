import type { LevelDef } from '../../types';
import { squareWithCrack } from './crack';

// Era 3, "Late Edition". 120 seconds, and the square is full: many small things at once. The
// machine is on overdrive and the wheel is locked and turns by itself (ERA_RULES.retro), so the
// player fights with whatever colour comes up. The UV lens (F) is the one thing he chooses, and
// stealth is why: the ghost from the tenth second, the wraith after the first checkpoint.
export const retro: LevelDef = {
    name: 'Retro Era',
    style: 'retro',
    radiations: ['blue', 'red', 'green', 'uv'],
    grants: ['doubleDash', 'uv'],
    introText: [
        'Dark now. The machine runs hot. Too hot.',
        'The wheel turns by itself. Something hides.',
    ],
    rooms: [
        {
            // Secret: the shop front right of the town hall (north wall, lower row)
            layout: squareWithCrack(15, 1),
            secret: 'uv',
            waves: [],
            continuous: {
                duration: 120,
                // One arrival every 3.4 s at the start, every 1.5 s at the end
                spawnEvery: [3400, 1500],
                maxAlive: 34,
                surge: 20,
                checkpointEvery: 45,
                table: [
                    // 0:00 Fodder: one overdriven flash clears a pack, whatever the wheel shows
                    { monster: 'rat', weight: 5, group: 6 },
                    { monster: 'bat', weight: 3, group: 5 },
                    // 0:10 The first ghost, among rats only. Nothing but UV touches it.
                    { monster: 'ghost', weight: 2, from: 10 },
                    { monster: 'slime', weight: 2, group: 3, from: 25 },
                    // 0:50 Just past the first checkpoint: the wraith, which does not wait
                    { monster: 'wraith', weight: 2, from: 50 },
                    { monster: 'zigbat', weight: 2, group: 3, from: 60 },
                    // 1:20 One thing that needs the right colour, when the wheel will not give it
                    { monster: 'ironclad', weight: 2, from: 60 },
                    { monster: 'golem', weight: 2, from: 80 },
                    // 1:35 Past the second checkpoint: the horde
                    { monster: 'rat', weight: 3, group: 8, from: 95 },
                ],
            },
        },
    ],
};
