import type { ArtStyle, GuideEntry, MonsterId, RayId, RayMode, StyleId, UpgradeId } from '../types';

// All player-facing words live here so they can be edited in one place.
// Captions are shown one line at a time in a comic caption box: keep each string to about
// 60 characters. Era intro captions live with each era in src/config/levels.
//
// The voice is the Handler's own, and it thins as the eras go on, like the drawing: florid in
// the Golden era, clipped in Cyberpunk, terse in Retro, almost wordless in Manga. The ending is
// in a plain voice, and the officer is patient.

export const TITLE = {
    name: 'LIGHT HANDLER',
    tagline: 'He sees what no one else can!',
    prompt: 'Press any key',
};

/** What each era is called. The level names in src/config/levels match these. */
export const ERA_NAMES: Record<StyleId, string> = {
    goldenAge: 'Golden Age',
    cyberpunk: 'Neon Dusk',
    retro: 'Late Edition',
    manga: 'White Page',
    finalPage: 'The Final Page',
    plain: 'An Ordinary Afternoon',
};

/**
 * What each era does to the machine, in the fewest words: for the pause page, and for the
 * moment the boss switches era.
 */
export const ERA_RULE_LINES: Record<ArtStyle, string> = {
    goldenAge: 'The full wheel. No dash.',
    cyberpunk: 'No Blue. One dash.',
    retro: 'Overdrive. The wheel turns itself. F for UV.',
    manga: 'White light only.',
    plain: 'A pocket torch.',
};

/** What the mode key (F) cycles through, as the HUD names them */
export const MODE_NAMES: Record<RayMode, string> = {
    rgb: 'WHEEL',
    uv: 'UV LENS',
    unprism: 'UNPRISM',
};

/** Small words for the HUD */
export const HUD_WORDS = {
    wheelLocked: 'LOCKED',
    overdrive: 'OVERDRIVE',
    dash: 'DASH',
    energyEmpty: 'RECHARGING',
    wave: 'WAVE',
    survive: 'SURVIVE',
};

/**
 * Field Guide pages. Each `note` is the Handler's own, and is also literally true of what
 * the thing really was; `truth` is the same fact as the attending officer wrote it down.
 */
export const GUIDE: Record<MonsterId, GuideEntry> = {
    // Golden era: he has words to spare
    rat: {
        title: 'Rat Pack',
        note: 'Small, grey, and never alone! They crowd about my feet as if I carried bread. One wide flash and the whole pack scatters.',
        truth: 'Pigeons, on foot. Scattered when the subject ran at them with the torch. None harmed.',
    },
    slime: {
        title: 'Slime',
        note: 'Low to the ground and always in a bunch, as if tied together! They bounce at my ankles and will not be put off.',
        truth: 'Four small dogs on leads, with their walker. Excitable. Jumped up at the subject. No bites.',
    },
    bat: {
        title: 'Bat',
        note: 'A dark cloud of them, straight over the fountain and straight at my head! They never set foot on the ground. Sweep a wide light across and the whole cloud turns.',
        truth: 'Starlings. They roost on the town hall and fly low over the square at that hour every day.',
    },
    ironclad: {
        title: 'Ironclad',
        note: 'A hard shell on top! It keeps its distance, takes its time, and throws things at me. Only a red light ever stops it.',
        truth: 'Cyclist wearing a helmet. Threw a water bottle at the subject. Has been spoken to about that.',
    },
    golem: {
        title: 'Golem',
        note: 'Enormous! Slow to start and slower to turn. It rolls straight at me, and I cannot see a thing behind it. Step aside and it goes by.',
        truth: 'Delivery driver pushing a loaded trolley. Could not see over the boxes. Asked the subject to move, twice.',
    },
    // Cyberpunk: clipped
    zigbat: {
        title: 'Zig-zag Bat',
        note: 'Small. Fast. Never a straight line. It thinks this is a game. Slow it first.',
        truth: 'Child on a scooter, aged about nine, weaving between people. Thought it was a game. Parent present.',
    },
    skitter: {
        title: 'Skitter',
        note: 'Quick on its feet. Light it and it bolts. It always comes back round.',
        truth: 'Jogger doing laps of the square. Ran off each time the torch was shone at her. Kept to her route.',
    },
    // Retro: terse
    ghost: {
        title: 'Ghost',
        note: 'Unseen until the light is on its face. Then it stops dead.',
        truth: 'Man in a dark coat, walking home at dusk. Stopped when a torch was shone in his eyes.',
    },
    wraith: {
        title: 'Wraith',
        note: 'By the cinema doors. Does not wait. Comes twice.',
        truth: 'Doorman at the cinema, in a dark uniform. Came out twice to ask the subject to move along.',
    },
    // Manga: almost nothing left
    snowman: {
        title: 'Snowman',
        note: 'White. Cold. Keeps back. The ground goes slick.',
        truth: 'Ice-cream vendor in a white coat, behind his cart. Several cones dropped. Paving slippery.',
    },
    acidSlime: {
        title: 'Acid Slime',
        note: 'Wet. It stings. Do not stand in it.',
        truth: 'Window cleaner with a bucket. Soapy water on the paving. It does sting, if it gets in the eyes.',
    },
    prism: {
        title: 'The Prism',
        note: 'It wails. Red, then blue, then red. Of all the people in the square, it came for me.',
        truth: 'Police patrol car, lights and siren on. Sent after several calls from the public.',
    },
};

