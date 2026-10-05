import type { Grid, SheetDef } from '../../sprites/grid';
import { Canvas, SOFT_EDGE, eraStyles } from '../paint';

// The EMW Machine, and the small textures that look the same in every era.

/** Draws the top half and reflects it: the game spins the machine to aim, so it has no up */
function reflected(top: readonly string[]): Grid {
    const canvas = new Canvas(24, 12);
    canvas.stamp(0, 1, [...top, ...top.slice().reverse()]);
    return canvas.outline('k', SOFT_EDGE).grid();
}

// Points right, origin at its left end: a brass grip, a steel body with a red stone, a
// barrel, and a dish with a lens in it.
const RAY_GUN = reflected([
    '...................ZC...',
    '.....tttttttt.....ZCc...',
    '..YY.MMYMMMMYM....ZCcc..',
    '.YyyYMMYMrrMYMttttZCcce.',
    '.YeyYmmYmqqmYmMMMMZccwe.',
]);

const TORCH = reflected([
    '........................',
    '.................GGG....',
    '.dddddddddddd...GGgg....',
    '.DdDdDdDdddddGddGggyy...',
    '.dGdGdGdGGGGdGGGGgyee...',
]);

const MACHINE_FRAMES = [RAY_GUN];

export const MACHINE_V2: SheetDef = {
    key: 'machine',
    width: 24,
    height: 12,
    frames: MACHINE_FRAMES,
    styles: eraStyles(MACHINE_FRAMES, [TORCH]),
};

// --- Hearts ----------------------------------------------------------------------------------

const HEART: Grid = [
    '................',
    '..kkkk....kkkk..',
    '.kqqrrk..krrrRk.',
    'kqwwrrrkkrrrrRRk',
    'kqwrrrrrrrrrrRRk',
    'kqrrrrrrrrrrrRRk',
    'krrrrrrrrrrrRRRk',
    'krrrrrrrrrrrRRQk',
    '.krrrrrrrrrRRQk.',
    '..krrrrrrrRRQk..',
    '...krrrrrRRQk...',
    '....krrrRRQk....',
    '.....krRRQk.....',
    '......kRQk......',
    '.......kk.......',
    '................',
];

export const HEART_V2: SheetDef = { key: 'heart', width: 16, height: 16, frames: [HEART] };

// The health upgrade: a heart kept in a corked jar, with a glint so it reads as treasure
const UPGRADE: Grid = [
    '......kkkk...e..',
    '.....kuooOk.eee.',
    '....kkkOOkkk.e..',
    '...kyyyyyyYYk...',
    '..kkkkkkkkkkkk..',
    '.kcwmrrmmrrmmCk.',
    '.kcwrqrrrrrRmCk.',
    '.kcmrqrrrrrRmCk.',
    '.kcmrrrrrrRRmCk.',
    '.kcmmrrrrRRmmCk.',
    '.kcmmmrrRRmmmCk.',
    '.kcmmmmRRmmmCCk.',
    '.kCcmmmmmmmCCZk.',
    '..kCCCCCCCCZZk..',
    '...kkkkkkkkkk...',
    '................',
];

export const UPGRADE_V2: SheetDef = { key: 'upgrade', width: 16, height: 16, frames: [UPGRADE] };

const SPARK: Grid = ['...ww...', '..wwww..', '.wwwwww.', 'wwwwwwww', 'wwwwwwww', '.wwwwww.', '..wwww..', '...ww...'];

export const SPARK_V2: SheetDef = { key: 'spark', width: 8, height: 8, frames: [SPARK] };

// --- Ray icons -------------------------------------------------------------------------------
// Each is the shape the ray makes, in the ray's colour.

const ICON = 24;

function icon(paint: (canvas: Canvas) => void): Grid {
    const canvas = new Canvas(ICON, ICON);
    paint(canvas);
    return canvas.outline('k').grid();
}

/** Blue: a cone opening to the right */
const ICON_BLUE = icon((canvas) => {
    for (let y = 2; y < 22; y++) {
        for (let x = 3; x < 22; x++) {
            const dx = x - 2.5;
            const dy = y - 11.5;
            const spread = Math.abs(dy) / dx;
            if (dx * dx + dy * dy > 19 * 19 || spread > 0.56) {
                continue;
            }
            canvas.set(x, y, spread < 0.14 ? 'w' : spread < 0.3 ? 'c' : spread < 0.44 ? 'a' : 'b');
        }
    }
    canvas.rect(2, 10, 3, 4, 'B');
});

/** Red: a straight beam from an emitter */
const ICON_RED = icon((canvas) => {
    canvas.rect(6, 10, 14, 4, 'r').rect(6, 11, 15, 2, 'q').rect(8, 11, 10, 1, 'w');
    canvas.rect(20, 11, 2, 2, 'r');
    canvas.ball(4.5, 11.5, 3, 4.4, 'qrRQ');
    // Heat coming off the beam
    canvas.rect(10, 6, 1, 2, 'r').rect(15, 5, 1, 3, 'q').rect(12, 16, 1, 3, 'q').rect(17, 16, 1, 2, 'r');
});

/** Green: a charged blob */
const ICON_GREEN = icon((canvas) => {
    canvas.ball(11.5, 11, 8, 7.5, 'wllnnNL');
    canvas.ball(6, 18.5, 2, 2.4, 'nN').ball(13, 20, 1.6, 2, 'nN').ball(18.5, 17.5, 1.6, 2.2, 'NN');
    canvas.rect(7, 6, 3, 2, 'w').set(11, 5, 'w');
});

