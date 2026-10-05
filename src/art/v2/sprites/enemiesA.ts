import type { Grid, SheetDef } from '../../sprites/grid';
import { Canvas, SOFT_EDGE, eraStyles } from '../paint';
import { manSide } from './hero';

// The swarm and armour enemies. Each has two drawings: what the Handler sees, and (in
// `plain`) what was really there. Side-on drawings face RIGHT; front-on ones face the viewer.

function finish(canvas: Canvas): Grid {
    return canvas.outline('k', SOFT_EDGE).grid();
}

// --- Rat / pigeon ----------------------------------------------------------------------------

const RAT_STRETCH = [
    '..........iI....',
    '.....vvvvvipp...',
    '...vvpppppppep..',
    '..vppppppppppPI.',
    '.i.pppppppPPPw..',
    '.i..PPPPPPP.....',
    '..ii.P....P.....',
    '....P......P....',
];

const RAT_GATHER = [
    '.........iI.....',
    '.....vvvvipp....',
    '...vvppppppep...',
    '..vpppppppppPI..',
    '.ivppppppPPPw...',
    '.i.PPPPPPPP.....',
    'i...P.PP.P......',
    'i....P..P.......',
];

function rat(rows: readonly string[], y: number): Grid {
    return finish(new Canvas(16, 16).shadow(7.5, 13, 6, 1.6).stamp(0, y, rows));
}

const PIGEON_WALK = [
    '..........ddd...',
    '.........ddkdYY.',
    '.........npd....',
    '....gggGGnpp....',
    '..gwgggGGGGd....',
    '.ggwgGGGdGG.....',
    'dd.ggGGGGG......',
    '.....GGGG.......',
    '......r.r.......',
    '.....rr.rr......',
];

const PIGEON_BOB = [
    '................',
    '...........ddd..',
    '..........ddkdYY',
    '....gggGGGnpd...',
    '..gwgggGGGnp....',
    '.ggwgGGGdGG.....',
    'dd.ggGGGGG......',
    '.....GGGG.......',
    '.....r...r......',
    '....rr...rr.....',
];

function pigeon(rows: readonly string[]): Grid {
    return finish(new Canvas(16, 16).shadow(7.5, 13.5, 5, 1.4).stamp(0, 4, rows.map((row) => row.slice(1) + '.')));
}

const RAT_FRAMES = [rat(RAT_STRETCH, 5), rat(RAT_GATHER, 4)];

export const RAT_V2: SheetDef = {
    key: 'rat',
    width: 16,
    height: 16,
    frames: RAT_FRAMES,
    styles: eraStyles(RAT_FRAMES, [pigeon(PIGEON_WALK), pigeon(PIGEON_BOB)]),
};

// --- Slime / small dog on a lead ---------------------------------------------------------------

function slime(squat: boolean): Grid {
    const canvas = new Canvas(32, 32);
    const cx = 15.5;
    const [cy, rx, ry, floor] = squat ? [21, 12, 9, 27] : [14, 9, 11.5, 23];
    canvas.shadow(cx, 28.5, squat ? 12 : 8, squat ? 2.6 : 2);
    canvas.ball(cx, cy, rx, ry, 'wccCCZ', (_x, y) => y <= floor);
    if (squat) {
        // Feet of goo where it has landed
        canvas.ball(5, 26, 3, 2, 'CZ').ball(26, 26, 3, 2, 'ZZ').ball(15, 27.4, 4, 1.5, 'CZ');
    } else {
        // Drips left behind as it leaves the ground
        canvas.ball(11, 24.5, 2, 2.5, 'CZ').ball(19.5, 25, 1.5, 2.5, 'ZZ').set(15, 27, 'C');
    }
    const eyes = Math.round(cy) - (squat ? 2 : 1);
    for (const x of [10, 18]) {
        canvas.rect(x, eyes, 3, 4, 'A').rect(x, eyes, 2, 2, 'w');
    }
    canvas.rect(13, eyes + 6, 5, 1, 'Z').set(12, eyes + 5, 'Z').set(18, eyes + 5, 'Z');
    // The sheen: a hard white window high on the lit side
    const shine = Math.round(cy - ry * 0.55);
    canvas.rect(Math.round(cx - rx * 0.55), shine, 3, 2, 'm').set(Math.round(cx - rx * 0.55) + 4, shine - 1, 'm');
    return finish(canvas);
}

