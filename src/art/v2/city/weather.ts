import { LEVELS } from '../../../config/levels';
import type { ArtStyle } from '../../../types';
import { FRONT_JOINS, frontWindows } from './buildings';
import { INK, PAPER, type Look } from './looks';
import { Pix, bayer, desaturate, hash, mix, rgb, tone } from './pix';
import { CITY_HEIGHT, CITY_WIDTH, EAST, FOUNTAIN_X, FOUNTAIN_Y, MOUTH_X0, MOUTH_X1, MOUTH_Y0, MOUTH_Y1, NORTH, SOUTH, TILE, WEST } from './plan';

// Time and use, laid over the square after it is drawn: damp climbing the walls, streaks under
// the sills, soot, posters, ivy, pipes, moss on the roofs, dirt gathered against the walls, worn
// stone, litter. Applied to the whole picture rather than to each piece, so the parts grow
// together into one place (Rain World does its erosion the same way). Every mark comes from a
// fixed hash, so the square is the same on every boot.
//
// Two rules keep it fair: nothing here draws a crack in a wall, since a hairline crack is what
// marks each era's secret; and the open paving stays calm, so what moves on it still reads.

/** How worn each era is. The real square, in the ending, is the most lived-in of all. */
const WEAR: Record<ArtStyle, number> = {
    goldenAge: 0.65,
    cyberpunk: 0.85,
    retro: 0.9,
    manga: 0.7,
    plain: 1,
};

// ---------------------------------------------------------------- noise and pixels

function noise(x: number, y: number, seed: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi, seed);
    const b = hash(xi + 1, yi, seed);
    const c = hash(xi, yi + 1, seed);
    const d = hash(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number): number {
    return noise(x, y, seed) * 0.5 + noise(x * 2.1, y * 2.1, seed + 1) * 0.3 + noise(x * 4.3, y * 4.3, seed + 2) * 0.2;
}

function colourAt(p: Pix, x: number, y: number): number {
    const i = (y * p.width + x) * 4;
    return p.data[i + 3] === 0 ? -1 : (p.data[i] << 16) | (p.data[i + 1] << 8) | p.data[i + 2];
}

/** Which pixels hold one of `colours`, read once before anything is changed */
function maskOf(p: Pix, colours: Set<number>): (x: number, y: number) => boolean {
    const mask = new Uint8Array(p.width * p.height);
    for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
            mask[y * p.width + x] = colours.has(colourAt(p, x, y)) ? 1 : 0;
        }
    }
    return (x, y) => x >= 0 && y >= 0 && x < p.width && y < p.height && mask[y * p.width + x] === 1;
}

function key(hex: string): number {
    const [r, g, b] = rgb(hex);
    return (r << 16) | (g << 8) | b;
}

/**
 * Darkens a pixel by `amount` (0 to 1). In an era snapped to a few colours a gentle multiply
 * would be snapped straight back, so there the darkening is dithered instead; in ink, it is
 * stippled.
 */
function darken(p: Pix, L: Look, x: number, y: number, amount: number): void {
    if (amount <= 0 || x < 0 || y < 0 || x >= p.width || y >= p.height) {
        return;
    }
    const i = (y * p.width + x) * 4;
    if (p.data[i + 3] === 0) {
        return;
    }
    if (L.detail === 1) {
        if (amount * 1.6 > bayer(x, y) + hash(x, y, 91) * 0.5) {
            p.px(x, y, INK);
        }
        return;
    }
    let k = 1 - amount;
    if (L.palette) {
        k = amount * 3 > bayer(x, y) ? 0.7 : 1;
    }
    p.data[i] *= k;
    p.data[i + 1] *= k;
    p.data[i + 2] *= k;
}

/** Wall tiles that hold a secret this era or any other, grown a little: no clutter near them */
const SECRETS: [number, number][] = [];
for (const level of LEVELS) {
    for (const room of level.rooms) {
        room.layout.forEach((line, row) => {
            const col = line.indexOf('S');
            if (col >= 0) {
                SECRETS.push([col * TILE, row * TILE]);
            }
        });
    }
}

function nearSecret(x: number, y: number, margin = 8): boolean {
    return SECRETS.some(([sx, sy]) => x >= sx - margin && x < sx + TILE + margin && y >= sy - margin && y < sy + TILE + margin);
}

// ---------------------------------------------------------------- the paving

