import { INK, PAPER, type Building, type BuildingId, type Look } from './looks';
import { Pix, hash, inEllipse, mix, textWidth, tone, type Test } from './pix';
import { CITY_WIDTH, EAST, MOUTH_X0, MOUTH_X1, MOUTH_Y0, MOUTH_Y1, NORTH, SIDE_WALL, SOUTH, WEST, screentone } from './plan';

// The ring of buildings. North fronts are seen face on; the other three sides show roofs.
// Each function draws the same building at whatever level of detail the era still has.

// ---------------------------------------------------------------- shared pieces

/** Roof tiles in courses: across the picture, or down it for the side roofs */
function roofCourses(p: Pix, b: Building, x: number, y: number, w: number, h: number, vertical = false): void {
    const joint = mix(b.roof, b.roofLo, 0.6);
    for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
            const across = vertical ? i - x : j - y;
            const along = vertical ? j - y : i - x;
            const course = across >> 2;
            let colour = b.roof;
            if ((across & 3) === 3) {
                colour = b.roofLo;
            } else if ((along + course * 3) % 6 === 0) {
                colour = joint;
            } else if ((across & 3) === 0 && hash(along >> 1, course, 11) < 0.35) {
                colour = b.roofHi;
            }
            p.px(i, j, colour);
        }
    }
}

function windowFull(p: Pix, L: Look, b: Building, x: number, y: number, w: number, h: number, shutters: boolean, box: boolean): void {
    if (shutters) {
        const slat = tone(b.shutter, 0.72);
        for (const sx of [x - 5, x + w + 2]) {
            p.rect(sx, y - 1, 3, h + 2, b.shutter);
            for (let j = y; j < y + h; j += 2) {
                p.hline(sx, j, 3, slat);
            }
        }
    }
    p.rect(x - 1, y - 1, w + 2, h + 2, b.trim);
    p.rect(x, y, w, h, L.glass);
    p.hline(x, y, w, L.glassLo);
    p.vline(x, y, h, L.glassLo);
    p.line(x + 1, y + 4, x + 3, y + 2, L.glassHi);
    p.line(x + 7, y + 12, x + 9, y + 10, L.glassHi);
    p.line(x + 6, y + 14, x + 9, y + 11, L.glassHi);
    p.vline(x + (w >> 1), y, h, b.trim);
    p.hline(x, y + 6, w, b.trim);
    p.hline(x - 2, y + h + 1, w + 4, b.trim);
    p.hline(x - 2, y + h + 2, w + 4, b.wallLo);
    if (box) {
        p.rect(x - 2, y + h - 1, w + 4, 3, tone(b.door, 0.9));
        p.hline(x - 2, y + h - 1, w + 4, tone(b.door, 1.2));
        for (let i = x - 2; i < x + w + 2; i++) {
            p.px(i, y + h - 2, hash(i, y, 21) < 0.5 ? L.leaf : L.leafLo);
            if (hash(i, y, 22) < 0.6) {
                p.px(i, y + h - 3, L.leafHi);
            }
            if ((i - x) % 3 === 0) {
                p.px(i, y + h - 3, L.flowers[Math.floor(hash(i, y, 23) * L.flowers.length)]);
            }
        }
    }
}

function chimney(p: Pix, L: Look, b: Building, x: number, y: number): void {
    if (L.detail === 1) {
        p.rect(x, y, 8, 8, PAPER);
        p.frame(x, y, 8, 8, INK);
        return;
    }
    if (L.detail === 2) {
        p.rect(x, y, 8, 8, L.outline);
        return;
    }
    if (L.detail === 3) {
        p.rect(x, y, 8, 8, b.roofHi);
        p.rect(x + 2, y + 2, 4, 4, L.deep);
        return;
    }
    const brick = L.paint('#b9694a');
    p.shade(x + 3, y + 3, 10, 9, 0.78);
    p.rect(x, y, 8, 9, brick);
    p.rect(x, y, 8, 1, tone(brick, 1.3));
    p.vline(x, y, 9, tone(brick, 1.2));
    p.rect(x, y + 6, 8, 3, tone(brick, 0.75));
    p.hline(x + 1, y + 7, 6, tone(brick, 0.62));
    p.rect(x + 2, y + 2, 4, 3, L.deep);
    p.frame(x - 1, y - 1, 10, 11, L.outline);
}

function skylight(p: Pix, L: Look, b: Building, x: number, y: number, w: number, h: number, lit: string | null): void {
    if (L.detail === 1) {
        return;
    }
    if (L.detail === 2) {
        p.rect(x, y, w, h, L.glass);
        return;
    }
    p.rect(x - 1, y - 1, w + 2, h + 2, L.detail === 4 ? b.trim : b.roofHi);
    p.rect(x, y, w, h, lit ?? L.glass);
    if (L.detail === 4) {
        p.hline(x, y, w, L.glassLo);
        p.line(x + 1, y + h - 2, x + h - 2, y + 1, L.glassHi);
        p.vline(x + (w >> 1), y, h, b.trim);
        p.hline(x - 1, y + h + 1, w + 2, b.roofLo);
    }
}

/** A striped awning seen face on, hanging from `y` */
function awningFront(p: Pix, L: Look, b: Building, x: number, y: number, w: number): void {
    if (L.detail === 3) {
        p.rect(x, y + 1, w, 5, b.awnA);
        p.hline(x, y + 6, w, b.neon);
        return;
    }
    for (let i = 0; i < w; i++) {
        const colour = (i >> 2) & 1 ? b.awnB : b.awnA;
        p.px(x + i, y, tone(colour, 0.78));
        p.vline(x + i, y + 1, 4, colour);
        p.vline(x + i, y + 5, 2, tone(colour, 0.86));
        if ((i & 3) === 1 || (i & 3) === 2) {
            p.px(x + i, y + 7, tone(colour, 0.78));
        }
    }
    p.vline(x - 1, y, 6, L.outline);
    p.vline(x + w, y, 6, L.outline);
}

