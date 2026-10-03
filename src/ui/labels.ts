// The interface's own furniture: tab names, key caps, stamps. Story wording lives in
// src/config/text.ts; these are only the labels printed on the screens around it.

export const LABELS = {
    page: 'PAGE',
    paused: 'PAUSED',
    mapTab: 'THE PAGES',
    guideTab: 'FIELD GUIDE',
    switchTabs: 'Q / E  turn the page',
    resume: 'ESC  back to the action',
    here: 'YOU ARE HERE',
    locked: '???',
    lockedNote: 'Not yet observed.',
    guideUpdated: 'FIELD GUIDE UPDATED',
    continue: 'SPACE',
    truthLabel: 'ACTUALLY:',
    coverPrice: '10c',
    coverIssue: 'No. 1',
    coverSeal: ['ALL', 'ORIGINAL', 'RADIATION'],
    reportStamp: 'FILED',
    statPanels: 'PANELS INKED',
    statSecrets: 'SECRETS FOUND',
    statGuide: 'GUIDE PAGES',
} as const;

/** Shown on the cover and on the pause page */
export const CONTROLS: { keys: string[]; action: string }[] = [
    { keys: ['W', 'A', 'S', 'D'], action: 'Move' },
    { keys: ['MOUSE'], action: 'Aim' },
    { keys: ['L-CLICK'], action: 'Fire' },
    { keys: ['1', '2', '3', '4'], action: 'Switch' },
    { keys: ['ESC'], action: 'Pause' },
];
