import { INK, PAPER, type Look } from './looks';
import { Pix, hash, inEllipse, tone, type Test } from './pix';
import { FOUNTAIN_X as CX, FOUNTAIN_Y as CY, TILE } from './plan';

// The fountain, the four lamp posts in their planters, and the cracked wall.

// ---------------------------------------------------------------- fountain

const RX = 30;
const RY = 24;
/** How much of the basin's wall shows below its rim */
const WALL = 6;

const rim = inEllipse(CX, CY, RX, RY);
const bowl = inEllipse(CX, CY, RX - 4, RY - 4);
const wallFace: Test = (x, y) => !rim(x, y);

function fountainInk(p: Pix): void {
    p.ellipse(CX, CY + WALL, RX, RY, INK);
    p.ellipse(CX, CY + WALL, RX - 1, RY - 1, PAPER);
    p.ellipse(CX, CY, RX, RY, INK);
    p.ellipse(CX, CY, RX - 1, RY - 1, PAPER);
    p.ring(CX, CY, RX - 4, RY - 4, INK);
    p.rect(CX - 3, CY - 14, 6, 16, PAPER);
    p.frame(CX - 3, CY - 14, 6, 17, INK);
}

/** The upper bowl and the jet: the part that stands taller than a person */
function fountainTop(p: Pix, L: Look): void {
    if (L.detail === 1) {
        p.ellipse(CX, CY - 15, 9, 3.5, INK);
        p.ellipse(CX, CY - 15, 8, 2.5, PAPER);
        for (const [dx, dy] of [[0, -22], [-1, -27], [0, -32], [-5, -24], [4, -25]]) {
            p.px(CX + dx, CY + dy, INK);
        }
        return;
    }
    if (L.detail === 2) {
        p.ellipse(CX, CY - 14, 8, 3.5, L.stoneLo);
        p.ellipse(CX, CY - 15, 8, 3, L.stoneHi);
        p.rect(CX - 1, CY - 22, 2, 6, L.waterHi);
        return;
    }
    p.ellipse(CX, CY - 13, 11, 4.5, L.stoneLo);
    p.ellipse(CX, CY - 14, 11, 4, L.detail === 4 ? L.stoneHi : L.stone);
    p.ellipse(CX, CY - 14, 9, 2.5, L.water);
    if (L.detail === 3) {
        p.rect(CX - 1, CY - 34, 2, 20, L.waterHi, (_x, y) => (y & 3) !== 3);
        return;
    }
    p.hline(CX - 6, CY - 15, 5, L.waterHi);
    // The jet, and the drops falling back either side of it
    p.rect(CX - 1, CY - 38, 2, 24, L.waterHi);
    p.vline(CX, CY - 37, 22, '#ffffff');
    p.px(CX - 1, CY - 39, '#ffffff');
    const drops = [[2, -37], [3, -35], [4, -32], [5, -28], [6, -23], [6, -19], [3, -31], [4, -26]];
    for (const [dx, dy] of drops) {
        p.px(CX + dx, CY + dy, L.waterHi);
        p.px(CX - 1 - dx, CY + dy + 1, L.waterHi);
    }
    p.px(CX + 5, CY - 30, '#ffffff');
    p.px(CX - 5, CY - 33, '#ffffff');
}

export function drawFountain(base: Pix, over: Pix, L: Look, limit: number): void {
    if (L.detail === 1) {
        fountainInk(base);
    } else {
        fountainBasin(base, L);
    }
    fountainTop(base, L);
    fountainTop(over, L);
    over.clear(CX - TILE, limit, TILE * 2, TILE * 2);
}