/** Shown on the card when an era hands the player something: the control, in the fewest words */
export const UPGRADES: Record<UpgradeId, { title: string; line: string }> = {
    blue: { title: 'BLUE RAY', line: 'Click: a wide cone. Q and E turn the wheel.' },
    red: { title: 'RED RAY', line: 'Hold click: a laser. Strongest up close.' },
    green: { title: 'GREEN RAY', line: 'Hold to charge, release: a blob that slows.' },
    white: { title: 'UNPRISM', line: 'Click: white light throws everything back.' },
    uv: { title: 'UV LENS', line: 'F switches lens. UV shows what hides.' },
    dash: { title: 'DASH', line: 'Space: dash through anything, unhurt.' },
    doubleDash: { title: 'DOUBLE DASH', line: 'Space, twice: two dashes, then a wait.' },
};

/** The same words for the five rays alone (the v1 item card reads this) */
export const ITEM_GET: Record<RayId, { title: string; line: string }> = {
    blue: UPGRADES.blue,
    red: UPGRADES.red,
    green: UPGRADES.green,
    white: UPGRADES.white,
    uv: UPGRADES.uv,
};

/**
 * Comic sound words that pop up on a hit: the player learns what suits what from these.
 * `weak` is the enemy being weak to the ray (a strong hit: big and electric); `resist` is the
 * ray barely scratching it (small and dull).
 */
export const ONOMATOPOEIA = {
    weak: ['KRAKA-ZAP!', 'FZZAAAK!', 'BLAZAM!', 'SKRAZZT!', 'ZZARRK!', 'KA-THOOM!', 'VZZOWW!'],
    normal: ['pow', 'bap', 'zot', 'thwap', 'whap', 'biff'],
    resist: ['tink', 'plip', 'pff', 'tik', 'dink', 'fup'],
};

export const BANNERS = {
    roomCleared: 'The square is held!',
    roomFailed: 'Our hero falls! Once more...',
    secret: 'A hidden panel!',
    /** For the end of an era, when the page turns */
    levelCleared: 'Page turned!',
    /** Timed eras: a 45-second checkpoint was reached */
    checkpoint: 'Checkpoint!',
    /** Timed eras: the final surge begins */
    surge: 'Here they all come!',
    /** Timed eras: the clock ran out and the player is still standing */
    timeUp: 'Time! The square is held!',
    /** Timed eras: died, and going back to the last checkpoint */
    checkpointRetry: 'Back to the checkpoint...',
    /** The health upgrade from behind a cracked wall was picked up */
    healthUp: 'Tougher!',
};

/** The boss fight: shown while the coming era hangs over the Prism's head, and as it lands */
export const BOSS_WORDS = {
    telegraph: 'THE PAGE TURNS!',
    /** The big word as the square redraws, by the era it switched to */
    swapped: {
        goldenAge: 'GOLDEN AGE!',
        cyberpunk: 'NEON DUSK!',
        retro: 'LATE EDITION!',
        manga: 'WHITE PAGE!',
        plain: '',
    } as Record<ArtStyle, string>,
};

/** Caption lines for the ending, shown one at a time */
export const ENDING = {
    /** The comic styles drop away and the detail returns; narration, now in a plain voice */
    reveal: [
        'The Prism goes dark. So does everything else.',
        'Then the colour comes back. All of it. Every window.',
        'A city square on an ordinary afternoon. A fountain.',
        'People, rubbing their eyes. Some dogs. Some pigeons.',
        'In his hand: a small pocket torch.',
    ],
    /** The officer, patient throughout */
    arrest: [
        '"Afternoon, sir. That\'s a bright little torch."',
        '"Could you point it at the ground for me? Thank you."',
        '"A few people rang us. Nobody\'s hurt. A bit dazzled."',
        '"You\'re not in trouble. Well. A very small amount."',
        '"The city? Yes. It\'s safe. You can stand down now."',
        '"Come and sit in the car. We\'ve rung your sister."',
        '"She says it\'s been a hard few weeks. Let\'s get you home."',
        '"Keep hold of the torch if you like. Just switch it off."',
    ],
    /** The arrest report card: one "Label: value" entry per line, ending with the charge */
    report: [
        'INCIDENT REPORT',
        'Place: City Square, by the fountain.',
        'Time: 3.40 pm. Weather: bright.',
        'Subject: Adult male. Gives name as "the Light Handler".',
        'Item: One pocket torch. Batteries low.',
        'Reported by: A cyclist. A delivery driver. A jogger.',
        'Also: An ice-cream vendor. A window cleaner.',
        'Also: The cinema doorman. A man in a dark coat.',
        'Declined to complain: A child on a scooter. Enjoyed it.',
        'No statement: Pigeons. Starlings. Four small dogs.',
        'Injuries: None. Some squinting.',
        'Manner: Polite. Asked if the city was safe. Told yes.',
        'Action: Arrested. Driven home. Sister present.',
        'Property: Torch returned to subject.',
        'CHARGE: Causing mild annoyance to the public.',
    ],
    guideHeading: 'FIELD GUIDE (as corrected by the attending officer)',
    credits: [
        'LIGHT HANDLER',
        'Made for TGC GameJam 2026',
        '',
        'Gursahib Singh',
        'Abhishek Bhadiyadra',
        'Shardul Kholam',
        'Laveena Jain',
        'Harshil Soni',
        '',
        'Art and music are generated by the game\'s own code. AI tools were used: see CREDITS.md.',
        'No pigeons were harmed in the making of this game.',
        'Thank you for playing.',
    ],
};
