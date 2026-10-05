import { mirror, type Grid, type SheetDef } from '../../sprites/grid';
import { Canvas, SOFT_EDGE, eraStyles } from '../paint';

// The Light Handler as he sees himself: welder's goggles pushed up on his forehead, a red
// scarf, washing-up gloves and a long blue coat. In `plain` he is the man who was really
// there. 32x48, sixteen frames: for each of down, up, left, right: idle, walk A, walk B, dash.

const WIDTH = 32;
const HEIGHT = 48;

type Facing = 'down' | 'up' | 'right';
type Pose = 'idle' | 'a' | 'b' | 'dash';
const POSES: Pose[] = ['idle', 'a', 'b', 'dash'];

/** How far the upper body drops on a step */
const BOB: Record<Pose, number> = { idle: 0, a: 1, b: 1, dash: 2 };

interface Cloth {
    /** Four slots across a leg, light to dark */
    leg: string;
    bootTop: string;
    boot: string;
    sole: string;
}

const HERO_CLOTH: Cloth = { leg: 'ddDD', bootTop: 'uooO', boot: 'oooO', sole: 'OOOU' };
const MAN_CLOTH: Cloth = { leg: 'abbB', bootTop: 'xXXz', boot: 'XXXz', sole: 'zzzz' };

/** One leg seen from the front or back: cloth from `top` down to a three-row shoe at `shoe` */
function leg(canvas: Canvas, x: number, top: number, shoe: number, cloth: Cloth, far = false) {
    for (let y = top; y < shoe; y++) {
        canvas.stamp(x, y, [cloth.leg]);
    }
    // A foot stepping away from the viewer shows less of itself
    canvas.stamp(x, shoe, far ? [cloth.boot, cloth.sole] : [cloth.bootTop, cloth.boot, cloth.sole]);
}

function frontLegs(canvas: Canvas, pose: Pose, cloth: Cloth, top: number) {
    const left = 11;
    const right = 17;
    if (pose === 'idle') {
        leg(canvas, left, top, 41, cloth);
        leg(canvas, right, top, 41, cloth);
    } else if (pose === 'a') {
        leg(canvas, left, top, 43, cloth);
        leg(canvas, right, top, 40, cloth, true);
    } else if (pose === 'b') {
        leg(canvas, left, top, 40, cloth, true);
        leg(canvas, right, top, 43, cloth);
    } else {
        leg(canvas, left - 1, top, 43, cloth);
        leg(canvas, right + 1, top, 41, cloth, true);
    }
}

function sideLegs(canvas: Canvas, pose: Pose, cloth: Cloth, top: number) {
    const [l, m, , d] = cloth.leg;
    const [bl, bm, , bd] = cloth.bootTop;
    const sole = cloth.sole[0];
    const column = (x: number, from: number, to: number, lean: number) => {
        for (let y = from; y <= to; y++) {
            const dx = Math.round(((y - from) / Math.max(1, to - from)) * lean);
            canvas.stamp(x + dx, y, [l + m + d + d]);
        }
    };
    const shoe = (x: number, y: number) => {
        canvas.stamp(x, y, [bl + bm + bm + bd, bm + bm + bm + bm + bd, sole.repeat(6)]);
    };
    if (pose === 'idle') {
        column(13, top, 40, 0);
        shoe(13, 41);
    } else if (pose === 'a' || pose === 'dash') {
        // Full stride: back leg trails, front leg reaches
        const reach = pose === 'dash' ? 6 : 4;
        column(12, top, 40, -reach + 1);
        canvas.stamp(12 - reach, 41, [bl + bm + bm + bd, sole.repeat(5)]);
        column(15, top, 40, reach - 1);
        shoe(14 + reach, 41);
    } else {
        // Passing: the back foot is lifted behind the standing leg
        canvas.stamp(9, 39, [`.${bm}${bd}`, `${bm}${bm}${bd}${d}`, `${sole}${sole}.`]);
        column(13, top, 40, 0);
        shoe(13, 41);
    }
}

/** An arm hanging at the side; `drop` swings it down or up a pixel as he walks */
function arm(canvas: Canvas, x: number, rows: readonly string[], drop: number) {
    const shown = drop > 0 ? [...new Array<string>(drop).fill(rows[0]), ...rows] : rows.slice(-drop);
    canvas.stamp(x, 20, shown);
}

/** The arm seen side on, swinging forward (positive) or back from the shoulder */
function sideArm(canvas: Canvas, rows: readonly string[], y: number, swing: number) {
    rows.forEach((row, i) => {
        canvas.stamp(13 + Math.round((i / (rows.length - 1)) * swing), y + i, [row]);
    });
}

