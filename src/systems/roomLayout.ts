import { ROOM, ROOM_COLS, ROOM_ROWS, TILE } from '../config/world';
import type { RoomDef } from '../types';

// Pure layout parsing (no Phaser), so it can be unit tested.
//
// Legend (docs/DESIGN.md): # building wall, . paving, , worn paving, o street furniture,
// F fountain, e street entry, P player start, S a cracked wall on the outer ring (the secret).

export type TileKind = 'floor' | 'floorAlt' | 'wall' | 'prop' | 'secret';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RoomTile extends Rect {
    col: number;
    row: number;
    kind: TileKind;
}

export interface ParsedRoom {
    tiles: RoomTile[];
    /** Tiles that stop movement */
    solids: Rect[];
    /** Tiles that also stop radiation */
    walls: Rect[];
    /** Player start, in world units (centre of the P tile) */
    start: { x: number; y: number };
    /** The S tiles: cracked walls. Each is also in `solids` and `walls`, and stays there when it breaks */
    secrets: RoomTile[];
    /** The e tiles: where enemies come in from the streets */
    entries: RoomTile[];
}

const KINDS: Record<string, TileKind> = {
    '#': 'wall',
    '.': 'floor',
    ',': 'floorAlt',
    o: 'prop',
    P: 'floor',
    S: 'secret',
    // The fountain: stands in the way like any prop
    F: 'prop',
    // A street entry: open floor that enemies walk in from
    e: 'floor',
};

const NEIGHBOURS = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
];

const isWallChar = (char: string | undefined) => char === '#' || char === 'S';
const isFloorChar = (char: string | undefined) => char !== undefined && KINDS[char]?.startsWith('floor') === true;

/** Returns a list of problems with a layout; empty when it is valid. */
export function validateLayout(layout: string[]): string[] {
    const problems: string[] = [];
    if (layout.length !== ROOM_ROWS) {
        problems.push(`expected ${ROOM_ROWS} rows, got ${layout.length}`);
    }

    let starts = 0;
    layout.forEach((line, row) => {
        if (line.length !== ROOM_COLS) {
            problems.push(`row ${row}: expected ${ROOM_COLS} columns, got ${line.length}`);
        }
        [...line].forEach((char, col) => {
            if (!(char in KINDS)) {
                problems.push(`row ${row}, col ${col}: unknown character "${char}"`);
            }
            if (char === 'P') {
                starts++;
            }
            const onEdge = row === 0 || row === layout.length - 1 || col === 0 || col === line.length - 1;
            if (onEdge && !isWallChar(char)) {
                problems.push(`row ${row}, col ${col}: the outer ring must be wall`);
            }
        });
    });

    if (starts !== 1) {
        problems.push(`expected exactly one P, got ${starts}`);
    }
    return problems;
}

/** [col, row] of every tile with this character */
function findAll(layout: string[], wanted: string) {
    const found: [number, number][] = [];
    layout.forEach((line, row) => {
        [...line].forEach((char, col) => {
            if (char === wanted) {
                found.push([col, row]);
            }
        });
    });
    return found;
}

/** True if there is nothing but building from this wall tile to the edge of the room, going one way */
function wallToEdge(layout: string[], col: number, row: number, dc: number, dr: number) {
    for (let c = col + dc, r = row + dr; layout[r]?.[c] !== undefined; c += dc, r += dr) {
        if (!isWallChar(layout[r][c])) {
            return false;
        }
    }
    return true;
}

/**
 * The open paving in front of a wall tile on the outer ring, as { col, row }: the tile a
 * person facing the wall would stand on. The ring may be more than one tile deep (the north
 * side of the square is), so "on the ring" means there is only building behind the tile.
 * Returns null when the tile is not on the ring or has no paving in front of it.
 */
export function floorInFront(layout: string[], col: number, row: number): { col: number; row: number } | null {
    for (const [dc, dr] of NEIGHBOURS) {
        if (isFloorChar(layout[row + dr]?.[col + dc]) && wallToEdge(layout, col, row, -dc, -dr)) {
            return { col: col + dc, row: row + dr };
        }
    }
    return null;
}

/**
 * Checks a whole room: the layout itself, that its cracked wall agrees with `secret`, and that
 * it has something to fight. Returns a list of problems; empty when the room is valid.
 */
export function validateRoom(room: RoomDef): string[] {
    const problems = validateLayout(room.layout);
    const secrets = findAll(room.layout, 'S');

    if (secrets.length > 0 && !room.secret) {
        problems.push('an S tile needs a secret ray');
    }
    if (room.secret && secrets.length === 0) {
        problems.push('a secret ray needs an S tile');
    }
    if (secrets.length > 1) {
        problems.push(`expected at most one S, got ${secrets.length}`);
    }
    for (const [col, row] of secrets) {
        if (floorInFront(room.layout, col, row)) {
            continue;
        }
        const onRing = NEIGHBOURS.some(([dc, dr]) => wallToEdge(room.layout, col, row, dc, dr));
        problems.push(
            onRing
                ? `row ${row}, col ${col}: an S tile needs open paving in front of it`
                : `row ${row}, col ${col}: an S tile must be on the outer ring`,
        );
    }

    if (room.continuous) {
        const { duration, table, maxAlive, spawnEvery } = room.continuous;
        if (room.waves.length > 0) {
            problems.push('a timed room must have no waves');
        }
        if (!(duration > 0)) {
            problems.push('a timed room needs a duration');
        }
        if (!(maxAlive > 0)) {
            problems.push('a timed room needs maxAlive above 0');
        }
        if (!(spawnEvery[0] > 0 && spawnEvery[1] > 0)) {
            problems.push('a timed room needs spawnEvery above 0');
        }
        if (!table.some((entry) => (entry.from ?? 0) <= 0 && entry.weight > 0)) {
            problems.push('a timed room needs something that can appear from the first second');
        }
    } else if (room.waves.length === 0) {
        problems.push('a room needs waves or a continuous spawn table');
    }
    return problems;
}

export function parseRoom(layout: string[]): ParsedRoom {
    const tiles: RoomTile[] = [];
    const solids: Rect[] = [];
    const walls: Rect[] = [];
    const secrets: RoomTile[] = [];
    const entries: RoomTile[] = [];
    let start = { x: ROOM.x + ROOM.width / 2, y: ROOM.y + ROOM.height / 2 };

    layout.forEach((line, row) => {
        [...line].forEach((char, col) => {
            const kind = KINDS[char] ?? 'floor';
            const tile: RoomTile = {
                col,
                row,
                kind,
                x: ROOM.x + col * TILE,
                y: ROOM.y + row * TILE,
                width: TILE,
                height: TILE,
            };
            tiles.push(tile);

            if (kind === 'wall' || kind === 'secret') {
                solids.push(tile);
                walls.push(tile);
            } else if (kind === 'prop') {
                solids.push(tile);
            }
            if (kind === 'secret') {
                secrets.push(tile);
            }
            if (char === 'e') {
                entries.push(tile);
            }
            if (char === 'P') {
                start = { x: tile.x + TILE / 2, y: tile.y + TILE / 2 };
            }
        });
    });

    return { tiles, solids, walls, start, secrets, entries };
}
