import type { Grid } from '../sprites/grid';

// A tiny painter for building sprite grids from parts. A 32x48 figure with sixteen frames
// is too much to type as whole pictures, so frames are assembled: hand-drawn stamps for
// the parts that carry the character (heads, hands, faces) and shapes for the rest, then
// one outlining pass. Nothing here imports Phaser; the output is the same Grid v1 uses.

const EMPTY = '.';
/** Drop shadows are not part of the figure: outlines ignore them and anything may overwrite them */
const SHADOW = 's';

/** Upper left and a little toward the viewer, the way most 16-bit sprites are lit */
const LIGHT = { x: -0.48, y: -0.62, z: 0.62 };

export class Canvas {
    readonly width: number;
    readonly height: number;
    private readonly cells: string[][];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.cells = Array.from({ length: height }, () => new Array<string>(width).fill(EMPTY));
    }

    get(x: number, y: number): string {
        return this.cells[y]?.[x] ?? EMPTY;
    }

    set(x: number, y: number, slot: string): this {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
            this.cells[y][x] = slot;
        }
        return this;
    }

    private filled(x: number, y: number): boolean {
        const slot = this.get(x, y);
        return slot !== EMPTY && slot !== SHADOW;
    }

    rect(x: number, y: number, width: number, height: number, slot: string): this {
        for (let j = y; j < y + height; j++) {
            for (let i = x; i < x + width; i++) {
                this.set(i, j, slot);
            }
        }
        return this;
    }

    line(x0: number, y0: number, x1: number, y1: number, slot: string): this {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            this.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), slot);
        }
        return this;
    }

    /** A filled ellipse. Half-pixel centres give even widths. */
    ellipse(cx: number, cy: number, rx: number, ry: number, slot: string): this {
        return this.ball(cx, cy, rx, ry, slot);
    }

    /**
     * An ellipse shaded as a lit ball. `ramp` runs from highlight to deep shade, one slot
     * per character; the bands are cut by how far each pixel faces the light.
     */
    ball(cx: number, cy: number, rx: number, ry: number, ramp: string, only?: (x: number, y: number) => boolean): this {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                const nx = (x - cx) / rx;
                const ny = (y - cy) / ry;
                const flat = nx * nx + ny * ny;
                if (flat > 1 || (only && !only(x, y))) {
                    continue;
                }
                const nz = Math.sqrt(1 - flat);
                const lit = (nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z + 1) / 2;
                // Square the falloff a little so the highlight stays small and the shade wide
                const band = Math.min(ramp.length - 1, Math.floor((1 - lit) ** 0.8 * ramp.length * 1.08));
                this.set(x, y, ramp[band]);
            }
        }
        return this;
    }

    /** A one-pixel circle, for wheels and bursts */
    ring(cx: number, cy: number, radius: number, slot: string): this {
        const steps = Math.ceil(radius * 8);
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            this.set(Math.round(cx + Math.cos(angle) * radius), Math.round(cy + Math.sin(angle) * radius), slot);
        }
        return this;
    }

    /** Paints rows of slots with their top left at (x, y). '.' and ' ' leave what is there. */
    stamp(x: number, y: number, rows: readonly string[], flip = false): this {
        rows.forEach((row, j) => {
            const chars = flip ? Array.from(row).reverse() : Array.from(row);
            chars.forEach((slot, i) => {
                if (slot !== EMPTY && slot !== ' ') {
                    this.set(x + i, y + j, slot);
                }
            });
        });
        return this;
    }

    /** Copies another canvas onto this one, offset */
    paste(other: Canvas, dx = 0, dy = 0): this {
        return this.stamp(dx, dy, other.grid());
    }

    /** Slides each row sideways by `shift(y)` pixels: a lean, for dashes and wind-ups */
    shear(shift: (y: number) => number): this {
        this.cells.forEach((row, y) => {
            const by = Math.round(shift(y));
            if (by === 0) {
                return;
            }
            const copy = row.slice();
            for (let x = 0; x < this.width; x++) {
                row[x] = copy[x - by] ?? EMPTY;
            }
        });
        return this;
    }

    /**
     * Draws a one-pixel outline around everything painted so far. Where the outline sits on
     * the lit side (above or left of the figure) it takes the deep shade of the material it
     * touches, from `soft`; everywhere else it is `ink`. That is what keeps a 16-bit sprite
     * from looking like a sticker.
     */
    outline(ink = 'k', soft: Record<string, string> = {}): this {
        const marks: [number, number, string][] = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.filled(x, y)) {
                    continue;
                }
                const below = this.filled(x, y + 1) ? this.get(x, y + 1) : undefined;
                const right = this.filled(x + 1, y) ? this.get(x + 1, y) : undefined;
                const touches = below ?? right;
                if (this.filled(x, y - 1) || this.filled(x - 1, y)) {
                    marks.push([x, y, ink]);
                } else if (touches !== undefined) {
                    marks.push([x, y, soft[touches] ?? ink]);
                }
            }
        }
        for (const [x, y, slot] of marks) {
            this.set(x, y, slot);
        }
        return this;
    }

    /** A soft oval on the ground, painted only where nothing else is */
    shadow(cx: number, cy: number, rx: number, ry: number): this {
        return this.ball(cx, cy, rx, ry, SHADOW, (x, y) => this.get(x, y) === EMPTY);
    }

    /** Replaces slots everywhere, e.g. to flatten a ramp for a poorer era */
    remap(slots: Record<string, string>): this {
        for (const row of this.cells) {
            for (let x = 0; x < row.length; x++) {
                row[x] = slots[row[x]] ?? row[x];
            }
        }
        return this;
    }

    grid(): Grid {
        return this.cells.map((row) => row.join(''));
    }
}