/** How far a paving pixel is from the nearest wall (the street mouths are open) */
function wallDistance(x: number, y: number): number {
    const inNorthSouthMouth = x >= MOUTH_X0 && x < MOUTH_X1;
    const inSideMouth = y >= MOUTH_Y0 && y < MOUTH_Y1;
    return Math.min(
        inNorthSouthMouth ? 99 : y - NORTH,
        inNorthSouthMouth ? 99 : SOUTH - 1 - y,
        inSideMouth ? 99 : x - WEST,
        inSideMouth ? 99 : EAST - 1 - x,
    );
}

/** Distance from a point to the segment a-b */
function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** Drain grates in the paving, top-left corners: 12x6, steam rises from them in the dusk */
export const GRATES: [number, number][] = [
    [FOUNTAIN_X - 132, SOUTH - 22],
    [FOUNTAIN_X + 120, NORTH + 30],
];

/** The lines people walk most: from each street to the fountain */
const PATHS: [number, number, number, number][] = [
    [FOUNTAIN_X, NORTH, FOUNTAIN_X, FOUNTAIN_Y],
    [FOUNTAIN_X, SOUTH, FOUNTAIN_X, FOUNTAIN_Y],
    [WEST, (MOUTH_Y0 + MOUTH_Y1) / 2, FOUNTAIN_X, FOUNTAIN_Y],
    [EAST, (MOUTH_Y0 + MOUTH_Y1) / 2, FOUNTAIN_X, FOUNTAIN_Y],
];

interface Litter {
    /** Cells of [dx, dy, colour] */
    cells: [number, number, string][];
}

function litterKinds(L: Look): Litter[] {
    if (L.detail === 1) {
        return [
            { cells: [[0, 0, INK], [1, 0, INK], [2, 0, INK], [0, 1, INK], [2, 1, INK], [0, 2, INK], [1, 2, INK], [2, 2, INK]] },
            { cells: [[0, 0, INK], [2, 1, INK]] },
            { cells: [[0, 0, INK], [1, 1, INK], [3, 0, INK]] },
        ];
    }
    const leafA = L.paint('#c8782f');
    const leafB = L.paint('#a9572b');
    const leafC = L.paint('#d9a441');
    const paper = L.paint('#efe8d4');
    const paperLo = L.paint('#c9c0a8');
    const kinds: Litter[] = [
        { cells: [[0, 0, leafA], [1, 0, leafA], [1, 1, leafB]] },
        { cells: [[1, 0, leafC], [0, 1, leafC], [1, 1, leafA]] },
        { cells: [[0, 0, leafB], [1, 1, leafB]] },
        { cells: [[0, 0, paper], [1, 0, paper], [2, 0, paperLo], [0, 1, paperLo], [1, 1, paper]] },
    ];
    if (L.style === 'plain' || L.detail === 3) {
        // A cigarette end, a bottle cap
        kinds.push({ cells: [[0, 0, '#ece6d6'], [1, 0, '#ece6d6'], [2, 0, '#c9773a']] });
        kinds.push({ cells: [[0, 0, L.paint('#b8432f')], [1, 0, L.paint('#8f2f22')]] });
    }
    if (L.detail === 3) {
        // A can, catching the neon
        kinds.push({ cells: [[0, 0, L.lit[0]], [1, 0, L.lit[0]], [0, 1, tone(L.lit[0], 0.6)], [1, 1, tone(L.lit[0], 0.6)]] });
    }
    if (L.style === 'goldenAge') {
        // Petals from the planters
        kinds.push({ cells: [[0, 0, L.paint('#f7c6d0')], [2, 1, '#fff6f0']] });
    }
    return kinds;
}