function fountainBasin(p: Pix, L: Look): void {
    if (L.detail === 4) {
        p.shade(CX - RX, CY - RY, RX * 2 + 12, RY * 2 + 16, L.shadow, inEllipse(CX + 5, CY + 8, RX + 1, RY));
    }
    p.ellipse(CX, CY + WALL, RX, RY, L.stoneLo);
    if (L.detail === 4) {
        // Lit from the north-west, so the left of the wall catches the sun
        p.ellipse(CX, CY + WALL, RX, RY, L.stone, (x, y) => wallFace(x, y) && x < CX - 8);
        p.ellipse(CX, CY + WALL, RX, RY, tone(L.stoneLo, 0.86), (x, y) => wallFace(x, y) && (x - CX + RX) % 7 === 0);
        p.ring(CX, CY + WALL, RX, RY, L.outline, 1, (_x, y) => y > CY + WALL);
    }
    p.ellipse(CX, CY, RX, RY, L.detail === 2 ? L.stone : L.stoneHi);
    if (L.detail >= 3) {
        p.ellipse(CX, CY, RX, RY, L.stone, (x, y) => x - CX + (y - CY) * 1.2 > 16);
    }
    p.ellipse(CX, CY, RX - 4, RY - 4, L.stoneLo);
    const water = inEllipse(CX, CY + 2, RX - 4, RY - 6);
    const pool: Test = (x, y) => bowl(x, y) && water(x, y);
    p.rect(CX - RX, CY - RY, RX * 2, RY * 2, L.water, pool);
    if (L.detail === 2) {
        p.rect(CX - 2, CY - 12, 4, 14, L.stoneHi);
        return;
    }
    p.rect(CX - RX, CY - RY, RX * 2, 12, L.waterLo, pool);
    if (L.detail === 4) {
        p.ring(CX, CY + 3, 19, 12, L.waterHi, 1, (x, y) => pool(x, y) && hash(x >> 2, y >> 1, 5) < 0.6);
        p.ring(CX, CY + 3, 12, 7, L.waterHi, 1, (x, y) => pool(x, y) && hash(x >> 2, y >> 1, 6) < 0.5);
        if (L.heroic) {
            for (const [dx, dy] of [[-18, 0], [16, -3], [11, 11], [-11, 12], [20, 6]]) {
                p.px(CX + dx, CY + dy, '#ffffff');
                p.px(CX + dx - 1, CY + dy, L.waterHi);
                p.px(CX + dx + 1, CY + dy, L.waterHi);
                p.px(CX + dx, CY + dy - 1, L.waterHi);
                p.px(CX + dx, CY + dy + 1, L.waterHi);
            }
        }
    } else {
        // Neon lying on the water
        const streaks: [number, string][] = [
            [-17, L.lit[1]],
            [-9, L.lit[2]],
            [12, L.lit[1]],
            [19, L.lit[0]],
        ];
        for (const [dx, colour] of streaks) {
            for (let j = 0; j < 11; j++) {
                if (pool(CX + dx, CY - 2 + j)) {
                    p.px(CX + dx, CY - 2 + j, colour, 0.6 - j * 0.04);
                }
            }
        }
    }
    p.ellipse(CX, CY + 4, 7, 3, L.waterLo);
    p.rect(CX - 3, CY - 12, 6, 16, L.stone);
    p.vline(CX - 3, CY - 12, 16, L.stoneHi);
    p.vline(CX + 2, CY - 12, 16, L.stoneLo);
    if (L.detail === 4) {
        // Water spilling from the upper bowl
        for (const dx of [-10, -6, 5, 9]) {
            p.rect(CX + dx, CY - 11, 1, 12, L.waterHi, (_x, y) => (y + dx) % 3 !== 0);
        }
    }
}

// ---------------------------------------------------------------- lamp posts and planters

/** The lantern: the only part of a lamp that stands above a person's head */
function lampHead(p: Pix, L: Look, cx: number, y: number, index: number): void {
    if (L.detail === 1) {
        p.rect(cx - 3, y - 24, 6, 9, PAPER);
        p.frame(cx - 3, y - 24, 6, 9, INK);
        return;
    }
    if (L.detail === 2) {
        p.rect(cx - 3, y - 24, 6, 9, L.lampGlass);
        p.hline(cx - 4, y - 25, 8, L.metal);
        return;
    }
    const glass = L.detail === 3 ? (index % 2 ? L.lit[1] : L.lit[2]) : L.lampGlass;
    p.rect(cx - 1, y - 28, 2, 2, L.metal);
    p.rect(cx - 5, y - 26, 10, 2, L.metal);
    p.rect(cx - 4, y - 24, 8, 8, glass);
    p.rect(cx - 3, y - 16, 6, 2, L.metal);
    if (L.detail === 3) {
        p.rect(cx - 2, y - 23, 4, 6, '#ffffff');
        return;
    }
    p.hline(cx - 5, y - 26, 10, L.metalHi);
    p.vline(cx - 4, y - 24, 8, L.metal);
    p.vline(cx + 3, y - 24, 8, L.metal);
    p.vline(cx - 1, y - 24, 8, L.metal);
    p.rect(cx - 3, y - 23, 2, 3, '#ffffff');
    p.rect(cx, y - 19, 3, 3, tone(glass, 0.86));
}

