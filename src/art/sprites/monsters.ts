import { remap, squash, symmetric, withRows, type Grid, type SheetDef } from './grid';

// Each monster has two drawings: what the Handler sees, and (in the `plain` style) what was
// really there. The monster shapes quietly echo the real thing: the Frostling's crown is a
// scoop of ice cream, the Ironclad's helmet has vents, the Prism carries two flashing lights.

// --- Swarmlet / pigeon -------------------------------------------------------------------

const SWARMLET_UP: Grid = [
    'kk....kk',
    'kck..kck',
    'kcckkcck',
    '.knnnnk.',
    '.krnnrk.',
    '.knNNnk.',
    '..kkkk..',
    '........',
];

const SWARMLET_DOWN: Grid = [
    '........',
    '..kkkk..',
    '.knnnnk.',
    'kkrnnrkk',
    'kcnNNnck',
    'kcckkcck',
    'kkk..kkk',
    '........',
];

const PIGEON: Grid = [
    '.....kk.',
    '....kGGk',
    '....kkGY',
    '.kkkknpk',
    'kggggGk.',
    'kgdddgk.',
    '.kkkkkk.',
    '...r.r..',
];

const PIGEON_PECK: Grid = [
    '........',
    '.....kk.',
    '....kGGk',
    '.kkkkkGY',
    'kgggnpk.',
    'kgdddgk.',
    '.kkkkkk.',
    '..r...r.',
];

export const SWARMLET: SheetDef = {
    key: 'rat',
    width: 8,
    height: 8,
    frames: [SWARMLET_UP, SWARMLET_DOWN],
    styles: { plain: [PIGEON, PIGEON_PECK] },
};

// --- Frostling / ice-cream vendor --------------------------------------------------------

const FROSTLING: Grid = [
    '.......kk.......',
    '...k..kwck..k...',
    '..kwk.kwck.kck..',
    '..kwckkwcckkcCk.',
    '.kwccccwccccccCk',
    '.kwcccccccccccCk',
    '.kcckkcccckkccCk',
    '.kcckecccckeccCk',
    '.kccccccccccccCk',
    '.kcccckkkkccccCk',
    '.kCccckwwkcccCCk',
    '..kCcccccccccCk.',
    '..kCCccccccCCCk.',
    '...kkCCCCCCkkk..',
    '..kCk.kkkk.kCk..',
    '..kkk......kkk..',
];

const VENDOR: Grid = [
    '.....kkkkkk.....',
    '....kwwwwwwk....',
    '...kwwwwwwwwk...',
    '...krrrrrrrrk...',
    '...khffffffhk...',
    '...kfkffffkfk...',
    '...kfkffffkfkkk.',
    '....kffFFffkkiwk',
    '...kwwwggwwwkiik',
    '..kwwrwrwrwrwkyk',
    '..kfwrwrwrwrfkYk',
    '..kkwrwrwrwrkkk.',
    '...kwrwrwrwrk...',
    '...kgggkkgggk...',
    '...kOOkkkkOOk...',
    '...kkkk..kkkk...',
];

const VENDOR_STEP = withRows(VENDOR, {
    14: '...kOOkkkkkkk...',
    15: '...kkkk.........',
});

export const FROSTLING_SHEET: SheetDef = {
    key: 'slime',
    width: 16,
    height: 16,
    frames: [FROSTLING, squash(FROSTLING, 8)],
    styles: { plain: [VENDOR, VENDOR_STEP] },
};

// --- Shade / man in a dark coat ----------------------------------------------------------

const SHADE: Grid = [
    '......kkkk......',
    '.....kPPPPk.....',
    '....kPppppPk....',
    '...kPppppppPk...',
    '...kPkkppkkPk...',
    '...kPeeppeePk...',
    '...kPppppppPk...',
    '..kPPppppppPPk..',
    '..kPppppppppPk..',
    '.kPPppppppppPPk.',
    '.kPpppPppPpppPk.',
    '.kPpppPppPpppPk.',
    '.kPppPPppPPppPk.',
    '.kPpkkPppPkkpPk.',
    '.kPk..kPPk..kPk.',
    '..k....kk....k..',
];