function weatherGround(p: Pix, L: Look): void {
    const wear = WEAR[L.style];
    const isJointAt = maskOf(p, new Set([key(L.joint)]));
    const polished = L.detail === 4;
    for (let y = NORTH; y < SOUTH; y++) {
        for (let x = WEST; x < EAST; x++) {
            const near = wallDistance(x, y);
            // Dirt gathered against the walls
            if (near < 16) {
                const edge = (1 - near / 16) ** 2;
                darken(p, L, x, y, edge * 0.2 * wear * (0.6 + 0.8 * noise(x / 6, y / 6, 11)));
            }
            const isJoint = isJointAt(x, y);
            if (isJoint && near < 26) {
                darken(p, L, x, y, 0.12 * wear);
                if (L.detail === 4 && hash(x, y, 12) < 0.12 * wear) {
                    p.px(x, y, hash(x, y, 13) < 0.5 ? L.grass : L.leafLo);
                }
            }
            // Stains: spilt drinks, oil, the ghost of a market stall
            const stain = fbm(x / 38, y / 30, 14);
            if (stain > 0.64) {
                darken(p, L, x, y, (stain - 0.64) * 0.55 * wear);
            }
            // The stone itself: pits and grit, never quite one colour
            if (L.detail >= 3 && !isJoint) {
                const grit = hash(x, y, 16);
                if (grit < 0.025) {
                    darken(p, L, x, y, 0.1);
                } else if (grit > 0.985) {
                    p.px(x, y, '#ffffff', 0.08);
                }
            }
            // Sunlight from the north-west, falling off across the square
            if (L.detail === 4) {
                const t = ((x - WEST) / (EAST - WEST) + (y - NORTH) / (SOUTH - NORTH)) / 2;
                if (t < 0.5) {
                    p.px(x, y, L.style === 'plain' ? '#ffffff' : '#fff6d8', (0.5 - t) * 0.12);
                } else {
                    darken(p, L, x, y, (t - 0.5) * 0.1);
                }
            }
            // Stone polished by feet, along the lines people walk
            if (polished && !isJoint) {
                let path = 99;
                for (const [ax, ay, bx, by] of PATHS) {
                    path = Math.min(path, segmentDistance(x, y, ax, ay, bx, by));
                }
                const reach = 14 + 8 * noise(x / 20, y / 20, 15);
                if (path < reach) {
                    p.px(x, y, '#ffffff', 0.05 * (1 - path / reach) * wear);
                }
            }
        }
    }

    // Litter, thicker against the walls and drifted into the corners
    const kinds = litterKinds(L);
    const CELL = 12;
    for (let cy = NORTH; cy < SOUTH - 3; cy += CELL) {
        for (let cx = WEST; cx < EAST - 3; cx += CELL) {
            const x = cx + Math.floor(hash(cx, cy, 21) * (CELL - 3));
            const y = cy + Math.floor(hash(cx, cy, 22) * (CELL - 3));
            const near = wallDistance(x, y);
            const corner = Math.min(Math.hypot(x - WEST, y - NORTH), Math.hypot(x - EAST, y - NORTH), Math.hypot(x - WEST, y - SOUTH), Math.hypot(x - EAST, y - SOUTH));
            const chance = wear * (0.035 + (near < 14 ? 0.14 : 0) + (corner < 48 ? 0.3 : 0));
            if (hash(cx, cy, 23) >= chance) {
                continue;
            }
            const kind = kinds[Math.floor(hash(cx, cy, 24) * kinds.length)];
            const flip = hash(cx, cy, 25) < 0.5;
            for (const [dx, dy, colour] of kind.cells) {
                p.px(x + (flip ? -dx : dx), y + dy, colour);
            }
        }
    }

    // Grass and weeds where the paving meets the walls
    if (L.detail >= 3) {
        for (let x = WEST; x < EAST; x++) {
            for (const [y, up] of [[NORTH, 1], [SOUTH - 1, -1]] as const) {
                if (x >= MOUTH_X0 && x < MOUTH_X1) {
                    continue;
                }
                if (hash(x, y, 31) < 0.08 * wear) {
                    const tall = 1 + Math.floor(hash(x, y, 32) * 3);
                    for (let k = 0; k < tall; k++) {
                        p.px(x, y + up * k, k === tall - 1 ? L.leafHi : L.grass);
                    }
                }
            }
        }
    }

    // Drain grates, one each side of the fountain
    if (L.detail >= 2) {
        for (const [gx, gy] of GRATES) {
            p.rect(gx, gy, 12, 6, mix(L.joint, L.deep, 0.5));
            p.frame(gx - 1, gy - 1, 14, 8, L.joint);
            for (let k = 1; k < 12; k += 2) {
                p.vline(gx + k, gy + 1, 4, L.detail === 2 ? L.joint : mix(L.metal, L.ground, 0.35));
            }
        }
    }
}

// ---------------------------------------------------------------- the buildings

function wallColours(L: Look): Set<number> {
    const set = new Set<number>();
    for (const b of Object.values(L.b)) {
        set.add(key(b.wall));
        set.add(key(b.wallHi));
        set.add(key(b.wallLo));
    }
    if (L.detail === 1) {
        set.add(key(PAPER));
    }
    return set;
}

