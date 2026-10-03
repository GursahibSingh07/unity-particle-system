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
    noir: { band: 0x121218, title: 0xf5f5f7, titleStroke: 0x000000, accent: 0x8f909a, floor: 0x2b2d37, wall: 0x8f909a },
    manga: { band: 0xffffff, title: 0x000000, titleStroke: 0xffffff, accent: 0xa8a8a8, floor: 0xa8a8a8, wall: 0xffffff },
    plain: { band: 0xd9d4c4, title: 0x4a4540, titleStroke: 0xf7f4ea, accent: 0x7d99b8, floor: 0xd9d4c4, wall: 0xc49a84 },
    finalPage: { band: 0x4b2580, title: YELLOW, titleStroke: INK, accent: RED, floor: 0x2a2140, wall: 0x8a4cc4 },
};

/** The palette a level's sprites are baked in (the boss page borrows the Golden Age one) */
export const artStyleOf = (style: StyleId): ArtStyle => (style === 'finalPage' ? 'goldenAge' : style);

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
        fontSize: `${size}px`,
        fontStyle: options.bold ? 'bold' : 'normal',
        color: hex(options.color ?? INK),
        align: options.align ?? 'left',
    };
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
    const text = scene.add.text(x, y, content, style);
    if (options.lineSpacing) {
        text.setLineSpacing(options.lineSpacing);
    }
    return text;
}