const DOG = [
    '...............wwww...',
    '.w............OOwwkw..',
    '.ww...........OOwwwwwD',
    '..w...........OwwwwwG.',
    '..wwwwwwwwwwwwRRgg....',
    '..woooowwwwwwwRRg.....',
    '..wooooowwwwwwwwg.....',
    '..wwoooowwwwwwwgg.....',
    '..gwwwwwwwwwwwggg.....',
    '..ggggggggggggggg.....',
];

function dog(step: boolean): Grid {
    const canvas = new Canvas(32, 32);
    canvas.shadow(15, 28.5, 10, 2);
    // The lead runs up and back to a hand that is out of the picture
    const y = step ? 14 : 15;
    canvas.line(19, y + 3, 4, 1, 'R');
    canvas.stamp(5, y, DOG);
    const legs = step ? [8, 12, 16, 20] : [7, 10, 17, 19];
    legs.forEach((x, i) => {
        const lifted = step && i % 2 === 1 ? 1 : 0;
        canvas.rect(x, y + 10, 2, 3 - lifted, i % 2 === 0 ? 'w' : 'g').rect(x, y + 12 - lifted, 2, 1, 'G');
    });
    return finish(canvas);
}

const SLIME_FRAMES = [slime(true), slime(false)];

export const SLIME_V2: SheetDef = {
    key: 'slime',
    width: 32,
    height: 32,
    frames: SLIME_FRAMES,
    styles: eraStyles(SLIME_FRAMES, [dog(false), dog(true)]),
};

// --- Bat / starling --------------------------------------------------------------------------

const WING_UP = [
    'p........',
    'vp.......',
    'vPp......',
    'pPPp.....',
    '.pPPpp...',
    '.pPPPPpp.',
    '..pPPPPPp',
    '..pPPpPPP',
    '...pV.pPP',
    '...p...pV',
];

const WING_DOWN = [
    '......vpp',
    '....vpPPP',
    '..vpPPPPP',
    '.vPPPpPPP',
    'pPPpP.pPV',
    'pPp.p..pV',
    'pp.......',
    'p........',
];

function bat(up: boolean): Grid {
    const canvas = new Canvas(24, 24);
    const y = up ? 13 : 11;
    const wing = up ? WING_UP : WING_DOWN;
    const top = up ? y - 9 : y - 1;
    canvas.stamp(1, top, wing).stamp(14, top, wing, true);
    // Ears first so the head sits on them
    canvas.stamp(8, y - 8, ['p......p', 'pp....pp', 'pip..pip', 'pip..pIp']);
    canvas.ball(11.5, y - 1, 4.2, 4.6, 'vppPV');
    canvas.rect(9, y - 2, 2, 2, 'r').rect(13, y - 2, 2, 2, 'r').set(9, y - 2, 'e').set(13, y - 2, 'e');
    canvas.rect(10, y + 1, 4, 1, 'V').set(10, y + 2, 'w').set(13, y + 2, 'w');
    // Feet tucked under
    canvas.set(10, y + 4, 'P').set(13, y + 4, 'P');
    return finish(canvas);
}

const STARLING_BODY = [
    '............DDD...',
    '...........DddkyY.',
    '...DDDDDdddddd....',
    'DDDDdwddnddddd....',
    '.DDDddddwddpd.....',
    '....DDddddDD......',
];

function starling(up: boolean): Grid {
    const canvas = new Canvas(24, 24);
    canvas.stamp(3, 9, STARLING_BODY);
    if (up) {
        canvas.stamp(9, 5, ['D.....', 'DD....', 'DdD...', 'DddD..', 'DdddD.', 'DddddD']);
    } else {
        canvas.stamp(9, 14, ['DddddD', 'DdddD.', 'DddD..', 'DdD...', 'DD....']);
    }
    return finish(canvas);
}