function roofColours(L: Look): Set<number> {
    const set = new Set<number>();
    for (const b of Object.values(L.b)) {
        set.add(key(b.roof));
        set.add(key(b.roofHi));
        set.add(key(b.roofLo));
    }
    return set;
}

function poster(p: Pix, L: Look, x: number, y: number, seed: number): void {
    const w = 7;
    const h = 9;
    if (L.detail === 1) {
        p.rect(x, y, w, h, PAPER);
        p.frame(x, y, w, h, INK);
        p.hline(x + 2, y + 2, 3, INK);
        p.hline(x + 2, y + 5, 3, INK);
        return;
    }
    const papers = ['#f1e6c8', '#e8d6a8', '#f4efe2'];
    const inks = ['#c8383c', '#2f6fa8', '#3f9b4f', '#7a4fa0', '#e0a530'];
    const back = L.paint(papers[Math.floor(hash(seed, 1, 41) * papers.length)]);
    const ink = L.detail === 3 ? L.lit[Math.floor(hash(seed, 2, 41) * L.lit.length)] : L.paint(inks[Math.floor(hash(seed, 2, 41) * inks.length)]);
    const faded = L.style === 'plain' ? (c: string) => desaturate(mix(c, back, 0.35), 0.7) : (c: string) => c;
    p.rect(x, y, w, h, faded(back));
    // A picture, a headline, two lines of small print
    p.rect(x + 1, y + 1, w - 2, 3, faded(ink));
    p.hline(x + 1, y + 5, w - 2, faded(tone(ink, 0.7)));
    p.hline(x + 1, y + 7, 3, faded(tone(back, 0.75)));
    // Torn at one corner, darkened by the weather along the bottom
    const torn = hash(seed, 3, 41) < 0.5;
    darken(p, L, torn ? x + w - 1 : x, y + h - 1, 0.25);
    for (let i = 0; i < w; i++) {
        darken(p, L, x + i, y + h - 1, 0.1);
    }
    p.px(x + 1, y, tone(back, 1.15));
    p.px(x + w - 2, y, tone(back, 1.15));
}

function ivy(p: Pix, L: Look, isWall: (x: number, y: number) => boolean, startX: number, seed: number): void {
    let x = startX;
    let misses = 0;
    const height = 18 + Math.floor(hash(seed, 0, 51) * 24);
    for (let k = 0; k < height; k++) {
        const y = NORTH - 5 - k;
        if (y < 2) {
            return;
        }
        const drift = hash(seed, k, 52);
        if (drift < 0.2) {
            x -= 1;
        } else if (drift > 0.8) {
            x += 1;
        }
        if (!isWall(x, y)) {
            if (++misses > 2) {
                return;
            }
            continue;
        }
        misses = 0;
        p.px(x, y, L.leafLo);
        for (const side of [-1, 1]) {
            if (hash(seed, k * 2 + side, 53) < 0.55) {
                p.px(x + side, y, L.leaf);
                if (hash(seed, k * 2 + side, 54) < 0.4) {
                    p.px(x + side * 2, y, L.leafHi);
                }
            }
        }
    }
}