// --- The hero --------------------------------------------------------------------------------

const HERO_HEAD_DOWN = [
    '....u..h......',
    '...uhu.hh..H..',
    '..uuhhhhhhHH..',
    '.uhhuhhhhhhhH.',
    '.hyyyyhhyyyyH.',
    'OymccYOOymccYO',
    'OycCCYOOycCCYO',
    'hhYYYYhhYYYYHH',
    'hjffffffffffFH',
    'hjfwkffffwkfFH',
    'FjfkkffffkkfFF',
    '.fffffFFffffF.',
    '.FffffJJfffFF.',
    '..FFffffffFF..',
];

const HERO_HEAD_UP = [
    '....u..h......',
    '...uhu.hh..H..',
    '..uuhhhhhhHH..',
    '.uhhuhhhhhhhH.',
    '.uhhhhhhhhhhH.',
    'OooooooooooOOO',
    'OOOOOOyyOOOOUU',
    'uhhhhhhhhhhhHH',
    'uhhuhhhhhhhhHH',
    'hhhhhhhuhhhHHH',
    'hhhhhhhhhhhHHH',
    '.hhHhhhhhHHHH.',
    '.HHhHHHhHHHHH.',
    '..FHHHHHHHHF..',
];

const HERO_HEAD_RIGHT = [
    '...u..h.......',
    '..uhu.hh..H...',
    '..uuhhhhhhH...',
    '.uhhuhhhhhhH..',
    '.uhhhhhhyyyyH.',
    'uhooooooymccY.',
    'uhOOOOOOycCCY.',
    'uhhhhhhhYYYYf.',
    'uhhhhhhjfffff.',
    'hhhhhhjfffwkf.',
    'HhhhhFffffkkff',
    '.HhhHFfffffff.',
    '.HHHHFffffJJF.',
    '..HH.FFffffF..',
];

// Torso and coat skirt without the arms, which swing separately. Starts at the scarf.
const HERO_BODY_DOWN = [
    '....qqrrrrrrrrrrRR....',
    '...qrrrrRrrrrrrrRRR...',
    '..aaQRRRRRRRRRRRRQBB..',
    '.....ABBBwwggBBBA.....',
    '.....AabbwwggbbBA.....',
    '.....AaabbwgbbBBA.....',
    '.....AaabbbAbbBBA.....',
    '.....AaabbyAbbBBA.....',
    '.....AabbbbAbBBBA.....',
    '.....AooooyeoooOA.....',
    '.....ABBBBABBBBBA.....',
    '.....AabbbABbbBBA.....',
    '.....AaabbABbbBBA.....',
    '.....aabbbABbbbBB.....',
    '.....aabbbABbbbBB.....',
    '...aaabBbbABbbBbBBB...',
    '...aabbBbbABbbBbBBB...',
    '...aabbBbbABbbBbBBB...',
    '..aaabbBbbABbbBbbBBB..',
    '..aabbbBbbABbbBbbBBB..',
    '..abbbBBbBABbBBbBBBB..',
    '..bBBBBBBAABBBBBBBBB..',
];

const HERO_BODY_UP = [
    '....qqrrrrrrrrrrRR....',
    '...qrrrrrrrrRrrrRRR...',
    '..aaQRRRRRRRRRRRRQBB..',
    '.....ABBBBBBBBBBA.....',
    '.....AabbbbbbbbBA.....',
    '.....AaabbbbbbBBA.....',
    '.....AaabbbbbbBBA.....',
    '.....AaabbbbbbBBA.....',
    '.....AabbbbbbBBBA.....',
    '.....AoooooooooOA.....',
    '.....ABBBBBBBBBBA.....',
    '.....AabbbbbbbBBA.....',
    '.....AaabbbbbbBBA.....',
    '.....aabbbbbbbbBB.....',
    '.....aabbbbbbbbBB.....',
    '...aaabBbbbbbbBbBBB...',
    '...aabbBbbABbbBbBBB...',
    '...aabbBbbABbbBbBBB...',
    '..aaabbBbbABbbBbbBBB..',
    '..aabbbBbbABbbBbbBBB..',
    '..abbbBBbBABbBBbBBBB..',
    '..bBBBBBBAABBBBBBBBB..',
];

