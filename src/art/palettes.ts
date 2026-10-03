import type { ArtStyle } from '../types';

// One palette per comic style. Sprite grids name slots, palettes decide what a slot looks
// like, so the same drawing becomes a four-colour print, a noir panel or a manga page.
//
// Slots: k ink, w white, g/G/d light/mid/dark grey, r/R red, y/Y yellow, b/B blue,
// c/C cyan, n/N green, p/P purple, i/I pink, f/F skin, h/H hair, o/O wood, e glow,
// s drop shadow, 1-3 floor, 4-7 wall (4 lit top, 5 face, 6 mortar, 7 face shadow).

/** Two colours laid out as print dots, for halftone and screentone */
export interface Pattern {
    kind: 'checker' | 'halftone';
    a: string;
    b: string;
}

export type Tone = string | Pattern;
export type Palette = Record<string, Tone>;

/** The colour of a tone at a pixel. Coordinates are frame-local so patterns tile. */
export function toneAt(tone: Tone, x: number, y: number): string {
    if (typeof tone === 'string') {
        return tone;
    }
    if (tone.kind === 'checker') {
        return (x + y) % 2 === 0 ? tone.a : tone.b;
    }
    // Staggered dots on a 4px pitch
    const dot = (x % 4 === 0 && y % 4 === 0) || (x % 4 === 2 && y % 4 === 2);
    return dot ? tone.b : tone.a;
}

const goldenAge: Palette = {
    k: '#1b1626',
    w: '#fbf3dc',
    g: '#d9d3c3',
    G: '#9b98a8',
    d: '#55536b',
    r: '#e8332c',
    R: '#a01c28',
    y: '#ffd640',
    Y: '#f08c1e',
    b: '#2b63d9',
    B: '#1c3a94',
    c: '#8fe0f5',
    C: '#3aa3d8',
    n: '#52c24a',
    N: '#237a3c',
    p: '#8a4cc4',
    P: '#4b2580',
    i: '#ff8fb0',
    I: '#d05a86',
    f: '#ffcfa0',
    F: '#e39a6c',
    h: '#b0683a',
    H: '#74401f',
    o: '#b0683a',
    O: '#74401f',
    e: '#fff27a',
    s: 'rgba(27, 22, 38, 0.3)',
    // Newsprint with a halftone dot, the way cheap four-colour presses filled flat areas
    1: { kind: 'halftone', a: '#f0e2b0', b: '#e3cc85' },
    2: '#dcc47c',
    3: '#b89a55',
    4: '#9cc4ff',
    5: '#3f6fd8',
    6: '#1b1f55',
    7: '#2b4fae',
};

// Greys only: the one accent colour in a noir room is the radiation, which the game draws
const noir: Palette = {
    k: '#07070b',
    w: '#f5f5f7',
    g: '#cfcfd6',
    G: '#8f909a',
    d: '#4b4c57',
    r: '#30313b',
    R: '#1c1c24',
    y: '#b4b6c2',
    Y: '#8a8c98',
    b: '#6f7180',
    B: '#464854',
    c: '#e4e6ee',
    C: '#a4a8b8',
    n: '#a2a4ae',
    N: '#5c5e6a',
    p: '#474858',
    P: '#23232e',
    i: '#c0c0c8',
    I: '#888892',
    f: '#e6e6ea',
    F: '#a6a6ae',
    h: '#34353f',
    H: '#1c1c24',
    o: '#6a6b76',
    O: '#3c3d47',
    e: '#ffffff',
    s: 'rgba(0, 0, 0, 0.45)',
    1: '#23242c',
    2: '#2b2d37',
    3: '#3f4250',
    4: '#b4b6c2',
    5: '#555764',
    6: '#121218',
    7: '#3e404c',
};

const INK = '#000000';
const PAPER = '#ffffff';
const SCREENTONE = '#a8a8a8';

// Black, white and one grey. Anything in between is that grey laid down as screentone.
const manga: Palette = {
    k: INK,
    w: PAPER,
    g: PAPER,
    G: SCREENTONE,
    d: { kind: 'checker', a: INK, b: SCREENTONE },
    r: INK,
    R: INK,
    y: PAPER,
    Y: SCREENTONE,
    b: PAPER,
    B: SCREENTONE,
    c: PAPER,
    C: { kind: 'checker', a: PAPER, b: SCREENTONE },
    n: { kind: 'checker', a: INK, b: SCREENTONE },
    N: INK,
    p: { kind: 'checker', a: INK, b: SCREENTONE },
    P: INK,
    i: PAPER,
    I: SCREENTONE,
    f: PAPER,
    F: SCREENTONE,
    h: INK,
    H: INK,
    o: SCREENTONE,
    O: { kind: 'checker', a: INK, b: SCREENTONE },
    e: PAPER,
    s: { kind: 'checker', a: SCREENTONE, b: INK },
    // A toned ground with white figures on it: the page's one grey does the most work here
    1: SCREENTONE,
    2: { kind: 'checker', a: SCREENTONE, b: PAPER },
    3: INK,
    4: PAPER,
    5: PAPER,
    6: INK,
    7: { kind: 'checker', a: PAPER, b: SCREENTONE },
};

// The ending: an ordinary street on an ordinary day. Even the outlines are soft.
const plain: Palette = {
    k: '#4a4540',
    w: '#f7f4ea',
    g: '#d5d2c8',
    G: '#a3a39c',
    d: '#5d6068',
    r: '#c9706a',
    R: '#a05552',
    y: '#e6cf8a',
    Y: '#c9a66a',
    b: '#7d99b8',
    B: '#5a7391',
    c: '#b5d3dc',
    C: '#8eb4c2',
    n: '#9db08a',
    N: '#788c6a',
    p: '#a391b5',
    P: '#7d6c90',
    i: '#eeb0c0',
    I: '#d48ca0',
    f: '#f0cdb0',
    F: '#d8a98c',
    h: '#8a6a4e',
    H: '#6f5644',
    o: '#b08e6c',
    O: '#8a6c54',
    e: '#fff6c8',
    s: 'rgba(60, 50, 40, 0.2)',
    1: '#d9d4c4',
    2: '#cec8b6',
    3: '#b4ad9b',
    4: '#ecd2be',
    5: '#c49a84',
    6: '#8f6f60',
    7: '#b08672',
};

export const PALETTES: Record<ArtStyle, Palette> = { goldenAge, noir, manga, plain };

/** For the HUD textures that look the same in every style */
export const SHARED_PALETTE: Palette = {
    ...goldenAge,
    // Pure white so the game can tint it
    w: '#ffffff',
    p: '#c9a0ff',
    P: '#7a5cff',
    n: '#8cf06a',
};