const BAT_FRAMES = [bat(true), bat(false)];

export const BAT_V2: SheetDef = {
    key: 'bat',
    width: 24,
    height: 24,
    frames: BAT_FRAMES,
    styles: eraStyles(BAT_FRAMES, [starling(true), starling(false)]),
};

// --- Ironclad / cyclist ------------------------------------------------------------------------

const PLUME = ['..qr...', '.qrrR..', 'qrrrRR.', '.qrrRR.', '..rRR..'];

function ironclad(pose: 'left' | 'right' | 'windup'): Grid {
    const canvas = new Canvas(32, 32);
    const steel = 'mMMtT';
    canvas.shadow(15.5, 29, 10, 2.4);

    // Legs: the stepping foot is planted a pixel lower
    const drop = { left: [1, 0], right: [0, 1], windup: [1, 1] }[pose];
    [10, 17].forEach((x, i) => {
        canvas.rect(x, 23, 5, 3 + drop[i], 't').rect(x, 23, 2, 3 + drop[i], 'M');
        canvas.rect(x - 1, 26 + drop[i], 7, 2, 'T').rect(x - 1, 26 + drop[i], 3, 1, 't');
    });

    // Arms hang behind the pauldrons; the right one goes up to throw
    canvas.rect(4, 17, 4, 6, 'M').rect(6, 17, 2, 6, 't').rect(4, 22, 4, 3, 't').rect(4, 22, 2, 1, 'm');
    if (pose === 'windup') {
        canvas.rect(24, 6, 4, 9, 'M').rect(26, 6, 2, 9, 't').rect(23, 4, 5, 3, 't').rect(23, 4, 2, 1, 'm');
        canvas.ball(25.5, 2.2, 2.4, 2.4, 'eyY');
    } else {
        canvas.rect(24, 17, 4, 6, 'M').rect(26, 17, 2, 6, 'T').rect(24, 22, 4, 3, 't').rect(26, 22, 2, 3, 'T');
    }

    canvas.ball(15.5, 19, 8.5, 6.5, steel);
    // Breastplate: a gold seam, a red stone, a belt
    canvas.rect(15, 14, 1, 9, 't').rect(14, 17, 3, 3, 'r').set(14, 17, 'q').set(16, 19, 'R');
    canvas.rect(8, 23, 16, 1, 'Y').rect(8, 23, 6, 1, 'y').rect(14, 22, 3, 3, 'y').set(15, 23, 'E');
    canvas.ball(6.5, 15, 3.6, 3.4, steel).ball(24.5, 15, 3.6, 3.4, steel);
    canvas.rect(4, 17, 6, 1, 'Y').rect(22, 17, 6, 1, 'Y');

    // Helm with a cross visor and something lit behind it
    canvas.stamp(13, 0, PLUME);
    canvas.ball(15.5, 9.5, 7, 6.5, steel);
    canvas.rect(10, 9, 12, 2, 'k').rect(15, 6, 2, 8, 'k');
    canvas.rect(11, 9, 3, 2, 'e').rect(18, 9, 3, 2, 'e').set(13, 10, 'y').set(20, 10, 'y');
    canvas.rect(9, 14, 14, 1, 'T').rect(9, 14, 5, 1, 't');
    return finish(canvas);
}

