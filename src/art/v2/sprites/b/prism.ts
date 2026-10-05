import type { Grid } from '../../../sprites/grid';
import { Pix, inked, type Detail, type Point } from './paint';

// The boss, and what it was: a police car seen from the front. The crystal keeps the car's
// face on purpose: two lights on the roof, two headlights for eyes, a grille for a mouth.

type Frame = 0 | 1 | 2;

const mir = (points: readonly Point[]): Point[] => points.map(([x, y]) => [64 - x, y]);

// The sun is on the left, so every facet's mirror image is one step darker
const SHADED: Record<string, string> = { m: 'c', c: 'C', C: 'Z', Z: 'B', b: 'A' };

interface Lamp {
    core: string;
    body: string;
    edge: string;
}

const RED_ON: Lamp = { core: 'w', body: 'q', edge: 'r' };
const RED_OFF: Lamp = { core: 'R', body: 'R', edge: 'Q' };
const BLUE_ON: Lamp = { core: 'w', body: 'a', edge: 'b' };
const BLUE_OFF: Lamp = { core: 'B', body: 'B', edge: 'A' };
// On the manga page a lit lamp is bare paper and a dark one is solid ink
const INK_ON: Lamp = { core: 'w', body: 'w', edge: 'w' };
const INK_OFF: Lamp = { core: 'k', body: 'k', edge: 'k' };

const FANG = ['wwww', 'wwww', '.ww.', '.ww.'];

