import type { Grid } from '../../../sprites/grid';
import { Pix, inked, type Detail } from './paint';

// The projectile class: both are heaps with a face, one stacked and one melted, and both
// make their wind-up with the whole body so it reads at a glance from across the square.

type Frame = 0 | 1 | 2;

// --- Snowman -------------------------------------------------------------------------------

function snowman(detail: Detail, frame: Frame): Pix {
    const p = new Pix(32, 32);
    const bob = frame === 1 ? 1 : 0;
    const throwing = frame === 2;
    const snow = detail >= 2 ? 'mmMt' : detail >= 1 ? 'mmMM' : 'mmmm';
    const cuts = [0.82, -0.02, -0.5];

    // Twig arms go on first so the body overlaps their roots
    const twig = detail >= 1 ? 'H' : 'k';
    if (throwing) {
        p.path([[8, 19], [4, 20], [1, 23]], twig).path([[4, 20], [2, 19]], twig);
        p.path([[23, 18], [27, 13], [27, 8]], twig);
    } else {
        p.path([[8, 19 + bob], [4, 16], [1, 14 - bob]], twig).path([[4, 16], [3, 13 - bob]], twig);
        p.path([[23, 19 + bob], [27, 16], [30, 14 - bob]], twig).path([[27, 16], [28, 13 - bob]], twig);
    }

    p.ball(15.5, 22.5 + bob / 2, 9.4 + bob / 2, 7.4 - bob / 2, snow, cuts);
    p.ball(15.5, 11 + bob, 6.6, 6.2, snow, cuts);

    // A scarf in the vendor's red, and a wafer cone worn as a hat
    p.rect(10, 15 + bob, 12, 2, 'r');
    p.rect(11, 17 + bob, 3, 4, 'r');
    if (detail >= 1) {
        p.rect(18, 15 + bob, 4, 2, 'R').rect(13, 17 + bob, 1, 4, 'R').rect(10, 16 + bob, 8, 1, 'R');
        p.rect(10, 15 + bob, 8, 1, 'r');
    }
    if (detail >= 3) {
        p.rect(11, 15 + bob, 3, 1, 'q');
    }
    p.poly([[15, 0 + bob], [17, 0 + bob], [21, 7 + bob], [10, 7 + bob]], 'y');
    if (detail >= 1) {
        p.poly([[16.5, 0 + bob], [17, 0 + bob], [21, 7 + bob], [17, 7 + bob]], 'Y');
    }
    if (detail >= 3) {
        p.dots('E', 14, 4 + bob, 16, 2 + bob, 17, 5 + bob, 13, 6 + bob, 19, 6 + bob, 15, 6 + bob);
    }

    if (throwing) {
        p.ball(27, 5, 3.4, 3.4, snow, cuts);
    }
    p.outline('k', detail >= 2 ? { m: 't' } : {});

    // Coal eyes under a frown, a carrot, a crooked coal mouth
    const y = 9 + bob;
    p.rows(11, y, ['k......k', 'kk....kk', 'kk....kk']);
    p.rows(15, y + 2, detail >= 2 ? ['Yq', 'YYY', 'E'] : ['YY', 'YYY']);
    if (detail >= 1) {
        p.dots('k', 12, y + 5, 14, y + 6, 16, y + 6, 18, y + 5);
    }
    if (throwing) {
        p.rows(13, y + 5, ['kkkkk', 'kkkkk']);
    }
    if (detail >= 2) {
        p.dots('k', 16, 21 + bob, 16, 24 + bob, 16, 27);
    }
    return p;
}

export function snowmanFrames(detail: Detail): Grid[] {
    const frames = ([0, 1, 2] as Frame[]).map((f) => snowman(detail, f).grid());
    return detail === 0 ? frames.map((g) => inked(g, 'kY', 'ry')) : frames;
}

// --- Acid slime ----------------------------------------------------------------------------