function cyclist(pose: 'down' | 'up' | 'wave'): Grid {
    const canvas = new Canvas(32, 32);
    canvas.shadow(15.5, 29.5, 12, 1.8);
    const wheel = (cx: number) => {
        canvas.ring(cx, 24, 5, 'D').ring(cx, 24, 4, 'G');
        // Spokes turn with the frame
        if (pose === 'up') {
            canvas.line(cx - 3, 21, cx + 3, 27, 'G').line(cx - 3, 27, cx + 3, 21, 'G');
        } else {
            canvas.line(cx - 4, 24, cx + 4, 24, 'G').line(cx, 20, cx, 28, 'G');
        }
        canvas.set(cx, 24, 'D');
    };
    wheel(7);
    wheel(24);
    // Frame, saddle, bars
    canvas.line(7, 24, 12, 17, 'r').line(12, 17, 21, 17, 'r').line(21, 17, 24, 24, 'r').line(12, 17, 15, 24, 'r').line(15, 24, 21, 18, 'R');
    canvas.rect(10, 15, 5, 1, 'D').line(21, 17, 21, 13, 'D').rect(21, 13, 3, 1, 'D');

    // Legs on the pedals, one down and one up
    const down = pose !== 'up';
    canvas.line(13, 15, down ? 15 : 17, 20, 'B').line(14, 15, down ? 16 : 18, 20, 'b');
    canvas.line(down ? 16 : 18, 20, down ? 15 : 17, down ? 26 : 23, 'b').line(down ? 15 : 17, 20, down ? 14 : 16, down ? 26 : 23, 'B');
    canvas.rect(down ? 14 : 16, down ? 26 : 23, 4, 1, 'D');

    // Hi-vis jacket, leaning over the bars
    canvas.stamp(11, 7, ['...eeyy....', '..eeyyyY...', '.eyyyyyYY..', '.eyywwyyY..', 'eyyyyyyYY..', 'yyyyyyYY...', 'yyyyYYY....', '.YYYY......']);
    if (pose === 'wave') {
        canvas.line(18, 9, 22, 4, 'y').line(19, 9, 23, 4, 'Y').rect(22, 2, 2, 2, 'f');
    } else {
        canvas.line(18, 10, 22, 12, 'y').line(18, 11, 22, 13, 'Y').rect(22, 12, 2, 2, 'f');
    }
    // Head and helmet
    canvas.stamp(16, 0, ['..ccccC..', '.cwccCCC.', 'ccCcCcCCZ', 'ZZZZZZZZZ', '.hfffff..', '.Ffffkf..', '.Fffffff.', '..FffJf..', '...FFF...']);
    return finish(canvas);
}

const IRONCLAD_FRAMES = [ironclad('left'), ironclad('right'), ironclad('windup')];

export const IRONCLAD_V2: SheetDef = {
    key: 'ironclad',
    width: 32,
    height: 32,
    frames: IRONCLAD_FRAMES,
    styles: eraStyles(IRONCLAD_FRAMES, [cyclist('down'), cyclist('up'), cyclist('wave')]),
};

// --- Golem / delivery man with a trolley -------------------------------------------------------

const GOLEM_CENTRE = 23.5;
const GOLEM_RADIUS = 16.5;

/** Things carved into the boulder, as offsets from its centre when it is upright */
const GOLEM_MARKS: [number, number, readonly string[]][] = [
    // Brow and eyes
    [-10, -8, ['DD.....', 'zDDD...', '.YeeY..', '.YeeY..', '..YY...']],
    [3, -8, ['.....DD', '...DDDz', '..YeeY.', '..YeeY.', '...YY..']],
    // A mouth like a split in the rock
    [-7, 3, ['D............D', 'zD..D....D..Dz', '.zDDzD..DzDDz.', '...z.zDDz.z...']],
    // Old cracks
    [-14, -2, ['z..', 'Dz.', '.D.', '.Dz']],
    [9, 8, ['..z', '.zD', 'zD.', 'D..']],
    [-3, -15, ['z....', 'Dz.zD', '.DzD.']],
    // Moss on what is the top, for now
    [4, -15, ['.lnn..', 'lnnNn.', '.nNNNn', '..N.N.']],
    [-13, 6, ['nn..', 'nNn.', '.NN.']],
];

/** Lumps that stick out of the round: fists and feet. Angle in quarter turns from the right. */
const GOLEM_LUMPS: [number, number][] = [
    [0.08, 4.6],
    [1.92, 4.6],
    [0.72, 4],
    [1.28, 4],
];