// ---------------------------------------------------------------- north: shop fronts

interface Shop {
    id: BuildingId;
    x: number;
    w: number;
    text: string;
    /** Door's left edge, from the shop's left edge */
    door: number;
    shutters: boolean;
    boxes: boolean;
    quoins: boolean;
    goods: string[];
    tallGoods: boolean;
}

const SHOPS: Shop[] = [
    { id: 'grocer', x: 0, w: 112, text: 'FRUIT', door: 50, shutters: true, boxes: true, quoins: false, goods: ['#e8483c', '#f29a2e', '#7cc043', '#f2d23c'], tallGoods: false },
    { id: 'tailor', x: 112, w: 112, text: 'TAILOR', door: 12, shutters: false, boxes: true, quoins: true, goods: ['#3f5c8a', '#c8383c', '#f4ecd8'], tallGoods: true },
    { id: 'clocks', x: 416, w: 112, text: 'CLOCKS', door: 88, shutters: true, boxes: false, quoins: true, goods: ['#fff6dc', '#e0a530', '#fff6dc', '#8a4b2e'], tallGoods: false },
    { id: 'tea', x: 528, w: 112, text: 'TEAS', door: 50, shutters: false, boxes: true, quoins: false, goods: ['#ffffff', '#f2b6c8', '#bfe3ee'], tallGoods: false },
];

const WINDOW_W = 11;
const WINDOW_H = 16;
const WINDOW_Y = 12;
const SIGN_Y = 32;
const AWNING_Y = 41;
const DOOR_Y = 49;
const DOOR_W = 12;

function windowXs(shop: Shop, count: number): number[] {
    const xs: number[] = [];
    for (let i = 0; i < count; i++) {
        xs.push(shop.x + Math.round((shop.w * (i + 0.5)) / count) - (WINDOW_W >> 1));
    }
    return xs;
}

/** The stretches of shop window either side of the door */
function displaySpans(shop: Shop): [number, number][] {
    const door = shop.x + shop.door;
    const spans: [number, number][] = [
        [shop.x + 7, door - 4],
        [door + DOOR_W + 4, shop.x + shop.w - 7],
    ];
    return spans.filter(([a, b]) => b - a >= 14);
}

function shopFull(p: Pix, L: Look, b: Building, shop: Shop): void {
    const { x, w } = shop;
    roofCourses(p, b, x, 0, w, 8);
    p.hline(x, 8, w, b.trim);
    p.hline(x, 9, w, b.wallLo);
    p.rect(x, 10, w, 54, b.wall);
    p.rect(x, 10, w, 48, b.wallHi, (i, j) => hash(i, j, 3) < 0.035);
    p.rect(x, 10, w, 48, b.wallLo, (i, j) => hash(i, j, 4) < 0.03);
    p.vline(x + 1, 10, 54, b.wallHi);
    p.vline(x + w - 1, 8, 56, b.wallLo);
    if (shop.quoins) {
        for (let j = 11, k = 0; j < 56; j += 5, k++) {
            const q = k % 2 ? 3 : 5;
            p.rect(x + 1, j, q, 4, b.trim);
            p.rect(x + w - 1 - q, j, q, 4, b.trim);
        }
    }
    p.rect(x + 1, 59, w - 2, 5, b.wallLo);
    p.hline(x + 1, 59, w - 2, tone(b.wall, 0.93));

    windowXs(shop, 3).forEach((wx, i) => {
        windowFull(p, L, b, wx, WINDOW_Y, WINDOW_W, WINDOW_H, shop.shutters, shop.boxes && i !== 1);
    });

    const board = textWidth(shop.text) + 10;
    const bx = x + ((w - board) >> 1);
    p.rect(bx, SIGN_Y, board, 9, b.sign);
    p.frame(bx, SIGN_Y, board, 9, b.signInk);
    p.text(bx + 5, SIGN_Y + 2, shop.text, b.signInk);
    p.hline(bx + 1, SIGN_Y + 9, board, b.wallLo);

    for (const [a, end] of displaySpans(shop)) {
        const length = end - a;
        p.rect(a - 1, 50, length + 2, 10, b.trim);
        p.rect(a, 51, length, 8, L.glass);
        p.rect(a, 51, length, 2, L.glassLo);
        for (let i = a + 3; i + 6 < end; i += 13) {
            p.line(i, 57, i + 4, 53, L.glassHi);
            p.line(i + 2, 57, i + 5, 54, L.glassHi);
        }
        for (let i = a + 2, k = 0; i < end - 2; i += 4, k++) {
            const colour = L.paint(shop.goods[k % shop.goods.length]);
            if (shop.tallGoods) {
                p.rect(i, 54, 2, 5, colour);
                p.px(i, 53, tone(colour, 1.3));
            } else {
                p.rect(i, 57 - (k % 2), 2, 2, colour);
            }
        }
        for (let i = a + 13; i < end - 6; i += 14) {
            p.vline(i, 51, 8, b.trim);
        }
        p.hline(a - 1, 60, length + 2, tone(b.wallLo, 0.9));
    }

    const dx = x + shop.door;
    p.rect(dx - 1, DOOR_Y - 1, DOOR_W + 2, 16, b.trim);
    p.rect(dx, DOOR_Y, DOOR_W, 15, b.door);
    p.vline(dx, DOOR_Y, 15, tone(b.door, 1.25));
    p.rect(dx + 2, DOOR_Y + 2, 8, 5, L.glass);
    p.hline(dx + 2, DOOR_Y + 2, 8, L.glassLo);
    p.px(dx + 3, DOOR_Y + 4, L.glassHi);
    p.px(dx + 4, DOOR_Y + 3, L.glassHi);
    p.rect(dx + 2, DOOR_Y + 9, 8, 4, tone(b.door, 0.78));
    p.px(dx + 9, DOOR_Y + 8, L.paint('#f2c94c'));
    p.rect(dx - 2, 62, DOOR_W + 4, 2, L.stoneHi);
    p.hline(dx - 2, 63, DOOR_W + 4, L.stone);

    p.shade(x + 5, AWNING_Y + 7, w - 10, 3, 0.8);
    awningFront(p, L, b, x + 5, AWNING_Y, w - 10);
    if (x > 0) {
        p.vline(x, 0, 64, L.outline);
    }
}

