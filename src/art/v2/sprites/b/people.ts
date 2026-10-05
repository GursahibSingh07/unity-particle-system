import type { Grid } from '../../../sprites/grid';
import { Pix } from './paint';

// What was really in the square: ordinary people, all built on one small figure so they
// belong to the same street. Everyone faces the Handler, because he is shining a torch at them.

type Arm = 'down' | 'pump' | 'shield' | 'offer' | 'carry' | 'raise';

interface Person {
    hair: string;
    /** light, mid, dark */
    top: [string, string, string];
    /** A long coat hides the legs down to the shin */
    longCoat?: boolean;
    legs: [string, string];
    /** Bare knees below shorts */
    shorts?: boolean;
    shoes: string;
    /** The arm on the viewer's left, then the one on the right */
    arms: [Arm, Arm];
    /** Drawn before the outline: hats, aprons, anything that changes the silhouette */
    wear?: (p: Pix, bob: number, step: boolean) => void;
    /** Drawn after the outline: buttons, stripes, things held */
    trim?: (p: Pix, bob: number, step: boolean) => void;
}

const HEAD = [
    '..hhhhhh..',
    '.hhhhhhhh.',
    'hhhhhhhhhH',
    'hhhffffhHH',
    'hfffffffFH',
    'hfffffffFF',
    'fffffffFFF',
    '.fffffFFF.',
    '..ffFFFF..',
];

function arm(p: Pix, pose: Arm, right: boolean, bob: number, step: boolean, cloth: [string, string, string]) {
    const [, mid, dark] = cloth;
    const tone = right ? dark : mid;
    // x of the arm's outer column and the direction that points away from the body
    const x = right ? 22 : 8;
    const out = right ? 1 : -1;
    const y = 13 + bob;
    const swing = step === right ? 1 : 0;
    switch (pose) {
        case 'down':
            p.rect(x, y, 2, 7 + swing, tone);
            p.rect(x, y + 7 + swing, 2, 2, 'f');
            break;
        case 'pump':
            // Elbows out, fists up: a runner
            p.rect(x, y, 2, 4, tone);
            p.rect(x + (right ? 1 : -1), y + 3, 2, 2, tone);
            p.rect(x + (right ? 1 : -1), y + 1 - swing * 2, 2, 2, 'f');
            break;
        case 'shield':
            // Upper arm lifts, the hand lands flat over the brow
            p.rect(x, y - 3, 2, 5, tone);
            p.rect(x + (right ? -1 : 1), y - 5, 2, 3, tone);
            p.rect(right ? 14 : 11, 5 + bob, 7, 2, 'f');
            p.rect(right ? 20 : 10, 5 + bob, 2, 3, tone);
            break;
        case 'offer':
            p.rect(right ? x : x - 4, y + 1, 6, 2, tone);
            p.rect(right ? x + 6 : x - 6, y + 1, 2, 2, 'f');
            break;
        case 'raise':
            // An open hand held up: stop
            p.rect(x, y, 2, 3, tone);
            p.rect(x + out, y - 4, 2, 5, tone);
            p.rect(x + out, y - 7, 2, 3, 'f');
            p.set(x + out * 2 + (right ? 1 : 0), y - 7, 'f');
            break;
        case 'carry':
            // Held a little away from the body by the weight
            p.rect(x, y, 2, 8, tone);
            p.rect(x, y + 8, 2, 2, 'f');
            break;
    }
}

