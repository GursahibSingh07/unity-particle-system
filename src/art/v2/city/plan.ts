import { SQUARE_LAYOUT } from '../../../config/square';
import { INK, PAPER } from './looks';
import type { Pix, Test } from './pix';

// Where things stand, in texture pixels. Every era draws from these same numbers, which is
// what makes it one square seen five ways.

export const TILE = 32;
export const CITY_WIDTH = SQUARE_LAYOUT[0].length * TILE;
export const CITY_HEIGHT = SQUARE_LAYOUT.length * TILE;

/** The paving runs from WEST to EAST and from NORTH to SOUTH; the buildings ring it */
export const NORTH = 2 * TILE;
export const SOUTH = CITY_HEIGHT - TILE;
export const WEST = TILE;
export const EAST = CITY_WIDTH - TILE;

/** The north and south streets open over these columns, the side streets over these rows */
export const MOUTH_X0 = 9 * TILE;
export const MOUTH_X1 = 11 * TILE;
export const MOUTH_Y0 = 4 * TILE;
export const MOUTH_Y1 = 6 * TILE;
/** The building north of a side street shows this much of its south wall in the mouth */
export const SIDE_WALL = 20;

export const FOUNTAIN_X = 10 * TILE;
export const FOUNTAIN_Y = 6 * TILE - 2;
/** Nothing of the fountain below this line may go on the over-layer: people stand in front of it */
export const FOUNTAIN_OVER_LIMIT = 176;

/** Calls back with the top-left pixel of every tile holding `char` */
export function eachTile(char: string, visit: (x: number, y: number, index: number) => void): void {
    let index = 0;
    SQUARE_LAYOUT.forEach((row, ty) => {
        for (let tx = 0; tx < row.length; tx++) {
            if (row[tx] === char) {
                visit(tx * TILE, ty * TILE, index++);
            }
        }
    });
}

/** Manga screentone: one dot in four, staggered */
export const TONE_DOT: Test = (x, y) => (y & 1) === 0 && (x & 1) === ((y >> 1) & 1);

/** Paper with screentone dots over it */
export function screentone(p: Pix, x: number, y: number, w: number, h: number, test?: Test): void {
    p.rect(x, y, w, h, PAPER, test);
    p.rect(x, y, w, h, INK, (i, j) => TONE_DOT(i, j) && (!test || test(i, j)));
}
