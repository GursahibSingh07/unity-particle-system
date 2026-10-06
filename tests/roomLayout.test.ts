import { describe, expect, it } from 'vitest';
import { SQUARE_LAYOUT } from '../src/config/square';
import { ROOM, ROOM_COLS, ROOM_ROWS, TILE } from '../src/config/world';
import { cornerSlip, fitFurniture, floorInFront, parseRoom, validateLayout, validateRoom, mergeRects } from '../src/systems/roomLayout';
import type { ContinuousDef, RoomDef, WaveDef } from '../src/types';
import { emptyLayout, setTile } from './helpers';

const WAVE: WaveDef = { spawns: [{ monster: 'rat', count: 1 }] };
const room = (layout: string[], extra: Partial<RoomDef> = {}): RoomDef => ({ layout, waves: [WAVE], ...extra });
const timed = (change: Partial<ContinuousDef> = {}): ContinuousDef => ({
    duration: 60,
    spawnEvery: [3000, 1500],
    maxAlive: 10,
    table: [{ monster: 'rat', weight: 1 }],
    ...change,
});
const SQUARE = [...SQUARE_LAYOUT];

describe('validateLayout', () => {
    it('accepts a valid empty room', () => {
        expect(validateLayout(emptyLayout())).toEqual([]);
    });

    it('accepts the city square', () => {
        expect(validateLayout(SQUARE)).toEqual([]);
    });

    it('accepts every legend character', () => {
        let layout = emptyLayout();
        ['.', ',', 'o', 'F', 'e'].forEach((char, i) => {
            layout = setTile(layout, 2 + i, 2, char);
        });
        layout = setTile(layout, 0, 3, 'S');
        expect(validateLayout(layout)).toEqual([]);
    });

    it.each(['C', 'H', 'x', ' ', 'p', 'E'])('reports the unknown character "%s"', (char) => {
        const problems = validateLayout(setTile(emptyLayout(), 3, 2, char));
        expect(problems).toEqual([`row 2, col 3: unknown character "${char}"`]);
    });

    it('reports a missing row', () => {
        const problems = validateLayout(emptyLayout().slice(0, ROOM_ROWS - 1));
        expect(problems).toContain(`expected ${ROOM_ROWS} rows, got ${ROOM_ROWS - 1}`);
    });

    it('reports an extra row', () => {
        const layout = emptyLayout();
        const problems = validateLayout([...layout.slice(0, 2), layout[1], ...layout.slice(2)]);
        expect(problems).toEqual([`expected ${ROOM_ROWS} rows, got ${ROOM_ROWS + 1}`]);
    });

    it('reports a row that is too short or too long', () => {
        const layout = emptyLayout();
        layout[3] = `#${'.'.repeat(ROOM_COLS - 3)}#`;
        layout[6] = `#${'.'.repeat(ROOM_COLS - 1)}#`;
        expect(validateLayout(layout)).toEqual([
            `row 3: expected ${ROOM_COLS} columns, got ${ROOM_COLS - 1}`,
            `row 6: expected ${ROOM_COLS} columns, got ${ROOM_COLS + 1}`,
        ]);
    });

    it.each([
        ['top', 7, 0],
        ['bottom', 7, ROOM_ROWS - 1],
        ['left', 0, 4],
        ['right', ROOM_COLS - 1, 4],
    ])('reports a gap in the %s wall', (_side, col, row) => {
        const problems = validateLayout(setTile(emptyLayout(), col, row, '.'));
        expect(problems).toEqual([`row ${row}, col ${col}: the outer ring must be wall`]);
    });

    it('does not let a street entry stand in the outer ring', () => {
        const problems = validateLayout(setTile(emptyLayout(), 0, 4, 'e'));
        expect(problems).toEqual(['row 4, col 0: the outer ring must be wall']);
    });

    it('accepts a cracked wall in the outer ring', () => {
        expect(validateLayout(setTile(emptyLayout(), 0, 4, 'S'))).toEqual([]);
    });

    it('reports a missing player start', () => {
        const problems = validateLayout(setTile(emptyLayout(), 5, 4, '.'));
        expect(problems).toEqual(['expected exactly one P, got 0']);
    });

    it('reports a second player start', () => {
        const problems = validateLayout(setTile(emptyLayout(), 9, 6, 'P'));
        expect(problems).toEqual(['expected exactly one P, got 2']);
    });

    it('reports every problem at once', () => {
        let layout = setTile(emptyLayout(), 5, 4, '.');
        layout = setTile(layout, 3, 2, '?');
        layout = setTile(layout, 0, 5, '.');
        expect(validateLayout(layout)).toHaveLength(3);
    });
});

