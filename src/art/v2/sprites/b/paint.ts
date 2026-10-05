import type { Grid } from '../../../sprites/grid';

// A tiny pixel painter. The v2 sprites are four times the area of the old ones, so they are
// built from shaded shapes and hand-placed pixel rows instead of being typed out whole. The
// result is still a plain Grid of palette slots, so the baker and the palettes do not change.

/** How much of a drawing an era keeps: 3 goldenAge, 2 cyberpunk, 1 retro, 0 manga */
export type Detail = 0 | 1 | 2 | 3;

export type Point = readonly [number, number];

const CLEAR = '.';

// The sun is over the Handler's left shoulder in every sprite
const LIGHT = { x: -0.55, y: -0.65, z: 0.52 };

const BANDS: Record<number, number[]> = {
    1: [],
    2: [0.1],
    3: [0.68, -0.05],
    4: [0.8, 0.3, -0.28],
    5: [0.86, 0.5, 0.05, -0.4],
};

export class Pix {
    readonly w: number;
    readonly h: number;
    private cells: string[][];

    constructor(w: number, h: number) {
        this.w = w;
        this.h = h;
        this.cells = Array.from({ length: h }, () => Array<string>(w).fill(CLEAR));
    }

    get(x: number, y: number): string {
        return x < 0 || y < 0 || x >= this.w || y >= this.h ? CLEAR : this.cells[y][x];
    }