function weatherBuildings(p: Pix, L: Look): void {
    const wear = WEAR[L.style];
    const walls = wallColours(L);
    const isWall = maskOf(p, walls);

    // The north fronts: damp from below, soot from above, streaks under every sill and sign
    const streaks: [number, number][] = [];
    for (let y = 1; y < NORTH; y++) {
        for (let x = 0; x < CITY_WIDTH; x++) {
            if (!isWall(x, y)) {
                continue;
            }
            const underSill = !isWall(x - 1, y - 1) && !isWall(x, y - 1) && !isWall(x + 1, y - 1);
            if (underSill && hash(x, y, 61) < 0.22 * wear && !nearSecret(x, y, 24)) {
                streaks.push([x, y]);
            }
            if (L.detail === 1) {
                continue;
            }
            // Plaster is never one flat colour: it was patched and repainted
            const mottle = noise(x / 7, y / 5, 60) - 0.5;
            if (mottle > 0) {
                darken(p, L, x, y, mottle * 0.09);
            } else if (!L.palette) {
                p.px(x, y, '#ffffff', -mottle * 0.07);
            }
            const damp = 9 + 8 * noise(x / 11, 0, 62);
            const fromFoot = NORTH - y;
            if (fromFoot < damp) {
                darken(p, L, x, y, (1 - fromFoot / damp) ** 1.4 * 0.22 * wear * (0.7 + 0.6 * noise(x / 4, y / 3, 63)));
            }
            if (y < 9) {
                darken(p, L, x, y, (1 - y / 9) * 0.12 * wear * noise(x / 5, y / 2, 64));
            }
            const stain = fbm(x / 16, y / 11, 65);
            if (stain > 0.62) {
                darken(p, L, x, y, (stain - 0.62) * 0.6 * wear);
            }
        }
    }
    for (const [x, y] of streaks) {
        const length = 3 + Math.floor(hash(x, y, 66) * 7);
        for (let k = 0; k < length; k++) {
            if (!isWall(x, y + k)) {
                break;
            }
            const fade = 1 - k / length;
            darken(p, L, x, y + k, (L.detail === 1 ? 0.4 : 0.1) * fade);
            if (isWall(x + 1, y + k)) {
                darken(p, L, x + 1, y + k, (L.detail === 1 ? 0 : 0.05) * fade);
            }
        }
    }
    if (L.detail === 1) {
        // Ink hatching where the fronts meet the ground
        for (let x = 0; x < CITY_WIDTH; x += 2) {
            if (hash(x, 0, 67) < 0.5 * wear && !nearSecret(x, NORTH - 4)) {
                const h = 3 + Math.floor(hash(x, 1, 67) * 4);
                for (let k = 0; k < h; k++) {
                    if (isWall(x + k, NORTH - 2 - k)) {
                        p.px(x + k, NORTH - 2 - k, INK);
                    }
                }
            }
        }
    }

    // Down-pipes where one front meets the next, and in the dusk the cables strung between them
    const joins = FRONT_JOINS;
    if (L.detail >= 3) {
        for (const x of joins) {
            if (nearSecret(x, NORTH - 10, 2)) {
                continue;
            }
            p.vline(x - 1, 2, NORTH - 3, L.outline);
            p.vline(x, 2, NORTH - 3, L.metal);
            p.vline(x + 1, 2, NORTH - 3, L.metalHi);
            for (let y = 8; y < NORTH - 4; y += 11) {
                p.hline(x - 1, y, 4, L.outline);
            }
            p.hline(x - 1, NORTH - 2, 4, L.metal);
            darken(p, L, x + 2, NORTH - 1, 0.3);
        }
    }
    if (L.detail === 3) {
        for (let n = 0; n + 1 < joins.length; n++) {
            const x0 = joins[n] + 1;
            const x1 = joins[n + 1] - 1;
            for (const [top, sag] of [[5, 6], [9, 4]]) {
                for (let x = x0; x <= x1; x++) {
                    const t = (x - x0) / (x1 - x0);
                    p.px(x, Math.round(top + sag * 4 * t * (1 - t)), L.outline, 0.85);
                }
            }
        }
    }

    // Posters and notices on the bare wall
    if (L.detail >= 1) {
        let placed = 0;
        const most = L.detail === 3 ? 6 : 5;
        for (let x = 6; x < CITY_WIDTH - 10 && placed < most; x += 19) {
            const px = x + Math.floor(hash(x, 0, 71) * 9);
            const py = 14 + Math.floor(hash(x, 1, 71) * 16);
            if (hash(x, 2, 71) > 0.4 + 0.3 * wear || nearSecret(px, py)) {
                continue;
            }
            let clear = true;
            for (let j = -1; j <= 9 && clear; j++) {
                for (let i = -1; i <= 7 && clear; i++) {
                    clear = isWall(px + i, py + j);
                }
            }
            if (clear) {
                poster(p, L, px, py, x);
                placed++;
                x += 30;
            }
        }
    }

    // Tags in the dusk
    if (L.detail === 3) {
        let tags = 0;
        for (let x = 10; x < CITY_WIDTH - 20 && tags < 4; x += 23) {
            const tx = x + Math.floor(hash(x, 0, 81) * 10);
            const ty = NORTH - 12 + Math.floor(hash(x, 1, 81) * 4);
            if (hash(x, 2, 81) > 0.45 || nearSecret(tx, ty) || !isWall(tx, ty) || !isWall(tx + 9, ty + 4)) {
                continue;
            }
            const colour = L.lit[Math.floor(hash(x, 3, 81) * L.lit.length)];
            let cx = tx;
            let cy = ty + 2;
            for (let k = 0; k < 6; k++) {
                const nx = cx + 1 + Math.floor(hash(x, 10 + k, 81) * 2);
                const ny = ty + Math.floor(hash(x, 20 + k, 81) * 5);
                p.line(cx, cy, nx, ny, colour);
                cx = nx;
                cy = ny;
            }
            tags++;
        }
    }

    // Ivy on the old fronts
    if (L.detail === 4) {
        let grown = 0;
        for (let x = 20; x < CITY_WIDTH - 20 && grown < 3; x += 41) {
            const sx = x + Math.floor(hash(x, 0, 55) * 20);
            if (hash(x, 1, 55) < 0.6 && isWall(sx, NORTH - 6) && !nearSecret(sx, NORTH - 20, 14)) {
                ivy(p, L, isWall, sx, x);
                grown++;
            }
        }
    }

    // Moss, lichen and the odd bird on the roofs
    if (L.detail >= 2) {
        const roofs = roofColours(L);
        const moss = L.detail === 2 ? L.deep : mix(L.leafLo, L.grass, 0.4);
        const lichen = L.paint('#cfc684');
        for (let y = NORTH; y < CITY_HEIGHT; y++) {
            for (let x = 0; x < CITY_WIDTH; x++) {
                const onRoof = y >= SOUTH || x < WEST || x >= EAST;
                if (!onRoof || !roofs.has(colourAt(p, x, y))) {
                    continue;
                }
                const growth = fbm(x / 9, y / 9, 91);
                if (growth > 0.62) {
                    if (L.palette) {
                        darken(p, L, x, y, (growth - 0.62) * 2);
                    } else {
                        p.px(x, y, moss, Math.min(0.75, (growth - 0.62) * 3.2 * wear));
                    }
                }
                if (L.detail === 4 && hash(x, y, 92) < 0.004 * wear) {
                    p.px(x, y, lichen);
                }
                if (L.detail === 4 && hash(x, y, 93) < 0.0012 * wear) {
                    p.px(x, y, '#f4f1e8');
                }
            }
        }
    }
}

