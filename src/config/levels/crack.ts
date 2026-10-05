import { SQUARE_LAYOUT } from '../square';

/**
 * The city square with one wall tile cracked (S) for an era's secret. The tile must be a
 * building wall with open paving in front of it, or the upgrade would have nowhere to drop.
 * Columns and rows count from 0 at the top left.
 */
export function squareWithCrack(col: number, row: number): string[] {
    const line = SQUARE_LAYOUT[row];
    if (!line || line[col] !== '#') {
        throw new Error(`squareWithCrack: (${col}, ${row}) is not a wall tile of the square`);
    }
    const layout = [...SQUARE_LAYOUT];
    layout[row] = line.slice(0, col) + 'S' + line.slice(col + 1);
    return layout;
}
