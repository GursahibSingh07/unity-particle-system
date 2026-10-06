import type { ArtStyle } from '../../../types';
import { drawNorth, drawOverhangs, drawSides, drawSouth, drawStreets } from './buildings';
import { INK, LOOKS, type Look } from './looks';
import { Pix, bayer, hash, inEllipse } from './pix';
import {
    CITY_HEIGHT,
    CITY_WIDTH,
    EAST,
    FOUNTAIN_OVER_LIMIT,
    FOUNTAIN_X,
    FOUNTAIN_Y,
    MOUTH_Y0,
    MOUTH_Y1,
    NORTH,
    SIDE_WALL,
    SOUTH,
    TILE,
    WEST,
    eachTile,
} from './plan';
import { drawCrack, drawFountain, drawLamps } from './props';
import { weatherPaving, weatherWalls } from './weather';

// Composes the whole square for one era. The ground is kept quiet on purpose: characters
// have to read against it, so the richness goes into the ring of buildings and the props.

const STONE = 8;

/** Individual paving stones in a running bond, with a border of darker ones round the fountain */
function cobbles(p: Pix, L: Look): void {
    const border = (x: number, y: number) => {
        const dx = Math.abs(x - FOUNTAIN_X);
        const dy = Math.abs(y - FOUNTAIN_Y - 1);
        return dx <= 60 && dy <= 52 && (dx > 52 || dy > 44) && !(dx > 52 && dy > 44);
    };
    for (let y = NORTH; y < SOUTH; y++) {
        const row = y >> 3;
        const offset = (row & 1) * 4;
        for (let x = WEST; x < EAST; x++) {
            const column = (x + offset) >> 3;
            if ((y & 7) === 7 || ((x + offset) & 7) === 7) {
                p.px(x, y, L.joint);
                continue;
            }
            const cx = column * STONE - offset + 3;
            const cy = row * STONE + 3;
            const h = hash(column, row, 1);
            let colour = h < 0.18 ? L.groundAlt[0] : h < 0.36 ? L.groundAlt[1] : L.ground;
            if (border(cx, cy)) {
                colour = L.inlay;
            }
            p.px(x, y, colour);
        }
    }
}

function wornPatch(p: Pix, L: Look, x: number, y: number, index: number): void {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    if (L.detail === 1) {
        for (const [dx, dy] of [[-6, 2], [0, -2], [5, 3]]) {
            p.line(cx + dx - 3, cy + dy + 2, cx + dx + 3, cy + dy - 2, INK);
        }
        return;
    }
    if (L.detail === 2) {
        const patch = inEllipse(cx, cy, 11, 7);
        p.rect(x, y, TILE, TILE, L.worn, (i, j) => patch(i, j) && bayer(i, j) < 0.3);
        return;
    }
    if (L.detail === 3) {
        // A puddle holding the neon
        const flip = index % 2 ? -1 : 1;
        p.ellipse(cx, cy + 2, 12, 5, L.worn);
        p.ellipse(cx + 6 * flip, cy + 5, 8, 4, L.worn);
        const neon = [L.lit[1], L.lit[2], L.lit[0]];
        [-6, 1, 7].forEach((dx, k) => {
            for (let j = 0; j < 5 + ((k + index) % 2) * 2; j++) {
                p.px(cx + dx * flip, cy - 1 + j, neon[(k + index) % 3], 0.55 - j * 0.06);
            }
        });
        p.hline(cx - 3 + 6 * flip, cy + 7, 5, L.wornLo);
        return;
    }
    // Stones that have sunk and darkened, with weeds in the joints
    for (let j = y - 4; j < y + TILE + 4; j++) {
        const row = j >> 3;
        const offset = (row & 1) * 4;
        for (let i = x - 4; i < x + TILE + 4; i++) {
            if ((j & 7) === 7 || ((i + offset) & 7) === 7) {
                continue;
            }
            const column = (i + offset) >> 3;
            const sx = column * STONE - offset + 3;
            const sy = row * STONE + 3;
            const reach = 9 + hash(column, row, 2) * 9;
            if (Math.hypot(sx - cx, (sy - cy) * 1.2) < reach) {
                p.px(i, j, hash(column, row, 3) < 0.35 ? L.wornLo : L.worn);
            }
        }
    }
    p.line(cx - 9, cy - 3, cx - 3, cy + 1, L.wornLo);
    p.line(cx - 3, cy + 1, cx + 4, cy - 1, L.wornLo);
    for (const [dx, dy] of [[-8, 7], [3, 7], [7, -1], [-4, -9]]) {
        p.px(cx + dx, cy + dy, L.grass);
        p.px(cx + dx + 1, cy + dy, L.grass);
        p.px(cx + dx, cy + dy - 1, L.leafHi);
    }
}