function shopDusk(p: Pix, L: Look, b: Building, shop: Shop): void {
    const { x, w } = shop;
    p.rect(x, 0, w, 8, b.roof);
    p.hline(x, 8, w, b.wallHi);
    p.rect(x, 9, w, 55, b.wall);
    p.rect(x, 58, w, 6, b.wallLo);

    windowXs(shop, 3).forEach((wx, i) => {
        const lit = hash(x, i, 7) < 0.6;
        const colour = L.lit[Math.floor(hash(x, i, 8) * L.lit.length)];
        p.rect(wx - 1, WINDOW_Y - 1, WINDOW_W + 2, WINDOW_H + 2, b.wallLo);
        p.rect(wx, WINDOW_Y, WINDOW_W, WINDOW_H, lit ? colour : L.glass);
        if (lit) {
            p.rect(wx, WINDOW_Y + 10, WINDOW_W, 6, tone(colour, 0.78));
        }
        p.vline(wx + (WINDOW_W >> 1), WINDOW_Y, WINDOW_H, b.wallLo);
    });

    const tw = textWidth(shop.text);
    const tx = x + ((w - tw) >> 1);
    p.glow(tx + tw / 2, SIGN_Y + 4.5, tw / 2 + 9, 8, b.neon, 0.45);
    p.text(tx, SIGN_Y + 2, shop.text, b.neon);

    const shopLight = mix(b.neon, b.wall, 0.5);
    for (const [a, end] of displaySpans(shop)) {
        p.rect(a - 1, 50, end - a + 2, 10, b.wallLo);
        p.rect(a, 51, end - a, 8, shopLight);
        p.rect(a, 56, end - a, 3, tone(shopLight, 0.8));
    }
    const dx = x + shop.door;
    p.rect(dx, DOOR_Y, DOOR_W, 15, L.deep);
    p.rect(dx + 3, DOOR_Y + 2, 6, 4, shopLight);
    awningFront(p, L, b, x + 5, AWNING_Y, w - 10);
    p.vline(x, 0, 64, L.outline);
}

function shopFlat(p: Pix, L: Look, b: Building, shop: Shop): void {
    const { x, w } = shop;
    p.rect(x, 0, w, 9, b.roof);
    p.hline(x, 8, w, L.outline);
    p.rect(x, 9, w, 55, b.wall);
    for (const wx of windowXs(shop, 2)) {
        p.rect(wx, WINDOW_Y + 4, WINDOW_W, 14, L.glass);
    }
    p.rect(x + shop.door, DOOR_Y - 1, DOOR_W, 16, b.door);
    p.vline(x, 0, 64, L.outline);
}

function shopInk(p: Pix, shop: Shop): void {
    const { x, w } = shop;
    p.rect(x, 0, w, 64, PAPER);
    screentone(p, x, 0, w, 8);
    p.hline(x, 8, w, INK);
    for (const wx of windowXs(shop, 2)) {
        p.frame(wx, WINDOW_Y + 4, WINDOW_W, 14, INK);
    }
    p.frame(x + shop.door, DOOR_Y - 1, DOOR_W, 17, INK);
    p.vline(x, 0, 64, INK);
}

// ---------------------------------------------------------------- north: the town hall

const HALL_X = 224;
const HALL_W = 192;
const HALL_MID = 320;

/** The upper windows of the north shop fronts, as [x, y, w, h]: someone lives behind them */
export function frontWindows(): [number, number, number, number][] {
    return SHOPS.flatMap((shop) => windowXs(shop, 3).map((x): [number, number, number, number] => [x, WINDOW_Y, WINDOW_W, WINDOW_H]));
}

/** Where one north front meets the next: down-pipes run here */
export const FRONT_JOINS: number[] = [...new Set([...SHOPS.map((shop) => shop.x).filter((x) => x > 0), HALL_X, HALL_X + HALL_W])].sort((a, b) => a - b);
const ARCH_X = 296;
const ARCH_W = 48;
const ARCH_SPRING = 34;
const TOWER_X = 298;
const TOWER_W = 44;
const TOWER_H = 23;
/** Pixel centres, so the clock is an odd number of pixels across with a true middle */
const CLOCK_X = 320.5;
const CLOCK_Y = 11.5;
const WING_WINDOWS = [243, 271, 369, 397];
const WING_MIDDLES = [257, 383];

const archTop = inEllipse(HALL_MID, ARCH_SPRING, ARCH_W / 2, 10);
const inArch: Test = (x, y) => (y >= ARCH_SPRING ? x >= ARCH_X && x < ARCH_X + ARCH_W : archTop(x, y));

function clockHands(p: Pix, colour: string): void {
    p.line(320, 11, 317, 9, colour);
    p.line(320, 11, 324, 8, colour);
}

