import type { SheetDef } from '../sprites/grid';
import { ENEMY_SHEETS_A } from './sprites/enemiesA';
import { ENEMY_SHEETS_B, SHARED_SHEETS_B } from './sprites/enemiesB';
import { PLAYER_V2 } from './sprites/hero';
import { ERA_ICONS_V2, HEART_V2, ICONS_V2, MACHINE_V2, SPARK_V2, UPGRADE_V2 } from './sprites/items';

// Every v2 sheet in one place, with no Phaser import, so the lists can be read, checked or
// rendered outside the browser.

/** Baked once per style, as `{key}-{style}` */
export const STYLED_SHEETS_V2: SheetDef[] = [PLAYER_V2, MACHINE_V2, ...ENEMY_SHEETS_A, ...ENEMY_SHEETS_B];

/** Baked once, under their own key */
export const SHARED_SHEETS_V2: SheetDef[] = [HEART_V2, UPGRADE_V2, SPARK_V2, ICONS_V2, ERA_ICONS_V2, ...SHARED_SHEETS_B];

/** Keys that get no `{key}-{style}-move` animation: they are not creatures */
const STILL = new Set(['player', 'machine', 'projectiles', 'hazards']);

/** Last frame of the move loop where it is not frames 0-1 */
const MOVE_END: Record<string, number> = { golem: 3 };

/** The `{key}-{style}-move` loops, as [sheet key, first frame, last frame] */
export const MOVE_LOOPS_V2: [string, number, number][] = STYLED_SHEETS_V2.filter((sheet) => !STILL.has(sheet.key)).map(
    (sheet) => [sheet.key, 0, MOVE_END[sheet.key] ?? 1],
);
