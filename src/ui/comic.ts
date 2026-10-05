import '@fontsource/bangers/400.css';
import '@fontsource/comic-neue/400.css';
import '@fontsource/comic-neue/700.css';
import Phaser from 'phaser';
import { burst, burstPoints } from './draw';
import { hex } from './theme';

// The pause book's own look: a comic printed in four process colours on newsprint. Nothing here
// is used by the HUD or the cover, which keep the pixel lettering of the game itself.

export const DISPLAY = '"Bangers", "Comic Neue", sans-serif';
export const BODY = '"Comic Neue", sans-serif';

// Canvas text is drawn once, so every weight has to be ready before the book is first opened.
// A font that fails to load must not stop the game: the browser's fallback is used instead.
await Promise.all(
    ['400 30px "Bangers"', '400 20px "Comic Neue"', '700 20px "Comic Neue"'].map((font) => document.fonts.load(font).catch(() => undefined)),
);

/** Key black: every outline, and all lettering */
export const KEY = 0x1d191c;
export const CYAN = 0x00aeef;
export const MAGENTA = 0xec008c;
export const PROCESS_YELLOW = 0xffec00;
/** Magenta deep enough to letter with on newsprint */
export const MAGENTA_INK = 0xb8006c;
export const NEWSPRINT = 0xe7dfca;
export const NEWSPRINT_LIGHT = 0xf5efdf;
export const NEWSPRINT_DARK = 0xcdc2a4;
/** Non-photo blue: the pencil a page is laid out in before it is inked */
export const PENCIL_BLUE = 0x6fb1dc;
export const DESK = 0x0e1a26;

/** The open book: two pages either side of a spine */
export const BOOK = { spine: 640, top: 44, pageWidth: 590, pageHeight: 636 } as const;

export const PAPER_LEFT = 'book-paper-left';
export const PAPER_RIGHT = 'book-paper-right';
const DOTS = 'book-dots';
const DOT_TILE = 16;

export interface ComicTextOptions {
    /** Bangers, for headings and stamps; otherwise Comic Neue */
    display?: boolean;
    bold?: boolean;
    color?: number;
    stroke?: number;
    strokeThickness?: number;
    /** Hard offset shadow in pixels */
    drop?: number;
    dropColor?: number;
    wrap?: number;
    align?: 'left' | 'center' | 'right';
    lineSpacing?: number;
}

/** Lettering for the book. Unlike makeText, sizes are free: these fonts are not drawn on a grid. */
export function comicText(scene: Phaser.Scene, x: number, y: number, content: string, size: number, options: ComicTextOptions = {}) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: options.display ? DISPLAY : BODY,
        fontSize: `${size}px`,
        fontStyle: options.bold && !options.display ? 'bold' : 'normal',
        color: hex(options.color ?? KEY),
        align: options.align ?? 'left',
        // Bangers leans: without room at the sides its last letter is cut off
        padding: options.display ? { left: 3, right: 5, top: 2, bottom: 2 } : { left: 1, right: 1, top: 1, bottom: 1 },
        resolution: 2,
    };
    if (options.stroke !== undefined) {
        style.stroke = hex(options.stroke);
        style.strokeThickness = options.strokeThickness ?? Math.max(4, Math.round(size / 7));
    }
    if (options.drop) {
        style.shadow = { offsetX: options.drop, offsetY: options.drop, color: hex(options.dropColor ?? KEY), blur: 0, stroke: true, fill: true };
    }
    if (options.wrap) {
        style.wordWrap = { width: options.wrap, useAdvancedWrap: true };
    }
    const text = scene.add.text(x, y, content, style);
    text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (options.lineSpacing) {
        text.setLineSpacing(options.lineSpacing);
    }
    return text;
}

/** Makes `text` no wider than `width` by squeezing it, the way a letterer condenses a long word */
export function fitWidth(text: Phaser.GameObjects.Text, width: number) {
    if (text.width > width) {
        text.setScale(width / text.width);
    }
    return text;
}