function tallWindow(p: Pix, L: Look, b: Building, cx: number): void {
    const x = cx - 6;
    p.rect(x - 1, 17, 14, 32, b.trim);
    p.px(x - 1, 17, b.wall);
    p.px(x + 12, 17, b.wall);
    p.rect(x, 20, 12, 28, L.glass);
    p.hline(x + 1, 19, 10, L.glass);
    p.hline(x + 3, 18, 6, L.glass);
    p.rect(x, 20, 12, 2, L.glassLo);
    p.rect(x, 44, 12, 4, L.glassLo);
    p.line(x + 1, 26, x + 4, 23, L.glassHi);
    p.line(x + 7, 35, x + 10, 32, L.glassHi);
    p.line(x + 1, 42, x + 3, 40, L.glassHi);
    p.rect(x + 5, 18, 2, 30, b.trim);
    p.hline(x, 28, 12, b.trim);
    p.hline(x, 38, 12, b.trim);
    p.hline(x - 2, 49, 16, b.trim);
    p.hline(x - 2, 50, 16, b.wallLo);
}

function hallFull(p: Pix, L: Look, b: Building): void {
    roofCourses(p, b, HALL_X, 0, HALL_W, 5);
    p.rect(HALL_X, 5, HALL_W, 5, b.trim);
    for (let i = HALL_X + 1; i < HALL_X + HALL_W - 1; i += 4) {
        p.rect(i, 6, 2, 3, b.wallLo);
    }
    p.hline(HALL_X, 9, HALL_W, b.wallLo);

    p.rect(HALL_X, 10, HALL_W, 54, b.wall);
    const joint = mix(b.wall, b.wallLo, 0.55);
    for (let row = 0; row < 6; row++) {
        p.hline(HALL_X, 17 + row * 8, HALL_W, joint);
        for (let i = HALL_X + (row & 1) * 8; i < HALL_X + HALL_W; i += 16) {
            p.vline(i, 10 + row * 8, 7, joint);
        }
    }
    p.rect(HALL_X, 57, HALL_W, 7, b.wallLo);
    p.hline(HALL_X, 57, HALL_W, b.trim);
    for (const x of [HALL_X + 2, HALL_X + HALL_W - 6]) {
        p.rect(x, 12, 4, 45, b.trim);
        p.vline(x + 3, 12, 45, mix(b.trim, b.wallLo, 0.5));
        p.rect(x - 1, 11, 6, 2, b.wallHi);
        p.rect(x - 1, 55, 6, 2, b.trim);
    }
    WING_WINDOWS.forEach((cx) => tallWindow(p, L, b, cx));

    for (const cx of WING_MIDDLES) {
        if (L.heroic) {
            p.shade(cx + 4, 17, 2, 22, 0.85);
            p.hline(cx - 5, 14, 11, L.metal);
            p.rect(cx - 3, 15, 7, 24, b.awnA);
            p.vline(cx - 3, 15, 24, tone(b.awnA, 0.8));
            p.hline(cx - 3, 17, 7, b.awnB);
            p.hline(cx - 3, 35, 7, b.awnB);
            p.grid(cx - 1, 24, ['.g.', 'ggg', 'ggg', '.g.'], { g: b.awnB });
            p.px(cx, 38, b.wall);
            p.rect(cx - 1, 39, 3, 1, b.wall);
        } else {
            // What actually hangs on a town hall
            p.rect(cx - 7, 30, 14, 12, b.door);
            p.rect(cx - 6, 31, 12, 10, L.paint('#c9b48a'));
            p.rect(cx - 5, 32, 4, 6, L.paint('#f6f4ec'));
            p.rect(cx + 1, 32, 4, 4, L.paint('#f6f4ec'));
            p.rect(cx + 1, 37, 3, 3, L.paint('#e6d98a'));
            p.hline(cx - 4, 34, 2, L.outline);
            p.hline(cx - 4, 36, 2, L.outline);
            p.hline(cx - 7, 42, 14, b.wallLo);
        }
    }

    // The clock tower breaks the roof line over the arch
    p.rect(TOWER_X, 0, TOWER_W, TOWER_H, b.wall);
    p.hline(TOWER_X, 0, TOWER_W, b.trim);
    p.vline(TOWER_X, 0, TOWER_H, b.wallHi);
    p.vline(TOWER_X + TOWER_W - 1, 0, TOWER_H, b.wallLo);
    p.vline(TOWER_X - 1, 0, 10, L.outline);
    p.vline(TOWER_X + TOWER_W, 0, 10, L.outline);
    p.ellipse(CLOCK_X, CLOCK_Y, 9.5, 9.5, L.outline);
    p.ellipse(CLOCK_X, CLOCK_Y, 8.5, 8.5, b.awnB);
    p.ellipse(CLOCK_X, CLOCK_Y, 6.5, 6.5, L.paint('#fffaf0'));
    p.ring(CLOCK_X, CLOCK_Y, 6.5, 6.5, L.paint('#e9dfc6'), 1, (_x, y) => y > 11);
    for (const [tx, ty] of [[320, 5], [320, 17], [314, 11], [326, 11]]) {
        p.px(tx, ty, L.outline);
    }
    for (const [tx, ty] of [[323, 6], [325, 8], [325, 14], [323, 16], [317, 16], [315, 14], [315, 8], [317, 6]]) {
        p.px(tx, ty, mix(L.outline, '#fffaf0', 0.55));
    }
    clockHands(p, L.outline);
    p.px(320, 11, b.awnA);

    // Arch: stone surround, then the street going away under it
    p.ellipse(HALL_MID, ARCH_SPRING, ARCH_W / 2 + 4, 14, b.trim, (_x, y) => y < ARCH_SPRING);
    p.ring(HALL_MID, ARCH_SPRING, ARCH_W / 2 + 4, 14, mix(b.trim, b.wallLo, 0.6), 1, (_x, y) => y < ARCH_SPRING);
    for (const x of [ARCH_X - 6, ARCH_X + ARCH_W]) {
        p.rect(x, ARCH_SPRING, 6, 30, b.trim);
        p.vline(x + 5, ARCH_SPRING, 30, mix(b.trim, b.wallLo, 0.5));
        p.rect(x - 1, ARCH_SPRING - 2, 8, 2, b.wallHi);
        p.hline(x - 1, ARCH_SPRING, 8, b.wallLo);
        p.rect(x - 1, 60, 8, 4, b.trim);
    }
    p.rect(ARCH_X, 22, ARCH_W, 42, L.deep, inArch);
    const far = L.b.tea;
    const farOther = L.b.clocks;
    p.rect(ARCH_X + 3, 27, 20, 10, tone(far.wall, 0.92), inArch);
    p.rect(ARCH_X + 23, 29, 22, 8, tone(farOther.wall, 0.92), inArch);
    p.rect(ARCH_X + 3, 27, 20, 2, far.roof, inArch);
    p.rect(ARCH_X + 23, 29, 22, 2, farOther.roof, inArch);
    for (const fx of [ARCH_X + 7, ARCH_X + 14, ARCH_X + 28, ARCH_X + 36]) {
        p.rect(fx, 31, 3, 3, L.glassLo);
    }
    p.rect(ARCH_X + 3, 37, ARCH_W - 6, 6, L.street);
    p.rect(ARCH_X + 3, 43, ARCH_W - 6, 21, tone(L.street, 0.7));
    p.rect(ARCH_X + 3, 43, ARCH_W - 6, 21, tone(L.streetLo, 0.66), (x, y) => (y & 3) === 2 || ((x + ((y >> 2) & 1) * 4) & 7) === 7);
    for (const x of [ARCH_X, ARCH_X + ARCH_W - 3]) {
        p.rect(x, ARCH_SPRING - 6, 3, 36, tone(b.wall, 0.55), inArch);
    }
    p.rect(HALL_MID - 3, 21, 6, 5, b.wallHi);
    p.hline(HALL_MID - 3, 26, 6, b.wallLo);
    for (const x of [ARCH_X - 4, ARCH_X + ARCH_W + 2]) {
        p.rect(x, 41, 2, 4, L.lampGlass);
        p.hline(x - 1, 40, 4, L.metal);
        p.px(x, 45, L.metal);
        p.px(x + 1, 45, L.metal);
    }
    p.vline(HALL_X, 0, 64, L.outline);
}

