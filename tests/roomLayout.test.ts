import { describe, expect, it } from 'vitest';
import { HUD_HEIGHT, ROOM, ROOM_COLS, ROOM_ROWS, TILE, WORLD_HEIGHT, WORLD_WIDTH, ZOOM } from '../src/config/world';
import { parseRoom, validateLayout } from '../src/systems/roomLayout';
import { emptyLayout, setTile } from './helpers';

describe('world constants', () => {
    it('fits the room and the HUD strip exactly inside the world', () => {
        expect(ROOM.width).toBe(ROOM_COLS * TILE);
        expect(ROOM.height).toBe(ROOM_ROWS * TILE);
        expect(ROOM.x + ROOM.width).toBeLessThanOrEqual(WORLD_WIDTH);
        expect(ROOM.y).toBe(HUD_HEIGHT);
        expect(ROOM.y + ROOM.height).toBe(WORLD_HEIGHT);
        expect(HUD_HEIGHT).toBeGreaterThanOrEqual(0);
    });

    it('uses a whole-number zoom so pixel art stays sharp', () => {
        expect(Number.isInteger(ZOOM)).toBe(true);
        expect(ZOOM).toBeGreaterThan(0);
    });
});

describe('validateLayout', () => {
    it('accepts an empty room', () => {
        expect(validateLayout(emptyLayout())).toEqual([]);
    });

    it('accepts every character in the legend', () => {
        let layout = emptyLayout();
        [',', 'o', 'C', 'S', '#'].forEach((char, i) => {
            layout = setTile(layout, 2 + i, 2, char);
        });
        expect(validateLayout(layout)).toEqual([]);
    });

    it('accepts a secret wall in the outer ring', () => {
        expect(validateLayout(setTile(emptyLayout(), 0, 3, 'S'))).toEqual([]);
    });

    it('reports too few and too many rows', () => {
        const layout = emptyLayout();
        // Drop or repeat an inner row so the outer ring stays intact
        const short = [...layout.slice(0, 2), ...layout.slice(3)];
        const long = [...layout.slice(0, 2), layout[1], ...layout.slice(2)];

        expect(validateLayout(short)).toEqual([`expected ${ROOM_ROWS} rows, got ${ROOM_ROWS - 1}`]);
        expect(validateLayout(long)).toEqual([`expected ${ROOM_ROWS} rows, got ${ROOM_ROWS + 1}`]);
    });

    it('reports a row with the wrong number of columns, naming the row', () => {
        const layout = emptyLayout();
        layout[3] = `#${'.'.repeat(ROOM_COLS - 3)}#`;
        expect(validateLayout(layout)).toEqual([`row 3: expected ${ROOM_COLS} columns, got ${ROOM_COLS - 1}`]);

        layout[3] = `#${'.'.repeat(ROOM_COLS - 1)}#`;
        expect(validateLayout(layout)).toEqual([`row 3: expected ${ROOM_COLS} columns, got ${ROOM_COLS + 1}`]);
    });

    it('reports an unknown character, naming the tile', () => {
        const problems = validateLayout(setTile(emptyLayout(), 7, 2, 'X'));
        expect(problems).toEqual(['row 2, col 7: unknown character "X"']);
    });

    it.each([
        ['top', 4, 0],
        ['bottom', 4, ROOM_ROWS - 1],
        ['left', 0, 4],
        ['right', ROOM_COLS - 1, 4],
    ])('reports a gap in the %s edge of the outer ring', (_edge, col, row) => {
        const problems = validateLayout(setTile(emptyLayout(), col, row, '.'));
        expect(problems).toEqual([`row ${row}, col ${col}: the outer ring must be wall`]);
    });

    it('reports a prop in the outer ring, because props do not stop radiation', () => {
        const problems = validateLayout(setTile(emptyLayout(), 0, 2, 'o'));
        expect(problems).toEqual(['row 2, col 0: the outer ring must be wall']);
    });

    it('reports a room with no player start', () => {
        const layout = emptyLayout().map((line) => line.replace('P', '.'));
        expect(validateLayout(layout)).toEqual(['expected exactly one P, got 0']);
    });

    it('reports a room with more than one player start', () => {
        const layout = setTile(emptyLayout(), 10, 6, 'P');
        expect(validateLayout(layout)).toEqual(['expected exactly one P, got 2']);
    });

    it('reports every problem, not only the first', () => {
        let layout = emptyLayout().map((line) => line.replace('P', '.'));
        layout = setTile(layout, 3, 3, '?');
        layout = setTile(layout, 0, 5, '.');
        expect(validateLayout(layout)).toHaveLength(3);
    });
});

