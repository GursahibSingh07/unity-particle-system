import { LEVELS, SANDBOX } from '../src/config/levels';
import { ROOM_COLS, ROOM_ROWS } from '../src/config/world';
import type { ArtStyle, LevelDef, MonsterId, RadiationId, RoomDef, StyleId } from '../src/types';

// The unions in src/types.ts do not exist at runtime, so the contract is restated here.
// The `satisfies` checks below stop these lists from drifting when a type is edited.
export const RADIATION_IDS = ['radio', 'infrared', 'ultraviolet', 'gamma'] as const satisfies readonly RadiationId[];
export const MONSTER_IDS = [
    'swarmlet',
    'frostling',
    'shade',
    'ironclad',
    'prism',
] as const satisfies readonly MonsterId[];
export const ART_STYLES = ['goldenAge', 'noir', 'manga', 'plain'] as const satisfies readonly ArtStyle[];
export const STYLE_IDS = [...ART_STYLES, 'finalPage'] as const satisfies readonly StyleId[];

export interface LevelCase {
    /** Used in test names and failure messages, e.g. `level 2 "Noir"` */
    label: string;
    level: LevelDef;
    shipped: boolean;
}

export interface RoomCase {
    /** e.g. `level 2 "Noir" room 3` */
    label: string;
    level: LevelDef;
    room: RoomDef;
    shipped: boolean;
}

/** Every level the game can load: the shipped ones plus the dev sandbox */
export const LEVEL_CASES: LevelCase[] = [
    ...LEVELS.map((level, i) => ({ label: `level ${i + 1} "${level.name}"`, level, shipped: true })),
    { label: 'sandbox', level: SANDBOX, shipped: false },
];

export const ROOM_CASES: RoomCase[] = LEVEL_CASES.flatMap(({ label, level, shipped }) =>
    (level.rooms ?? []).map((room, i) => ({ label: `${label} room ${i + 1}`, level, room, shipped })),
);

/** A valid empty room: a ring of wall around floor, with the player start in the middle */
export function emptyLayout(): string[] {
    const edge = '#'.repeat(ROOM_COLS);
    const inner = `#${'.'.repeat(ROOM_COLS - 2)}#`;
    const layout = Array.from({ length: ROOM_ROWS }, (_, row) =>
        row === 0 || row === ROOM_ROWS - 1 ? edge : inner,
    );
    return setTile(layout, 5, 4, 'P');
}

/** A copy of the layout with one character replaced */
export function setTile(layout: string[], col: number, row: number, char: string): string[] {
    return layout.map((line, r) => (r === row ? line.slice(0, col) + char + line.slice(col + 1) : line));
}

const WALKABLE = new Set(['.', ',', 'P', 'C']);

export interface Reachability {
    /** Number of tiles the player can stand on */
    walkable: number;
    /** How many of those can be walked to from the player start */
    reached: number;
    /** Walkable tiles that cannot be reached, as "(col, row)" */
    unreachable: string[];
}

/** Flood fill over walkable tiles from P, moving in the four compass directions */
export function reachability(layout: string[]): Reachability {
    const isWalkable = (col: number, row: number) => WALKABLE.has(layout[row]?.[col] ?? '#');
    const key = (col: number, row: number) => `(${col}, ${row})`;

    const all: [number, number][] = [];
    let start: [number, number] | undefined;
    layout.forEach((line, row) => {
        [...line].forEach((char, col) => {
            if (WALKABLE.has(char)) {
                all.push([col, row]);
            }
            if (char === 'P') {
                start ??= [col, row];
            }
        });
    });

    const seen = new Set<string>();
    const queue: [number, number][] = start ? [start] : [];
    if (start) {
        seen.add(key(...start));
    }
    while (queue.length > 0) {
        const [col, row] = queue.pop()!;
        for (const [dc, dr] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const next: [number, number] = [col + dc, row + dr];
            if (isWalkable(...next) && !seen.has(key(...next))) {
                seen.add(key(...next));
                queue.push(next);
            }
        }
    }

    return {
        walkable: all.length,
        reached: seen.size,
        unreachable: all.map(([col, row]) => key(col, row)).filter((k) => !seen.has(k)),
    };
}