function hallDusk(p: Pix, L: Look, b: Building): void {
    p.rect(HALL_X, 0, HALL_W, 6, b.roof);
    p.hline(HALL_X, 6, HALL_W, b.wallHi);
    p.rect(HALL_X, 7, HALL_W, 57, b.wall);
    p.rect(HALL_X, 57, HALL_W, 7, b.wallLo);
    for (const x of [HALL_X + 2, HALL_X + HALL_W - 6, ARCH_X - 6, ARCH_X + ARCH_W]) {
        p.rect(x, 12, x === HALL_X + 2 || x === HALL_X + HALL_W - 6 ? 4 : 6, 52, b.trim);
    }
    WING_WINDOWS.forEach((cx, i) => {
        const colour = i % 2 ? L.lit[0] : L.lit[2];
        p.rect(cx - 7, 17, 14, 32, b.wallLo);
        p.rect(cx - 6, 18, 12, 30, colour);
        p.rect(cx - 6, 38, 12, 10, tone(colour, 0.78));
        p.vline(cx - 1, 18, 30, b.wallLo);
        p.vline(cx, 18, 30, b.wallLo);
    });
    p.rect(TOWER_X, 0, TOWER_W, TOWER_H, b.wall);
    p.frame(TOWER_X, -1, TOWER_W, TOWER_H + 1, b.wallHi);
    p.glow(CLOCK_X, CLOCK_Y, 14, 14, b.neon, 0.35);
    p.ellipse(CLOCK_X, CLOCK_Y, 8.5, 8.5, L.deep);
    p.ring(CLOCK_X, CLOCK_Y, 8.5, 8.5, b.neon);
    clockHands(p, b.neon);

    p.rect(ARCH_X, 22, ARCH_W, 42, L.deep, inArch);
    p.rect(ARCH_X + 3, 40, ARCH_W - 6, 24, tone(L.street, 0.6));
    for (const [fx, fy, c] of [[306, 30, 0], [313, 33, 1], [326, 31, 2], [334, 34, 1], [320, 36, 0]] as const) {
        p.rect(fx, fy, 2, 2, L.lit[c]);
    }
    const neon = L.b.tailor.neon;
    p.ring(HALL_MID, ARCH_SPRING, ARCH_W / 2 + 1, 11, neon, 1, (_x, y) => y < ARCH_SPRING);
    p.vline(ARCH_X - 1, ARCH_SPRING, 30, neon);
    p.vline(ARCH_X + ARCH_W, ARCH_SPRING, 30, neon);
    p.vline(HALL_X, 0, 64, L.outline);
}

function hallFlat(p: Pix, L: Look, b: Building): void {
    p.rect(HALL_X, 0, HALL_W, 6, b.roof);
    p.hline(HALL_X, 6, HALL_W, L.outline);
    p.rect(HALL_X, 7, HALL_W, 57, b.wall);
    p.rect(TOWER_X, 0, TOWER_W, TOWER_H, b.wall);
    p.vline(TOWER_X - 1, 0, 7, L.outline);
    p.vline(TOWER_X + TOWER_W, 0, 7, L.outline);
    p.ellipse(CLOCK_X, CLOCK_Y, 8.5, 8.5, L.outline);
    p.ellipse(CLOCK_X, CLOCK_Y, 7.5, 7.5, b.trim);
    clockHands(p, L.outline);
    for (const cx of WING_MIDDLES) {
        p.rect(cx - 6, 18, 12, 30, L.glass);
    }
    p.rect(ARCH_X, 22, ARCH_W, 42, L.deep, inArch);
    p.rect(ARCH_X + 6, 46, ARCH_W - 12, 18, L.street);
    p.vline(HALL_X, 0, 64, L.outline);
}