function prism(detail: Detail, frame: Frame): Pix {
    const p = new Pix(64, 64);
    const charge = frame === 2;
    const leftOn = frame !== 1;
    const rightOn = frame !== 0;
    const pair = (points: Point[], slot: string) => {
        p.poly(points, slot).poly(mir(points), SHADED[slot] ?? slot);
    };

    // Shards that hang beside it and rise for the wind-up
    const hang = charge ? -9 : frame === 1 ? 1 : -1;
    const shard: Point[] = [[4, 29 + hang], [7, 35 + hang], [5, 46 + hang], [1, 38 + hang]];
    pair(shard, 'C');
    if (detail >= 1) {
        pair([[4, 29 + hang], [4, 37 + hang], [5, 46 + hang], [1, 38 + hang]], 'c');
    }

    // Horns: each holds one of the two lights
    const horn = (points: Point[], lamp: Lamp, lit: boolean, side: (pts: Point[]) => Point[]) => {
        p.poly(side([[13, 25], [10, 12], [15, 3], [20, 11], [20, 19]]), detail >= 1 ? 'Z' : 'C');
        p.poly(side([[13, 25], [10, 12], [15, 3], [15, 22]]), 'C');
        p.poly(side(points), lamp.edge);
        p.poly(side([[11.5, 11], [15, 5], [15, 13]]), lamp.body);
        if (lit) {
            p.poly(side([[13, 9], [15, 6], [16, 11]]), lamp.core);
        }
    };
    const glass: Point[] = [[10, 12], [15, 3], [20, 11], [15, 15]];
    const same = (pts: Point[]) => pts;
    if (detail === 0) {
        horn(glass, leftOn ? INK_ON : INK_OFF, leftOn, same);
        horn(glass, rightOn ? INK_ON : INK_OFF, rightOn, mir);
    } else {
        horn(glass, leftOn ? RED_ON : RED_OFF, leftOn, same);
        horn(glass, rightOn ? BLUE_ON : BLUE_OFF, rightOn, mir);
    }

    // The body: a cut gem, table to the front, point down
    const A: Point = [19, 17];
    const L: Point = [7, 33];
    const B: Point = [32, 61];
    const a: Point = [22, 25];
    const l: Point = [15, 34];
    const m: Point = [23, 46];
    const e: Point = [21, 49];
    pair([A, [32, 17], [32, 25], a], detail >= 2 ? 'm' : 'c');
    pair([A, a, l, L], 'c');
    pair([a, [32, 25], [32, 49], m, l], 'C');
    pair([L, l, m, e], 'Z');
    pair([m, [32, 49], B, e], 'b');

    if (detail >= 2) {
        // Ridges catch the light
        p.line(22, 25, 15, 34, 'm').line(22, 25, 31, 25, 'm').line(15, 34, 23, 46, 'c');
        p.line(41, 25, 48, 34, 'C').line(48, 34, 40, 46, 'C');
    }
    if (detail >= 3) {
        // What a prism does to light: the spectrum, split along the lower facets
        p.line(24, 49, 31, 58, 'q').line(26, 49, 31, 55, 'y');
        p.line(39, 49, 32, 58, 'a').line(37, 49, 32, 55, 'l');
        p.rows(22, 19, ['.w.', 'www', '.w.']);
        p.dots('w', 12, 31, 13, 30, 47, 21);
    }

    p.outline('k', detail >= 2 ? { m: 'Z', c: 'Z', q: 'R', a: 'B' } : {});

    // Rays off whichever lamp is lit
    const rays = (lit: boolean, slot: string, side: (pts: Point[]) => Point[]) => {
        if (!lit || detail === 1) {
            return;
        }
        for (const [x, y] of side([[15.5, 0.5], [8.5, 5.5], [22.5, 4.5], [7.5, 9.5]])) {
            p.set(Math.floor(x), Math.floor(y), slot);
        }
    };
    rays(leftOn, detail === 0 ? 'k' : 'q', same);
    rays(rightOn, detail === 0 ? 'k' : 'a', mir);

    // The face. Eyes are slits of headlight under a heavy brow.
    const eye: Point[] = charge ? [[18, 33], [28, 37], [28, 39], [21, 38]] : [[17, 31], [28, 35], [28, 39], [20, 38]];
    p.poly(eye, 'e').poly(mir(eye), detail >= 2 ? 'y' : 'e');
    const brow = charge ? 2 : 0;
    p.line(16, 30 + brow, 28, 34 + brow, 'k').line(16, 31 + brow, 28, 35 + brow, 'k');
    p.line(47, 30 + brow, 35, 34 + brow, 'k').line(47, 31 + brow, 35, 35 + brow, 'k');
    p.rect(24, 36, 2, 3, 'k').rect(38, 36, 2, 3, 'k');

    if (charge) {
        // Jaws wide, the next shot burning in its throat
        p.poly([[21, 42], [43, 42], [41, 52], [32, 57], [23, 52]], 'k');
        p.ball(32, 48.5, 5, 4.5, detail >= 2 ? 'wey' : 'ee');
        for (let x = 23; x <= 38; x += 5) {
            p.rows(x, 42, FANG);
        }
        p.rows(25, 51, ['.w.', 'www']).rows(36, 51, ['.w.', 'www']);
    } else {
        // A grille of teeth
        p.poly([[20, 42], [44, 42], [41, 48], [32, 51], [23, 48]], 'k');
        for (let x = 23; x <= 38; x += 5) {
            p.rows(x, 42, FANG);
        }
        if (detail >= 1) {
            p.rows(28, 47, ['.w.', 'www']).rows(33, 47, ['.w.', 'www']);
        }
    }
    return p;
}

export function prismFrames(detail: Detail): Grid[] {
    const frames = ([0, 1, 2] as Frame[]).map((f) => prism(detail, f).grid());
    return detail === 0 ? frames.map((g) => inked(g, 'kA', 'ZBb')) : frames;
}

// --- Police car ----------------------------------------------------------------------------