const HERO_BODY_RIGHT = [
    '..qrrrrrrrRR..',
    '.qrrrrrRrrrRR.',
    '..QRRRRRRRRQ..',
    '..aBBBBBBBBw..',
    '..aabbbbbbBw..',
    '..aabbbbbbBg..',
    '..aabbbbbbbB..',
    '..aabbbbbbyB..',
    '..abbbbbbbBB..',
    '..oooooooyeO..',
    '..aBBBBBBBBB..',
    '..aabbbbbbBB..',
    '..aabbbbbbbB..',
    '.aaabbbbbbBB..',
    '.aabbBbbbbBB..',
    '.aabbBbbbBbB..',
    '.aabbBbbbBbBB.',
    'aaabbBbbbBbBB.',
    'aabbbBbbbBbBB.',
    'aabbBBbbBBBBB.',
    'abbbBBBBBBBBB.',
    'bBBBBBBBBBBBB.',
];

const HERO_ARM_LEFT = ['aab', 'aab', 'aab', 'aab', 'abb', 'abb', 'abb', 'abb', 'bbB', 'eyY', 'yyY', 'yYY'];
const HERO_ARM_RIGHT = ['bBB', 'bBB', 'bBB', 'bBB', 'bBB', 'bBB', 'bBB', 'bBB', 'BBB', 'yyY', 'yYY', 'YYY'];
const HERO_ARM_SIDE = ['AabA', 'AabA', 'AabA', 'AabBA', 'AabBA', 'AabBA', 'AabBA', 'AabBA', 'AabBA', 'EeyYE', 'EyyYE', '.EEE.'];

// The scarf's loose end. Seen from the front it hangs outside his right arm; it lifts as he
// moves and streams when he dashes.
const TAIL_FRONT: Record<Pose, { x: number; y: number; rows: string[] }> = {
    idle: { x: 3, y: 19, rows: ['..qr', '.qrR', '.qrR', '.qrR', 'qrrR', 'qrR.', 'rR..'] },
    a: { x: 2, y: 19, rows: ['...qr', '..qrR', '.qrRR', 'qrrR.', 'qrR..', 'rR...'] },
    b: { x: 3, y: 19, rows: ['..qr', '..qR', '.qrR', '.qrR', '.qrR', '.qrR', '.rR.'] },
    dash: { x: 1, y: 11, rows: ['qr....', 'qrr...', '.qrr..', '.qrrR.', '..qrR.', '..qrrR', '...qrR', '...qrR', '....rR'] },
};

const TAIL_BACK: Record<Pose, { x: number; y: number; rows: string[] }> = {
    idle: { x: 13, y: 19, rows: ['qrrR', 'qrRR', 'qrrR', 'qr.rR', 'qr.rR', 'qr.rR', 'qr..rR', '....rR'] },
    a: { x: 12, y: 19, rows: ['.qrrR', '.qrRR', '.qrrR', 'qr.rR', 'qr.rR', 'qr..rR', 'qr..rR'] },
    b: { x: 13, y: 19, rows: ['qrrR', 'qrRR', 'qrrR', '.qrrR', '.qr.rR', '.qr.rR', '..qr.rR', '..qr...'] },
    dash: { x: 12, y: 19, rows: ['.qrrR.', '.qrRR.', 'qrrrrR', 'qr..rR', 'qr..rR', 'qr...rR', 'qr...rR', 'q.....R'] },
};

const TAIL_SIDE: Record<Pose, { x: number; y: number; rows: string[] }> = {
    idle: { x: 5, y: 18, rows: ['...qrr', '..qrRR', '.qrRR.', '.qrR..', 'qrR...', 'qR....'] },
    a: { x: 2, y: 17, rows: ['qr.......', 'qrrrqrrrr', '.RRrrRRRR', '....RR...'] },
    b: { x: 3, y: 18, rows: ['....qrrr', '.qqrrRRR', 'qrrRR...', 'rRR.....'] },
    dash: { x: 0, y: 15, rows: ['qr..........', 'qrrrqqrr....', '.rRrrrrrqrrr', '..RR.RRrrRRR', '........RR..'] },
};

