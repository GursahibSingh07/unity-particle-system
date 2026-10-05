import Phaser from 'phaser';
import { CONTROLS } from './labels';
import { INK, PAPER, makeText } from './theme';

type Graphics = Phaser.GameObjects.Graphics;

/** A box with an ink border and a hard offset shadow: the basic comic caption shape */
export function panel(
    g: Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: number,
    border = 4,
    shadow = 6,
    borderColor = INK,
) {
    if (shadow > 0) {
        g.fillStyle(INK, 1).fillRect(x + shadow, y + shadow, width, height);
    }
    g.fillStyle(borderColor, 1).fillRect(x, y, width, height);
    g.fillStyle(fill, 1).fillRect(x + border, y + border, width - border * 2, height - border * 2);
}

/** A spiky comic burst. `wobble` (0 to 1) makes the spikes uneven, seeded so it does not flicker. */
export function burstPoints(
    cx: number,
    cy: number,
    outer: number,
    inner: number,
    spikes: number,
    wobble = 0,
    seed = 1,
    stretchX = 1,
): Phaser.Math.Vector2[] {
    const random = new Phaser.Math.RandomDataGenerator([String(seed)]);
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const base = i % 2 === 0 ? outer : inner;
        const radius = base * (1 + (random.frac() - 0.5) * wobble);
        points.push(new Phaser.Math.Vector2(cx + Math.cos(angle) * radius * stretchX, cy + Math.sin(angle) * radius));
    }
    return points;
}

export function burst(g: Graphics, points: Phaser.Math.Vector2[], fill: number, outline = INK, outlineWidth = 4) {
    g.fillStyle(fill, 1).fillPoints(points, true);
    if (outlineWidth > 0) {
        g.lineStyle(outlineWidth, outline, 1).strokePoints(points, true, true);
    }
}

/** Alternating wedges fanning out from a point, like a cover's sunburst */
export function rays(g: Graphics, cx: number, cy: number, radius: number, count: number, color: number, alpha = 1) {
    const step = (Math.PI * 2) / count;
    g.fillStyle(color, alpha);
    for (let i = 0; i < count; i += 2) {
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, radius, i * step, (i + 1) * step);
        g.closePath();
        g.fillPath();
    }
}

/** Print dots that grow from nothing at one edge to `maxRadius` at the other */
export function halftoneFade(
    g: Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    pitch: number,
    maxRadius: number,
    direction: 'down' | 'up' | 'right' | 'left',
    alpha = 1,
) {
    g.fillStyle(color, alpha);
    const rows = Math.ceil(height / pitch);
    const columns = Math.ceil(width / pitch);
    for (let row = 0; row <= rows; row++) {
        for (let column = 0; column <= columns; column++) {
            const along =
                direction === 'down'
                    ? row / rows
                    : direction === 'up'
                      ? 1 - row / rows
                      : direction === 'right'
                        ? column / columns
                        : 1 - column / columns;
            const radius = maxRadius * along;
            if (radius < 0.6) {
                continue;
            }
            // Every other row is shifted half a step, as on a real halftone screen
            const dx = row % 2 === 0 ? 0 : pitch / 2;
            g.fillCircle(x + column * pitch + dx, y + row * pitch, radius);
        }
    }
}

/** A dashed rectangle outline: an empty panel still in pencil */
export function dashedRect(g: Graphics, x: number, y: number, width: number, height: number, color: number, dash = 10, thickness = 3) {
    g.fillStyle(color, 1);
    for (let dx = 0; dx < width; dx += dash * 2) {
        const length = Math.min(dash, width - dx);
        g.fillRect(x + dx, y, length, thickness);
        g.fillRect(x + dx, y + height - thickness, length, thickness);
    }
    for (let dy = 0; dy < height; dy += dash * 2) {
        const length = Math.min(dash, height - dy);
        g.fillRect(x, y + dy, thickness, length);
        g.fillRect(x + width - thickness, y + dy, thickness, length);
    }
}

/** A caption plate that holds on any background: a paper keyline, an ink edge, then the fill */
export function plate(g: Graphics, x: number, y: number, width: number, height: number, fill: number, keyline = PAPER) {
    g.fillStyle(keyline, 1).fillRect(x - 2, y - 2, width + 4, height + 4);
    g.fillStyle(INK, 1).fillRect(x, y, width, height);
    g.fillStyle(fill, 1).fillRect(x + 3, y + 3, width - 6, height - 6);
}

/**
 * One key cap centred on a point, drawn into `g`. Returns its lettering (to go in the same
 * container as `g`, above it) and the cap's size.
 */