function acidSlime(detail: Detail, frame: Frame): Pix {
    const p = new Pix(32, 32);
    const sag = frame === 1 ? 1 : 0;
    const swell = frame === 2;
    const goo = detail >= 3 ? 'elnN' : detail >= 2 ? 'llnN' : detail >= 1 ? 'llnn' : 'llll';
    const cuts = [0.84, 0.1, -0.42];

    // The pool it stands in, then the heap: a sagging belly with a lopsided crown
    p.ellipse(16, 27.5, 13.5 + sag, 3, detail >= 1 ? 'N' : 'n');
    if (detail >= 2) {
        p.ellipse(17, 28.4, 11 + sag, 1.6, 'L');
    }
    if (swell) {
        p.ball(16, 16, 13, 11.5, goo, cuts);
        p.ball(15, 6.5, 6, 4.5, goo, cuts);
    } else {
        p.ball(16, 19 + sag, 12 + sag, 9 - sag / 2, goo, cuts);
        p.ball(14, 10.5 + sag, 7, 6, goo, cuts);
        p.ball(20.5, 12 + sag, 4.5, 4, goo, cuts);
    }

    // Runs of acid creeping down the flanks
    const drip = (x: number, y: number, long: number) => {
        p.rect(x, y, 2, long, detail >= 1 ? 'n' : 'l');
        p.ball(x + 0.5, y + long, 1.6, 1.9, detail >= 1 ? 'ln' : 'll');
    };
    drip(2, 19, 3 + sag * 2);
    drip(28, 20, 2 + (1 - sag) * 2);
    if (detail >= 2 && !swell) {
        // Lighter runs down the belly, each ending in a bead
        const run = (x: number, y: number, long: number) => {
            p.rect(x, y, 1, long, 'e').rect(x, y + long, 2, 2, 'e').set(x + 1, y + long + 1, 'l');
        };
        run(6, 16 + sag, 4 + sag);
        run(24, 15 + sag, 3 + (1 - sag) * 2);
        run(20, 22, 2 + sag);
    }

    // Suds: the window cleaner's soap, floating off the top
    if (detail >= 2) {
        p.rows(22, 3 - sag, ['.cc.', 'cw.c', 'c..c', '.cc.']);
        p.rows(5, 6 + sag, ['.c.', 'cwc', '.c.']);
    }
    p.outline('k', detail >= 2 ? { e: 'N', l: 'N', n: 'L' } : {});

    if (swell) {
        // Cheeks blown out, eyes screwed shut, lips pursed round the shot
        p.rows(8, 12, ['kk..........kk', '..kk......kk..', 'kk..........kk']);
        p.rows(13, 17, ['.kkkk.', 'kNNNNk', 'kNkkNk', 'kNNNNk', '.kkkk.']);
        if (detail >= 2) {
            p.rows(5, 16, ['.ii.', 'iiii', '.ii.']).rows(23, 16, ['.ii.', 'iiii', '.ii.']);
        }
        if (detail >= 3) {
            p.dots('e', 12, 3, 13, 4, 6, 12, 7, 11);
        }
    } else {
        // Heavy lids and a slack mouth that leaks
        const y = 14 + sag;
        p.rows(8, y, ['kkkkk....kkkkk', 'wkkww....wwkkw', '.www......www.']);
        p.rows(10, y + 5, ['k..........k', '.kkkkkkkkkk.', '..NNNNNNNN..']);
        if (detail >= 1) {
            p.rect(13, y + 7, 2, 2 + sag, 'l').rect(18, y + 7, 1, 1 + (1 - sag), 'l');
        }
        if (detail >= 3) {
            // Things it has not finished dissolving
            p.dots('N', 7, 22 + sag, 23, 23 + sag, 21, 25, 11, 24);
            p.dots('e', 10, 7 + sag, 11, 6 + sag);
        }
    }
    return p;
}

export function acidSlimeFrames(detail: Detail): Grid[] {
    const frames = ([0, 1, 2] as Frame[]).map((f) => acidSlime(detail, f).grid());
    return detail === 0 ? frames.map((g) => inked(g, 'kN', 'n')) : frames;
}
