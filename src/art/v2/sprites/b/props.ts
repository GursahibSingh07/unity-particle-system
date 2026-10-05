import type { Grid } from '../../../sprites/grid';
import { Pix, inked, type Detail, type Point } from './paint';

// Things in the air and things on the floor.

// --- Projectiles: 0 thrown lump, 1 snowball, 2 acid glob, 3 prism shard ---------------------

function lump(detail: Detail): Pix {
    const p = new Pix(16, 16);
    // A fist of scrap iron: round, but knocked about
    p.ball(7.5, 7.5, 5.2, 5, detail >= 3 ? 'mMtT' : detail >= 1 ? 'MMtT' : 'MMMM');
    p.rect(11, 3, 2, 2, '.').rect(2, 10, 2, 2, '.');
    p.outline('k');
    if (detail >= 2) {
        p.dots('T', 6, 9, 7, 10, 9, 6).dots('k', 8, 10);
    }
    return p;
}

function snowball(detail: Detail): Pix {
    const p = new Pix(16, 16);
    p.ball(7.5, 7.5, 5, 5, detail >= 2 ? 'mmMt' : detail >= 1 ? 'mmMM' : 'mmmm', [0.82, -0.02, -0.5]);
    p.outline('k', detail >= 2 ? { m: 't' } : {});
    if (detail >= 3) {
        p.dots('w', 5, 5, 6, 5, 5, 6).dots('m', 14, 2, 1, 13, 13, 13);
    }
    return p;
}

function acidGlob(detail: Detail): Pix {
    const p = new Pix(16, 16);
    const goo = detail >= 3 ? 'elnN' : detail >= 1 ? 'llnN' : 'llll';
    // A fat drop with a tail and one drip that has let go
    p.ball(7, 8, 4.8, 4.4, goo);
    p.ball(10, 10.5, 3, 2.6, detail >= 1 ? 'lnN' : 'lll');
    p.ball(13, 4, 1.4, 1.4, 'ln');
    p.ball(3, 13.5, 1, 1, 'nn');
    p.outline('k', detail >= 2 ? { e: 'N', l: 'N' } : {});
    if (detail >= 2) {
        p.dots('e', 5, 7, 6, 6);
    }
    return p;
}

function shard(detail: Detail): Pix {
    const p = new Pix(16, 16);
    p.poly([[8, 0.5], [12, 7], [8, 15.5], [4, 7]], 'C');
    p.poly([[8, 0.5], [8, 7], [4, 7]], detail >= 1 ? 'm' : 'C');
    p.poly([[4, 7], [8, 7], [8, 15.5]], detail >= 1 ? 'c' : 'C');
    if (detail >= 1) {
        p.poly([[8, 7], [12, 7], [8, 15.5]], 'Z');
    }
    p.outline('k', detail >= 2 ? { m: 'Z', c: 'Z' } : {});
    if (detail >= 3) {
        p.dots('w', 6, 5, 7, 4, 7, 3).dots('a', 13, 3, 2, 12);
    }
    return p;
}

export function projectileFrames(detail: Detail): Grid[] {
    const frames = [lump(detail), snowball(detail), acidGlob(detail), shard(detail)].map((p) => p.grid());
    return detail === 0 ? frames.map((g) => inked(g, 'k', 'MC')) : frames;
}

// What was really thrown: a cyclist's bottle, a scoop, a sponge, and one blue flash
const BOTTLE: Grid = [
    '................',
    '......kkkk......',
    '.....kbbBBk.....',
    '.....kbbBBk.....',
    '......kggk......',
    '.....kkGGkk.....',
    '....kcwcccCk....',
    '....kcwcccCk....',
    '....kbbbbbBk....',
    '....kbwwwbBk....',
    '....kbbbbbBk....',
    '....kcwcccCk....',
    '....kcwcccCk....',
    '....kcccCCCk....',
    '.....kkkkkk.....',
    '................',
];

const SCOOP: Grid = [
    '................',
    '................',
    '.....kkkkkk.....',
    '....kiwwiiik....',
    '...kiwwiiiiIk...',
    '..kiiwiiiiiIIk..',
    '..kiiiiiiiiIIk..',
    '..kiiiiiiiIIIk..',
    '..kiiiiiiIIIIk..',
    '.kiiiiiiIIIIIIk.',
    '.kiIiiIIIIiIIIk.',
    '..kkIIkkIIkkIk..',
    '....kk..kk..k...',
    '................',
    '................',
    '................',
];

const SPONGE: Grid = [
    '................',
    '..........kk....',
    '...kk....kcwk...',
    '..kwck....kk....',
    '..kcck..........',
    '...kkkkkkkkkk...',
    '..kyeyyyyyyyYk..',
    '.kyeyyyEyyyyyYk.',
    '.kyyyyyyyyEyyYk.',
    '.kyyEyyyyyyyyYk.',
    '.kyyyyyyEyyyYYk.',
    '.kYyyyyyyyyYYYk.',
    '..kYYYYYYYYYYk..',
    '...kkkkkkkkkk...',
    '.....c..........',
    '................',
];

