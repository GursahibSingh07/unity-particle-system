import type { LevelDef, RoomDef, WaveDef } from '../../types';
import { SQUARE_LAYOUT } from '../square';

// Dev-only playground on the city square: open the game with ?sandbox, or ?sandbox&room=N to
// start in room N (numbered from 1, as below). Add &nodamage to watch without being hurt.
// With no `rule` the machine has every ray and mode and both dashes (DEFAULT_RULE).
// Not part of the shipped game.

const room = (...waves: WaveDef[]): RoomDef => ({ layout: [...SQUARE_LAYOUT], waves });

/** The square with the wall tile at (col, row) cracked */
function cracked(col: number, row: number): string[] {
    const layout = [...SQUARE_LAYOUT];
    layout[row] = layout[row].slice(0, col) + 'S' + layout[row].slice(col + 1);
    return layout;
}

export const sandbox: LevelDef = {
    name: 'Sandbox',
    style: 'goldenAge',
    radiations: ['blue', 'red', 'green', 'white', 'uv'],
    rooms: [
        // 1. Swarm on foot: a pack of rats that surrounds, then slimes hopping in among them
        room(
            { spawns: [{ monster: 'rat', count: 8 }] },
            { spawns: [{ monster: 'slime', count: 4 }] },
            {
                spawns: [
                    { monster: 'rat', count: 10 },
                    { monster: 'slime', count: 3 },
                ],
            },
        ),
        // 2. Bats over the fountain: they cross it in a straight line while the rats go round
        room(
            { spawns: [{ monster: 'bat', count: 6 }] },
            {
                spawns: [
                    { monster: 'bat', count: 8 },
                    { monster: 'rat', count: 6 },
                ],
            },
        ),
        // 3. Ironclads: keep their distance, wind up, throw
        room(
            { spawns: [{ monster: 'ironclad', count: 1 }] },
            {
                spawns: [
                    { monster: 'ironclad', count: 2 },
                    { monster: 'slime', count: 2 },
                ],
            },
        ),
        // 4. A golem alone to learn its roll, then one shielding a pack
        room(
            { spawns: [{ monster: 'golem', count: 1 }] },
            {
                spawns: [
                    { monster: 'golem', count: 1 },
                    { monster: 'rat', count: 8 },
                    { monster: 'ironclad', count: 1 },
                ],
            },
        ),
        // 5. Zig-zag bats: hard for the laser, easy for the cone and the blob
        room(
            { spawns: [{ monster: 'zigbat', count: 3 }] },
            {
                spawns: [
                    { monster: 'zigbat', count: 6 },
                    { monster: 'bat', count: 4 },
                ],
            },
        ),
        // 6. Skitters: they bite, and bolt when hurt
        room({ spawns: [{ monster: 'skitter', count: 1 }] }, { spawns: [{ monster: 'skitter', count: 4 }] }),
        // 7. Stealth (F for the UV lens): a ghost alone to learn on, a wraith alone to meet its
        // double dash, then both kinds with rats to split the player's attention
        room(
            { spawns: [{ monster: 'ghost', count: 1 }] },
            { spawns: [{ monster: 'wraith', count: 1 }] },
            {
                spawns: [
                    { monster: 'ghost', count: 2 },
                    { monster: 'wraith', count: 2 },
                    { monster: 'rat', count: 5 },
                ],
            },
        ),
        // 8. Projectile (F for White, which pushes shots back): a snowman alone (ice), an acid
        // slime alone (pools), then enough of both to fill the floor and the air
        room(
            { spawns: [{ monster: 'snowman', count: 1 }] },
            { spawns: [{ monster: 'acidSlime', count: 1 }] },
            {
                spawns: [
                    { monster: 'snowman', count: 3 },
                    { monster: 'acidSlime', count: 3 },
                ],
            },
        ),
        // 9. A mix of every class: the right ray for each job
        room(
            {
                spawns: [
                    { monster: 'rat', count: 8 },
                    { monster: 'bat', count: 4 },
                    { monster: 'skitter', count: 2 },
                ],
            },
            {
                spawns: [
                    { monster: 'golem', count: 1 },
                    { monster: 'ironclad', count: 1 },
                    { monster: 'slime', count: 4 },
                    { monster: 'zigbat', count: 4 },
                ],
            },
            {
                spawns: [
                    { monster: 'ghost', count: 1 },
                    { monster: 'snowman', count: 1 },
                    { monster: 'acidSlime', count: 1 },
                    { monster: 'rat', count: 10 },
                ],
            },
        ),
        // 10. Density: as many small things alive at once as a timed era will have
        room({
            spawns: [
                { monster: 'rat', count: 40 },
                { monster: 'bat', count: 12 },
                { monster: 'slime', count: 8 },
            ],
        }),
        // 11. The Prism
        room({ spawns: [{ monster: 'prism', count: 1 }] }),
        // 12. A timed era in miniature: 30 seconds, a checkpoint every 10, the surge for the last 8.
        // K winds the clock on by one checkpoint.
        {
            layout: [...SQUARE_LAYOUT],
            waves: [],
            continuous: {
                duration: 30,
                spawnEvery: [2400, 1200],
                maxAlive: 12,
                surge: 8,
                checkpointEvery: 10,
                table: [
                    { monster: 'rat', weight: 4, group: 3 },
                    { monster: 'bat', weight: 2, group: 2, from: 5 },
                    { monster: 'slime', weight: 2, from: 10 },
                    { monster: 'skitter', weight: 1, from: 20 },
                ],
            },
        },
        // 13. A secret: the crack is in the west wall, one tile up from the bottom corner. Only
        // Red breaks it; every other ray makes a dull spark. The lone slime keeps the room open.
        {
            layout: cracked(0, 7),
            waves: [{ spawns: [{ monster: 'slime', count: 1 }], delay: 60000 }],
            secret: 'red',
        },
    ],
};