function heroFrame(facing: Facing, pose: Pose): Grid {
    const canvas = new Canvas(WIDTH, HEIGHT);
    const bob = BOB[pose];
    const swing = pose === 'a' ? 1 : pose === 'b' ? -1 : 0;

    if (facing === 'right') {
        sideLegs(canvas, pose, HERO_CLOTH, 38);
        canvas.stamp(9, 17 + bob, HERO_BODY_RIGHT);
        canvas.stamp(TAIL_SIDE[pose].x, TAIL_SIDE[pose].y + bob, TAIL_SIDE[pose].rows);
        sideArm(canvas, HERO_ARM_SIDE, 20 + bob, pose === 'dash' ? -5 : swing * 3);
        canvas.stamp(9, 3 + bob, HERO_HEAD_RIGHT);
        if (pose === 'dash') {
            // Lean into it: the head leads the feet
            canvas.shear((y) => (y < 40 ? (40 - y) / 8 : 0));
        }
    } else {
        const front = facing === 'down';
        frontLegs(canvas, pose, HERO_CLOTH, 38);
        const spread = pose === 'dash' ? 1 : 0;
        arm(canvas, 7 - spread, HERO_ARM_LEFT, bob + swing);
        arm(canvas, 22 + spread, HERO_ARM_RIGHT, bob - swing);
        canvas.stamp(5, 17 + bob, front ? HERO_BODY_DOWN : HERO_BODY_UP);
        const tail = front ? TAIL_FRONT[pose] : TAIL_BACK[pose];
        canvas.stamp(tail.x, tail.y + bob, tail.rows);
        canvas.stamp(9, 3 + bob, front ? HERO_HEAD_DOWN : HERO_HEAD_UP);
    }

    return canvas.outline('k', SOFT_EDGE).shadow(15.5, 44.5, 9, 2.6).grid();
}

// --- The man ---------------------------------------------------------------------------------

const MAN_HEAD_DOWN = [
    '..............',
    '....uhhhhH....',
    '..uuhhhhhhHH..',
    '.uhhuhhhhhhhH.',
    '.hhhhhhhhhhhH.',
    'hhhjjfffhhhhHH',
    'hhjfffffffhhHH',
    'hjjfffffffffFH',
    'hjffffffffffFH',
    'hjfwkffffwkfFH',
    'FjfkkffffkkfFF',
    '.fffffFFffffF.',
    '.FffffJJfffFF.',
    '..FFffffffFF..',
];

const MAN_HEAD_UP = [
    '..............',
    '....uhhhhH....',
    '..uuhhhhhhHH..',
    '.uhhuhhhhhhhH.',
    '.uhhhhhhhhhhH.',
    'uhhhhhhhhhhhHH',
    'uhhhhuhhhhhhHH',
    'uhhhhhhhhhhhHH',
    'uhhuhhhhhhhhHH',
    'hhhhhhhuhhhHHH',
    'FhhhhhhhhhHHHF',
    '.fhHhhhhhHHHF.',
    '.fFHHHHHHHHFF.',
    '..fFFFFFFFFF..',
];

const MAN_HEAD_RIGHT = [
    '..............',
    '...uhhhhhH....',
    '..uuhhhhhhHH..',
    '.uhhuhhhhhhhH.',
    '.uhhhhhhhhhjf.',
    'uhhhhhhhhjfff.',
    'uhhhhhhhjffff.',
    'uhhhhhhjfffff.',
    'uhhhhhfjfffff.',
    'hhhhjFfjffwkf.',
    'HhhhfFffffkkff',
    '.HhhHFfffffff.',
    '.HHFFFffffJJF.',
    '..FF.FFffffF..',
];

// A zip-up jacket to the hips and jeans. Starts at the neck.
const MAN_BODY_DOWN = [
    '.........fffF.........',
    '.....llnnwFFwnnNN.....',
    '..llnnnnnwwggnnnnNNN..',
    '.....LlnnwwggnnNL.....',
    '.....LllnnwggnnNL.....',
    '.....LllnnwgnnNNL.....',
    '.....LllnnnLnnNNL.....',
    '.....LllnnnLnnNNL.....',
    '.....LlnnnnLnnNNL.....',
    '.....LlnLLnLnLLNL.....',
    '.....LlnnnnLnnNNL.....',
    '.....LlnnnnLnNNNL.....',
    '.....LNNNNNLNNNNL.....',
    '......abbbbABbbB......',
    '......aabbbABbbB......',
    '......aabbbABbBB......',
    '......abbbBABbBB......',
];

const MAN_BODY_UP = [
    '.........FffF.........',
    '.....llnnnnnnnnNN.....',
    '..llnnnnnnnnnnnnnNNN..',
    '.....LlnnnnnnnnNL.....',
    '.....LllnnnnnnnNL.....',
    '.....LllnnnnnnNNL.....',
    '.....LllnnnnnnNNL.....',
    '.....LllnnnnnnNNL.....',
    '.....LlnnnnnnnNNL.....',
    '.....LlnnnnnnnNNL.....',
    '.....LlnnnnnnnNNL.....',
    '.....LlnnnnnnNNNL.....',
    '.....LNNNNNNNNNNL.....',
    '......abbbbbbbbB......',
    '......aabbbABbbB......',
    '......aabbbABbBB......',
    '......abbbBABbBB......',
];

