import type { Grid, SheetDef } from '../../sprites/grid';
import { DETAILS, type Detail } from './b/paint';
import { acidSlimeFrames, snowmanFrames } from './b/lobbers';
import { ACID_SLIME_PLAIN, GHOST_PLAIN, SKITTER_PLAIN, SNOWMAN_PLAIN, WRAITH_PLAIN } from './b/people';
import { PRISM_PLAIN, prismFrames } from './b/prism';
import { HAZARDS_PLAIN, PROJECTILES_PLAIN, hazardFrames, projectileFrames } from './b/props';
import { ghostFrames, wraithFrames } from './b/stealth';
import { ZIGBAT_PLAIN, skitterFrames, zigbatFrames } from './b/speed';

// Character Artist B's sheets: the speed, stealth and projectile enemies, the boss, the
// projectiles and the floor hazards. Each is drawn once per era by a function that takes a
// detail level, so an era loses drawing as well as colour; `plain` is what was really there.

function sheet(key: string, width: number, height: number, draw: (detail: Detail) => Grid[], plain: Grid[]): SheetDef {
    return {
        key,
        width,
        height,
        frames: draw(DETAILS.goldenAge),
        styles: {
            cyberpunk: draw(DETAILS.cyberpunk),
            retro: draw(DETAILS.retro),
            manga: draw(DETAILS.manga),
            plain,
        },
    };
}

/** Baked once per style, as `{key}-{style}` */
export const ENEMY_SHEETS_B: SheetDef[] = [
    sheet('zigbat', 24, 24, zigbatFrames, ZIGBAT_PLAIN),
    sheet('skitter', 32, 32, skitterFrames, SKITTER_PLAIN),
    sheet('ghost', 32, 32, ghostFrames, GHOST_PLAIN),
    sheet('wraith', 32, 32, wraithFrames, WRAITH_PLAIN),
    sheet('snowman', 32, 32, snowmanFrames, SNOWMAN_PLAIN),
    sheet('acidSlime', 32, 32, acidSlimeFrames, ACID_SLIME_PLAIN),
    sheet('prism', 64, 64, prismFrames, PRISM_PLAIN),
    sheet('projectiles', 16, 16, projectileFrames, PROJECTILES_PLAIN),
    sheet('hazards', 32, 32, hazardFrames, HAZARDS_PLAIN),
];

/** Baked once, under their own key */
export const SHARED_SHEETS_B: SheetDef[] = [];
