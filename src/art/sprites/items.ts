import type { Grid, SheetDef } from './grid';

// The EMW Machine points right with its origin at the left end. The game rotates it to aim,
// so it is drawn nearly symmetrical top to bottom: it must not look upside down aiming left.
const RAY_GUN: Grid = [
    '..kkk....kk.',
    '.kyrrkkkkcck',
    'kyrwggGGkcww',
    'kyrGGGddkccw',
    '.kyrrkkkkcck',
    '..kkk....kk.',
];

const TORCH: Grid = [
    '........kkk.',
    '.kkkkkkkkggk',
    'kdddGdddkgyw',
    'kdddddddkgyw',
    '.kkkkkkkkggk',
    '........kkk.',
];

export const MACHINE: SheetDef = {
    key: 'machine',
    width: 12,
    height: 6,
    frames: [RAY_GUN],
    styles: { plain: [TORCH] },
};

const HEART: Grid = [
    '.kk..kk.',
    'krrkkrrk',
    'krwrrrrk',
    'krrrrrRk',
    '.krrrRk.',
    '..krRk..',
    '...kk...',
    '........',
];

export const HEART_SHEET: SheetDef = { key: 'heart', width: 8, height: 8, frames: [HEART] };

const SPARK: Grid = ['.ww.', 'wwww', 'wwww', '.ww.'];

export const SPARK_SHEET: SheetDef = { key: 'spark', width: 4, height: 4, frames: [SPARK] };

// HUD icons, in key order: 0 radio, 1 infrared, 2 ultraviolet, 3 gamma

const ICON_RADIO: Grid = [
    '............',
    '..k......k..',
    '.kpk....kpk.',
    'kpk..kk..kpk',
    'kpk.kwwk.kpk',
    'kpk.kwwk.kpk',
    'kpk..kk..kpk',
    '.kpk.kk.kpk.',
    '..k..kk..k..',
    '.....kk.....',
    '....kkkk....',
    '............',
];

const ICON_INFRARED: Grid = [
    '.....k......',
    '....krk.....',
    '....krrk....',
    '...krrrk.k..',
    '..krrYrrkrk.',
    '..krYYYrrrk.',
    '.krrYyyYrrk.',
    '.krYyyyyYrk.',
    '.krYywwyYrk.',
    '.krrYyyYrrk.',
    '..kkrrrrkk..',
    '....kkkk....',
];

const ICON_ULTRAVIOLET: Grid = [
    '.....PP.....',
    '.P...PP...P.',
    '..P......P..',
    '....kkkk....',
    '...kPwwPk...',
    'PP.kwwwwk.PP',
    'PP.kwwwwk.PP',
    '...kPwwPk...',
    '....kkkk....',
    '..P......P..',
    '.P...PP...P.',
    '.....PP.....',
];

const ICON_GAMMA: Grid = [
    '............',
    '.kk......kk.',
    'knnk....knnk',
    'knnk....knnk',
    '.knnk..knnk.',
    '..knnkknnk..',
    '...knnnnk...',
    '....knnk....',
    '...knnnnk...',
    '...knkknk...',
    '...knnnnk...',
    '....kkkk....',
];

export const ICONS: SheetDef = {
    key: 'icons',
    width: 12,
    height: 12,
    frames: [ICON_RADIO, ICON_INFRARED, ICON_ULTRAVIOLET, ICON_GAMMA],
};
