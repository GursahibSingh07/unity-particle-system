import type { RayMode, StyleId } from '../types';

// The interface's own furniture: tab names, key caps, stamps. Story wording lives in
// src/config/text.ts; these are only the labels printed on the screens around it.

export const LABELS = {
    page: 'PAGE',
    paused: 'PAUSED',
    mapTab: 'THE PAGES',
    guideTab: 'FIELD GUIDE',
    settingsTab: 'SETTINGS',
    switchTabs: 'Q / E  turn the page',
    resume: 'ESC  back to the action',
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
    demoNote: 'Start from any era on the cover',
    on: 'ON',
    off: 'OFF',
    settingsHint: 'W / S  choose     A / D  change     or click',
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

/** Shown on the cover and on the pause page (docs/DESIGN.md section 4) */
export const CONTROLS: { keys: string[]; action: string }[] = [
    { keys: ['W', 'A', 'S', 'D'], action: 'Move' },
    { keys: ['MOUSE'], action: 'Aim' },
    { keys: ['L-CLICK'], action: 'Fire' },
    { keys: ['Q', 'E'], action: 'Wheel' },
    { keys: ['F'], action: 'Mode' },
    { keys: ['SPACE'], action: 'Dash' },
    { keys: ['ESC'], action: 'Pause' },
];