/** Curtains, blinds, a plant, someone at the window: the flats above the shops are lived in */
function windowLife(p: Pix, L: Look): void {
    const frames = new Set<number>();
    for (const b of Object.values(L.b)) {
        frames.add(key(b.trim));
        frames.add(key(b.wallLo));
    }
    const fabrics = ['#c8383c', '#e0a530', '#7a4fa0', '#3f9b4f', '#efe3c6', '#2f6fa8'];
    frontWindows().forEach(([x, y, w, h], n) => {
        // The glass, not the bars across it, read before anything is drawn on it
        const pane = new Uint8Array(w * h);
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                pane[j * w + i] = frames.has(colourAt(p, x + i, y + j)) ? 0 : 1;
            }
        }
        const inside = (i: number, j: number) => i >= x && i < x + w && j >= y && j < y + h && pane[(j - y) * w + (i - x)] === 1;
        const put = (i: number, j: number, colour: string, alpha = 1) => {
            if (inside(i, j)) {
                p.px(i, j, colour, alpha);
            }
        };
        const pick = hash(n, 1, 101);
        if (L.detail === 1) {
            if (pick < 0.45) {
                for (let j = y + 1; j < y + 7; j += 2) {
                    for (let i = x; i < x + w; i++) {
                        put(i, j, INK);
                    }
                }
            }
            return;
        }
        const dark = L.detail === 3 ? tone(L.outline, 0.9) : mix(L.glassLo, '#000000', 0.35);
        if (L.detail === 3 || L.detail === 2) {
            // Blinds, and now and then someone standing at the light
            if (pick < 0.5) {
                for (let j = y + 1; j < y + h; j += 2) {
                    for (let i = x; i < x + w; i++) {
                        put(i, j, dark, 0.45);
                    }
                }
            } else if (pick < 0.75) {
                const cx = x + 2 + Math.floor(hash(n, 2, 101) * (w - 5));
                p.rect(cx, y + 6, 3, 3, dark, inside);
                p.rect(cx - 1, y + 9, 5, h - 9, dark, inside);
            }
            return;
        }
        const fabric = L.paint(fabrics[Math.floor(hash(n, 3, 101) * fabrics.length)]);
        const fold = tone(fabric, 0.78);
        if (pick < 0.4) {
            // Curtains drawn back and tied at the waist
            for (let j = y; j < y + h; j++) {
                const reach = j < y + 7 ? 3 : j < y + 10 ? 1 : 2;
                for (let k = 0; k < reach; k++) {
                    put(x + k, j, k === reach - 1 ? fold : fabric);
                    put(x + w - 1 - k, j, k === reach - 1 ? fold : fabric);
                }
            }
        } else if (pick < 0.6) {
            // A blind half down
            for (let j = y; j < y + 5; j++) {
                for (let i = x; i < x + w; i++) {
                    put(i, j, j % 2 ? fold : fabric);
                }
            }
        } else if (pick < 0.78) {
            // A pot plant on the sill inside
            const cx = x + 1 + Math.floor(hash(n, 4, 101) * (w - 4));
            p.rect(cx, y + h - 3, 3, 3, L.paint('#b5603a'), inside);
            p.rect(cx - 1, y + h - 6, 5, 3, L.leaf, inside);
            put(cx + 1, y + h - 7, L.leafHi);
            put(cx, y + h - 5, L.leafLo);
        } else if (pick < 0.88 && L.style === 'plain') {
            // Someone looking out at the square
            const cx = x + 2 + Math.floor(hash(n, 5, 101) * (w - 5));
            p.rect(cx, y + 7, 3, 3, dark, inside);
            p.rect(cx - 1, y + 10, 5, h - 10, dark, inside);
        }
    });
}