/** White: a ring bursting outward all round */
const ICON_WHITE = icon((canvas) => {
    canvas.ring(11.5, 11.5, 6.4, 'w').ring(11.5, 11.5, 5.6, 'w').ring(11.5, 11.5, 5, 'g');
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
        canvas.line(Math.round(11.5 + cos * 8.6), Math.round(11.5 + sin * 8.6), Math.round(11.5 + cos * 10.4), Math.round(11.5 + sin * 10.4), 'w');
    }
    canvas.rect(10, 10, 4, 4, 'w').rect(11, 11, 2, 2, 'g');
});

/** UV: a lens, and the light that comes out of it */
const ICON_UV = icon((canvas) => {
    canvas.ball(8, 11.5, 5, 9.5, 'wvvppPV');
    canvas.ball(8, 11.5, 2.6, 7, 'wvvp');
    canvas.rect(6, 5, 2, 4, 'w');
    canvas.line(14, 11, 21, 11, 'v').line(14, 12, 21, 12, 'p').line(14, 7, 20, 3, 'v').line(14, 16, 20, 20, 'p');
});

/** Dash: chevrons leaving speed lines */
const ICON_DASH = icon((canvas) => {
    for (const [x, slot] of [[8, 'Y'], [14, 'y']] as const) {
        for (let i = 0; i < 4; i++) {
            canvas.line(x + i, 3, x + i + 7, 11, slot).line(x + i, 20, x + i + 7, 12, slot);
        }
        canvas.line(x, 3, x + 7, 11, 'e');
    }
    canvas.rect(1, 8, 5, 1, 'w').rect(2, 11, 6, 2, 'w').rect(1, 15, 5, 1, 'w');
});

export const ICONS_V2: SheetDef = {
    key: 'icons',
    width: ICON,
    height: ICON,
    frames: [ICON_BLUE, ICON_RED, ICON_GREEN, ICON_WHITE, ICON_UV, ICON_DASH],
};

// --- Era icons -------------------------------------------------------------------------------
// Shown over the Prism's head before it changes the era, so each must be told from the
// others by shape alone as well as by colour.

/** Golden Age: the sun */
const ERA_GOLDEN = icon((canvas) => {
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
        const from = [Math.round(11.5 + cos * 7.5), Math.round(11.5 + sin * 7.5)];
        const to = [Math.round(11.5 + cos * 10.2), Math.round(11.5 + sin * 10.2)];
        canvas.line(from[0], from[1], to[0], to[1], 'y').line(from[0] + 1, from[1], to[0] + 1, to[1], 'Y');
    }
    canvas.ball(11.5, 11.5, 6, 6, 'eeyyY');
});

/** Cyberpunk: a neon moon over a lit tower */
const ERA_CYBERPUNK = icon((canvas) => {
    canvas.ball(11.5, 11.5, 10, 10, 'PPPVV');
    canvas.ball(9, 8, 5, 5, 'ii').ball(11, 7, 4.2, 4.2, 'PP');
    canvas.rect(13, 10, 5, 11, 'V').rect(6, 15, 5, 6, 'V');
    canvas.rect(14, 11, 1, 2, 'c').rect(16, 13, 1, 2, 'c').rect(14, 16, 1, 2, 'i').rect(16, 18, 1, 1, 'c');
    canvas.rect(7, 16, 1, 1, 'c').rect(9, 18, 1, 2, 'i').rect(13, 9, 5, 1, 'c');
});

/** Retro: a dull old television */
const ERA_RETRO = icon((canvas) => {
    canvas.line(8, 1, 11, 5, 'd').line(16, 1, 13, 5, 'd');
    canvas.rect(2, 5, 20, 15, 'z').rect(2, 5, 20, 1, 'X').rect(2, 5, 1, 15, 'X');
    canvas.rect(4, 7, 12, 11, 'D').rect(5, 8, 10, 9, 'd').rect(5, 8, 10, 1, 'G').rect(5, 11, 10, 1, 'G').rect(5, 14, 10, 1, 'G');
    canvas.rect(18, 8, 2, 2, 'G').rect(18, 12, 2, 2, 'd').rect(18, 16, 2, 1, 'D');
    canvas.rect(4, 20, 3, 2, 'D').rect(17, 20, 3, 2, 'D');
});

/** Manga: a shout balloon in ink on paper */
const ERA_MANGA = icon((canvas) => {
    for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        canvas.line(12, 11, Math.round(11.5 + Math.cos(angle) * 10.4), Math.round(11.5 + Math.sin(angle) * 10.4), 'w');
        canvas.line(11, 11, Math.round(11.5 + Math.cos(angle) * 10.4), Math.round(11.5 + Math.sin(angle) * 10.4), 'w');
    }
    canvas.ball(11.5, 11.5, 7.6, 7.6, 'w');
    canvas.rect(10, 5, 3, 9, 'k').rect(10, 16, 3, 3, 'k');
});

export const ERA_ICONS_V2: SheetDef = {
    key: 'era-icons',
    width: ICON,
    height: ICON,
    frames: [ERA_GOLDEN, ERA_CYBERPUNK, ERA_RETRO, ERA_MANGA],
};
