import { LEVELS, SANDBOX } from '../src/config/levels';
import { ROOM_COLS, ROOM_ROWS } from '../src/config/world';
import type {
    ArtStyle,
    ContinuousDef,
    EnemyClass,
    LevelDef,
    MonsterId,
    RayId,
    RayMode,
    RoomDef,
    StyleId,
    UpgradeId,
    WeaponRule,
} from '../src/types';

// The unions in src/types.ts do not exist at runtime, so the contract is restated here.
// The `satisfies` checks stop these lists holding anything the types do not, and the
// `Exhaustive` checks below stop them missing anything the types gain.
export const RAY_IDS = ['blue', 'red', 'green', 'white', 'uv'] as const satisfies readonly RayId[];
export const RAY_MODES = ['rgb', 'uv', 'unprism'] as const satisfies readonly RayMode[];
export const ENEMY_CLASSES = ['swarm', 'armor', 'speed', 'stealth', 'projectile', 'boss'] as const satisfies readonly EnemyClass[];
export const MONSTER_IDS = [
    'rat',
    'slime',
    'bat',
    'ironclad',
    'golem',
    'zigbat',
    'skitter',
    'ghost',
    'wraith',
    'snowman',
    'acidSlime',
    'prism',
] as const satisfies readonly MonsterId[];
export const ART_STYLES = ['goldenAge', 'cyberpunk', 'retro', 'manga', 'plain'] as const satisfies readonly ArtStyle[];
export const STYLE_IDS = [...ART_STYLES, 'finalPage'] as const satisfies readonly StyleId[];
export const UPGRADE_IDS = [...RAY_IDS, 'dash', 'doubleDash'] as const satisfies readonly UpgradeId[];

/** Compiles only when the list names every member of the union */
type Exhaustive<Union, List extends readonly unknown[]> = [Union] extends [List[number]] ? true : never;
export const EXHAUSTIVE: [
    Exhaustive<RayId, typeof RAY_IDS>,
    Exhaustive<RayMode, typeof RAY_MODES>,
    Exhaustive<EnemyClass, typeof ENEMY_CLASSES>,
    Exhaustive<MonsterId, typeof MONSTER_IDS>,
    Exhaustive<ArtStyle, typeof ART_STYLES>,
    Exhaustive<StyleId, typeof STYLE_IDS>,
    Exhaustive<UpgradeId, typeof UPGRADE_IDS>,
] = [true, true, true, true, true, true, true];

export interface LevelCase {
    /** Used in test names and failure messages, e.g. `era 2 "Neon Dusk"` */
    label: string;
    level: LevelDef;
    /** Position in LEVELS, or -1 for the sandbox */
    index: number;
    shipped: boolean;
}

export interface RoomCase {
    /** e.g. `era 2 "Neon Dusk"` or `sandbox room 12` */
    label: string;
    level: LevelDef;
    room: RoomDef;
    shipped: boolean;
}

export interface TimedCase extends RoomCase {
    continuous: ContinuousDef;
}

/** The five eras of the shipped game */
export const ERA_CASES: LevelCase[] = LEVELS.map((level, index) => ({
    label: `era ${index + 1} "${level.name}"`,
    level,
    index,
    shipped: true,
}));

/** Every level the game can load: the eras plus the dev sandbox */
export const LEVEL_CASES: LevelCase[] = [...ERA_CASES, { label: 'sandbox', level: SANDBOX, index: -1, shipped: false }];

export const ROOM_CASES: RoomCase[] = LEVEL_CASES.flatMap(({ label, level, shipped }) =>
    (level.rooms ?? []).map((room, i) => ({
        // An era is one room, so its room number would only be noise
        label: shipped && level.rooms.length === 1 ? label : `${label} room ${i + 1}`,
        level,
        room,
        shipped,
    })),
);

export const TIMED_CASES: TimedCase[] = ROOM_CASES.filter((entry) => entry.room.continuous).map((entry) => ({
    ...entry,
    continuous: entry.room.continuous!,
}));

/** The rays a rule lets the player fire, whatever he does with Q, E and F */
export function fireableRays(rule: WeaponRule): RayId[] {
    const rays: RayId[] = [];
    if (rule.modes.includes('rgb')) {
        rays.push(...rule.wheel);
    }
    if (rule.modes.includes('uv')) {
        rays.push('uv');
    }
    if (rule.modes.includes('unprism')) {
        rays.push('white');
    }
    return rays;
}

/** Every monster a room can bring, with the first moment it can (a wave number, or seconds) */
export function monstersOf(room: RoomDef): { monster: MonsterId; where: string }[] {
    const waves = room.waves.flatMap((wave, i) => wave.spawns.map((group) => ({ monster: group.monster, where: `wave ${i + 1}` })));
    const table = (room.continuous?.table ?? []).map((entry, i) => ({
        monster: entry.monster,
        where: `table line ${i + 1} (from ${entry.from ?? 0}s)`,
    }));
    return [...waves, ...table];
}

/** A valid empty room: a ring of wall around floor, with the player start inside */
export function emptyLayout(): string[] {
    const edge = '#'.repeat(ROOM_COLS);
    const inner = `#${'.'.repeat(ROOM_COLS - 2)}#`;
    const layout = Array.from({ length: ROOM_ROWS }, (_, row) => (row === 0 || row === ROOM_ROWS - 1 ? edge : inner));
    return setTile(layout, 5, 4, 'P');
}

/** A copy of the layout with one character replaced */
export function setTile(layout: readonly string[], col: number, row: number, char: string): string[] {
    return layout.map((line, r) => (r === row ? line.slice(0, col) + char + line.slice(col + 1) : line));
}

/** [col, row] of every tile holding this character */
export function findTiles(layout: readonly string[], wanted: string): [number, number][] {
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

/** What someone on foot can stand on: paving, street entries and the start */
const WALKABLE = new Set(['.', ',', 'P', 'e']);

export interface Reachability {
    /** Number of tiles someone can stand on */
    walkable: number;
    /** How many of those can be walked to from the player start */
    reached: number;
    /** Walkable tiles that cannot be reached, as "(col, row)" */
    unreachable: string[];
}

/** Flood fill over walkable tiles from P, moving in the four compass directions */
export function reachability(layout: readonly string[]): Reachability {
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
