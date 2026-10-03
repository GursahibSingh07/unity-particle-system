import type { ArtStyle } from '../../types';

// Sprites are arrays of strings. Each character is a palette slot (see ../palettes.ts) and
// '.' is transparent. Nothing in this folder imports Phaser, so the data can be read or
// checked without a browser.

/** One frame: equal-length rows, one character per pixel */
export type Grid = readonly string[];

export interface SheetDef {
    /** Texture key, before the `-{style}` suffix */
    key: string;
    width: number;
    height: number;
    frames: Grid[];
    /** Styles that draw something different, not just the same pixels in other colours */
    styles?: Partial<Record<ArtStyle, Grid[]>>;
    /** frame -> frame painted underneath it, for frames that need an opaque background */
    underlay?: Record<number, number>;
}

/** Swap palette slots, e.g. to darken one half of a sprite */
export function remap(grid: Grid, slots: Record<string, string>): Grid {
    return grid.map((row) => Array.from(row, (slot) => slots[slot] ?? slot).join(''));
}

export function mirror(grid: Grid): Grid {
    return grid.map((row) => Array.from(row).reverse().join(''));
}

/** Replace whole rows, for a second animation frame that only moves the legs */
export function withRows(grid: Grid, rows: Record<number, string>): Grid {
    return grid.map((row, y) => rows[y] ?? row);
}

/** Drop one row and push everything above it down a pixel: a cheap squash for a bob frame */
export function squash(grid: Grid, row: number): Grid {
    return ['.'.repeat(grid[0].length), ...grid.slice(0, row), ...grid.slice(row + 1)];
}

/** Build a full sprite from its left half; `rightSlots` re-colours the mirrored half */
export function symmetric(left: Grid, rightSlots: Record<string, string> = {}): Grid {
    const right = remap(mirror(left), rightSlots);
    return left.map((row, y) => row + right[y]);
}
