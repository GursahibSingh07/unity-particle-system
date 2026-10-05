import type { ArtStyle } from '../../../types';
import { desaturate, mix, tone } from './pix';

// One Look per era: the colours, and how much of the square is still there to be drawn.
// The drawing code in scene.ts reads `detail` to decide what to leave out.

export type BuildingId =
    | 'grocer'
    | 'tailor'
    | 'hall'
    | 'clocks'
    | 'tea'
    | 'bookshop'
    | 'flats'
    | 'cinema'
    | 'pharmacy'
    | 'house'
    | 'cafe'
    | 'bakery'
    | 'cottage';

export interface Building {
    wall: string;
    wallHi: string;
    wallLo: string;
    trim: string;
    roof: string;
    roofHi: string;
    roofLo: string;
    awnA: string;
    awnB: string;
    door: string;
    shutter: string;
    sign: string;
    signInk: string;
    neon: string;
}

export interface Look {
    style: ArtStyle;
    /** 4 everything, 3 small details gone, 2 flat blocks, 1 ink outlines */
    detail: 1 | 2 | 3 | 4;
    /** Banners and sparkle: Golden only. The real square has a notice board instead. */
    heroic: boolean;
    outline: string;
    deep: string;
    ground: string;
    groundAlt: [string, string];
    joint: string;
    worn: string;
    wornLo: string;
    inlay: string;
    grass: string;
    street: string;
    streetLo: string;
    /** Painted road markings: only the real square has them */
    streetMark: string | null;
    kerb: string;
    /** Cast shadows multiply the ground by this, and reach this many pixels */
    shadow: number;
    shadowLength: number;
    glass: string;
    glassHi: string;
    glassLo: string;
    lit: string[];
    stone: string;
    stoneHi: string;
    stoneLo: string;
    water: string;
    waterHi: string;
    waterLo: string;
    metal: string;
    metalHi: string;
    lampGlass: string;
    leaf: string;
    leafHi: string;
    leafLo: string;
    flowers: string[];
    b: Record<BuildingId, Building>;
    /** Brings an incidental colour (goods in a window, a poster) into this era's light */
    paint: (hex: string) => string;
    /** When set, the finished picture is snapped to these colours */
    palette?: readonly string[];
}

type Source = Pick<Building, 'wall' | 'trim' | 'roof' | 'awnA' | 'awnB' | 'door' | 'shutter' | 'sign' | 'signInk' | 'neon'>;

const CREAM = '#f7f1dc';
const PINK = '#ff4fa3';
const CYAN = '#3fe0ff';
const AMBER = '#ffd65c';
const LIME = '#5dff9b';
const VIOLET = '#b56bff';

// The square as the Handler first sees it. Every other era is derived from these.
const SOURCE: Record<BuildingId, Source> = {
    grocer: { wall: '#f4e3b4', trim: '#fff8e0', roof: '#cc5a3c', awnA: '#3f9b4f', awnB: CREAM, door: '#7a4a2a', shutter: '#3d7f5a', sign: '#6b4226', signInk: '#ffe9a8', neon: LIME },
    tailor: { wall: '#e39368', trim: '#fbe9cf', roof: '#5f6f9a', awnA: '#c8383c', awnB: CREAM, door: '#3f5c8a', shutter: '#7c3b3b', sign: '#2f4a7a', signInk: '#ffffff', neon: PINK },
    hall: { wall: '#ddd5c0', trim: '#f6f1e2', roof: '#54708a', awnA: '#c33b3b', awnB: '#f2c94c', door: '#5a4636', shutter: '#54708a', sign: '#5a4636', signInk: '#f2c94c', neon: CYAN },
    clocks: { wall: '#a9cde4', trim: '#ffffff', roof: '#b5503a', awnA: '#e0a530', awnB: CREAM, door: '#8a4b2e', shutter: '#2f5f8a', sign: '#2d2d44', signInk: '#ffd66b', neon: AMBER },
    tea: { wall: '#f2c95e', trim: '#fff3cf', roof: '#7d5a8f', awnA: '#7a4fa0', awnB: CREAM, door: '#5a3d6e', shutter: '#a04f6e', sign: '#5a2f4f', signInk: '#ffeef5', neon: VIOLET },
    bookshop: { wall: '#e9c9a0', trim: '#fff3d6', roof: '#b5503a', awnA: '#2f6fa8', awnB: CREAM, door: '#6b4226', shutter: '#2f6fa8', sign: '#6b4226', signInk: '#ffe9a8', neon: CYAN },
    flats: { wall: '#e7d9c2', trim: '#fff8e8', roof: '#62749c', awnA: '#c8383c', awnB: CREAM, door: '#6b4226', shutter: '#3d7f5a', sign: '#6b4226', signInk: '#ffffff', neon: AMBER },
    cinema: { wall: '#d98a8a', trim: '#fff0d8', roof: '#8d4f6c', awnA: '#c8383c', awnB: '#ffe28a', door: '#5a2f3f', shutter: '#8d4f6c', sign: '#5a2f3f', signInk: '#ffe28a', neon: PINK },
    pharmacy: { wall: '#dfeee6', trim: '#ffffff', roof: '#4f8f7c', awnA: '#2f9b62', awnB: CREAM, door: '#2f6b55', shutter: '#2f9b62', sign: '#ffffff', signInk: '#2f9b62', neon: LIME },
    house: { wall: '#e7d9c2', trim: '#fff8e8', roof: '#6a7aa4', awnA: '#3f9b4f', awnB: CREAM, door: '#6b4226', shutter: '#3d7f5a', sign: '#6b4226', signInk: '#ffffff', neon: VIOLET },
    cafe: { wall: '#f4e3b4', trim: '#fff8e0', roof: '#c9573a', awnA: '#c8383c', awnB: CREAM, door: '#6b4226', shutter: '#7c3b3b', sign: '#6b4226', signInk: '#ffffff', neon: PINK },
    bakery: { wall: '#f2c95e', trim: '#fff3cf', roof: '#d08a3c', awnA: '#e0a530', awnB: CREAM, door: '#6b4226', shutter: '#8a4b2e', sign: '#6b4226', signInk: '#ffffff', neon: AMBER },
    cottage: { wall: '#dfeee6', trim: '#ffffff', roof: '#5f8f6c', awnA: '#3f9b4f', awnB: CREAM, door: '#6b4226', shutter: '#3d7f5a', sign: '#6b4226', signInk: '#ffffff', neon: CYAN },
};