export function keyCap(scene: Phaser.Scene, g: Graphics, label: string, cx: number, cy: number, size = 15, fill = PAPER) {
    const text = makeText(scene, cx, cy, label, size, { bold: true, color: INK }).setOrigin(0.5);
    const height = size + 11;
    const width = Math.max(height, Math.ceil(text.width) + 12);
    const left = Math.round(cx - width / 2);
    const top = Math.round(cy - height / 2);
    g.fillStyle(INK, 1).fillRect(left, top + 3, width, height);
    g.fillStyle(INK, 1).fillRect(left, top, width, height);
    g.fillStyle(fill, 1).fillRect(left + 2, top + 2, width - 4, height - 4);
    return { text, width, height };
}

/**
 * The controls as a row of key caps, centred on `cx`. Returns the objects so the caller can
 * put them in its own container. The lettering steps down a size until the row fits `maxWidth`.
 */
export function controlsRow(
    scene: Phaser.Scene,
    cx: number,
    y: number,
    size: number,
    textColor = INK,
    capFill = PAPER,
    maxWidth = 1160,
): Phaser.GameObjects.GameObject[] {
    // Made first, so the caps lie under their lettering wherever the row is not in a container
    const g = scene.add.graphics();
    const capHeight = size + 12;
    const gap = Math.round(size * 1.4);

    // Lay everything out from zero first, then shift it so the row is centred
    const placed: { text: Phaser.GameObjects.Text; x: number; cap: number; digit?: string }[] = [];
    let x = 0;
    for (const control of CONTROLS) {
        for (const key of control.keys) {
            const text = makeText(scene, 0, 0, key, size, { bold: true, color: INK });
            const cap = Math.max(capHeight, Math.ceil(text.width) + 14);
            placed.push({ text, x, cap, digit: isPixelNumber(key) ? key : undefined });
            x += cap + 4;
        }
        const action = makeText(scene, 0, 0, control.action, size + 2, { color: textColor });
        placed.push({ text: action, x: x + 4, cap: 0 });
        x += 4 + Math.ceil(action.width) + gap;
    }
    if (x - gap > maxWidth && size > 11) {
        for (const item of placed) {
            item.text.destroy();
        }
        g.destroy();
        return controlsRow(scene, cx, y + 1, size - 1, textColor, capFill, maxWidth);
    }
    const left = Math.round(cx - (x - gap) / 2);

    const objects: Phaser.GameObjects.GameObject[] = [g];
    for (const item of placed) {
        if (item.cap > 0) {
            g.fillStyle(INK, 1).fillRect(left + item.x, y + 3, item.cap, capHeight);
            g.fillStyle(INK, 1).fillRect(left + item.x, y, item.cap, capHeight);
            g.fillStyle(capFill, 1).fillRect(left + item.x + 2, y + 2, item.cap - 4, capHeight - 4);
            item.text.setOrigin(0.5).setPosition(left + item.x + item.cap / 2, y + capHeight / 2);
            if (item.digit) {
                item.text.setVisible(false);
                pixelNumber(g, item.digit, left + item.x + item.cap / 2, y + capHeight / 2, 2, INK);
            }
        } else {
            item.text.setOrigin(0, 0.5).setPosition(left + item.x, y + capHeight / 2 + 1);
        }
        objects.push(item.text);
    }
    return objects;
}

// The font's 2 and 5 are easy to misread at small sizes, and key numbers must not be:
// wherever a number is an instruction or a count, it is drawn from these instead.
const DIGITS: Record<string, string[]> = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
    ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
};
const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;

export const isPixelNumber = (text: string) => text.length > 0 && [...text].every((char) => DIGITS[char]);

/** Width of `text` drawn by pixelNumber at `px` screen pixels per dot */
export const pixelNumberWidth = (text: string, px: number) => text.length * (GLYPH_WIDTH + 1) * px - px;

/**
 * Draws digits (and "/") centred on a point, `px` screen pixels per dot. With `outline`, the
 * number gets an ink edge one dot thick, like the stroked lettering around it.
 */
export function pixelNumber(g: Graphics, text: string, cx: number, cy: number, px: number, color: number, outline?: number) {
    const left = Math.round(cx - pixelNumberWidth(text, px) / 2);
    const top = Math.round(cy - (GLYPH_HEIGHT * px) / 2);
    const pass = (dx: number, dy: number, fill: number) => {
        g.fillStyle(fill, 1);
        [...text].forEach((char, index) => {
            const glyph = DIGITS[char];
            if (!glyph) {
                return;
            }
            const x = left + index * (GLYPH_WIDTH + 1) * px + dx;
            glyph.forEach((row, rowIndex) => {
                for (let column = 0; column < GLYPH_WIDTH; column++) {
                    if (row[column] === '1') {
                        g.fillRect(x + column * px, top + rowIndex * px + dy, px, px);
                    }
                }
            });
        });
    };
    if (outline !== undefined) {
        const around = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [2, 2], [1, 2], [2, 1]];
        for (const [dx, dy] of around) {
            pass(dx * px, dy * px, outline);
        }
    }
    pass(0, 0, color);
}