function hallInk(p: Pix): void {
    p.rect(HALL_X, 0, HALL_W, 64, PAPER);
    screentone(p, HALL_X, 0, HALL_W, 6);
    p.hline(HALL_X, 6, HALL_W, INK);
    p.rect(TOWER_X, 0, TOWER_W, TOWER_H, PAPER);
    p.frame(TOWER_X, -1, TOWER_W, TOWER_H + 1, INK);
    p.ring(CLOCK_X, CLOCK_Y, 8.5, 8.5, INK);
    for (const cx of WING_MIDDLES) {
        p.frame(cx - 6, 18, 12, 30, INK);
    }
    p.rect(ARCH_X, 22, ARCH_W, 42, INK, inArch);
    p.vline(HALL_X, 0, 64, INK);
    p.vline(HALL_X + HALL_W - 1, 0, 64, INK);
}

export function drawNorth(p: Pix, L: Look): void {
    for (const shop of SHOPS) {
        const b = L.b[shop.id];
        if (L.detail === 4) {
            shopFull(p, L, b, shop);
        } else if (L.detail === 3) {
            shopDusk(p, L, b, shop);
        } else if (L.detail === 2) {
            shopFlat(p, L, b, shop);
        } else {
            shopInk(p, shop);
        }
    }
    const hall = L.b.hall;
    if (L.detail === 4) {
        hallFull(p, L, hall);
    } else if (L.detail === 3) {
        hallDusk(p, L, hall);
    } else if (L.detail === 2) {
        hallFlat(p, L, hall);
    } else {
        hallInk(p);
    }
    // Where the fronts meet the paving
    if (L.detail === 1) {
        p.rect(0, NORTH - 2, MOUTH_X0 + 8, 2, INK);
        p.rect(MOUTH_X1 - 8, NORTH - 2, CITY_WIDTH - MOUTH_X1 + 8, 2, INK);
    } else if (L.detail <= 3) {
        p.hline(0, NORTH - 1, ARCH_X, L.outline);
        p.hline(ARCH_X + ARCH_W, NORTH - 1, CITY_WIDTH - ARCH_X - ARCH_W, L.outline);
    }
}

// ---------------------------------------------------------------- west and east: roof edges

interface Side {
    upper: BuildingId;
    lower: BuildingId;
    x: number;
    west: boolean;
}

const SIDES: Side[] = [
    { upper: 'bookshop', lower: 'flats', x: 0, west: true },
    { upper: 'cinema', lower: 'pharmacy', x: EAST, west: false },
];

function sideRoof(p: Pix, L: Look, b: Building, side: Side, y: number, h: number): void {
    const { x, west } = side;
    const eave = west ? x + 31 : x;
    const inner = west ? x + 30 : x + 1;
    if (L.detail === 1) {
        screentone(p, x, y, 32, h);
        p.vline(eave, y, h, INK);
        p.vline(inner, y, h, INK);
        p.hline(x, y, 32, INK);
        p.hline(x, y + h - 1, 32, INK);
        return;
    }
    if (L.detail === 2) {
        p.rect(x, y, 32, h, b.roof);
        p.vline(eave, y, h, L.outline);
        p.hline(x, y, 32, L.outline);
        p.hline(x, y + h - 1, 32, L.outline);
        return;
    }
    if (L.detail === 3) {
        p.rect(x, y, 32, h, b.roof);
        p.vline(inner, y, h, mix(b.neon, b.roof, 0.45));
        p.vline(eave, y, h, L.outline);
        p.hline(x, y, 32, L.outline);
        p.hline(x, y + h - 1, 32, L.outline);
        return;
    }
    roofCourses(p, b, x, y, 32, h, true);
    // The ridge runs along the outer edge; past it the roof falls away from the sun
    const ridge = west ? x + 5 : x + 26;
    p.vline(ridge, y, h, b.roofHi);
    p.shade(west ? x : ridge + 1, y, 5, h, west ? 0.86 : 0.8);
    p.vline(inner, y, h, b.trim);
    p.vline(eave, y, h, L.outline);
    p.hline(x, y, 32, L.outline);
    p.hline(x, y + 1, 32, b.roofHi);
    p.hline(x, y + h - 1, 32, L.outline);
}

function drawSide(p: Pix, L: Look, side: Side): void {
    const { x, west } = side;
    const upper = L.b[side.upper];
    const lower = L.b[side.lower];
    const wallY = MOUTH_Y0;

    sideRoof(p, L, upper, side, NORTH, MOUTH_Y0 - NORTH);
    sideRoof(p, L, lower, side, MOUTH_Y1, SOUTH - MOUTH_Y1);
    chimney(p, L, upper, x + 11, NORTH + 12);
    chimney(p, L, lower, x + 12, MOUTH_Y1 + 58);
    skylight(p, L, upper, x + 10, NORTH + 36, 10, 14, L.detail === 3 ? L.lit[0] : null);
    skylight(p, L, lower, x + 10, MOUTH_Y1 + 14, 10, 14, null);
    if (L.detail === 4) {
        skylight(p, L, lower, x + 10, MOUTH_Y1 + 34, 10, 14, null);
    }

    // The upper building's south wall shows in the street mouth
    if (L.detail === 1) {
        p.rect(x, wallY, 32, SIDE_WALL, PAPER);
        p.hline(x, wallY + SIDE_WALL - 1, 32, INK);
        p.vline(west ? x + 31 : x, wallY, SIDE_WALL, INK);
        return;
    }
    p.rect(x, wallY, 32, SIDE_WALL, upper.wall);
    if (L.detail === 2) {
        p.rect(x + 11, wallY + 5, 10, 9, L.glass);
        p.hline(x, wallY + SIDE_WALL - 1, 32, L.outline);
        return;
    }
    p.hline(x, wallY + SIDE_WALL - 1, 32, L.outline);
    if (L.detail === 3) {
        const colour = side.upper === 'cinema' ? upper.neon : L.lit[0];
        p.rect(x + 10, wallY + 4, 12, 11, upper.wallLo);
        p.rect(x + 11, wallY + 5, 10, 9, colour);
        p.rect(x + 11, wallY + 10, 10, 4, tone(colour, 0.78));
        return;
    }
    p.rect(x, wallY, 32, 2, upper.wallLo);
    p.rect(x, wallY + 2, 32, 16, upper.wallHi, (i, j) => hash(i, j, 3) < 0.035);
    p.rect(x, wallY + SIDE_WALL - 4, 32, 3, upper.wallLo);
    if (side.upper === 'cinema') {
        // Film posters
        const posters: [number, string, string][] = [
            [x + 4, '#e8483c', '#ffe28a'],
            [x + 18, '#2f6fa8', '#f4ecd8'],
        ];
        for (const [px, back, figure] of posters) {
            p.rect(px - 1, wallY + 3, 11, 13, upper.trim);
            p.rect(px, wallY + 4, 9, 11, L.paint(back));
            p.rect(px + 3, wallY + 6, 3, 5, L.paint(figure));
            p.hline(px + 1, wallY + 13, 7, L.paint(figure));
        }
    } else {
        windowFull(p, L, upper, x + 10, wallY + 4, WINDOW_W, 10, true, false);
    }
}