function person(spec: Person, step: boolean): Pix {
    const p = new Pix(32, 32);
    const bob = step ? 1 : 0;
    const [light, mid, dark] = spec.top;

    // Legs: the lifted foot is drawn shorter, which is all a two-frame walk needs
    const [leg, legDark] = spec.legs;
    for (const right of [false, true]) {
        const x = right ? 16 : 11;
        const lifted = step === right;
        const foot = lifted ? 27 : 29;
        p.rect(x, 21, 5, foot - 21, right ? legDark : leg);
        if (spec.shorts) {
            p.rect(x + 1, 24 + bob, 3, foot - 24 - bob, right ? 'F' : 'f');
            p.rect(x, 24 + bob, 1, foot - 24 - bob, '.');
            p.rect(x + 4, 24 + bob, 1, foot - 24 - bob, '.');
        }
        p.rect(x, foot, 5, 2, spec.shoes);
    }
    // The gap between the legs
    p.rect(15, 24, 2, 8, '.');
    p.rect(15, 24, 2, 1, legDark);

    // Torso
    const hem = spec.longCoat ? 26 : 22;
    p.rect(10, 12 + bob, 12, hem - 12 - bob, mid);
    p.rect(10, 12 + bob, 1, hem - 12 - bob, light);
    p.rect(11, 12 + bob, 10, 1, light);
    p.rect(20, 13 + bob, 2, hem - 13 - bob, dark);
    p.rect(11, hem - 1, 10, 1, dark);

    arm(p, spec.arms[0], false, bob, step, spec.top);
    arm(p, spec.arms[1], true, bob, step, spec.top);

    // Head
    p.rows(11, 2 + bob, HEAD.map((row) => row.replace(/h/g, spec.hair).replace(/H/g, spec.hair === 'f' ? 'F' : 'k')));
    spec.wear?.(p, bob, step);
    p.outline('k');

    // Face
    p.dots('k', 13, 8 + bob, 18, 8 + bob);
    p.dots('k', 13, 7 + bob, 18, 7 + bob);
    // Where the arms meet the body, and the neck's shadow
    p.rect(10, 14 + bob, 1, 5, dark);
    p.rect(13, 11 + bob, 6, 1, 'F');
    if (spec.arms[0] === 'shield' || spec.arms[1] === 'shield') {
        // The flat of the hand along the brow, and the shade it throws on the eyes
        p.rect(11, 5 + bob, 9, 1, 'f').rect(11, 6 + bob, 9, 1, 'F').rect(11, 4 + bob, 9, 1, 'k');
        p.rect(12, 7 + bob, 8, 1, 'F');
    }
    spec.trim?.(p, bob, step);
    return p;
}

const walk = (spec: Person): Grid[] => [person(spec, false).grid(), person(spec, true).grid()];

// --- Jogger (the skitter) ------------------------------------------------------------------

const JOGGER: Person = {
    hair: 'h',
    top: ['w', 'n', 'N'],
    legs: ['B', 'B'],
    shorts: true,
    shoes: 'w',
    arms: ['pump', 'pump'],
    trim: (p, bob) => {
        // Sweatband, bare arms, a number on the vest
        p.rect(11, 5 + bob, 10, 1, 'r');
        p.rect(14, 15 + bob, 4, 3, 'w');
        p.dots('d', 15, 16 + bob, 16, 16 + bob);
        p.rows(23, 3 + bob, ['.c.', 'cwc']);
    },
};

export const SKITTER_PLAIN = walk(JOGGER);

// --- Man in a dark coat (the ghost) --------------------------------------------------------

const hatBrim = (p: Pix, bob: number) => {
    p.rect(12, 1 + bob, 8, 3, 'd');
    p.rect(13, 1 + bob, 5, 1, 'G');
    p.rect(9, 4 + bob, 14, 2, 'd');
    p.rect(12, 3 + bob, 8, 1, 'k');
};

const COAT_MAN: Person = {
    hair: 'H',
    top: ['G', 'd', 'k'],
    longCoat: true,
    legs: ['d', 'k'],
    shoes: 'k',
    arms: ['down', 'down'],
    wear: hatBrim,
    trim: (p, bob) => {
        // Collar turned up, one line of buttons, a scarf the colour of the ghost
        p.rows(12, 12 + bob, ['GkppppkG', '.GkppkG.', '..GkkG..']);
        p.rect(16, 15 + bob, 1, 10 - bob, 'k');
        p.dots('G', 14, 17 + bob, 14, 20 + bob, 14, 23);
    },
};

export const GHOST_PLAIN: Grid[] = [
    ...walk(COAT_MAN),
    person({ ...COAT_MAN, arms: ['shield', 'down'] }, false).grid(),
];

// --- Cinema doorman (the wraith) -----------------------------------------------------------

const cap = (p: Pix, bob: number) => {
    p.rect(11, 0 + bob, 10, 4, 'r');
    p.rect(12, 0 + bob, 6, 1, 'i');
    p.rect(19, 1 + bob, 2, 3, 'R');
    p.rect(10, 3 + bob, 12, 1, 'y');
    p.rect(10, 4 + bob, 12, 2, 'k');
    p.rect(12, 6 + bob, 8, 1, 'k');
};