/**
 * A heading printed out of register: the cyan and magenta plates have slipped a little from
 * the key. Returns the three layers, back to front.
 */
export function headline(scene: Phaser.Scene, x: number, y: number, content: string, size: number, originX = 0, originY = 0, maxWidth = 0) {
    const slip = Math.max(2, Math.round(size / 16));
    const layers = [
        comicText(scene, x - slip, y + 1, content, size, { display: true, color: CYAN }),
        comicText(scene, x + slip, y + slip, content, size, { display: true, color: MAGENTA }),
        comicText(scene, x, y, content, size, { display: true, color: KEY }),
    ];
    for (const layer of layers) {
        layer.setOrigin(originX, originY);
        if (maxWidth > 0) {
            fitWidth(layer, maxWidth);
        }
    }
    return layers;
}

/** A caption box: flat colour, key outline, hard key shadow */
export function captionBox(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, fill = PROCESS_YELLOW, shadow = 4, border = 3) {
    if (shadow > 0) {
        g.fillStyle(KEY, 1).fillRect(x + shadow, y + shadow, width, height);
    }
    g.fillStyle(KEY, 1).fillRect(x, y, width, height);
    g.fillStyle(fill, 1).fillRect(x + border, y + border, width - border * 2, height - border * 2);
}

/** A field of Ben-Day dots in one ink */
export function dots(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color: number, alpha = 1, scale = 1) {
    return scene.add.tileSprite(x, y, width / scale, height / scale, DOTS).setOrigin(0).setScale(scale).setTint(color).setAlpha(alpha);
}

export interface StickerOptions {
    fill?: number;
    color?: number;
    angle?: number;
    spikes?: number;
    /** Width of the burst as a multiple of its height */
    stretch?: number;
    stroke?: number;
}

/** A tilted burst with a word on it, the kind stuck on a cover to shout something */
export function sticker(scene: Phaser.Scene, x: number, y: number, content: string, size: number, radius: number, options: StickerOptions = {}) {
    const g = scene.add.graphics();
    const stretch = options.stretch ?? 1.5;
    const spikes = options.spikes ?? 12;
    burst(g, burstPoints(3, 4, radius, radius * 0.74, spikes, 0.16, 7, stretch), KEY, KEY, 0);
    burst(g, burstPoints(0, 0, radius, radius * 0.74, spikes, 0.16, 7, stretch), options.fill ?? PROCESS_YELLOW, KEY, 3);
    const text = comicText(scene, 0, 0, content, size, {
        display: true,
        color: options.color ?? KEY,
        align: 'center',
        stroke: options.stroke,
        strokeThickness: options.stroke !== undefined ? 4 : undefined,
    }).setOrigin(0.5);
    return scene.add.container(x, y, [g, text]).setAngle(options.angle ?? -8);
}

/** A rubber stamp: a word in a double frame, struck at an angle */
export function stamp(scene: Phaser.Scene, x: number, y: number, content: string, size: number, color = MAGENTA, angle = -9) {
    const text = comicText(scene, 0, 0, content, size, { display: true, color }).setOrigin(0.5);
    const width = Math.ceil(text.width) + 14;
    const height = size + 12;
    const g = scene.add.graphics();
    g.fillStyle(NEWSPRINT_LIGHT, 0.92).fillRect(-width / 2, -height / 2, width, height);
    g.lineStyle(3, color, 1).strokeRect(-width / 2, -height / 2, width, height);
    g.lineStyle(1.5, color, 1).strokeRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10);
    return scene.add.container(x, y, [g, text]).setAngle(angle);
}

