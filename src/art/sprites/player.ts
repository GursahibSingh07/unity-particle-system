import { mirror, withRows, type Grid, type SheetDef } from './grid';

// The Light Handler as he sees himself: welder's goggles pushed up on his forehead, a red
// scarf and a long blue coat. Frame order: 0-1 down, 2-3 up, 4-5 left, 6-7 right.

const HERO_DOWN: Grid = [
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...kywcyywcyk...',
    '...kyccyyccyk...',
    '...khffffffhk...',
    '...kfkffffkfk...',
    '...kfkffffkfk...',
    '....kffFFffk....',
    '...krrrrrrrrk...',
    '..kbbrrbbbbbbk..',
    '..kfbbrbbybbfk..',
    '..kkbbRbbybbkk..',
    '...kbbbbbbbbk...',
    '...kBBBBBBBBk...',
    '...kookkkkook...',
    '...kkkk..kkkk...',
];

const HERO_DOWN_STEP = withRows(HERO_DOWN, {
    10: '..kkbbrbbybbfk..',
    11: '..kfbbRbbybbkk..',
    14: '...kookkkkkkk...',
    15: '...kkkk.........',
});

const HERO_UP: Grid = [
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...kyyyyyyyyk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...kHhhhhhhHk...',
    '....kHHHHHHk....',
    '...krrrrrrrrk...',
    '..kbbbbrrbbbbk..',
    '..kfbbbrrbbbfk..',
    '..kkbbbrrbbbkk..',
    '...kbbbrRbbbk...',
    '...kBBBBBBBBk...',
    '...kookkkkook...',
    '...kkkk..kkkk...',
];

const HERO_UP_STEP = withRows(HERO_UP, {
    10: '..kfbbbrrbbbkk..',
    11: '..kkbbbrrbbbfk..',
    12: '...kbbbRrbbbk...',
    14: '...kkkkkkkook...',
    15: '.........kkkk...',
});

const HERO_RIGHT: Grid = [
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhywcyk...',
    '...kyyyyyccyk...',
    '...khhhfffffk...',
    '...khhfffkffk...',
    '...khhfffkffk...',
    '....khfffffk....',
    '.kkkrrrrrrrk....',
    'krrRkbbbbbbk....',
    '.kkkkbbffbbk....',
    '....kbbbbbbk....',
    '....kbbbbbbk....',
    '....kBBBBBBk....',
    '.....kooook.....',
    '.....kkkkkk.....',
];

// The scarf tail lifts as he strides
const HERO_RIGHT_STEP = withRows(HERO_RIGHT, {
    7: '.kkkkhfffffk....',
    8: 'krrRrrrrrrrk....',
    9: '.kkkkbbbbbbk....',
    14: '...kookkkkook...',
    15: '...kkkk..kkkk...',
});

// The ending: the same man without the costume his mind gave him

const MAN_DOWN: Grid = [
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khffffffhk...',
    '...kfkffffkfk...',
    '...kfkffffkfk...',
    '....kffFFffk....',
    '...knnwwwwnnk...',
    '..knnnnwwnnnnk..',
    '..kfnnnnnnnnfk..',
    '..kknnnnnnnnkk..',
    '...kNNNNNNNNk...',
    '...kbbbkkbbbk...',
    '...kOOkkkkOOk...',
    '...kkkk..kkkk...',
];

const MAN_DOWN_STEP = withRows(MAN_DOWN, {
    10: '..kknnnnnnnnfk..',
    11: '..kfnnnnnnnnkk..',
    14: '...kOOkkkkkkk...',
    15: '...kkkk.........',
});

const MAN_UP: Grid = [
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...khhhhhhhhk...',
    '...kHhhhhhhHk...',
    '....kHffffHk....',
    '...knnnnnnnnk...',
    '..knnnnnnnnnnk..',
    '..kfnnnnnnnnfk..',
    '..kknnnnnnnnkk..',
    '...kNNNNNNNNk...',
    '...kbbbkkbbbk...',
    '...kOOkkkkOOk...',
    '...kkkk..kkkk...',
];

const MAN_UP_STEP = withRows(MAN_UP, {
    10: '..kfnnnnnnnnkk..',
    11: '..kknnnnnnnnfk..',
    14: '...kkkkkkkOOk...',
    15: '.........kkkk...',
});

const MAN_RIGHT: Grid = [
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khhhhhhffk...',
    '...khhhfffffk...',
    '...khhfffkffk...',
    '...khhfffkffk...',
    '....khfffffk....',
    '....knnnnnwk....',
    '....knnnnnnk....',
    '....knnffnnk....',
    '....knnnnnnk....',
    '....kNNNNNNk....',
    '....kbbbbbbk....',
    '.....kOOOOk.....',
    '.....kkkkkk.....',
];

const MAN_RIGHT_STEP = withRows(MAN_RIGHT, {
    13: '...kbbbkkbbbk...',
    14: '...kOOkkkkOOk...',
    15: '...kkkk..kkkk...',
});

export const PLAYER: SheetDef = {
    key: 'player',
    width: 16,
    height: 16,
    frames: [
        HERO_DOWN,
        HERO_DOWN_STEP,
        HERO_UP,
        HERO_UP_STEP,
        mirror(HERO_RIGHT),
        mirror(HERO_RIGHT_STEP),
        HERO_RIGHT,
        HERO_RIGHT_STEP,
    ],
    styles: {
        plain: [
            MAN_DOWN,
            MAN_DOWN_STEP,
            MAN_UP,
            MAN_UP_STEP,
            mirror(MAN_RIGHT),
            mirror(MAN_RIGHT_STEP),
            MAN_RIGHT,
            MAN_RIGHT_STEP,
        ],
    },
};