const IDS = Object.keys(SOURCE) as BuildingId[];

function buildings(make: (source: Source, index: number) => Source): Record<BuildingId, Building> {
    const out = {} as Record<BuildingId, Building>;
    IDS.forEach((id, index) => {
        const s = make(SOURCE[id], index);
        out[id] = {
            ...s,
            wallHi: tone(s.wall, 1.25),
            wallLo: tone(s.wall, 0.84),
            roofHi: tone(s.roof, 1.22),
            roofLo: tone(s.roof, 0.74),
        };
    });
    return out;
}

function mapColours(source: Source, f: (hex: string, part: keyof Source) => string): Source {
    const out = { ...source };
    for (const part of Object.keys(source) as (keyof Source)[]) {
        out[part] = f(source[part], part);
    }
    return out;
}

const GOLDEN: Look = {
    style: 'goldenAge',
    detail: 4,
    heroic: true,
    outline: '#4a3328',
    deep: '#3a2a2c',
    ground: '#e8d3a2',
    groundAlt: ['#eedaab', '#e2cb98'],
    joint: '#d7be8a',
    worn: '#d6bd88',
    wornLo: '#c4aa74',
    inlay: '#deb486',
    grass: '#86b552',
    street: '#cfb486',
    streetLo: '#bc9f70',
    streetMark: null,
    kerb: '#f4e8c8',
    shadow: 0.78,
    shadowLength: 7,
    glass: '#62b4e6',
    glassHi: '#e2f6ff',
    glassLo: '#3a7fb8',
    lit: [],
    stone: '#d9d2c0',
    stoneHi: '#f4efe0',
    stoneLo: '#a59c88',
    water: '#3fa9e0',
    waterHi: '#bdebff',
    waterLo: '#2579b8',
    metal: '#2f3a4a',
    metalHi: '#62748a',
    lampGlass: '#fff3b8',
    leaf: '#4fa64a',
    leafHi: '#8ad45f',
    leafLo: '#2f7a3f',
    flowers: ['#ff5a6e', '#ffd23f', '#ff8fd0', '#ffffff'],
    b: buildings((s) => s),
    paint: (hex) => hex,
};

// The real square: the same paint, weathered, under an ordinary sky
const natural = (hex: string) => mix(desaturate(hex, 0.42), '#b4b1aa', 0.14);