/** A row of key caps starting at `x`; returns the objects and the x after the last cap */
export function comicKeys(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, labels: readonly string[], x: number, cy: number, size = 17) {
    const texts: Phaser.GameObjects.Text[] = [];
    const height = size + 12;
    const top = Math.round(cy - height / 2);
    let at = Math.round(x);
    for (const label of labels) {
        const text = comicText(scene, 0, cy, label, size, { bold: true }).setOrigin(0.5);
        const width = Math.max(height, Math.ceil(text.width) + 12);
        g.fillStyle(KEY, 1).fillRect(at, top + 3, width, height);
        g.fillStyle(KEY, 1).fillRect(at, top, width, height);
        g.fillStyle(NEWSPRINT_LIGHT, 1).fillRect(at + 2, top + 2, width - 4, height - 4);
        text.setX(at + width / 2);
        texts.push(text);
        at += width + 5;
    }
    return { texts, end: at - 5 };
}

/** Small and seeded, so the paper looks the same every time the book is opened */
function seeded(seed: number) {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function bakePaper(scene: Phaser.Scene, key: string, side: 'left' | 'right') {
    const { pageWidth: width, pageHeight: height } = BOOK;
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture) {
        return;
    }
    const ctx = texture.getContext();
    ctx.fillStyle = hex(NEWSPRINT);
    ctx.fillRect(0, 0, width, height);

    // Pulp: flecks and short fibres, lighter and darker than the sheet
    const random = seeded(side === 'left' ? 11 : 29);
    for (let i = 0; i < 2600; i++) {
        const dark = random() < 0.6;
        ctx.fillStyle = dark ? `rgba(120, 96, 52, ${0.04 + random() * 0.07})` : `rgba(255, 252, 240, ${0.08 + random() * 0.1})`;
        ctx.fillRect(random() * width, random() * height, 1 + random() * 2.5, 1 + random() * 1.5);
    }

    const fade = (x0: number, y0: number, x1: number, y1: number, from: string, to: string) => {
        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
        gradient.addColorStop(0, from);
        gradient.addColorStop(1, to);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    };
    // The edges have yellowed with age
    const aged = 'rgba(166, 118, 36, 0.3)';
    const clear = 'rgba(166, 118, 36, 0)';
    fade(0, 0, 0, 34, aged, clear);
    fade(0, height, 0, height - 34, aged, clear);
    if (side === 'left') {
        fade(0, 0, 54, 0, aged, clear);
        // The page dips into the spine
        fade(width, 0, width - 56, 0, 'rgba(60, 40, 30, 0.3)', 'rgba(60, 40, 30, 0)');
        fade(width, 0, width - 12, 0, 'rgba(30, 20, 24, 0.4)', 'rgba(30, 20, 24, 0)');
    } else {
        fade(width, 0, width - 54, 0, aged, clear);
        fade(0, 0, 56, 0, 'rgba(60, 40, 30, 0.3)', 'rgba(60, 40, 30, 0)');
        fade(0, 0, 12, 0, 'rgba(30, 20, 24, 0.4)', 'rgba(30, 20, 24, 0)');
    }
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Bakes the paper and the dot screen once; safe to call every time the book opens */
export function bakeBookTextures(scene: Phaser.Scene) {
    if (!scene.textures.exists(PAPER_LEFT)) {
        bakePaper(scene, PAPER_LEFT, 'left');
    }
    if (!scene.textures.exists(PAPER_RIGHT)) {
        bakePaper(scene, PAPER_RIGHT, 'right');
    }
    if (!scene.textures.exists(DOTS)) {
        const texture = scene.textures.createCanvas(DOTS, DOT_TILE, DOT_TILE);
        if (texture) {
            const ctx = texture.getContext();
            ctx.fillStyle = '#ffffff';
            // Two dots to a tile, the second half a step along: a 45 degree screen
            for (const [cx, cy] of [[4, 4], [12, 12]]) {
                ctx.beginPath();
                ctx.arc(cx, cy, 2.7, 0, Math.PI * 2);
                ctx.fill();
            }
            texture.refresh();
            texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
    }
}
