import type { ArtStyle } from '../types';

// The hand-made layer over each era: a camera shader (paper, grain, wobble, grade, print
// artefacts) and a few ambient particles. Nothing here changes what the player can hit or be hit
// by; it only changes how the square is printed. Off with the "Hand-made look" setting.

/** Floating motes over the square. Speeds are world units a second, sizes texture pixels. */
export interface Ambient {
    kind: 'dust' | 'rain' | 'ash' | 'flecks' | 'leaves';
    /** Most alive at once */
    count: number;
    colors: number[];
    /** Opacity range of one mote */
    alpha: [number, number];
    /** Velocity range, world units a second */
    speedX: [number, number];
    speedY: [number, number];
    /** How long one lives, milliseconds */
    lifespan: [number, number];
}

export interface EraLook {
    /** Colour grade, applied first. 1 leaves a value alone. */
    saturation: number;
    contrast: number;
    brightness: number;
    /** Multiplied into the picture: the colour of the light */
    tint: [number, number, number];
    /** Added to the darks: printed ink is never black on real paper */
    lift: [number, number, number];

    /** Paper grain and fibres, 0 to 1 */
    paper: number;
    /** Uneven ink: big soft patches a little lighter or darker, 0 to 1 */
    blotch: number;
    /** Film grain, as a fraction of full brightness */
    grain: number;
    /** How far the hand-drawn wobble moves an edge, in art pixels */
    boil: number;
    /** Darkening towards the corners, 0 to 1 */
    vignette: number;
    /** Halftone dots in the shadows, 0 to 1 */
    halftone: number;
    /** Glow round the brightest lights (neon, lamps), 0 to 1 */
    bloom: number;

    ambient: Ambient | null;
}

/** The wobble is redrawn this many times a second, like a hand-drawn cel boiling */
export const BOIL_FPS = 6;
/** Film grain changes this many times a second */
export const GRAIN_FPS = 24;
/** Screen pixels per art pixel: the 640x360 picture on the 1280x720 canvas */
export const ART_PIXEL = 2;

export const LOOKS: Record<ArtStyle, EraLook> = {
    // A sunny four-colour comic, printed on cheap warm paper
    goldenAge: {
        saturation: 1.05,
        contrast: 1.04,
        brightness: 1,
        tint: [1, 0.97, 0.9],
        lift: [0.05, 0.035, 0.02],
        paper: 0.4,
        blotch: 0.35,
        grain: 0.0125,
        boil: 0,
        vignette: 0.35,
        halftone: 0.4,
        bloom: 0,
        ambient: {
            kind: 'dust',
            count: 40,
            colors: [0xffffff, 0xffe9a8, 0xd9a441],
            alpha: [0.6, 1],
            speedX: [-3, 3],
            speedY: [-4, -1],
            lifespan: [5000, 9000],
        },
    },
    // Dusk and neon in the rain: wet, cold, glowing
    cyberpunk: {
        saturation: 1.1,
        contrast: 1.08,
        brightness: 1,
        tint: [0.95, 0.95, 1.05],
        lift: [0.03, 0.02, 0.06],
        paper: 0.3,
        blotch: 0.25,
        grain: 0.0175,
        boil: 0,
        vignette: 0.5,
        halftone: 0,
        bloom: 0.7,
        ambient: {
            kind: 'rain',
            count: 110,
            colors: [0x9fdcff, 0xd8c8ff],
            alpha: [0.35, 0.6],
            speedX: [-40, -30],
            speedY: [210, 260],
            lifespan: [900, 1300],
        },
    },
    // Cheap newsprint gone dull and dirty, ash in the air
    retro: {
        saturation: 0.85,
        contrast: 0.95,
        brightness: 0.98,
        tint: [1, 1, 0.94],
        lift: [0.04, 0.045, 0.03],
        paper: 0.35,
        blotch: 0.45,
        grain: 0.0225,
        boil: 0,
        vignette: 0.55,
        halftone: 0,
        bloom: 0,
        ambient: {
            kind: 'ash',
            count: 45,
            colors: [0xc9c5a8, 0x8a876f],
            alpha: [0.5, 0.85],
            speedX: [-4, 4],
            speedY: [4, 10],
            lifespan: [6000, 10000],
        },
    },
    // Ink on paper: the paper shows most here, and only these lines boil
    manga: {
        saturation: 1,
        contrast: 1.02,
        brightness: 1,
        tint: [1, 0.99, 0.96],
        lift: [0.06, 0.06, 0.06],
        paper: 0.45,
        blotch: 0.3,
        grain: 0.0125,
        boil: 0.25,
        vignette: 0.25,
        halftone: 0,
        bloom: 0,
        ambient: {
            kind: 'flecks',
            count: 18,
            colors: [0x111111],
            alpha: [0.35, 0.7],
            speedX: [-2, 2],
            speedY: [2, 5],
            lifespan: [6000, 10000],
        },
    },
    // The truth in daylight: no print, no wobble, just a soft ordinary afternoon
    plain: {
        saturation: 0.96,
        contrast: 1,
        brightness: 1.02,
        tint: [1, 1, 0.98],
        lift: [0.02, 0.02, 0.02],
        paper: 0.15,
        blotch: 0.15,
        grain: 0.01,
        boil: 0,
        vignette: 0.2,
        halftone: 0,
        bloom: 0,
        ambient: {
            kind: 'leaves',
            count: 10,
            colors: [0xb5893f, 0x8f6a2e, 0x9a9a4a],
            alpha: [0.7, 0.95],
            speedX: [6, 14],
            speedY: [4, 9],
            lifespan: [8000, 12000],
        },
    },
};

/** Keeps every era readable: what a test holds the numbers to */
export const LOOK_LIMITS = {
    grain: 0.08,
    boil: 1,
    vignette: 0.6,
    ambientCount: 120,
};