const MAN_BODY_RIGHT = [
    '.....FfffF....',
    '..llnnnnnwN...',
    '..llnnnnnnNN..',
    '..llnnnnnnNw..',
    '..llnnnnnnNg..',
    '..llnnnnnnnN..',
    '..llnnnnnnnN..',
    '..lnnnnnnnNN..',
    '..lnnnnnnnNN..',
    '..lnnnnLLnNN..',
    '..lnnnnnnNNN..',
    '..lnnnnnNNNN..',
    '..NNNNNNNNNN..',
    '...abbbbbBB...',
    '...aabbbbBB...',
    '...aabbbbBB...',
    '...abbbbBBB...',
];

const MAN_ARM_LEFT = ['lln', 'lln', 'lln', 'lln', 'lnn', 'lnn', 'lnn', 'lnn', 'nnN', 'jfF', 'jfF', 'fFF'];
const MAN_ARM_RIGHT = ['nNN', 'nNN', 'nNN', 'nNN', 'nNN', 'nNN', 'nNN', 'nNN', 'NNN', 'ffF', 'fFF', 'FFF'];
const MAN_ARM_SIDE = ['LlnL', 'LlnL', 'LlnL', 'LlnNL', 'LlnNL', 'LlnNL', 'LlnNL', 'LlnNL', 'LlnNL', 'JjfFJ', 'JffFJ', '.JJJ.'];

function manFrame(facing: Facing, pose: Pose): Grid {
    const canvas = new Canvas(WIDTH, HEIGHT);
    // He never dashed. The dash frames are a hurried step, in case the ending moves him fast.
    const step: Pose = pose === 'dash' ? 'a' : pose;
    const bob = BOB[step];
    const swing = step === 'a' ? 1 : step === 'b' ? -1 : 0;

    if (facing === 'right') {
        sideLegs(canvas, step, MAN_CLOTH, 32);
        canvas.stamp(9, 17 + bob, MAN_BODY_RIGHT);
        sideArm(canvas, MAN_ARM_SIDE, 20 + bob, swing * 3);
        canvas.stamp(9, 3 + bob, MAN_HEAD_RIGHT);
    } else {
        const front = facing === 'down';
        frontLegs(canvas, step, MAN_CLOTH, 33);
        arm(canvas, 7, MAN_ARM_LEFT, bob + swing);
        arm(canvas, 22, MAN_ARM_RIGHT, bob - swing);
        canvas.stamp(5, 17 + bob, front ? MAN_BODY_DOWN : MAN_BODY_UP);
        canvas.stamp(9, 3 + bob, front ? MAN_HEAD_DOWN : MAN_HEAD_UP);
    }

    return canvas.outline('k', SOFT_EDGE).shadow(15.5, 44.5, 9, 2.6).grid();
}

function sheet(frame: (facing: Facing, pose: Pose) => Grid): Grid[] {
    const down = POSES.map((pose) => frame('down', pose));
    const up = POSES.map((pose) => frame('up', pose));
    const right = POSES.map((pose) => frame('right', pose));
    return [...down, ...up, ...right.map(mirror), ...right];
}

const HERO_FRAMES = sheet(heroFrame);

export const PLAYER_V2: SheetDef = {
    key: 'player',
    width: WIDTH,
    height: HEIGHT,
    frames: HERO_FRAMES,
    styles: eraStyles(HERO_FRAMES, sheet(manFrame)),
};

/** Frame of each facing's idle pose; walk A, walk B and dash follow it */
export const PLAYER_FACINGS = ['down', 'up', 'left', 'right'] as const;
export const PLAYER_FRAMES_PER_FACING = POSES.length;

/**
 * The man seen from his right with no arm, outline or shadow, on a 32x48 canvas: the base
 * for the people in the `plain` enemy sheets, who dress him differently.
 */
export function manSide(pose: 'idle' | 'a' | 'b'): Canvas {
    const canvas = new Canvas(WIDTH, HEIGHT);
    sideLegs(canvas, pose, MAN_CLOTH, 32);
    canvas.stamp(9, 17 + BOB[pose], MAN_BODY_RIGHT);
    canvas.stamp(9, 3 + BOB[pose], MAN_HEAD_RIGHT);
    return canvas;
}