const FLASH: Grid = [
    '.......a........',
    '.......a........',
    '..a....c....a...',
    '...a...c...a....',
    '....c.cwc.c.....',
    '.....cwwwc......',
    '....cwwwwwc.....',
    'aacccwwwwwcccaa.',
    '....cwwwwwc.....',
    '.....cwwwc......',
    '....c.cwc.c.....',
    '...a...c...a....',
    '..a....c....a...',
    '.......a........',
    '.......a........',
    '................',
];

export const PROJECTILES_PLAIN: Grid[] = [BOTTLE, SCOOP, SPONGE, FLASH];

// --- Hazards: 0 ice patch, 1 acid pool -----------------------------------------------------

// Decals lie flat and have no black line round them, only a darker rim: that keeps them on
// the floor, and the pale middle with a dark edge shows on light paving and on dark.

const ICE: Point[] = [[4, 13], [9, 8], [16, 9], [22, 6], [28, 11], [27, 17], [30, 22], [23, 26], [15, 24], [9, 27], [3, 22], [5, 18]];

function ice(detail: Detail): Pix {
    const p = new Pix(32, 32);
    p.poly(ICE, 'c');
    p.bevel('c', detail >= 2 ? 'm' : null, 'C', 1);
    p.outline(detail >= 1 ? 'Z' : 'k');
    if (detail >= 1) {
        // Glints, all leaning the same way so it looks slick
        p.line(9, 15, 13, 11, 'w').line(11, 16, 13, 14, 'w').line(19, 20, 23, 16, 'w');
    }
    if (detail >= 2) {
        p.path([[16, 13], [18, 16], [17, 19], [20, 22]], 'C').path([[18, 16], [22, 14]], 'C');
    }
    if (detail >= 3) {
        p.dots('w', 24, 10, 7, 21, 14, 21, 26, 21).line(21, 21, 23, 19, 'm');
    }
    return p;
}

function pool(detail: Detail, rim: string, fill: string, glow: string | null): Pix {
    const p = new Pix(32, 32);
    p.ellipse(15, 16, 10.5, 6.5, fill).ellipse(22, 19, 7, 5, fill).ellipse(9, 20, 6, 4.2, fill);
    p.ellipse(27, 10, 1.8, 1.4, fill).ellipse(4, 27, 1.5, 1.2, fill);
    if (glow) {
        p.bevel(fill, glow, rim, 1);
    }
    p.outline(detail >= 1 ? rim : 'k');
    return p;
}

function acid(detail: Detail): Pix {
    const p = pool(detail, 'N', 'n', detail >= 2 ? 'l' : null);
    if (detail >= 1) {
        p.outline('L');
        // Bubbles: rings while they swell, a bright dot when they pop
        p.rows(11, 13, ['.ll.', 'l..l', 'l..l', '.ll.']);
        p.rows(20, 18, ['.l.', 'l.l', '.l.']);
    }
    if (detail >= 2) {
        p.dots('e', 12, 14, 8, 20, 17, 21, 24, 20, 16, 11);
    }
    if (detail >= 3) {
        p.rows(5, 18, ['.l.', 'lel', '.l.']).dots('e', 27, 10, 19, 15);
    }
    return p;
}

export function hazardFrames(detail: Detail): Grid[] {
    const frames = [ice(detail).grid(), acid(detail).grid()];
    return detail === 0 ? frames.map((g, i) => inked(g, 'k', i === 0 ? 'C' : 'nNl')) : frames;
}

function spilledIceCream(): Pix {
    const p = pool(3, 'I', 'i', 'w');
    // The cone, where it landed
    p.poly([[19, 10], [27, 5], [25, 13]], 'y').poly([[23, 8], [27, 5], [25, 13]], 'Y');
    p.dots('E', 21, 10, 23, 10, 24, 8);
    p.line(18, 10, 26, 4, 'k').line(27, 5, 25, 14, 'k').line(19, 11, 24, 14, 'k');
    p.dots('w', 10, 15, 11, 14, 12, 14).dots('I', 14, 18, 15, 19, 20, 20);
    return p;
}

function soapyWater(): Pix {
    const p = pool(3, 'C', 'c', 'm');
    p.outline('Z');
    // Suds piled where the bucket tipped
    p.rows(9, 12, ['..ww.ww..', '.wmwwwmw.', 'wwwwmwwww', '.wmwwwww.', '..ww.ww..']);
    p.rows(20, 17, ['.ww.', 'wmww', '.ww.']);
    p.dots('w', 7, 20, 25, 21, 16, 21, 27, 10);
    return p;
}

export const HAZARDS_PLAIN: Grid[] = [spilledIceCream().grid(), soapyWater().grid()];
