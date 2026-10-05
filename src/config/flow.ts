// How an era starts, runs and ends. Times are in milliseconds unless they say otherwise.

export const FLOW = {
    /** Eras change with a quick fade to black and back */
    fade: 250,
    /** How long the banner shows before a fallen player's era starts again */
    restartDelay: 1300,
    /** How long the banner shows before the next era loads (sandbox rooms use roomDelay) */
    nextEraDelay: 1600,
    roomDelay: 900,
    /** The pause after the boss falls, and the white fade that follows it */
    endingDelay: 1400,
    endingFade: 900,

    /**
     * Guards against a UI that never answers. The player normally puts captions and cards away
     * himself, so these are long: nothing should start behind a card that is still being read.
     */
    introTimeout: 15000,
    introTimeoutPerLine: 5000,
    upgradeCardTimeout: 45000,

    /** The flash when the Prism redraws the square */
    styleFlash: 220,
};

/** Timed eras (RoomDef.continuous) */
export const ERA = {
    /** Seconds; used when ContinuousDef leaves them out */
    defaultSurge: 20,
    defaultCheckpointEvery: 45,
    /** The first arrival comes this soon after the clock starts */
    firstSpawn: 900,
    /** During the final surge the wait between arrivals is multiplied by this */
    surgeInterval: 0.5,
    /** With the square full, look again this often */
    fullRetry: 300,
    /** When the clock runs out, whatever is left goes in a wave spreading out from the player */
    purgeSpread: 650,
    purgePop: 260,
    purgeFlash: 260,
};

/** The cracked wall and what falls out of it */
export const SECRET = {
    /** Above the city picture, below everything that stands on it */
    depth: 0.6,
    /** The upgrade hops out of the wall over this long */
    dropTime: 380,
    shake: { duration: 140, intensity: 0.004 },
};

/** The boss is put down by hand: far too big for the usual search for open floor */
export const BOSS_ENTRY = {
    /** Its marker shows this many times longer than an ordinary spawn's */
    telegraphScale: 2,
    /** It comes in by the top street unless the player is within this many times SPAWN.minDistance of it */
    clearance: 1.4,
};

/** The ending: an ordinary afternoon */
export const ENDING_SCENE = {
    /** The square comes back out of the white the boss era ended on */
    fadeIn: 1200,
    fadeOut: 800,
    /** He keeps the torch for this long at most... */
    playTime: 14000,
    /** ...or until he has shone it at this many different people */
    peopleToBother: 3,
    /** Quiet beats between the steps of the sequence */
    beat: 900,
    /** Guards against a caption or a card that is never answered */
    dialogTimeout: 20000,
    dialogTimeoutPerLine: 6000,
    screenTimeout: 90000,
    /** Pigeons and dogs move off when he walks this close */
    shooDistance: 13,
    /** Someone walking through stops and waits while he is this close */
    walkerPause: 16,
    walkerSpeed: 22,
};
