import { ROOM, ROOM_COLS, ROOM_ROWS, TILE } from '../config/world';
import type { RoomDef } from '../types';

// Pure layout parsing (no Phaser), so it can be unit tested.
//
// Legend (docs/DESIGN.md): # wall, . floor, , floor variant, o prop, P player start,
// C chest (floor until the room is cleared), S secret wall, H health upgrade (floor with
// the pickup on it, meant to sit behind an S).

export type TileKind = 'floor' | 'floorAlt' | 'wall' | 'prop' | 'chest' | 'secret';

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
    /** The C tile, where the chest appears once the room is cleared */
    chest: RoomTile | null;
    /** The S tiles; each is also in `solids` and `walls` until it is broken */
    secrets: RoomTile[];
    /** The H tile, where the health upgrade waits */
    upgrade: RoomTile | null;
}

const KINDS: Record<string, TileKind> = {
    '#': 'wall',
    '.': 'floor',
    ',': 'floorAlt',
    o: 'prop',
    P: 'floor',
    C: 'chest',
    S: 'secret',
    // The upgrade is a pickup lying on ordinary floor
    H: 'floor',
};

/** Returns a list of problems with a layout; empty when it is valid. */
export function validateLayout(layout: string[]): string[] {
    const problems: string[] = [];
    if (layout.length !== ROOM_ROWS) {
        problems.push(`expected ${ROOM_ROWS} rows, got ${layout.length}`);
    }

    let starts = 0;
    let chests = 0;
    let upgrades = 0;
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
            } else if (char === 'C') {
                chests++;
            } else if (char === 'H') {
                upgrades++;
            }
            const onEdge = row === 0 || row === layout.length - 1 || col === 0 || col === line.length - 1;
            if (onEdge && char !== '#' && char !== 'S') {
                problems.push(`row ${row}, col ${col}: the outer ring must be wall`);
            }
        });
    });

    if (starts !== 1) {
        problems.push(`expected exactly one P, got ${starts}`);
    }
    if (chests > 1) {
        problems.push(`expected at most one C, got ${chests}`);
    }
    if (upgrades > 1) {
        problems.push(`expected at most one H, got ${upgrades}`);
    }
    return problems;
}

/** "col,row" of every tile with this character */
function findAll(layout: string[], wanted: string) {
    const found: string[] = [];
    layout.forEach((line, row) => {
        [...line].forEach((char, col) => {
            if (char === wanted) {
                found.push(`${col},${row}`);
            }
        });
    });
    return found;
}

/** Tiles that can be walked to from the start; `open` says whether secret walls count as broken */
function reachableFrom(layout: string[], open: boolean) {
    const blocks = (char: string | undefined) =>
        char === undefined || char === '#' || char === 'o' || (char === 'S' && !open);
    const seen = new Set(findAll(layout, 'P'));
    const queue = [...seen].map((key) => key.split(',').map(Number));
    while (queue.length > 0) {
        const [col, row] = queue.pop()!;
        for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const key = `${col + dc},${row + dr}`;
            if (!seen.has(key) && !blocks(layout[row + dr]?.[col + dc])) {
                seen.add(key);
                queue.push([col + dc, row + dr]);
            }
        }
    }
    return seen;
}

/**
 * Checks a whole room: the layout itself, and that its chest and secret agree with
 * `reward` and `secret`. Returns a list of problems; empty when the room is valid.
 */
export function validateRoom(room: RoomDef): string[] {
    const problems = validateLayout(room.layout);
    const chests = findAll(room.layout, 'C');
    const secrets = findAll(room.layout, 'S');
    const upgrades = findAll(room.layout, 'H');

    if (room.reward && chests.length !== 1) {
        problems.push(`a room with a reward needs exactly one C, got ${chests.length}`);
    }
    if (!room.reward && chests.length > 0) {
        problems.push('a C tile needs a reward');
    }
    if (chests.length === 1 && !reachableFrom(room.layout, false).has(chests[0])) {
        problems.push('the C tile cannot be reached from P');
    }

    if (secrets.length > 0 && !room.secret) {
        problems.push('S tiles need a secret radiation');
    }
    if (room.secret && secrets.length === 0) {
        problems.push('a secret radiation needs at least one S tile');
    }
    if (secrets.length > 0 && upgrades.length !== 1) {
        problems.push(`a room with S tiles needs exactly one H, got ${upgrades.length}`);
    }
    if (upgrades.length > 0 && secrets.length === 0) {
        problems.push('an H tile must be hidden behind an S tile');
    }
    if (upgrades.length === 1 && secrets.length > 0) {
        if (reachableFrom(room.layout, false).has(upgrades[0])) {
            problems.push('the H tile can be reached without breaking an S tile');
        } else if (!reachableFrom(room.layout, true).has(upgrades[0])) {
            problems.push('the H tile cannot be reached even with the S tiles broken');
        }
    }
    return problems;
}

export function parseRoom(layout: string[]): ParsedRoom {
    const tiles: RoomTile[] = [];
    const solids: Rect[] = [];
    const walls: Rect[] = [];
    const secrets: RoomTile[] = [];
    let start = { x: ROOM.x + ROOM.width / 2, y: ROOM.y + ROOM.height / 2 };
    let chest: RoomTile | null = null;
    let upgrade: RoomTile | null = null;

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

            if (char === 'P') {
                start = { x: tile.x + TILE / 2, y: tile.y + TILE / 2 };
            } else if (char === 'C') {
                chest ??= tile;
            } else if (char === 'H') {
                upgrade ??= tile;
            }
        });
    });

    return { tiles, solids, walls, start, chest, secrets, upgrade };
}