describe('parseRoom', () => {
    it('returns one tile per character, in world coordinates', () => {
        const room = parseRoom(emptyLayout());
        expect(room.tiles).toHaveLength(ROOM_COLS * ROOM_ROWS);

        for (const tile of room.tiles) {
            expect(tile.x).toBe(ROOM.x + tile.col * TILE);
            expect(tile.y).toBe(ROOM.y + tile.row * TILE);
            expect(tile.width).toBe(TILE);
            expect(tile.height).toBe(TILE);
        }

        const corner = room.tiles.find((tile) => tile.col === ROOM_COLS - 1 && tile.row === ROOM_ROWS - 1)!;
        expect(corner.x + corner.width).toBe(ROOM.x + ROOM.width);
        expect(corner.y + corner.height).toBe(ROOM.y + ROOM.height);
    });

    it('puts the player start at the centre of the P tile', () => {
        const layout = setTile(emptyLayout().map((line) => line.replace('P', '.')), 12, 7, 'P');
        const room = parseRoom(layout);
        expect(room.start).toEqual({ x: ROOM.x + 12 * TILE + TILE / 2, y: ROOM.y + 7 * TILE + TILE / 2 });
        expect(room.tiles.find((tile) => tile.col === 12 && tile.row === 7)!.kind).toBe('floor');
    });

    it('maps each legend character to its tile kind', () => {
        let layout = emptyLayout();
        const chars = { ',': 'floorAlt', o: 'prop', C: 'chest', S: 'secret', '#': 'wall', '.': 'floor' };
        Object.keys(chars).forEach((char, i) => {
            layout = setTile(layout, 2 + i, 2, char);
        });

        const room = parseRoom(layout);
        Object.values(chars).forEach((kind, i) => {
            const tile = room.tiles.find((t) => t.col === 2 + i && t.row === 2)!;
            expect(tile.kind, `tile for "${Object.keys(chars)[i]}"`).toBe(kind);
        });
    });

    it('treats the outer ring of an empty room as both solid and wall', () => {
        const room = parseRoom(emptyLayout());
        const ring = 2 * ROOM_COLS + 2 * (ROOM_ROWS - 2);
        expect(room.solids).toHaveLength(ring);
        expect(room.walls).toHaveLength(ring);
    });

    it('makes props block movement but not radiation', () => {
        const room = parseRoom(setTile(emptyLayout(), 8, 3, 'o'));
        const at = (rect: { x: number; y: number }) => rect.x === ROOM.x + 8 * TILE && rect.y === ROOM.y + 3 * TILE;
        expect(room.solids.some(at)).toBe(true);
        expect(room.walls.some(at)).toBe(false);
    });

    it('makes inner walls and secret walls block both movement and radiation', () => {
        for (const char of ['#', 'S']) {
            const room = parseRoom(setTile(emptyLayout(), 8, 3, char));
            const at = (rect: { x: number; y: number }) =>
                rect.x === ROOM.x + 8 * TILE && rect.y === ROOM.y + 3 * TILE;
            expect(room.solids.some(at), `"${char}" in solids`).toBe(true);
            expect(room.walls.some(at), `"${char}" in walls`).toBe(true);
        }
    });

    it('leaves floor, floor variants, the start and chests free to walk on', () => {
        let layout = emptyLayout();
        layout = setTile(layout, 8, 3, ',');
        layout = setTile(layout, 9, 3, 'C');
        const room = parseRoom(layout);
        const ring = 2 * ROOM_COLS + 2 * (ROOM_ROWS - 2);
        expect(room.solids).toHaveLength(ring);
        expect(room.walls).toHaveLength(ring);
    });
});