const SHADE_DRIFT = withRows(SHADE, {
    13: '.kPppkPppPkppPk.',
    14: '..kPk.kPPk.kPk..',
    15: '...k...kk...k...',
});

const COAT_MAN: Grid = [
    '.....kkkkkk.....',
    '....kHHHHHHk....',
    '...kHHHHHHHHk...',
    '...kHHHHHHHHk...',
    '...kHffffffHk...',
    '...kfkffffkfk...',
    '...kfkffffkfk...',
    '....kffFFffk....',
    '...kdGGddGGdk...',
    '..kdddddGddddk..',
    '..kdddddGddddk..',
    '..kkddddGdddkk..',
    '...kddddGdddk...',
    '...kddddGdddk...',
    '...kkOOkkOOkk...',
    '....kkk..kkk....',
];

const COAT_MAN_STEP = withRows(COAT_MAN, {
    14: '...kkOOkkkkkk...',
    15: '....kkk.........',
});

export const SHADE_SHEET: SheetDef = {
    key: 'ghost',
    width: 16,
    height: 16,
    frames: [SHADE, SHADE_DRIFT],
    styles: { plain: [COAT_MAN, COAT_MAN_STEP] },
};

// --- Ironclad / cyclist ------------------------------------------------------------------

const IRONCLAD: Grid = [
    '....kkkkkkkk....',
    '...kgwgdgdggk...',
    '..kgwggdgdgGGk..',
    '..kgggggggggGk..',
    '..kkkkkkkkkkkk..',
    '..kkeekkkkeekk..',
    '..kGGGGGGGGGGk..',
    '.kkkkGGGGGGkkkk.',
    'kgwgkgggggGkgGGk',
    'kgggkgwgggGkgGGk',
    'kGGGkggggGGkGGdk',
    '.kkkkddddddkkkk.',
    '...kgggkkgGGk...',
    '...kgGGkkgGGk...',
    '..kkGGGkkGGGkk..',
    '..kkkkkkkkkkkk..',
];

const IRONCLAD_STEP = withRows(IRONCLAD, {
    13: '...kgGGkkkkkk...',
    14: '..kkGGGk........',
    15: '..kkkkkk........',
});

// The wind-up: the visor flares and the shot gathers on its chest
const IRONCLAD_WINDUP = withRows(IRONCLAD, {
    5: '..kkwwkkkkwwkk..',
    8: 'kgwgkgkyykGkgGGk',
    9: 'kgggkkywwykkgGGk',
    10: 'kGGGkgkyykGkGGdk',
});

const CYCLIST: Grid = [
    '.........kkkk...',
    '........kyyyyk..',
    '.......kkywyykk.',
    '........kffkfk..',
    '........kffffk..',
    '......krrrrk....',
    '.....krrrrrfk...',
    '....krrrrkkffk..',
    '....kbbbk..kkGk.',
    '....kbbbbk..kk..',
    '.....kkbfk..kk..',
    '.kkkdddfkdddkkk.',
    'kdddk.kfk..kdddk',
    'kdgdkkkOOk.kdgdk',
    'kdddk.kkkk.kdddk',
    '.kkk........kkk.',
];

const CYCLIST_PEDAL = withRows(CYCLIST, {
    12: 'kdddk.kfk..kdddk',
    13: 'kdgdk.kfk..kdgdk',
    14: 'kdddkkkOOk.kdddk',
    15: '.kkk..kkkk..kkk.',
});

// What the Handler reads as an attack: a man shaking his fist
const CYCLIST_SHOUT = withRows(CYCLIST, {
    2: '...kk..kkywyykk.',
    3: '..kffk..kffkfk..',
    4: '..kffk..kffffk..',
    5: '...kfkkrrrrk....',
    6: '....kfrrrrrfk...',
});

export const IRONCLAD_SHEET: SheetDef = {
    key: 'ironclad',
    width: 16,
    height: 16,
    frames: [IRONCLAD, IRONCLAD_STEP, IRONCLAD_WINDUP],
    styles: { plain: [CYCLIST, CYCLIST_PEDAL, CYCLIST_SHOUT] },
};

// --- The Prism / police car --------------------------------------------------------------