function ground(p: Pix, L: Look): void {
    p.rect(0, 0, CITY_WIDTH, CITY_HEIGHT, L.ground);
    if (L.detail === 4) {
        cobbles(p, L);
    } else if (L.detail === 3) {
        // Wet streaks, and the light that falls out of the signs and lamps
        p.rect(WEST, NORTH, EAST - WEST, SOUTH - NORTH, L.groundAlt[0], (x, y) => hash(x >> 3, y, 71) < 0.02);
        const b = L.b;
        const pools: [number, number, number, number, string][] = [
            [56, NORTH, 46, 20, b.grocer.neon],
            [168, NORTH, 46, 20, b.tailor.neon],
            [320, NORTH + 2, 34, 22, b.tailor.neon],
            [472, NORTH, 46, 20, b.clocks.neon],
            [584, NORTH, 46, 20, b.tea.neon],
            [WEST, NORTH + 32, 22, 30, b.bookshop.neon],
            [EAST, NORTH + 32, 26, 34, b.cinema.neon],
            [EAST, MOUTH_Y1 + 40, 22, 30, b.pharmacy.neon],
            [216, SOUTH, 56, 16, b.cafe.neon],
            [424, SOUTH, 56, 16, b.bakery.neon],
        ];
        for (const [x, y, rx, ry, colour] of pools) {
            p.glow(x, y, rx, ry, colour, 0.3);
        }
        eachTile('o', (x, y, index) => {
            p.glow(x + 16, y + 24, 30, 18, index % 2 ? L.lit[1] : L.lit[2], 0.26);
        });
    } else if (L.detail === 2) {
        p.rect(WEST, NORTH, EAST - WEST, SOUTH - NORTH, L.joint, (x, y) => hash(x, y, 72) < 0.003);
    }
    eachTile(',', (x, y, index) => wornPatch(p, L, x, y, index));

    if (L.shadowLength > 0) {
        // The sun is in the north-west: the north and west buildings lay shadow on the paving
        const n = L.shadowLength;
        p.shade(WEST, NORTH, EAST - WEST, n, L.shadow);
        p.shade(WEST, NORTH + n, n, MOUTH_Y0 + SIDE_WALL - NORTH - n, L.shadow);
        p.shade(WEST, MOUTH_Y1, n, SOUTH - MOUTH_Y1, L.shadow);
    }
}

export interface CityPicture {
    base: Pix;
    over: Pix;
}

export function paintCity(style: ArtStyle): CityPicture {
    const L = LOOKS[style];
    const base = new Pix(CITY_WIDTH, CITY_HEIGHT);
    const over = new Pix(CITY_WIDTH, CITY_HEIGHT);

    ground(base, L);
    weatherPaving(base, L);
    drawStreets(base, L);
    drawNorth(base, L);
    drawSides(base, L);
    drawSouth(base, L);
    weatherWalls(base, L);

    const lamps: [number, number][] = [];
    eachTile('o', (x, y) => lamps.push([x, y]));
    for (const p of [base, over]) {
        drawOverhangs(p, L);
    }
    drawFountain(base, over, L, FOUNTAIN_OVER_LIMIT);
    drawLamps(base, over, L, lamps);

    if (L.palette) {
        base.posterize(L.palette);
        over.posterize(L.palette);
    }
    return { base, over };
}

/** Two 32x32 frames side by side: the hairline, then the wall broken open */
export function paintCrack(style: ArtStyle): Pix {
    const L = LOOKS[style];
    const p = new Pix(TILE * 2, TILE);
    drawCrack(p, L);
    if (L.palette) {
        p.posterize(L.palette);
    }
    return p;
}
