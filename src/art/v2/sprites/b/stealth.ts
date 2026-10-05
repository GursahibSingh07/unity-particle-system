import type { Grid } from '../../../sprites/grid';
import { Pix, inked, type Detail, type Point } from './paint';

// The stealth class. The game draws these almost transparent, so the outline is the whole
// character: the ghost is round and soft, the wraith is the same cloak cut into points.

type Frame = 0 | 1 | 2;

const mirrored = (points: Point[]): Point[] => points.map(([x, y]) => [32 - x, y]);

// --- Ghost ---------------------------------------------------------------------------------

function ghost(detail: Detail, frame: Frame): Pix {
    const p = new Pix(32, 32);
    const rear = frame === 2;
    const sway = frame === 1 ? 1 : 0;
    const top = rear ? 2 : frame === 1 ? -1 : 0;

    // The cloak: three scallops that trade places as it drifts
    const hem: Point[] =
        frame === 1
            ? [[26, 26], [23, 28], [20, 25], [17, 29], [14, 26], [11, 29], [8, 26], [6, 28]]
            : [[25, 28], [22, 25], [19, 29], [16, 26], [13, 29], [10, 25], [7, 28], [6, 25]];
    const width = rear ? 1 : 0;
    p.poly([[9 - width, 10 + top], [23 + width, 10 + top], [25 + width, 19], ...hem, [7 - width, 19]], 'p');
    p.bevel('p', null, detail >= 1 ? 'P' : null, 2);
    p.bevel('p', detail >= 2 ? 'v' : null, null, 1);
    if (detail >= 1) {
        // Folds hanging from the shoulders
        p.line(12, 20, 11 + sway, 25, 'P').line(20, 19, 21 + sway, 25, 'P');
    }

    // Arms: stubs that float, or thrown up before the lunge
    const arm: Point[] = rear
        ? [[8, 17], [3, 12], [1, 6], [4, 8], [5, 5], [7, 10], [10, 14]]
        : [[8, 15], [4, 18 + sway], [1, 22 + sway], [4, 23 + sway], [8, 20]];
    p.poly(arm, 'p').poly(mirrored(arm), detail >= 1 ? 'P' : 'p');

    p.ball(16, 10 + top, 7.6, 7.6, detail >= 3 ? 'vpPV' : detail >= 2 ? 'ppPV' : detail >= 1 ? 'ppPP' : 'pppp');
    p.outline('k', detail >= 2 ? { v: 'P', p: 'V' } : {});

    // Hollow eyes and a small round mouth; all three gape for the wind-up
    const y = 8 + top;
    if (rear) {
        p.rows(10, y - 1, ['.kkk...kkk.', 'kkkkk.kkkkk', 'kkekk.kkekk', 'kkkkk.kkkkk', '.kkk...kkk.']);
        p.rows(13, y + 5, ['.kkkk.', 'kkkkkk', 'kkkkkk', 'kkkkkk', '.kkkk.']);
        if (detail >= 1) {
            p.rows(11, y, ['.e.....e.', 'eee...eee', '.e.....e.']);
        }
    } else {
        p.rows(11, y, ['.kk...kk.', 'kkkk.kkkk', 'kkkk.kkkk', '.kk...kk.']);
        p.rows(14, y + 6, ['.kk.', 'kkkk', '.kk.']);
        if (detail >= 2) {
            p.dots('e', 12, y + 1, 18, y + 1);
        }
    }
    if (detail >= 3) {
        // A wisp trailing off the hem
        p.dots('v', 27, 30 - sway, 4, 30 + sway - 1);
    }
    return p;
}

export function ghostFrames(detail: Detail): Grid[] {
    const frames = ([0, 1, 2] as Frame[]).map((f) => ghost(detail, f).grid());
    return detail === 0 ? frames.map((g) => inked(g, 'k', '')) : frames;
}

// --- Wraith --------------------------------------------------------------------------------

function wraith(detail: Detail, frame: Frame): Pix {
    const p = new Pix(32, 32);
    const rear = frame === 2;
    const sway = frame === 1 ? 1 : 0;

    // The same cloak, torn: the hem is all points and they whip from side to side
    const hem: Point[] =
        frame === 1
            ? [[27, 25], [23, 23], [23, 30], [19, 24], [17, 31], [14, 24], [10, 29], [9, 23], [5, 26]]
            : [[26, 26], [23, 23], [21, 30], [18, 24], [15, 31], [13, 24], [9, 30], [9, 23], [6, 25]];
    p.poly([[10, 11], [22, 11], [26, 16], [24, 18], ...hem, [8, 18], [6, 16]], 'P');
    p.bevel('P', detail >= 2 ? 'p' : null, detail >= 1 ? 'V' : null, 2);

    // Arms end in three long claws; for the wind-up they go up and wide
    const armAt = (points: Point[], claws: Point[]) => {
        p.poly(points, 'P').poly(mirrored(points), detail >= 1 ? 'V' : 'P');
        p.poly(claws, 'w').poly(mirrored(claws), detail >= 2 ? 'g' : 'w');
    };
    if (rear) {
        armAt(
            [[9, 15], [4, 11], [2, 6], [7, 6], [8, 10], [11, 13]],
            [[2, 6], [0, 0], [3, 4], [4.5, 0], [5.5, 4], [9, 1], [7, 6]],
        );
    } else {
        const y = 19 + sway;
        armAt(
            [[9, 13], [4, 15 + sway], [1, y], [7, y], [9, 17]],
            [[1, y], [0, y + 6], [3, y + 2], [3.5, y + 6], [5, y + 2], [7.5, y + 5], [7, y]],
        );
    }

    // A peaked hood, the point bent over like a hooked nose
    const hood: Point[] = [[20, 0], [19, 3], [23, 7], [25, 13], [16, 16], [7, 13], [9, 7], [14, 2]];
    p.poly(hood, 'P');
    p.bevel('P', detail >= 2 ? 'p' : null, null, 1);
    if (detail >= 3) {
        p.path([[14, 3], [10, 7], [9, 11]], 'v');
    }
    p.outline('k', detail >= 2 ? { p: 'V', P: 'V' } : {});

    // Nothing inside the hood but eyes and teeth
    p.poly([[12, 6], [20, 6], [22, 11], [16, 15], [10, 11]], 'k');
    if (rear) {
        p.rows(11, 7, ['rr.....rr', 'qrr...rrq', '.rr...rr.']);
        p.rows(12, 11, ['w.w.w.w', 'kkkkkkk', '.w.w.w.']);
    } else {
        p.rows(11, 8, ['r.......r', 'qrr...rrq']);
        if (detail >= 1) {
            p.rows(13, 12, ['w.w.w', '.w.w.']);
        }
    }
    if (detail >= 3) {
        // The doorman's brass buttons, tarnished
        p.dots('y', 16, 18, 16, 21);
    }
    return p;
}

export function wraithFrames(detail: Detail): Grid[] {
    const frames = ([0, 1, 2] as Frame[]).map((f) => wraith(detail, f).grid());
    return detail === 0 ? frames.map((g) => inked(g, 'kV', 'Pp')) : frames;
}