// ---------------------------------------------------------------- south: roofs from behind

interface Roof {
    id: BuildingId;
    x: number;
    w: number;
    /** Left edge of a shop awning under the eave, if this is a shop */
    awning?: number;
}

const ROOFS: Roof[] = [
    { id: 'house', x: 0, w: 144 },
    { id: 'cafe', x: 144, w: 144, awning: 168 },
    { id: 'bakery', x: 352, w: 144, awning: 376 },
    { id: 'cottage', x: 496, w: 144 },
];

const RIDGE = SOUTH + 15;
const EAVE = 4;
const AWNING_W = 96;
const AWNING_DEPTH = 6;

export function drawSouth(p: Pix, L: Look): void {
    for (const roof of ROOFS) {
        const b = L.b[roof.id];
        const { x, w } = roof;
        if (L.detail === 1) {
            screentone(p, x, SOUTH, w, 32);
            p.hline(x, RIDGE, w, INK);
            p.frame(x, SOUTH, w, 33, INK);
        } else if (L.detail <= 3) {
            p.rect(x, SOUTH, w, 32, b.roof);
            p.rect(x, RIDGE, w, 32 - 15, b.roofLo);
            p.hline(x, RIDGE, w, L.detail === 3 ? b.roofHi : L.outline);
            p.vline(x, SOUTH, 32, L.outline);
            p.vline(x + w - 1, SOUTH, 32, L.outline);
        } else {
            roofCourses(p, b, x, SOUTH, w, 32);
            p.shade(x, RIDGE + 1, w, 16, 0.84);
            p.hline(x, RIDGE - 1, w, b.roofHi);
            p.hline(x, RIDGE, w, b.roofLo);
            p.vline(x, SOUTH, 32, L.outline);
            p.vline(x + w - 1, SOUTH, 32, b.roofLo);
        }
        chimney(p, L, b, x + 22, SOUTH + 5);
        chimney(p, L, b, x + w - 34, SOUTH + 19);
        skylight(p, L, b, x + 62, SOUTH + 5, 14, 7, L.detail === 3 && roof.awning ? L.lit[0] : null);
        if (L.detail === 4) {
            skylight(p, L, b, x + 96, SOUTH + 5, 14, 7, null);
        }
    }
}

// ---------------------------------------------------------------- things people walk behind

/** Roof eaves and shop awnings along the south side, hanging over the paving */
function southOverhang(p: Pix, L: Look): void {
    for (const roof of ROOFS) {
        const b = L.b[roof.id];
        const x = Math.max(roof.x, WEST);
        const w = Math.min(roof.x + roof.w, EAST) - x;
        const y = SOUTH - EAVE;
        if (L.detail === 1) {
            p.rect(x, y, w, EAVE, PAPER);
            p.hline(x, y, w, INK);
            p.vline(x, y, EAVE, INK);
            p.vline(x + w - 1, y, EAVE, INK);
            continue;
        }
        if (L.detail === 2) {
            p.rect(x, y, w, EAVE, b.roof);
            p.hline(x, y, w, L.outline);
            continue;
        }
        if (L.detail === 3) {
            p.rect(x, y, w, EAVE, b.roof);
            p.hline(x, y, w, mix(b.neon, b.roof, 0.45));
        } else {
            roofCourses(p, b, x, y, w, EAVE);
            p.hline(x, y, w, L.outline);
            p.hline(x, y + 1, w, b.roofHi);
        }
        if (roof.awning === undefined) {
            continue;
        }
        const ay = y - AWNING_DEPTH;
        if (L.detail === 3) {
            p.rect(roof.awning, ay, AWNING_W, AWNING_DEPTH, b.awnA);
            p.hline(roof.awning, ay, AWNING_W, b.neon);
            continue;
        }
        for (let i = 0; i < AWNING_W; i++) {
            const colour = (i >> 2) & 1 ? b.awnB : b.awnA;
            const ax = roof.awning + i;
            p.vline(ax, ay + 1, AWNING_DEPTH - 1, colour);
            p.px(ax, ay, tone(colour, 0.8));
            p.px(ax, ay + AWNING_DEPTH - 1, tone(colour, 0.86));
            if ((i & 3) === 1 || (i & 3) === 2) {
                p.px(ax, ay - 1, tone(colour, 0.8));
            }
        }
        p.vline(roof.awning - 1, ay, AWNING_DEPTH, L.outline);
        p.vline(roof.awning + AWNING_W, ay, AWNING_DEPTH, L.outline);
    }
}