// Left half only. The right half is its mirror, one step darker, with the cool half of the
// spectrum: a blue beacon, and green and blue facets where the left has red and orange.
const PRISM_LEFT: Grid = [
    '................',
    '.........kkkk...',
    '........krwrrk..',
    '........krrrrk..',
    '.......kkkkkkkkk',
    '......kwwwwkgggg',
    '.....kwwwwkggggg',
    '....kwwwwkgggggg',
    '...kwwwwkggggggg',
    '..kwwwwkgggggggg',
    '.kwwwwkggggggggg',
    'kkkkkkkkkkkkkkkk',
    'kwgggggggggggggg',
    'kwggkkkkgggggggg',
    'kwggkyyykkkggggg',
    'kwgggkyyeeykkggg',
    'kggggkkyyeeyykgg',
    'kggggggkkkkkkkgg',
    'kGgggggggkgggkgg',
    'kGGgggggkgkgkgkg',
    'kkkkkkkkkkkkkkkk',
    '.krrrrkYYYYkgggg',
    '...krrrkYYYkgggg',
    '....krrrkYYYkggg',
    '......krrkYYYkgg',
    '.......krrkYYkgg',
    '.........krkYYkg',
    '..........krkYkg',
    '............kkYk',
    '.............kkk',
    '...............k',
    '................',
];

const PRISM = symmetric(PRISM_LEFT, { r: 'b', Y: 'n', w: 'g', g: 'G', G: 'd' });

/** Swaps the two lights, so two frames make them flash like a light bar */
const flash = (grid: Grid) => remap(grid, { r: 'b', b: 'r' });

const BLANK_32 = '.'.repeat(32);

const POLICE_CAR: Grid = [
    ...Array<string>(8).fill(BLANK_32),
    '..............kkkk..............',
    '.............krrbbk.............',
    '.........kkkkkkkkkkkkkk.........',
    '........kwwwwwwwwwwwwwwk........',
    '.......kwkwcccckkwcccckwk.......',
    '......kwwkccccckkccccckwwk......',
    '.....kwwwkccccckkccccckwwwk.....',
    '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwwwwwwwwwwwwwwwwwk.',
    'kywwwwwwwwwwwwwwwwwwwwwwwwwwwwRk',
    'kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk',
    'kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwk',
    'kggkkkkkkggggggggggggggkkkkkkggk',
    '.kkkddddkkkkkkkkkkkkkkkkddddkkk.',
    '...kdGGdk..............kdGGdk...',
    '...kdGGdk..............kdGGdk...',
    '....kkkk................kkkk....',
    ...Array<string>(7).fill(BLANK_32),
];

export const PRISM_SHEET: SheetDef = {
    key: 'prism',
    width: 32,
    height: 32,
    frames: [PRISM, flash(PRISM)],
    styles: { plain: [POLICE_CAR, flash(POLICE_CAR)] },
};

// --- Projectile --------------------------------------------------------------------------

const ORB: Grid = [
    '........',
    '..kkkk..',
    '.kywwyk.',
    '.kywwyk.',
    '.kyyyYk.',
    '.kYYYYk.',
    '..kkkk..',
    '........',
];

// The cyclist only ever threw his water bottle
const BOTTLE: Grid = [
    '...kk...',
    '..kwwk..',
    '..kkkk..',
    '.kccwck.',
    '.kccwck.',
    '.kCCCCk.',
    '.kkkkkk.',
    '........',
];

export const PROJECTILE: SheetDef = {
    key: 'projectile',
    width: 8,
    height: 8,
    frames: [ORB],
    styles: { plain: [BOTTLE] },
};

// PLACEHOLDERS: the new enemies borrow existing drawings until the v2 art lands
const borrow = (sheet: SheetDef, key: string): SheetDef => ({ ...sheet, key });

export const MONSTER_SHEETS = [
    SWARMLET,
    FROSTLING_SHEET,
    SHADE_SHEET,
    IRONCLAD_SHEET,
    PRISM_SHEET,
    borrow(SWARMLET, 'bat'),
    borrow(SWARMLET, 'zigbat'),
    borrow(IRONCLAD_SHEET, 'golem'),
    borrow(FROSTLING_SHEET, 'skitter'),
    borrow(SHADE_SHEET, 'wraith'),
    borrow(FROSTLING_SHEET, 'snowman'),
    borrow(FROSTLING_SHEET, 'acidSlime'),
];