/** Aerials on the roofs, and in the dusk a dish or two */
function aerials(p: Pix, L: Look): void {
    const spots: [number, number][] = [
        [40, SOUTH + 9],
        [186, SOUTH + 11],
        [396, SOUTH + 8],
        [538, SOUTH + 10],
        [16, NORTH + 60],
        [EAST + 18, NORTH + 22],
        [EAST + 16, MOUTH_Y1 + 70],
    ];
    spots.forEach(([x, y], n) => {
        if (hash(n, 0, 111) < 0.25) {
            return;
        }
        const mast = L.detail === 1 ? INK : L.outline;
        p.vline(x, y - 7, 8, mast);
        for (const [dy, half] of [[-6, 3], [-4, 2], [-2, 3]]) {
            p.hline(x - half, y + dy, half * 2 + 1, mast);
        }
        if (L.detail >= 2) {
            // Its shadow on the tiles, away from the sun
            for (let k = 1; k < 6; k++) {
                darken(p, L, x + k, y + k - 1, 0.25);
            }
        }
        if (L.detail === 3 && n % 2 === 0) {
            p.ellipse(x + 6, y - 2, 3, 2, L.metalHi);
            p.px(x + 6, y - 2, L.outline);
            p.px(x, y - 8, L.lit[1]);
        }
    });
}

/** Chalk on the paving: a hopscotch, a sun. Faint, and flat, so nobody mistakes it for a wall. */
function chalk(p: Pix, L: Look): void {
    if (L.detail !== 4) {
        return;
    }
    const white = '#ffffff';
    const alpha = 0.32;
    const x0 = WEST + 54;
    const y0 = SOUTH - 22;
    const boxes: [number, number][] = [[0, 0], [0, -9], [-5, -18], [5, -18], [0, -27], [-5, -36], [5, -36]];
    for (const [dx, dy] of boxes) {
        const x = x0 + dx - 4;
        const y = y0 + dy - 8;
        for (let i = 0; i < 9; i++) {
            p.px(x + i, y, white, alpha);
            p.px(x + i, y + 8, white, alpha);
        }
        for (let j = 0; j < 9; j++) {
            p.px(x, y + j, white, alpha);
            p.px(x + 8, y + j, white, alpha);
        }
    }
    if (L.style === 'goldenAge') {
        const cx = EAST - 70;
        const cy = NORTH + 40;
        p.ring(cx, cy, 4, 4, '#fff3a0');
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            p.px(Math.round(cx + Math.cos(a) * 7), Math.round(cy + Math.sin(a) * 7), '#fff3a0', 0.7);
        }
    }
}

/** The paving: call after the ground and before the buildings and props are drawn */
export function weatherPaving(p: Pix, L: Look): void {
    weatherGround(p, L);
    chalk(p, L);
}

/** The ring of buildings: call after they are drawn, before the overhangs and props */
export function weatherWalls(p: Pix, L: Look): void {
    windowLife(p, L);
    weatherBuildings(p, L);
    aerials(p, L);
}
