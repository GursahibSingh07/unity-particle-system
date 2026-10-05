import type { Grid } from '../../../sprites/grid';
import { Pix, inked, type Detail, type Point } from './paint';

// The speed class: both are thin, sharp and mostly limb, so they read as fast standing still.

// --- Zig-zag bat ---------------------------------------------------------------------------

// Left wing only; the right is its mirror. The trailing edge is a lightning bolt.
const WING_UP: Point[] = [[10, 10], [5, 5], [0, 1], [3, 7], [1, 8], [5, 11], [3, 13], [8, 14], [10, 15]];
const WING_DOWN: Point[] = [[10, 10], [4, 11], [0, 19], [4, 16], [4, 20], [7, 17], [8, 21], [10, 16]];

function zigbat(detail: Detail, down: boolean): Pix {
    const half = new Pix(24, 24);
    half.poly(down ? WING_DOWN : WING_UP, 'R');
    if (detail >= 1) {
        // The bright leading edge of the wing
        if (down) {
            half.path([[9, 10], [4, 11], [1, 17]], 'r');
        } else {
            half.path([[9, 10], [5, 5], [1, 2]], 'r');
        }
    }
    if (detail >= 2) {
        // The streak that gives it its name
        if (down) {
            half.path([[8, 13], [5, 14], [6, 16], [4, 18]], 'y');
        } else {
            half.path([[8, 12], [5, 9], [6, 8], [3, 5]], 'y');
        }
    }

    const p = new Pix(24, 24).paste(half).paste(half.flipped());
    const lift = down ? -1 : 0;
    // Ears like blades, a kite of a body, a barbed tail
    p.poly([[8, 3 + lift], [11, 9 + lift], [8, 9 + lift]], 'r');
    p.poly([[16, 3 + lift], [16, 9 + lift], [13, 9 + lift]], 'r');
    p.poly([[12, 7 + lift], [16, 10 + lift], [14, 17 + lift], [12, 21 + lift], [10, 17 + lift], [8, 10 + lift]], 'r');
    if (detail >= 1) {
        p.rows(9, 14 + lift, ['R....R', '.R..R.', '.RRRR.', '..RR..', '..RR..', '..RR..']);
    }
    if (detail >= 3) {
        p.dots('Y', 9, 5 + lift, 9, 6 + lift, 9, 9 + lift, 10, 8 + lift, 11, 8 + lift);
    }
    p.outline('k');
    // Slit eyes, slanted in
    const eyes = ['e....e', 'ee..ee', '.e..e.'];
    p.rows(9, 10 + lift, detail === 0 ? eyes.map((row) => row.replace(/e/g, 'k')) : eyes);
    if (detail >= 3) {
        p.rows(10, 14 + lift, ['w..w']);
    }
    return p;
}

// A kid on a scooter, side on, helmet on
const SCOOTER_KID: Grid = [
    '........................',
    '..........kkkkk.........',
    '.........kbbbcbk........',
    '........kbbbbbcbk.......',
    '........kBBBBBBBkk......',
    '........khfffkffk.......',
    '........khfffffk........',
    '.........kfffFk....kk...',
    '........kkkFFkk...kdGk..',
    '.......kyyyyyykkkkkGk...',
    '.......kyyyyyyfffffkk...',
    '.......kyYyyyykkkkGk....',
    '.......kyYyyyk...kGk....',
    '.......kYYYYYk...kGk....',
    '.......kBBkBBk...kGk....',
    '......kBBkkBBk...kGk....',
    '.....kBBk.kBBk...kGk....',
    '....kBBk..kBBk...kGk....',
    '...kwwk...kwwkk..kGk....',
    '...kkkkkkkkkkkkkkkdk....',
    '..kkdddddddddddddddkk...',
    '.kdGdkkkkkkkkkkkkkdGdk..',
    '.kdddk...........kdddk..',
    '..kkk.............kkk...',
];

// The pushing leg swings through
const SCOOTER_KICK: Grid = [
    ...SCOOTER_KID.slice(0, 14),
    '.......kBBkBBk...kGk....',
    '.......kBBkBBk...kGk....',
    '.......kBBkBBk...kGk....',
    '......kBBk.kBBk..kGk....',
    '.....kwwwk.kwwk..kGk....',
    '.....kkkkkkkkkkkkkdk....',
    '..kkdddddddddddddddkk...',
    '.kdGdkkkkkkkkkkkkkdGdk..',
    '.kdddk...........kdddk..',
    '..kkk.............kkk...',
];

export function zigbatFrames(detail: Detail): Grid[] {
    const frames = [zigbat(detail, false).grid(), zigbat(detail, true).grid()];
    return detail === 0 ? frames.map((g) => inked(g, 'k', 'R')) : frames;
}

export const ZIGBAT_PLAIN: Grid[] = [SCOOTER_KID, SCOOTER_KICK];

// --- Skitter -------------------------------------------------------------------------------

type Leg = [hip: Point, knee: Point, foot: Point];

// Left legs; the right ones mirror them with the stride swapped, so it scuttles
const LEGS_A: Leg[] = [
    [[10, 12], [4, 4], [2, 28]],
    [[13, 16], [9, 21], [11, 29]],
];
const LEGS_B: Leg[] = [
    [[10, 12], [5, 3], [5, 25]],
    [[13, 16], [11, 20], [8, 28]],
];

function skitter(detail: Detail, stride: boolean): Pix {
    const legs = (set: Leg[]) => {
        const half = new Pix(32, 32);
        for (const [hip, knee, foot] of set) {
            half.path([hip, knee, foot], 'Y');
            if (detail >= 2) {
                half.set(knee[0], knee[1], 'y');
            }
            half.set(foot[0] - 1, foot[1], 'Y');
        }
        return half;
    };
    const p = new Pix(32, 32);
    p.paste(legs(stride ? LEGS_B : LEGS_A));
    p.paste(legs(stride ? LEGS_A : LEGS_B).flipped());

    const bob = stride ? 1 : 0;
    p.ball(15.5, 11.5 + bob, 6.6, 5.6, detail >= 3 ? 'eyYO' : detail >= 1 ? 'yyYO' : 'yyyy');
    p.outline('k', detail >= 2 ? { y: 'O', e: 'O' } : {});

    // Wide, frightened eyes looking over its shoulder
    const look = stride ? 1 : 0;
    p.rows(11, 9 + bob, ['.ww..ww.', 'wwww.wwww', 'wwww.wwww', '.ww..ww.']);
    p.dots('k', 12 + look, 10 + bob, 12 + look, 11 + bob, 17 + look, 10 + bob, 17 + look, 11 + bob);
    if (detail >= 1) {
        p.rows(14, 14 + bob, ['k.k', '.k.']);
    }
    if (detail >= 3) {
        // The sweat it shares with the jogger
        p.rows(23, 5 + bob, ['.c.', 'cwc', 'ccc']);
    }
    return p;
}

export function skitterFrames(detail: Detail): Grid[] {
    const frames = [skitter(detail, false).grid(), skitter(detail, true).grid()];
    return detail === 0 ? frames.map((g) => inked(g, 'k', 'Y')) : frames;
}