const PLAIN: Look = {
    style: 'plain',
    detail: 4,
    heroic: false,
    outline: '#4b4a48',
    deep: '#3c3b3a',
    ground: '#c6c3ba',
    groundAlt: ['#cbc8bf', '#c0bdb4'],
    joint: '#b6b3aa',
    worn: '#b9b6ac',
    wornLo: '#a9a69c',
    inlay: '#bcae9f',
    grass: '#8a9c72',
    street: '#7b7c80',
    streetLo: '#707175',
    streetMark: '#e0ded6',
    kerb: '#d9d6cd',
    shadow: 0.9,
    shadowLength: 4,
    glass: '#93a9b6',
    glassHi: '#d5e0e5',
    glassLo: '#657b8c',
    lit: [],
    stone: '#b9b5aa',
    stoneHi: '#d2cec4',
    stoneLo: '#8e8a80',
    water: '#86a4b4',
    waterHi: '#c6d8df',
    waterLo: '#64849a',
    metal: '#3f4a48',
    metalHi: '#70807c',
    lampGlass: '#e8e6da',
    leaf: '#62895a',
    leafHi: '#8aa872',
    leafLo: '#436644',
    flowers: ['#c9707a', '#d9c46a', '#e6e2d8'],
    b: buildings((s) => mapColours(s, natural)),
    paint: natural,
};

const DUSK_WALL = '#2a2350';
const DUSK_ROOF = '#16132c';

const CYBERPUNK: Look = {
    style: 'cyberpunk',
    detail: 3,
    heroic: false,
    outline: '#120f24',
    deep: '#0d0b1c',
    ground: '#453e6e',
    groundAlt: ['#4c4578', '#3f3866'],
    joint: '#3f3866',
    worn: '#2d2955',
    wornLo: '#7a76b8',
    inlay: '#4c4578',
    grass: '#453e6e',
    street: '#352f58',
    streetLo: '#2c274c',
    streetMark: null,
    kerb: '#5a5390',
    shadow: 1,
    shadowLength: 0,
    glass: '#1c1838',
    glassHi: '#3a3468',
    glassLo: '#120f24',
    lit: [AMBER, PINK, CYAN],
    stone: '#57518a',
    stoneHi: '#7570ac',
    stoneLo: '#322d58',
    water: '#1f4a78',
    waterHi: CYAN,
    waterLo: '#16305a',
    metal: '#1c1838',
    metalHi: '#5a5390',
    lampGlass: '#bff6ff',
    leaf: '#2c5a5e',
    leafHi: '#3f7a78',
    leafLo: '#1d3a48',
    flowers: [],
    b: buildings((s) =>
        mapColours(s, (hex, part) => {
            if (part === 'neon') {
                return hex;
            }
            if (part === 'roof') {
                return mix(hex, DUSK_ROOF, 0.82);
            }
            if (part === 'wall' || part === 'trim') {
                return mix(hex, DUSK_WALL, part === 'wall' ? 0.74 : 0.6);
            }
            return mix(hex, DUSK_ROOF, 0.6);
        }),
    ),
    paint: (hex) => mix(hex, DUSK_WALL, 0.6),
};

// Five tones and a rust, like a handheld with a tired screen
const R = ['#191d19', '#2c332c', '#4a5345', '#69735c', '#8b9377', '#5f4a3c'] as const;

const RETRO: Look = {
    style: 'retro',
    detail: 2,
    heroic: false,
    outline: R[0],
    deep: R[0],
    ground: R[2],
    groundAlt: [R[2], R[2]],
    joint: R[1],
    worn: R[1],
    wornLo: R[1],
    inlay: R[2],
    grass: R[2],
    street: R[1],
    streetLo: R[1],
    streetMark: null,
    kerb: R[3],
    shadow: 1,
    shadowLength: 0,
    glass: R[0],
    glassHi: R[0],
    glassLo: R[0],
    lit: [],
    stone: R[3],
    stoneHi: R[4],
    stoneLo: R[1],
    water: R[1],
    waterHi: R[3],
    waterLo: R[0],
    metal: R[0],
    metalHi: R[0],
    lampGlass: R[4],
    leaf: R[1],
    leafHi: R[1],
    leafLo: R[0],
    flowers: [],
    b: buildings((s, index) => ({
        ...s,
        wall: index % 2 ? R[3] : R[4],
        trim: R[4],
        roof: index % 3 === 1 ? R[1] : R[5],
        door: R[0],
        awnA: R[1],
        awnB: R[1],
    })),
    paint: (hex) => hex,
    palette: R,
};

export const INK = '#141414';
export const PAPER = '#f2f2ee';

const MANGA: Look = {
    ...RETRO,
    style: 'manga',
    detail: 1,
    outline: INK,
    deep: INK,
    ground: PAPER,
    b: buildings((s) => mapColours(s, () => PAPER)),
    palette: undefined,
};

export const LOOKS: Record<ArtStyle, Look> = {
    goldenAge: GOLDEN,
    cyberpunk: CYBERPUNK,
    retro: RETRO,
    manga: MANGA,
    plain: PLAIN,
};