    set(x: number, y: number, slot: string): this {
        x = Math.round(x);
        y = Math.round(y);
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) {
            this.cells[y][x] = slot;
        }
        return this;
    }

    /** Several single pixels of one slot: dots(slot, x, y, x, y, ...) */
    dots(slot: string, ...xy: number[]): this {
        for (let i = 0; i + 1 < xy.length; i += 2) {
            this.set(xy[i], xy[i + 1], slot);
        }
        return this;
    }

    rect(x: number, y: number, w: number, h: number, slot: string): this {
        for (let j = y; j < y + h; j++) {
            for (let i = x; i < x + w; i++) {
                this.set(i, j, slot);
            }
        }
        return this;
    }

    /** A flat ellipse; centre and radii may be fractional */
    ellipse(cx: number, cy: number, rx: number, ry: number, slot: string): this {
        return this.ball(cx, cy, rx, ry, slot);
    }

    /** An ellipse shaded as a rounded form. `ramp` runs light to dark, one slot per tone. */
    ball(cx: number, cy: number, rx: number, ry: number, ramp: string, bands?: number[]): this {
        const cuts = bands ?? BANDS[ramp.length];
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                const dx = (x - cx) / rx;
                const dy = (y - cy) / ry;
                const r2 = dx * dx + dy * dy;
                if (r2 > 1) {
                    continue;
                }
                const lit = dx * LIGHT.x + dy * LIGHT.y + Math.sqrt(1 - r2) * LIGHT.z;
                let tone = 0;
                while (tone < cuts.length && lit < cuts[tone]) {
                    tone++;
                }
                this.set(x, y, ramp[tone]);
            }
        }
        return this;
    }

    /** A filled polygon, sampled at pixel centres */
    poly(points: readonly Point[], slot: string): this {
        const ys = points.map((p) => p[1]);
        for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
            const crossings: number[] = [];
            const sy = y + 0.5;
            points.forEach((a, i) => {
                const b = points[(i + 1) % points.length];
                if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) {
                    crossings.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
                }
            });
            crossings.sort((a, b) => a - b);
            for (let i = 0; i + 1 < crossings.length; i += 2) {
                for (let x = Math.ceil(crossings[i] - 0.5); x <= Math.floor(crossings[i + 1] - 0.5); x++) {
                    this.set(x, y, slot);
                }
            }
        }
        return this;
    }

    line(x0: number, y0: number, x1: number, y1: number, slot: string): this {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = 0; i <= steps; i++) {
            this.set(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, slot);
        }
        return this;
    }

    /** A line through several points */
    path(points: readonly Point[], slot: string): this {
        for (let i = 0; i + 1 < points.length; i++) {
            this.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], slot);
        }
        return this;
    }

    /** Hand-placed pixels. '.' and ' ' leave what is there, '_' rubs it out. */
    rows(x: number, y: number, rows: readonly string[]): this {
        rows.forEach((row, j) => {
            for (let i = 0; i < row.length; i++) {
                const slot = row[i];
                if (slot === '.' || slot === ' ') {
                    continue;
                }
                this.set(x + i, y + j, slot === '_' ? CLEAR : slot);
            }
        });
        return this;
    }

    /**
     * Shades a flat area the cheap way a 16-bit artist does: the pixels of `slot` along its
     * upper-left edge become `light`, those along its lower-right edge become `dark`.
     */
    bevel(slot: string, light: string | null, dark: string | null, depth = 1): this {
        const inside = (x: number, y: number) => this.get(x, y) === slot;
        const edits: [number, number, string][] = [];
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (!inside(x, y)) {
                    continue;
                }
                let shade: string | null = null;
                for (let d = 1; d <= depth && !shade; d++) {
                    if (dark && (!inside(x + d, y) || !inside(x, y + d))) {
                        shade = dark;
                    } else if (light && (!inside(x - d, y) || !inside(x, y - d))) {
                        shade = light;
                    }
                }
                if (shade) {
                    edits.push([x, y, shade]);
                }
            }
        }
        edits.forEach(([x, y, shade]) => this.set(x, y, shade));
        return this;
    }

    /**
     * Rings the drawing in `slot`. `lit` softens the line where the light falls: an outline
     * pixel whose only neighbours are below or to its right takes that neighbour's entry.
     */
    outline(slot = 'k', lit: Record<string, string> = {}): this {
        const edits: [number, number, string][] = [];
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (this.get(x, y) !== CLEAR) {
                    continue;
                }
                const right = this.get(x + 1, y);
                const below = this.get(x, y + 1);
                const left = this.get(x - 1, y);
                const above = this.get(x, y - 1);
                if (left !== CLEAR || above !== CLEAR) {
                    edits.push([x, y, slot]);
                } else if (right !== CLEAR || below !== CLEAR) {
                    const body = below !== CLEAR ? below : right;
                    edits.push([x, y, lit[body] ?? slot]);
                }
            }
        }
        edits.forEach(([x, y, s]) => this.set(x, y, s));
        return this;
    }

    /** A flat ellipse that only fills empty pixels: a cast shadow, added after the outline */
    ground(cx: number, cy: number, rx: number, ry: number, slot = 's'): this {
        const under = new Pix(this.w, this.h).ellipse(cx, cy, rx, ry, slot);
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (this.cells[y][x] === CLEAR) {
                    this.cells[y][x] = under.cells[y][x];
                }
            }
        }
        return this;
    }

    /** Draws another canvas on top of this one */
    paste(other: Pix, dx = 0, dy = 0): this {
        for (let y = 0; y < other.h; y++) {
            for (let x = 0; x < other.w; x++) {
                const slot = other.get(x, y);
                if (slot !== CLEAR) {
                    this.set(x + dx, y + dy, slot);
                }
            }
        }
        return this;
    }

    /** A copy moved by whole pixels; what leaves the frame is lost */
    shifted(dx: number, dy: number): Pix {
        return new Pix(this.w, this.h).paste(this, dx, dy);
    }

    flipped(): Pix {
        const out = new Pix(this.w, this.h);
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                out.cells[y][this.w - 1 - x] = this.cells[y][x];
            }
        }
        return out;
    }

    recolour(slots: Record<string, string>): this {
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

/**
 * The manga page: ink, paper and one tone. Slots in `ink` become black, slots in `tone`
 * the grey, everything else paper.
 */
export function inked(grid: Grid, ink: string, tone: string): Grid {
    return grid.map((row) =>
        Array.from(row, (slot) => {
            if (slot === CLEAR || slot === 's') {
                return slot;
            }
            return ink.includes(slot) ? 'k' : tone.includes(slot) ? 'G' : 'w';
        }).join(''),
    );
}

export const DETAILS: Record<'goldenAge' | 'cyberpunk' | 'retro' | 'manga', Detail> = {
    goldenAge: 3,
    cyberpunk: 2,
    retro: 1,
    manga: 0,
};