const DOORMAN: Person = {
    hair: 'H',
    top: ['i', 'r', 'R'],
    longCoat: true,
    legs: ['d', 'k'],
    shoes: 'k',
    arms: ['down', 'down'],
    wear: (p, bob) => {
        cap(p, bob);
        // Epaulettes square the shoulders
        p.rect(7, 12 + bob, 4, 1, 'y');
        p.rect(21, 12 + bob, 4, 1, 'y');
    },
    trim: (p, bob) => {
        p.dots('e', 15, 2 + bob, 16, 2 + bob);
        p.rows(13, 12 + bob, ['wwkkww', '.wkkw.']);
        // Two rows of brass buttons and a gold hem
        for (let y = 15 + bob; y <= 22; y += 3) {
            p.dots('y', 13, y, 18, y);
        }
        p.rect(11, 24, 10, 1, 'y');
        p.rect(8, 19 + bob, 2, 1, 'y');
        p.rect(22, 19 + bob, 2, 1, 'y');
    },
};

export const WRAITH_PLAIN: Grid[] = [
    ...walk(DOORMAN),
    person({ ...DOORMAN, arms: ['down', 'raise'] }, false).grid(),
];

// --- Ice-cream vendor (the snowman) --------------------------------------------------------

const cone = (p: Pix, x: number, y: number) => {
    p.rows(x, y, [
        '.kkk.',
        'kiwik',
        'kiiIk',
        'kyYyk',
        '.kYk.',
        '.kyk.',
        '..k..',
    ]);
};

const paperHat = (p: Pix, bob: number) => {
    p.rect(11, 0 + bob, 10, 4, 'w');
    p.rect(19, 1 + bob, 2, 3, 'g');
    p.rect(11, 3 + bob, 10, 1, 'r');
};

const apron = (p: Pix, bob: number) => {
    p.rows(13, 12 + bob, ['w....w']);
    for (let x = 12; x < 20; x++) {
        p.rect(x, 14 + bob, 1, 8 - bob, x % 2 === 0 ? 'r' : 'w');
    }
    p.rect(12, 22, 8, 1, 'G');
};

const VENDOR: Person = {
    hair: 'h',
    top: ['w', 'w', 'g'],
    legs: ['G', 'd'],
    shoes: 'k',
    arms: ['down', 'carry'],
    wear: paperHat,
    trim: (p, bob) => {
        apron(p, bob);
        cone(p, 22, 15 + bob);
    },
};

export const SNOWMAN_PLAIN: Grid[] = [
    ...walk(VENDOR),
    person(
        {
            ...VENDOR,
            arms: ['down', 'offer'],
            trim: (p, bob) => {
                apron(p, bob);
                cone(p, 27, 9 + bob);
            },
        },
        false,
    ).grid(),
];

// --- Window cleaner (the acid slime) -------------------------------------------------------

const bucket = (p: Pix, x: number, y: number, slosh: boolean) => {
    p.rows(x, y, [
        '..kkk..',
        '.k...k.',
        'kkkkkkk',
        slosh ? 'kwcwwck' : 'kcwccwk',
        'kMMMMtk',
        'kMMMMtk',
        '.kMMtk.',
        '.kkkkk.',
    ]);
};

const flatCap = (p: Pix, bob: number) => {
    p.rect(11, 1 + bob, 10, 3, 'b');
    p.rect(12, 1 + bob, 6, 1, 'c');
    p.rect(10, 4 + bob, 12, 1, 'B');
};

const overalls = (p: Pix, bob: number) => {
    // Bib and braces over a pale shirt
    p.rect(12, 15 + bob, 8, 7 - bob, 'b');
    p.rect(12, 12 + bob, 2, 3, 'b');
    p.rect(18, 12 + bob, 2, 3, 'b');
    p.rect(18, 16 + bob, 2, 6 - bob, 'B');
    p.dots('y', 12, 15 + bob, 19, 15 + bob);
    p.rect(14, 17 + bob, 4, 2, 'B');
};

const CLEANER: Person = {
    hair: 'h',
    top: ['w', 'g', 'G'],
    legs: ['b', 'B'],
    shoes: 'k',
    arms: ['carry', 'down'],
    wear: (p, bob) => {
        flatCap(p, bob);
        // The squeegee over his shoulder
        p.rect(24, 4 + bob, 1, 10, 'O');
        p.rect(21, 2 + bob, 7, 1, 'd').rect(21, 3 + bob, 7, 1, 'c');
    },
    trim: (p, bob, step) => {
        overalls(p, bob);
        bucket(p, 4, 22 + bob, step);
    },
};

export const ACID_SLIME_PLAIN: Grid[] = [
    ...walk(CLEANER),
    // Swinging the bucket up to empty it
    person(
        {
            ...CLEANER,
            arms: ['offer', 'down'],
            trim: (p, bob) => {
                overalls(p, bob);
                bucket(p, 0, 9 + bob, true);
                p.rows(1, 5 + bob, ['.c..w', 'w.c..', '..w.c']);
            },
        },
        false,
    ).grid(),
];