describe('floorInFront', () => {
    it.each([
        ['north wall, lower row', 4, 1, 4, 2],
        ['north wall above a street entry', 9, 1, 9, 2],
        ['west wall', 0, 7, 1, 7],
        ['east wall', 19, 7, 18, 7],
        ['south wall', 3, 9, 3, 8],
    ])('finds the paving in front of the %s of the square', (_name, col, row, frontCol, frontRow) => {
        expect(floorInFront(SQUARE, col, row), `floorInFront(${col}, ${row})`).toEqual({ col: frontCol, row: frontRow });
    });

    it.each([
        ['the top row, which has building in front of it', 4, 0],
        ['a corner', 0, 0],
        ['the other corner', 19, 9],
    ])('returns null for %s', (_name, col, row) => {
        expect(floorInFront(SQUARE, col, row)).toBeNull();
    });

    it('returns null when furniture or the fountain stands in front', () => {
        const blocked = setTile(setTile(emptyLayout(), 1, 4, 'o'), 18, 4, 'F');
        expect(floorInFront(blocked, 0, 4), 'o in front').toBeNull();
        expect(floorInFront(blocked, 19, 4), 'F in front').toBeNull();
    });

    it('returns null for a wall that is not on the outer ring', () => {
        // A pillar in the middle of the floor: paving on every side, nothing but floor behind
        const layout = setTile(emptyLayout(), 10, 5, '#');
        expect(floorInFront(layout, 10, 5)).toBeNull();
    });

    it('counts a second ring of building as part of the outer ring', () => {
        // The north side of the square is two tiles deep
        expect(floorInFront(SQUARE, 12, 1)).toEqual({ col: 12, row: 2 });
    });
});

describe('validateRoom', () => {
    it('accepts a room of waves on the square', () => {
        expect(validateRoom(room(SQUARE))).toEqual([]);
    });

    it('accepts a timed room on the square', () => {
        expect(validateRoom(room(SQUARE, { waves: [], continuous: timed() }))).toEqual([]);
    });

    it('passes on every layout problem', () => {
        const layout = setTile(SQUARE, 3, 3, '?');
        expect(validateRoom(room(layout))).toEqual(validateLayout(layout));
        expect(validateRoom(room(layout))).toHaveLength(1);
    });

    it('accepts a cracked wall with paving in front and a secret ray', () => {
        expect(validateRoom(room(setTile(SQUARE, 4, 1, 'S'), { secret: 'blue' }))).toEqual([]);
        expect(validateRoom(room(setTile(SQUARE, 0, 7, 'S'), { secret: 'green' }))).toEqual([]);
    });

    it('reports an S tile without a secret ray', () => {
        expect(validateRoom(room(setTile(SQUARE, 4, 1, 'S')))).toEqual(['an S tile needs a secret ray']);
    });

    it('reports a secret ray without an S tile', () => {
        expect(validateRoom(room(SQUARE, { secret: 'red' }))).toEqual(['a secret ray needs an S tile']);
    });

    it('reports more than one S tile', () => {
        const layout = setTile(setTile(SQUARE, 4, 1, 'S'), 0, 7, 'S');
        expect(validateRoom(room(layout, { secret: 'red' }))).toEqual(['expected at most one S, got 2']);
    });

    it('reports an S tile with no paving in front of it', () => {
        // The top row of the square has a second row of building in front
        expect(validateRoom(room(setTile(SQUARE, 4, 0, 'S'), { secret: 'red' }))).toEqual([
            'row 0, col 4: an S tile needs open paving in front of it',
        ]);
        expect(validateRoom(room(setTile(SQUARE, 0, 0, 'S'), { secret: 'red' })), 'a corner').toEqual([
            'row 0, col 0: an S tile needs open paving in front of it',
        ]);
    });

    it('reports an S tile with furniture in front of it', () => {
        const layout = setTile(setTile(emptyLayout(), 0, 4, 'S'), 1, 4, 'o');
        expect(validateRoom(room(layout, { secret: 'red' }))).toEqual(['row 4, col 0: an S tile needs open paving in front of it']);
    });

    it('reports an S tile that is not on the outer ring', () => {
        const layout = setTile(emptyLayout(), 10, 5, 'S');
        expect(validateRoom(room(layout, { secret: 'red' }))).toEqual(['row 5, col 10: an S tile must be on the outer ring']);
    });

    it('reports a room with nothing to fight', () => {
        expect(validateRoom({ layout: SQUARE, waves: [] })).toEqual(['a room needs waves or a continuous spawn table']);
    });

    it('reports a timed room that also has waves', () => {
        expect(validateRoom(room(SQUARE, { continuous: timed() }))).toEqual(['a timed room must have no waves']);
    });

    it.each([
        ['no duration', { duration: 0 }, 'a timed room needs a duration'],
        ['a negative duration', { duration: -5 }, 'a timed room needs a duration'],
        ['a NaN duration', { duration: Number.NaN }, 'a timed room needs a duration'],
        ['no maxAlive', { maxAlive: 0 }, 'a timed room needs maxAlive above 0'],
        ['a zero start interval', { spawnEvery: [0, 1500] as [number, number] }, 'a timed room needs spawnEvery above 0'],
        ['a zero end interval', { spawnEvery: [3000, 0] as [number, number] }, 'a timed room needs spawnEvery above 0'],
        ['an empty table', { table: [] }, 'a timed room needs something that can appear from the first second'],
        [
            'nothing at the first second',
            { table: [{ monster: 'rat' as const, weight: 1, from: 5 }] },
            'a timed room needs something that can appear from the first second',
        ],
        [
            'only a weightless line at the first second',
            {
                table: [
                    { monster: 'rat' as const, weight: 0 },
                    { monster: 'bat' as const, weight: 2, from: 10 },
                ],
            },
            'a timed room needs something that can appear from the first second',
        ],
    ])('reports a timed room with %s', (_name, change, problem) => {
        expect(validateRoom({ layout: SQUARE, waves: [], continuous: timed(change) })).toEqual([problem]);
    });
});

