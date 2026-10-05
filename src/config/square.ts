// The city square: one place, the same in every era. Only the way it is drawn changes.
// Legend in docs/DESIGN.md. Era data (src/config/levels) starts from this and may only add
// S (a cracked wall) on the outer ring.

/**
 * - `F` the fountain in the middle (blocks movement, not rays)
 * - `o` street furniture: lamp posts, benches, planters (blocks movement, not rays)
 * - `e` a street entry: open floor where enemies walk in from
 * - `,` worn paving
 */
export const SQUARE_LAYOUT: readonly string[] = [
    '####################',
    '####################',
    '#........ee........#',
    '#..o............o..#',
    '#e.....,....,.....e#',
    '#e.......FF.......e#',
    '#......,.FF.,......#',
    '#..o............o..#',
    '#........eP........#',
    '####################',
];

/** What stands on the outer ring, for the artists: the square is ringed by buildings */
export const SQUARE_NOTES = {
    north: 'Two tiles deep, so the building fronts are seen face on: town hall with a clock, flanked by shops; a street opens in the middle (above the e tiles)',
    south: 'One tile: the roofs and awnings of a cafe and a bakery, seen from behind; a street opens in the middle',
    west: 'One tile: roof edge of a bookshop and apartments; a street opens at the e rows',
    east: 'One tile: roof edge of a cinema and a pharmacy; a street opens at the e rows',
    centre: 'A round stone fountain on a 2x2 block',
    furniture: 'Four lamp posts with planters at the o tiles',
};
