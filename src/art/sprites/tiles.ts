import type { Grid, SheetDef } from './grid';

// Frame order (docs/DESIGN.md): 0 floor, 1 floor variant, 2 wall, 3 prop, 4 cracked wall,
// 5 chest closed, 6 chest open. The floor stays almost empty so the sprites stand out.

const FLOOR: Grid = [
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111121111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1112111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111211',
    '1111111111111111',
    '1111111111111111',
];

const FLOOR_VARIANT: Grid = [
    '1111111111111111',
    '1111111111111111',
    '1111221111111111',
    '1112332111111111',
    '1111221111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111133111',
    '1111111111311111',
    '1111111111111111',
    '1111111111111111',
    '1123111111111111',
    '1111111111112111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
];

const WALL: Grid = [
    '4444444444444444',
    '4444444444444444',
    '5555555555555555',
    '6666666666666666',
    '5555555655555555',
    '5555555655555555',
    '7777777677777777',
    '6666666666666666',
    '5556555555565555',
    '5556555555565555',
    '7776777777767777',
    '6666666666666666',
    '5555555655555555',
    '5555555655555555',
    '7777777677777777',
    '6666666666666666',
];

// The same bricks with a hairline split running down them: easy to walk past, obvious once seen
const CRACKED_WALL: Grid = [
    '4444444444444444',
    '4444444444444444',
    '5555555555555555',
    '6666666666666666',
    '5555555656555555',
    '5555555665555555',
    '7777776677777777',
    '6666666666666666',
    '5556556555565555',
    '5556566755565555',
    '7776777677767777',
    '6666666666666666',
    '5555555675555555',
    '5555555657555555',
    '7777777677777777',
    '6666666666666666',
];

const CRATE: Grid = [
    '................',
    '..kkkkkkkkkkkk..',
    '.kyyyyyyyyyyyyk.',
    '.kyooooooooooyk.',
    '.kkkkkkkkkkkkkk.',
    '.kooooooooooook.',
    '.kokkkkkkkkkkok.',
    '.kokooOOOOOOkok.',
    '.kokOooOOOOOkok.',
    '.kokOOooOOOOkok.',
    '.kokOOOooOOOkok.',
    '.kokOOOOooOOkok.',
    '.kokkkkkkkkkkok.',
    '.kooooooooooook.',
    '.kkkkkkkkkkkkkk.',
    '..ssssssssssss..',
];

const CHEST_CLOSED: Grid = [
    '................',
    '................',
    '..kkkkkkkkkkkk..',
    '.kooooooooooook.',
    '.kooooooooooook.',
    '.kOOOOOOOOOOOOk.',
    '.kyyyyykkyyyyyk.',
    '.kkkkkkyykkkkkk.',
    '.kooookyykooook.',
    '.koooookkoooook.',
    '.kooooooooooook.',
    '.kOOOOOOOOOOOOk.',
    '.kyOOOOOOOOOOyk.',
    '.kkkkkkkkkkkkkk.',
    '..ssssssssssss..',
    '................',
];

const CHEST_OPEN: Grid = [
    '..kkkkkkkkkkkk..',
    '.kOOOOOOOOOOOOk.',
    '.kOooooooooooOk.',
    '.kOooooooooooOk.',
    '.kyyyyyyyyyyyyk.',
    '.kkkkkkkkkkkkkk.',
    '.kkeeyeeeeyeekk.',
    '.kyyyyykkyyyyyk.',
    '.kooookyykooook.',
    '.koooookkoooook.',
    '.kooooooooooook.',
    '.kOOOOOOOOOOOOk.',
    '.kyOOOOOOOOOOyk.',
    '.kkkkkkkkkkkkkk.',
    '..ssssssssssss..',
    '................',
];

export const TILES: SheetDef = {
    key: 'tiles',
    width: 16,
    height: 16,
    frames: [FLOOR, FLOOR_VARIANT, WALL, CRATE, CRACKED_WALL, CHEST_CLOSED, CHEST_OPEN],
    // Props and chests stand on floor, so their frames are safe to draw on their own
    underlay: { 3: 0, 5: 0, 6: 0 },
};