describe('parseRoom', () => {
    it('produces one tile per character, at the right world position', () => {
        const parsed = parseRoom(emptyLayout());
        expect(parsed.tiles).toHaveLength(ROOM_COLS * ROOM_ROWS);

        for (const tile of parsed.tiles) {
            expect(tile.x, `tile (${tile.col}, ${tile.row}) x`).toBe(ROOM.x + tile.col * TILE);
            expect(tile.y, `tile (${tile.col}, ${tile.row}) y`).toBe(ROOM.y + tile.row * TILE);
            expect(tile.width).toBe(TILE);
            expect(tile.height).toBe(TILE);
        }
        const last = parsed.tiles.at(-1)!;
        expect(last.x + last.width).toBe(ROOM.x + ROOM.width);
        expect(last.y + last.height).toBe(ROOM.y + ROOM.height);
    });

    it('puts the player start at the centre of the P tile', () => {
        const parsed = parseRoom(setTile(setTile(emptyLayout(), 5, 4, '.'), 12, 7, 'P'));
        expect(parsed.start).toEqual({ x: ROOM.x + 12 * TILE + TILE / 2, y: ROOM.y + 7 * TILE + TILE / 2 });
    });

    it('falls back to the middle of the room when there is no P', () => {
        const parsed = parseRoom(setTile(emptyLayout(), 5, 4, '.'));
        expect(parsed.start).toEqual({ x: ROOM.x + ROOM.width / 2, y: ROOM.y + ROOM.height / 2 });
    });

    it('treats walls as solid and ray-blocking', () => {
        const parsed = parseRoom(emptyLayout());
        const ring = 2 * ROOM_COLS + 2 * (ROOM_ROWS - 2);
        expect(parsed.solids).toHaveLength(ring);
        expect(parsed.walls).toHaveLength(ring);
        expect(parsed.secrets).toEqual([]);
        expect(parsed.entries).toEqual([]);
    });

    it('treats street furniture and the fountain as solid but not ray-blocking', () => {
        const empty = parseRoom(emptyLayout());
        const parsed = parseRoom(setTile(setTile(emptyLayout(), 8, 3, 'o'), 9, 3, 'F'));
        expect(parsed.solids).toHaveLength(empty.solids.length + 2);
        expect(parsed.walls).toHaveLength(empty.walls.length);
        for (const col of [8, 9]) {
            expect(parsed.solids).toContainEqual(expect.objectContaining({ col, row: 3, kind: 'prop' }));
            expect(parsed.walls).not.toContainEqual(expect.objectContaining({ col, row: 3 }));
        }
    });

    it('treats a cracked wall as a wall, and lists it as a secret', () => {
        const empty = parseRoom(emptyLayout());
        const parsed = parseRoom(setTile(emptyLayout(), 0, 6, 'S'));
        expect(parsed.secrets).toHaveLength(1);
        expect(parsed.secrets[0]).toMatchObject({ col: 0, row: 6, kind: 'secret', x: ROOM.x, y: ROOM.y + 6 * TILE });
        // It replaced a wall tile: the counts do not change, and the same object is in all three lists
        expect(parsed.solids).toHaveLength(empty.solids.length);
        expect(parsed.walls).toHaveLength(empty.walls.length);
        expect(parsed.solids).toContain(parsed.secrets[0]);
        expect(parsed.walls).toContain(parsed.secrets[0]);
    });

    it('lists street entries, which are open floor', () => {
        const empty = parseRoom(emptyLayout());
        const parsed = parseRoom(setTile(setTile(emptyLayout(), 1, 4, 'e'), 9, 1, 'e'));
        expect(parsed.entries.map((tile) => [tile.col, tile.row])).toEqual([
            [9, 1],
            [1, 4],
        ]);
        for (const entry of parsed.entries) {
            expect(entry.kind).toBe('floor');
        }
        expect(parsed.solids).toHaveLength(empty.solids.length);
    });

    it('maps each legend character to its tile kind', () => {
        const chars: Record<string, string> = { '#': 'wall', '.': 'floor', ',': 'floorAlt', o: 'prop', F: 'prop', e: 'floor', P: 'floor' };
        let layout = setTile(emptyLayout(), 5, 4, '.');
        Object.keys(chars).forEach((char, i) => {
            layout = setTile(layout, 2 + i, 2, char);
        });
        const parsed = parseRoom(layout);
        Object.entries(chars).forEach(([char, kind], i) => {
            const tile = parsed.tiles.find((t) => t.col === 2 + i && t.row === 2)!;
            expect(tile.kind, `tile for "${char}"`).toBe(kind);
        });
    });

    it('reads the city square: four streets, the fountain, four lamp posts', () => {
        const parsed = parseRoom(SQUARE);
        expect(parsed.entries.map((tile) => `${tile.col},${tile.row}`).sort()).toEqual(
            ['9,2', '10,2', '1,4', '18,4', '1,5', '18,5', '9,8'].sort(),
        );
        expect(parsed.solids.filter((solid) => !parsed.walls.includes(solid))).toHaveLength(8);
        expect(parsed.start).toEqual({ x: ROOM.x + 10 * TILE + TILE / 2, y: ROOM.y + 8 * TILE + TILE / 2 });
        expect(parsed.secrets).toEqual([]);
    });
});