function policeCar(frame: Frame): Pix {
    const p = new Pix(64, 64);
    const redOn = frame !== 1;
    const blueOn = frame !== 0;

    // Wheels, seen end on
    p.rect(9, 46, 9, 10, 'D').rect(46, 46, 9, 10, 'D');
    p.rect(10, 47, 2, 8, 'd').rect(47, 47, 2, 8, 'd');

    // Cabin and windscreen
    p.poly([[19, 14], [45, 14], [50, 29], [14, 29]], 'w');
    p.poly([[42, 14], [45, 14], [50, 29], [46, 29]], 'g');
    p.poly([[21, 17], [43, 17], [46, 27], [18, 27]], 'C');
    p.poly([[21, 17], [30, 17], [22, 27], [18, 27]], 'c');
    p.poly([[36, 17], [39, 17], [34, 27], [31, 27]], 'c');
    p.rect(18, 26, 28, 1, 'Z');
    // Two heads behind the glass
    p.rows(23, 20, ['.DDD.', 'DDDDD', 'DDDDD', '.DDD.', 'DDDDD', 'DDDDD']);
    p.rows(36, 20, ['.DDD.', 'DDDDD', 'DDDDD', '.DDD.', 'DDDDD', 'DDDDD']);
    // Wing mirrors
    p.rect(10, 24, 5, 3, 'g').rect(49, 24, 5, 3, 'G');

    // Bonnet, wings and bumper
    p.poly([[10, 29], [54, 29], [57, 33], [57, 47], [7, 47], [7, 33]], 'w');
    p.rect(8, 30, 48, 1, 'm');
    p.poly([[52, 30], [54, 30], [56, 33], [56, 46], [52, 46]], 'g');
    p.rect(8, 43, 48, 3, 'g');
    p.rect(6, 46, 52, 4, 'G').rect(6, 49, 52, 1, 'd').rect(6, 46, 52, 1, 'M');

    // The chequered band every police car wears
    for (let x = 8; x < 56; x += 4) {
        p.rect(x, 39, 2, 2, 'b').rect(x + 2, 41, 2, 2, 'b');
        p.rect(x + 2, 39, 2, 2, 'y').rect(x, 41, 2, 2, 'y');
    }

    // Headlights, grille, number plate
    p.rect(10, 32, 9, 5, 'y').rect(45, 32, 9, 5, 'y');
    p.rect(11, 33, 4, 2, 'e').rect(46, 33, 4, 2, 'e');
    p.rect(23, 32, 18, 5, 'D');
    for (let y = 33; y <= 35; y += 2) {
        p.rect(24, y, 16, 1, 'G');
    }
    p.rect(26, 46, 12, 3, 'e');
    p.dots('d', 28, 47, 30, 47, 31, 47, 33, 47, 35, 47);

    // Roof bar: one lamp lit at a time
    p.rect(20, 10, 24, 4, 'd');
    p.rect(21, 9, 10, 4, redOn ? 'q' : 'R');
    p.rect(33, 9, 10, 4, blueOn ? 'a' : 'B');
    p.rect(21, 12, 10, 1, redOn ? 'r' : 'Q').rect(33, 12, 10, 1, blueOn ? 'b' : 'A');
    if (redOn) {
        p.rect(23, 10, 4, 1, 'w');
    }
    if (blueOn) {
        p.rect(35, 10, 4, 1, 'w');
    }

    if (frame === 2) {
        // The driver's door swung open toward us
        p.poly([[7, 27], [1, 25], [1, 45], [7, 47]], 'g');
        p.poly([[6, 28], [2, 27], [2, 34], [6, 35]], 'C');
        p.rect(2, 39, 5, 3, 'b');
        p.rect(1, 25, 1, 21, 'w');
    }

    p.outline('k');
    p.ground(32, 56, 28, 3.5);
    // Panel lines, drawn last so the outline pass does not thicken them
    p.rect(8, 38, 48, 1, 'G');
    p.rect(19, 31, 1, 7, 'g').rect(44, 31, 1, 7, 'g');
    if (redOn) {
        p.dots('q', 19, 6, 22, 5, 26, 4, 30, 6);
    }
    if (blueOn) {
        p.dots('a', 33, 6, 37, 4, 41, 5, 44, 6);
    }
    return p;
}

export const PRISM_PLAIN: Grid[] = [policeCar(0).grid(), policeCar(1).grid(), policeCar(2).grid()];