/** A canopy seen from above, sticking out from a side building over the paving */
function sideCanopy(p: Pix, L: Look, b: Building, west: boolean, y: number, h: number, depth: number, bulbs: boolean): void {
    const x = west ? WEST : EAST - depth;
    const lip = west ? x + depth - 1 : x;
    if (L.detail === 3) {
        p.rect(x, y, depth, h, b.awnA);
        p.vline(lip, y, h, b.neon);
        if (bulbs) {
            p.hline(x, y, depth, b.neon);
            p.hline(x, y + h - 1, depth, b.neon);
        }
        return;
    }
    for (let j = 0; j < h; j++) {
        const colour = bulbs ? b.awnA : (j >> 2) & 1 ? b.awnB : b.awnA;
        p.hline(x, y + j, depth, colour);
        p.px(lip, y + j, tone(colour, 0.8));
    }
    p.hline(x, y - 1, depth, L.outline);
    p.hline(x, y + h, depth, L.outline);
    if (bulbs) {
        p.rect(x + 2, y + 2, depth - 3, h - 4, tone(b.awnA, 1.15));
        for (let j = 1; j < h; j += 3) {
            p.px(lip, y + j, b.awnB);
        }
        for (let i = 1; i < depth; i += 3) {
            p.px(x + i, y, b.awnB);
            p.px(x + i, y + h - 1, b.awnB);
        }
    }
}

function sideExtras(p: Pix, L: Look): void {
    if (L.detail <= 2) {
        return;
    }
    sideCanopy(p, L, L.b.bookshop, true, NORTH + 10, 44, 6, false);
    sideCanopy(p, L, L.b.cinema, false, NORTH + 8, 48, 9, true);
    sideCanopy(p, L, L.b.pharmacy, false, MOUTH_Y1 + 12, 28, 6, false);

    // The pharmacy's cross, on a bracket
    const b = L.b.pharmacy;
    const cy = MOUTH_Y1 + 52;
    if (L.detail === 3) {
        p.rect(EAST - 7, cy, 7, 7, L.deep);
        p.rect(EAST - 5, cy + 1, 3, 5, b.neon);
        p.rect(EAST - 6, cy + 2, 5, 3, b.neon);
    } else {
        p.rect(EAST - 8, cy - 1, 8, 9, L.outline);
        p.rect(EAST - 7, cy, 7, 7, b.sign);
        p.rect(EAST - 5, cy + 1, 3, 5, b.signInk);
        p.rect(EAST - 6, cy + 2, 5, 3, b.signInk);
    }

    if (L.detail === 4) {
        // Balconies on the flats, with something growing on them
        const flats = L.b.flats;
        for (const y of [MOUTH_Y1 + 16, MOUTH_Y1 + 56]) {
            p.rect(WEST, y, 5, 18, flats.trim);
            p.rect(WEST, y + 1, 4, 16, flats.wallLo);
            p.frame(WEST - 1, y - 1, 7, 20, L.outline);
            p.vline(WEST - 1, y - 1, 20, flats.trim);
            for (let j = y + 2; j < y + 16; j++) {
                const h = hash(3, j, 31);
                p.px(WEST + 1 + Math.floor(h * 3), j, h < 0.5 ? L.leaf : L.leafHi);
                if (h > 0.8) {
                    p.px(WEST + 2, j, L.flowers[j % L.flowers.length]);
                }
            }
        }
    }
}

/** Everything on the ring that overhangs the paving. Drawn on the picture and on the over-layer. */
export function drawOverhangs(p: Pix, L: Look): void {
    southOverhang(p, L);
    sideExtras(p, L);
}

export function drawSides(p: Pix, L: Look): void {
    for (const side of SIDES) {
        drawSide(p, L, side);
    }
}

/** Open ground inside the building ring: the three street mouths that are not the arch */
export function drawStreets(p: Pix, L: Look): void {
    const top = MOUTH_Y0 + SIDE_WALL;
    const areas: [number, number, number, number][] = [
        [0, top, 32, MOUTH_Y1 - top],
        [EAST, top, 32, MOUTH_Y1 - top],
        [MOUTH_X0, SOUTH, MOUTH_X1 - MOUTH_X0, 32],
    ];
    areas.forEach(([x, y, w, h], index) => {
        if (L.detail === 1) {
            p.rect(x, y, w, h, PAPER);
            return;
        }
        p.rect(x, y, w, h, L.street);
        if (L.detail === 4) {
            if (L.streetMark) {
                // Tarmac, and a crossing where the street meets the square
                p.rect(x, y, w, h, L.streetLo, (i, j) => hash(i, j, 41) < 0.08);
                if (index === 2) {
                    p.rect(x + 6, y + 5, w - 12, 12, L.streetMark, (i) => ((i - x - 6) % 7) < 4);
                    p.hline(x, y, w, L.kerb);
                    p.hline(x, y + 1, w, L.joint);
                } else {
                    const cx = index === 0 ? x + 12 : x + 4;
                    p.rect(cx, y + 6, 14, h - 12, L.streetMark, (_i, j) => ((j - y - 6) % 7) < 4);
                    p.vline(index === 0 ? x + 31 : x, y, h, L.kerb);
                    p.vline(index === 0 ? x + 30 : x + 1, y, h, L.joint);
                }
            } else {
                // Setts, a little darker than the square's paving
                p.rect(x, y, w, h, L.streetLo, (i, j) => (j & 3) === 3 || ((i + ((j >> 2) & 1) * 4) & 7) === 7);
            }
            if (index < 2) {
                p.shade(x, y, w, L.shadowLength, L.shadow);
            } else {
                p.shade(x, y, L.shadowLength, h, L.shadow);
            }
        } else if (L.detail === 3 && index === 2) {
            p.hline(x, y, w, L.kerb);
        }
    });
}