describe('mergeRects', () => {
    const tile = (col: number, row: number) => ({ x: col * 16, y: row * 16, width: 16, height: 16 });

    it('joins a row of tiles into one strip', () => {
        expect(mergeRects([tile(0, 0), tile(1, 0), tile(2, 0)])).toEqual([{ x: 0, y: 0, width: 48, height: 16 }]);
    });

    it('stacks equal strips into one block, and keeps apart what does not touch', () => {
        const merged = mergeRects([tile(0, 0), tile(1, 0), tile(0, 1), tile(1, 1), tile(5, 0)]);
        expect(merged).toHaveLength(2);
        expect(merged).toContainEqual({ x: 0, y: 0, width: 32, height: 32 });
        expect(merged).toContainEqual({ x: 80, y: 0, width: 16, height: 16 });
    });

    it('covers exactly the area it was given', () => {
        const tiles = [tile(0, 0), tile(1, 0), tile(2, 0), tile(0, 1), tile(0, 2), tile(4, 4)];
        const area = mergeRects(tiles).reduce((sum, rect) => sum + rect.width * rect.height, 0);
        expect(area).toBe(tiles.length * 16 * 16);
    });
});

describe('fitFurniture', () => {
    it('keeps every fitted body inside the tiles it stands on, and smaller than them', () => {
        for (const block of [{ x: 48, y: 68, width: 16, height: 16 }, { x: 144, y: 100, width: 32, height: 32 }]) {
            const fitted = fitFurniture([block]);
            expect(fitted.length).toBeGreaterThan(0);
            for (const rect of fitted) {
                expect(rect.x).toBeGreaterThan(block.x);
                expect(rect.y).toBeGreaterThan(block.y);
                expect(rect.x + rect.width).toBeLessThan(block.x + block.width);
                expect(rect.y + rect.height).toBeLessThanOrEqual(block.y + block.height);
            }
        }
    });

    it('leaves a block of any other shape alone', () => {
        const strip = { x: 0, y: 0, width: 48, height: 16 };
        expect(fitFurniture([strip])).toEqual([strip]);
    });
});

describe('cornerSlip', () => {
    const wall = [{ x: 0, y: 0, width: 16, height: 16 }];
    const body = (x: number, y: number) => ({ x, y, width: 8, height: 8 });

    it('steps aside when only a corner is in the way', () => {
        // Walking up, his left 3 units under the block's right end
        expect(cornerSlip(body(13, 16), 0, -1, wall, 5)).toEqual({ x: 1, y: 0 });
        expect(cornerSlip(body(-5, 16), 0, -1, wall, 5)).toEqual({ x: -1, y: 0 });
        expect(cornerSlip(body(16, 13), -1, 0, wall, 5)).toEqual({ x: 0, y: 1 });
    });

    it('does nothing when the way is clear, when he is square on, or when he moves diagonally', () => {
        expect(cornerSlip(body(30, 16), 0, -1, wall, 5)).toBeNull();
        expect(cornerSlip(body(4, 16), 0, -1, wall, 5)).toBeNull();
        expect(cornerSlip(body(13, 16), 0.7, -0.7, wall, 5)).toBeNull();
    });
});
