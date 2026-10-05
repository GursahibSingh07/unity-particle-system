// A small pixel-drawing toolkit for the city pictures. Everything lands on whole pixels in a
// plain RGBA buffer, so nothing is ever anti-aliased and every boot draws the same picture.

type Rgb = [number, number, number];

const parsed = new Map<string, Rgb>();

export function rgb(hex: string): Rgb {
    let value = parsed.get(hex);
    if (!value) {
        const n = parseInt(hex.slice(1), 16);
        value = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        parsed.set(hex, value);
    }
    return value;
}

function toHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + ((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1);
}

/** `t` of the way from `a` to `b` */
export function mix(a: string, b: string, t: number): string {
    const [ar, ag, ab] = rgb(a);
    const [br, bg, bb] = rgb(b);
    return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Below 1 darkens, above 1 lightens towards white */
export function tone(hex: string, k: number): string {
    return k <= 1 ? mix('#000000', hex, k) : mix(hex, '#ffffff', Math.min(1, k - 1));
}

/** Pulls a colour towards its own grey: `keep` 1 leaves it alone, 0 is fully grey */
export function desaturate(hex: string, keep: number): string {
    const [r, g, b] = rgb(hex);
    const grey = r * 0.3 + g * 0.59 + b * 0.11;
    return mix(toHex(grey, grey, grey), hex, keep);
}

/** A fixed pseudo-random number in 0..1 for a pixel or cell: the same on every boot */
export function hash(x: number, y: number, seed = 0): number {
    let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return ((n >>> 0) % 10000) / 10000;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in 0..1 for a pixel */
export function bayer(x: number, y: number): number {
    return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

export type Test = (x: number, y: number) => boolean;

export function inEllipse(cx: number, cy: number, rx: number, ry: number): Test {
    return (x, y) => {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        return dx * dx + dy * dy <= 1;
    };
}

// 3x5 capitals, one string of 15 cells per letter, rows top to bottom
const FONT: Record<string, string> = {
    A: '010101111101101',
    B: '110101110101110',
    C: '011100100100011',
    D: '110101101101110',
    E: '111100110100111',
    F: '111100110100100',
    G: '011100101101011',
    H: '101101111101101',
    I: '111010010010111',
    K: '101101110101101',
    L: '100100100100111',
    M: '101111111101101',
    N: '110101101101101',
    O: '010101101101010',
    P: '110101110100100',
    R: '110101110101101',
    S: '011100010001110',
    T: '111010010010010',
    U: '101101101101111',
    Y: '101101010010010',
};

export function textWidth(text: string): number {
    return text.length * 4 - 1;
}

export class Pix {
    readonly data: Uint8ClampedArray;

    constructor(
        readonly width: number,
        readonly height: number,
    ) {
        this.data = new Uint8ClampedArray(width * height * 4);
    }

    px(x: number, y: number, colour: string, alpha = 1): void {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return;
        }
        const i = (y * this.width + x) * 4;
        const [r, g, b] = rgb(colour);
        const d = this.data;
        if (alpha >= 1 || d[i + 3] === 0) {
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = alpha >= 1 ? 255 : Math.round(alpha * 255);
            return;
        }
        d[i] += (r - d[i]) * alpha;
        d[i + 1] += (g - d[i + 1]) * alpha;
        d[i + 2] += (b - d[i + 2]) * alpha;
    }

    /** A filled rectangle; with `test`, only the pixels that pass */
    rect(x: number, y: number, w: number, h: number, colour: string, test?: Test): void {
        for (let j = y; j < y + h; j++) {
            for (let i = x; i < x + w; i++) {
                if (!test || test(i, j)) {
                    this.px(i, j, colour);
                }
            }
        }
    }

    hline(x: number, y: number, length: number, colour: string): void {
        this.rect(x, y, length, 1, colour);
    }

    vline(x: number, y: number, length: number, colour: string): void {
        this.rect(x, y, 1, length, colour);
    }

    /** A one-pixel rectangle outline */
    frame(x: number, y: number, w: number, h: number, colour: string): void {
        this.hline(x, y, w, colour);
        this.hline(x, y + h - 1, w, colour);
        this.vline(x, y, h, colour);
        this.vline(x + w - 1, y, h, colour);
    }

    line(x0: number, y0: number, x1: number, y1: number, colour: string, alpha = 1): void {
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let error = dx + dy;
        for (;;) {
            this.px(x0, y0, colour, alpha);
            if (x0 === x1 && y0 === y1) {
                return;
            }
            const twice = error * 2;
            if (twice >= dy) {
                error += dy;
                x0 += sx;
            }
            if (twice <= dx) {
                error += dx;
                y0 += sy;
            }
        }
    }

    ellipse(cx: number, cy: number, rx: number, ry: number, colour: string, test?: Test): void {
        const inside = inEllipse(cx, cy, rx, ry);
        this.rect(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(rx * 2) + 1, Math.ceil(ry * 2) + 1, colour, (x, y) =>
            inside(x, y) && (!test || test(x, y)),
        );
    }

    /** The outline of an ellipse, `thick` pixels wide, drawn inwards */
    ring(cx: number, cy: number, rx: number, ry: number, colour: string, thick = 1, test?: Test): void {
        const inner = inEllipse(cx, cy, rx - thick, ry - thick);
        this.ellipse(cx, cy, rx, ry, colour, (x, y) => !inner(x, y) && (!test || test(x, y)));
    }

    /** Multiplies what is already there: a cast shadow. Leaves transparent pixels alone. */
    shade(x: number, y: number, w: number, h: number, k: number, test?: Test): void {
        for (let j = Math.max(0, y); j < Math.min(this.height, y + h); j++) {
            for (let i = Math.max(0, x); i < Math.min(this.width, x + w); i++) {
                const at = (j * this.width + i) * 4;
                if (this.data[at + 3] === 0 || (test && !test(i, j))) {
                    continue;
                }
                this.data[at] *= k;
                this.data[at + 1] *= k;
                this.data[at + 2] *= k;
            }
        }
    }

    /**
     * A pool of coloured light, banded and dithered rather than smooth: full `strength` at the
     * centre, nothing at the edge of the ellipse.
     */
    glow(cx: number, cy: number, rx: number, ry: number, colour: string, strength: number, test?: Test): void {
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
            for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
                if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
                    continue;
                }
                if (this.data[(y * this.width + x) * 4 + 3] === 0 || (test && !test(x, y))) {
                    continue;
                }
                const dx = (x + 0.5 - cx) / rx;
                const dy = (y + 0.5 - cy) / ry;
                const level = 1 - Math.sqrt(dx * dx + dy * dy);
                if (level <= 0) {
                    continue;
                }
                const band = Math.floor(level * 3 + bayer(x, y)) / 3;
                if (band > 0) {
                    this.px(x, y, colour, Math.min(1, band) * strength);
                }
            }
        }
    }

    /** A motif typed as rows of characters; `.` and unmapped characters are left alone */
    grid(x: number, y: number, rows: readonly string[], colours: Record<string, string>): void {
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i++) {
                const colour = colours[row[i]];
                if (colour) {
                    this.px(x + i, y + j, colour);
                }
            }
        });
    }

    text(x: number, y: number, text: string, colour: string): void {
        for (let n = 0; n < text.length; n++) {
            const glyph = FONT[text[n]];
            if (!glyph) {
                continue;
            }
            for (let i = 0; i < 15; i++) {
                if (glyph[i] === '1') {
                    this.px(x + n * 4 + (i % 3), y + Math.floor(i / 3), colour);
                }
            }
        }
    }

    clear(x: number, y: number, w: number, h: number): void {
        for (let j = Math.max(0, y); j < Math.min(this.height, y + h); j++) {
            this.data.fill(0, (j * this.width + Math.max(0, x)) * 4, (j * this.width + Math.min(this.width, x + w)) * 4);
        }
    }

    /** Snaps every visible pixel to the nearest of a few colours: keeps a limited palette honest */
    posterize(palette: readonly string[]): void {
        const colours = palette.map(rgb);
        const d = this.data;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) {
                continue;
            }
            let best = colours[0];
            let bestDistance = Infinity;
            for (const c of colours) {
                const distance = (c[0] - d[i]) ** 2 + (c[1] - d[i + 1]) ** 2 + (c[2] - d[i + 2]) ** 2;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = c;
                }
            }
            d[i] = best[0];
            d[i + 1] = best[1];
            d[i + 2] = best[2];
            d[i + 3] = 255;
        }
    }

    /** Copies the buffer onto a canvas at `left`, 0 */
    blit(context: CanvasRenderingContext2D, left = 0): void {
        const image = context.createImageData(this.width, this.height);
        image.data.set(this.data);
        context.putImageData(image, left, 0);
    }
}
