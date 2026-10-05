import '@fontsource/pixelify-sans/700.css';
import Phaser from 'phaser';
import type { ArtStyle, StyleId } from '../types';

export const FONT = '"Pixelify Sans", sans-serif';

// Canvas text is drawn once, so the bold weight has to be ready before any scene creates text
// (main.ts waits for the regular weight the same way)
await document.fonts.load('700 30px "Pixelify Sans"');

// The interface's own palette: the four-colour print of the Golden Age level, which reads
// over every room style because it is always laid on paper or ink, never on the room itself.
export const INK = 0x1b1626;
export const PAPER = 0xfbf3dc;
export const PAPER_SHADE = 0xe6d9b4;
export const RED = 0xe8332c;
export const RED_DARK = 0xa01c28;
export const YELLOW = 0xffd640;
export const ORANGE = 0xf08c1e;
export const BLUE = 0x2b63d9;
export const GREY = 0x9b98a8;
export const PENCIL = 0xb9ae90;
export const WHITE = 0xffffff;

export const SCREEN_WIDTH = 1280;
export const SCREEN_HEIGHT = 720;
export const HUD_STRIP = 80;

/** Layers of the UI scene, back to front */
export const Depth = {
    hud: 0,
    words: 10,
    banner: 20,
    toast: 30,
    caption: 40,
    card: 50,
    pause: 60,
} as const;

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export interface StyleTheme {
    /** Flat fill of a splash band or an inked panel */
    band: number;
    /** Lettering on the band */
    title: number;
    /** Outline of that lettering */
    titleStroke: number;
    accent: number;
    /** Page-map panel colours */
    floor: number;
    wall: number;
}

export const STYLE_THEME: Record<StyleId, StyleTheme> = {
    goldenAge: { band: YELLOW, title: RED, titleStroke: INK, accent: BLUE, floor: 0xf0e2b0, wall: 0x3f6fd8 },
    cyberpunk: { band: 0x1a1030, title: 0xff5ad1, titleStroke: 0x000000, accent: 0x3de0ff, floor: 0x2a2140, wall: 0x8a4cc4 },
    retro: { band: 0x2a2622, title: 0xd8c79a, titleStroke: 0x000000, accent: 0x7a7060, floor: 0x4a443c, wall: 0x7a7060 },
    manga: { band: 0xffffff, title: 0x000000, titleStroke: 0xffffff, accent: 0xa8a8a8, floor: 0xa8a8a8, wall: 0xffffff },
    plain: { band: 0xd9d4c4, title: 0x4a4540, titleStroke: 0xf7f4ea, accent: 0x7d99b8, floor: 0xd9d4c4, wall: 0xc49a84 },
    finalPage: { band: 0x4b2580, title: YELLOW, titleStroke: INK, accent: RED, floor: 0x2a2140, wall: 0x8a4cc4 },
};

/** The palette a level's sprites are baked in (the boss page opens in the Golden Age one) */
export const artStyleOf = (style: StyleId): ArtStyle => (style === 'finalPage' ? 'goldenAge' : style);

/** Blend two colours: 0 gives `a`, 1 gives `b` */
export function mix(a: number, b: number, t: number) {
    const channel = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) << shift;
    return channel(16) | channel(8) | channel(0);
}

/**
 * The HUD strip drains with the eras: fewer colours for Retro, black and white for Manga. The
 * colour wheel never does, because its colours are information.
 */
export interface StripTheme {
    paper: number;
    dots: number;
    /** A filled health block: face, underside, top light */
    health: number;
    healthDark: number;
    healthLight: number;
    /** An empty health block */
    well: number;
    wellShade: number;
    /** The current era's pip and the timer box */
    accent: number;
}

const GOLDEN_STRIP: StripTheme = {
    paper: PAPER,
    dots: PAPER_SHADE,
    health: RED,
    healthDark: RED_DARK,
    healthLight: 0xff8a78,
    well: 0x3d3852,
    wellShade: 0x2a2540,
    accent: YELLOW,
};

export const STRIP_THEME: Record<StyleId, StripTheme> = {
    goldenAge: GOLDEN_STRIP,
    cyberpunk: { ...GOLDEN_STRIP, paper: 0xe9def0, dots: 0xc7b0e2, health: 0xe83372, healthDark: 0x9c1c58, healthLight: 0xff8ab4, accent: 0x6fe6ff },
    retro: { ...GOLDEN_STRIP, paper: 0xcdc6b2, dots: 0xa9a28e, health: 0xb5463c, healthDark: 0x7a2c2a, healthLight: 0xd98a78, accent: 0xd8c79a },
    manga: { paper: 0xffffff, dots: 0xbdbdbd, health: 0x17141f, healthDark: 0x000000, healthLight: 0x77747f, well: 0xffffff, wellShade: 0xd5d5d5, accent: 0xffffff },
    plain: { ...GOLDEN_STRIP, paper: 0xf2efe6, dots: 0xdcd8cc },
    finalPage: GOLDEN_STRIP,
};

export interface TextOptions {
    color?: number;
    bold?: boolean;
    stroke?: number;
    strokeThickness?: number;
    /** Hard-edged offset shadow in pixels, the way comic lettering is dropped */
    drop?: number;
    dropColor?: number;
    wrap?: number;
    align?: 'left' | 'center' | 'right';
    lineSpacing?: number;
}

/**
 * Pixelify Sans is drawn on a grid of 10 pixels to the em. Text is rendered at twice its size,
 * so any multiple of 5 puts every font pixel on a whole number of texture pixels.
 */
const gridSize = (size: number) => Math.max(10, Math.round(size / 5) * 5);

export function makeText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    content: string,
    size: number,
    options: TextOptions = {},
): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: FONT,
        fontSize: `${gridSize(size)}px`,
        // The bold weight is not drawn on the font's pixel grid, so its letters smear and close up
        fontStyle: 'normal',
        color: hex(options.color ?? INK),
        align: options.align ?? 'left',
    };
    if (options.bold && options.stroke === undefined && size >= 20) {
        // Emphasis without the off-grid bold weight: a hair of outline in the text's own colour
        style.stroke = hex(options.color ?? INK);
        style.strokeThickness = 1;
    }
    if (options.stroke !== undefined) {
        style.stroke = hex(options.stroke);
        style.strokeThickness = options.strokeThickness ?? Math.max(4, Math.round(size / 8));
    }
    if (options.drop) {
        style.shadow = {
            offsetX: options.drop,
            offsetY: options.drop,
            color: hex(options.dropColor ?? INK),
            blur: 0,
            stroke: true,
            fill: true,
        };
    }
    if (options.wrap) {
        style.wordWrap = { width: options.wrap, useAdvancedWrap: true };
    }
    // DIRECTOR: drawn at twice the size and smoothed back down, at sizes that land on the font's
    // own pixel grid (see gridSize). Otherwise letters like "c" close up into "o".
    style.resolution = 2;
    const text = scene.add.text(x, y, content, style);
    text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (options.lineSpacing) {
        text.setLineSpacing(options.lineSpacing);
    }
    return text;
}
