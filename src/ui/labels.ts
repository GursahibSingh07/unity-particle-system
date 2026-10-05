import type { RayMode, StyleId } from '../types';

// The interface's own furniture: tab names, key caps, stamps. Story wording lives in
// src/config/text.ts; these are only the labels printed on the screens around it.

export const LABELS = {
    page: 'PAGE',
    paused: 'PAUSED',
    mapTab: 'THE ERAS',
    guideTab: 'FIELD GUIDE',
    settingsTab: 'SETTINGS',
    weaponsTab: 'THE MACHINE',
    modesTitle: 'THE OTHER MODES',
    energyCost: 'energy',
    energyTitle: 'ENERGY',
    strongAgainst: 'STRONG AGAINST:',
    nothingSpecial: 'nothing in particular',
    weakTo: 'WEAK TO:',
    noWeakness: 'no ray in particular',
    switchTabs: 'Q / E  turn the page',
    demoJump: '1 - 5  jump to an era',
    resume: 'ESC  back to the action',
    cornerHint: 'or click a page corner',
    controlsTitle: 'HOW TO PLAY',
    tallyTitle: 'THE STORY SO FAR',
    inked: 'INKED!',
    notInked: 'NOT YET INKED',
    secret: 'SECRET!',
    noteLabel: "HANDLER'S NOTE",
    guideCount: 'ENTRY',
    here: 'YOU ARE HERE',
    locked: '???',
    lockedNote: 'Not yet observed.',
    guideUpdated: 'FIELD GUIDE UPDATED',
    guideHint: 'ARROWS  choose',
    continue: 'SPACE',
    truthLabel: 'ACTUALLY:',
    coverPrice: '10c',
    coverIssue: 'No. 1',
    coverSeal: ['ALL', 'ORIGINAL', 'RADIATION'],
    reportStamp: 'FILED',
    statPanels: 'PAGES INKED',
    statSecrets: 'SECRETS FOUND',
    statGuide: 'GUIDE PAGES',

    // The machine
    overdrive: 'OVERDRIVE',
    energyEmpty: 'EMPTY',
    spaceKey: 'SPACE',
    newGear: 'NEW!',

    // Timed eras and the boss
    surge: 'SURGE!',
    checkpoint: 'CHECKPOINT',
    eraShift: 'ERA SHIFT',
    ice: 'ICE: SLOWED',
    acid: 'ACID!',

    // Settings
    music: 'MUSIC',
    sound: 'SOUND',
    shake: 'SCREEN SHAKE',
    demo: 'DEMO MODE',
    god: 'GOD MODE',
    godNote: 'Nothing can hurt you.',
    demoNote: 'Start from any era on the cover',
    demoNoteBook: 'Start from any era on the cover, or jump to one from this book.',
    on: 'ON',
    off: 'OFF',
    settingsHint: 'W / S  choose     A / D  change     or click',
    settingsKeys: [
        { keys: ['W', 'S'], action: 'Choose' },
        { keys: ['A', 'D'], action: 'Change' },
        { keys: ['ENTER'], action: 'Switch, or press the button' },
    ],
    optionsTitle: 'EXTRAS',
    exit: 'EXIT TO HOME SCREEN',
    exitNote: 'Back to the cover. This run is not kept.',
    exitAsk: 'LEAVE THIS RUN?',
    exitAskNote: 'Everything inked so far will be lost.',
    exitStay: 'STAY',
    exitLeave: 'LEAVE',
    settingsBack: 'ESC  back to the cover',
    settingsAction: 'Settings',
    eraSelect: 'DEMO MODE: PICK AN ERA',
} as const;

export const MODE_LABELS: Record<RayMode, string> = { rgb: 'RGB', uv: 'UV', unprism: 'WHITE' };

/** Only used when the level data has no era of that style to take the name from */
export const ERA_FALLBACK_NAMES: Record<StyleId, string> = {
    goldenAge: 'Golden Age',
    cyberpunk: 'Cyberpunk',
    retro: 'Retro',
    manga: 'Manga',
    plain: 'Daylight',
    finalPage: 'The Prism',
};

/** Shown on the cover (`action`) and in the pause book (`detail`, where there is room): docs/DESIGN.md section 4 */
export const CONTROLS: { keys: string[]; action: string; detail: string }[] = [
    { keys: ['W', 'A', 'S', 'D'], action: 'Move', detail: 'Move' },
    { keys: ['MOUSE'], action: 'Aim', detail: 'Aim' },
    { keys: ['L-CLICK'], action: 'Fire', detail: 'Fire (hold for the laser and the blob)' },
    { keys: ['Q', 'E'], action: 'Wheel', detail: 'Turn the colour wheel' },
    { keys: ['F'], action: 'Mode', detail: 'Switch mode: RGB, UV, White' },
    { keys: ['SPACE'], action: 'Dash', detail: 'Dash' },
    { keys: ['ESC'], action: 'Pause', detail: 'Pause: this book' },
];