function golem(turn: number): Grid {
    const canvas = new Canvas(48, 48);
    canvas.shadow(GOLEM_CENTRE, 43.5, 16, 3);
    const stone = 'xxXXXzzD';
    for (const [quarter, size] of GOLEM_LUMPS) {
        const angle = (quarter + turn) * (Math.PI / 2);
        const reach = GOLEM_RADIUS + size * 0.35;
        canvas.ball(GOLEM_CENTRE + Math.cos(angle) * reach, GOLEM_CENTRE + Math.sin(angle) * reach, size, size, stone);
    }
    canvas.ball(GOLEM_CENTRE, GOLEM_CENTRE, GOLEM_RADIUS, GOLEM_RADIUS, stone);
    for (const [left, top, rows] of GOLEM_MARKS) {
        rows.forEach((row, j) => {
            Array.from(row).forEach((slot, i) => {
                if (slot === '.') {
                    return;
                }
                // Half-pixel offsets, so a quarter turn lands exactly on pixels
                let dx = left + i + 0.5;
                let dy = top + j + 0.5;
                for (let n = 0; n < turn; n++) {
                    [dx, dy] = [-dy, dx];
                }
                canvas.set(GOLEM_CENTRE + dx, GOLEM_CENTRE + dy, slot);
            });
        });
    }
    return finish(canvas);
}

const COURIER_SLOTS = { l: 'y', n: 'y', N: 'Y', L: 'E' };

function courier(step: number): Grid {
    const canvas = new Canvas(48, 48);
    const pose = (['a', 'b', 'a', 'idle'] as const)[step];
    const bob = pose === 'idle' ? 0 : 1;
    const jolt = step % 2;
    canvas.shadow(22, 44.5, 19, 2.6);

    // The trolley: an upright frame, a toe plate, and more boxes than is sensible
    canvas.rect(24, 12, 2, 29, 't').rect(24, 12, 1, 29, 'M').rect(22, 12, 3, 2, 'T');
    canvas.rect(24, 40, 19, 2, 't').rect(24, 40, 19, 1, 'M');
    const box = (x: number, y: number, width: number, height: number) => {
        canvas.rect(x, y, width, height, 'h').rect(x, y, width - 2, height - 1, 'u').rect(x, y, width, 1, 'x');
        canvas.rect(x + Math.floor(width / 2) - 1, y, 2, height, 'x').rect(x, y + height - 1, width, 1, 'H');
    };
    box(26, 28, 16, 12);
    box(27, 17 - jolt, 14, 11 + jolt);
    box(28, 7 - jolt, 11, 10);
    canvas.ball(27.5, 42.5, 3, 3, 'DD').ball(27.5, 42.5, 1.2, 1.2, 'GG');
    canvas.set(step % 2 === 0 ? 27 : 29, step % 2 === 0 ? 40 : 42, 'G');

    // The man, in a courier's jacket and cap
    const man = manSide(pose).remap(COURIER_SLOTS);
    man.stamp(9, 3 + bob, ['...qrrrrR.....', '..qrrrrrrRR...', '.qrrrrrrrrRRRR', '.RRRRRRRRRR...']);
    canvas.paste(man, -3, 0);
    // Both arms out to the handle
    const y = 21 + bob;
    canvas.stamp(11, y, ['EyyyyyyyE...', 'EyyyyyyyyjfF', '.EYYYYYYYffF', '..EEEEEE....']);
    return finish(canvas);
}

const GOLEM_FRAMES = [0, 1, 2, 3].map(golem);

export const GOLEM_V2: SheetDef = {
    key: 'golem',
    width: 48,
    height: 48,
    frames: GOLEM_FRAMES,
    styles: eraStyles(GOLEM_FRAMES, [0, 1, 2, 3].map(courier)),
};

/** Every enemy sheet drawn by character artist A */
export const ENEMY_SHEETS_A: SheetDef[] = [RAT_V2, SLIME_V2, BAT_V2, IRONCLAD_V2, GOLEM_V2];