/** The deep shade each material's outline takes on its lit side */
export const SOFT_EDGE: Record<string, string> = {
    q: 'Q', r: 'Q', R: 'Q',
    a: 'A', b: 'A', B: 'A',
    l: 'L', n: 'L', N: 'L',
    e: 'E', y: 'E', Y: 'E',
    v: 'V', p: 'V', P: 'V',
    c: 'Z', C: 'Z',
    j: 'J', f: 'J', F: 'J',
    u: 'U', h: 'U', H: 'U', o: 'U', O: 'U',
    w: 'd', g: 'd', G: 'D', d: 'D',
    m: 'T', M: 'T', t: 'T',
    x: 'z', X: 'z',
    i: 'I',
};

// --- Detail by era ---------------------------------------------------------------------------
// The Handler sees less each era. These maps take tones out of a finished drawing, so the
// loss is in the pixels and not only in the palette.

/** Cyberpunk: the highlights go */
export const DETAIL_CYBERPUNK: Record<string, string> = {
    q: 'r', a: 'b', l: 'n', v: 'p', j: 'f', u: 'h', x: 'X',
};

/** Retro: highlights gone and the deep shades merge into the ink, leaving two tones a material */
export const DETAIL_RETRO: Record<string, string> = {
    ...DETAIL_CYBERPUNK,
    Q: 'k', A: 'k', L: 'k', V: 'k', U: 'k', T: 'k', D: 'k', E: 'Y', J: 'F', m: 'M', e: 'y', c: 'C',
};

/** Manga: ink, paper, and one screentone where the shadow falls */
export const DETAIL_MANGA: Record<string, string> = {
    // Red goes to solid ink: the scarf, a plume, a pair of eyes are what a manga panel keeps
    q: 'G', r: 'k', R: 'k', Q: 'k',
    a: 'w', b: 'w', B: 'G', A: 'k',
    l: 'w', n: 'w', N: 'G', L: 'k',
    e: 'w', y: 'w', Y: 'G', E: 'k',
    v: 'w', p: 'w', P: 'G', V: 'k',
    c: 'w', C: 'w', Z: 'G',
    i: 'w', I: 'G',
    j: 'w', f: 'w', F: 'w', J: 'k',
    u: 'k', h: 'k', H: 'k', U: 'k',
    o: 'w', O: 'G',
    g: 'w', d: 'G', D: 'k',
    m: 'w', M: 'w', t: 'G', T: 'k',
    x: 'w', X: 'w', z: 'G',
};

function reduce(frames: Grid[], slots: Record<string, string>): Grid[] {
    return frames.map((grid) => grid.map((row) => Array.from(row, (slot) => slots[slot] ?? slot).join('')));
}

/** The per-era drawings of a sheet whose `frames` are the full-detail Golden Age version */
export function eraStyles(frames: Grid[], plain: Grid[]) {
    return {
        cyberpunk: reduce(frames, DETAIL_CYBERPUNK),
        retro: reduce(frames, DETAIL_RETRO),
        manga: reduce(frames, DETAIL_MANGA),
        plain,
    };
}