function lamp(base: Pix, over: Pix, L: Look, x: number, y: number, index: number): void {
    const cx = x + TILE / 2;
    const p = base;
    if (L.detail === 1) {
        p.rect(x + 6, y + 16, 20, 12, PAPER);
        p.frame(x + 6, y + 16, 20, 12, INK);
        p.rect(cx - 1, y - 15, 2, 31, INK);
    } else if (L.detail === 2) {
        p.rect(x + 6, y + 16, 20, 12, L.stone);
        p.rect(x + 6, y + 16, 20, 3, L.leaf);
        p.rect(cx - 1, y - 15, 2, 31, L.metal);
    } else {
        if (L.detail === 4) {
            p.shade(x + 4, y + 16, 34, 18, L.shadow, inEllipse(cx + 6, y + 27, 13, 5));
        }
        // Tub
        p.ellipse(cx, y + 26, 11, 4, L.stoneLo);
        p.rect(x + 5, y + 18, 22, 8, L.stone);
        p.rect(x + 20, y + 18, 7, 9, L.stoneLo);
        if (L.detail === 4) {
            p.vline(x + 5, y + 18, 8, L.stoneHi);
            p.hline(x + 6, y + 23, 20, L.stoneLo);
            p.ring(cx, y + 26, 11, 4, L.outline, 1, (_i, j) => j > y + 26);
        }
        p.ellipse(cx, y + 18, 11, 4, L.detail === 4 ? L.stoneHi : L.stone);
        p.ellipse(cx, y + 18, 9, 3, L.leafLo);
        // Planting
        p.ellipse(cx, y + 15, 10, 5, L.leaf);
        if (L.detail === 4) {
            const bush = inEllipse(cx, y + 15, 10, 5);
            p.rect(x + 5, y + 9, 22, 12, L.leafHi, (i, j) => bush(i, j) && hash(i, j, 51) < 0.3);
            p.rect(x + 5, y + 13, 22, 8, L.leafLo, (i, j) => bush(i, j) && hash(i, j, 52) < 0.3);
            const spots = [[-7, 14], [-3, 12], [2, 15], [6, 13], [-1, 17], [5, 17], [-6, 17]];
            spots.forEach(([dx, fy], k) => {
                const colour = L.flowers[(k + index) % L.flowers.length];
                p.rect(cx + dx, y + fy, 2, 2, colour);
                p.px(cx + dx, y + fy, tone(colour, 1.4));
            });
        }
        // Post
        p.rect(cx - 1, y - 14, 2, 30, L.metal);
        p.rect(cx - 2, y + 11, 4, 4, L.metal);
        if (L.detail === 4) {
            p.vline(cx - 1, y - 14, 30, L.metalHi);
            p.hline(cx - 2, y - 4, 4, L.metal);
        }
    }
    lampHead(base, L, cx, y, index);
    lampHead(over, L, cx, y, index);
}

export function drawLamps(base: Pix, over: Pix, L: Look, tiles: [number, number][]): void {
    tiles.forEach(([x, y], index) => lamp(base, over, L, x, y, index));
}

// ---------------------------------------------------------------- the cracked wall

const HAIRLINE: [number, number][] = [
    [14, 3],
    [16, 8],
    [13, 13],
    [17, 18],
    [15, 24],
    [16, 29],
];

/** Frame 0 at x 0: a hairline. Frame 1 at x 32: the same wall broken open. Both on transparency. */
export function drawCrack(p: Pix, L: Look): void {
    // Faint enough to miss, so it sits on a pale wall or a dark roof alike
    const alpha = L.detail === 4 ? 0.42 : L.detail === 3 ? 0.7 : 1;
    // Retro's line is a middle tone: it has to hide on pale walls and dark roofs with five colours
    const dark = L.detail === 3 ? L.deep : L.detail === 2 ? L.ground : L.outline;
    for (let i = 0; i + 1 < HAIRLINE.length; i++) {
        const [x0, y0] = HAIRLINE[i];
        const [x1, y1] = HAIRLINE[i + 1];
        // Manga and Retro have so little on their walls that a whole line would shout
        if (L.detail <= 2 && i % 2 === 1) {
            continue;
        }
        p.line(x0, y0, x1, y1, dark, alpha);
    }
    p.line(17, 18, 20, 21, dark, alpha * 0.8);
    if (L.detail >= 3) {
        const edge = L.detail === 3 ? L.stoneHi : '#ffffff';
        p.px(17, 9, edge, 0.3);
        p.px(18, 19, edge, 0.3);
        p.px(16, 25, edge, 0.3);
    }

    const left = TILE;
    const hole: Test = (x, y) => {
        const dx = (x - left - 16) / 9;
        const dy = (y - 17) / 11.5;
        return dx * dx + dy * dy + (hash((x - left) >> 2, y >> 2, 61) - 0.5) * 0.7 < 0.8;
    };
    const ink = L.detail === 1;
    for (let y = 0; y < TILE; y++) {
        for (let x = left; x < left + TILE; x++) {
            if (!hole(x, y)) {
                continue;
            }
            const edge = !hole(x - 1, y) || !hole(x + 1, y) || !hole(x, y - 1) || !hole(x, y + 1);
            const lip = !hole(x, y - 1) || !hole(x, y - 2);
            if (ink) {
                p.px(x, y, INK);
            } else if (edge) {
                p.px(x, y, L.outline);
            } else {
                // The thickness of the wall shows as a paler lip under the top edge
                p.px(x, y, lip && L.detail >= 3 ? tone(L.stoneLo, 0.7) : L.deep);
            }
        }
    }
    for (const [x0, y0, x1, y1] of [[8, 9, 3, 5], [24, 8, 28, 3], [25, 22, 30, 25], [7, 23, 2, 27]]) {
        p.line(left + x0, y0, left + x1, y1, ink ? INK : dark, ink ? 1 : Math.min(1, alpha + 0.2));
    }
    // Rubble on the sill
    const chunks = [[9, 28], [13, 29], [19, 28], [23, 29], [16, 27]];
    chunks.forEach(([x, y], k) => {
        if (ink) {
            p.rect(left + x, y, 3, 2, PAPER);
            p.frame(left + x - 1, y - 1, 5, 4, INK);
            return;
        }
        p.rect(left + x, y, 3, 2, k % 2 ? L.stone : L.stoneHi);
        p.hline(left + x, y + 2, 3, L.outline);
    });
}
