import type { ArtStyle, MonsterDef, MonsterId, RayId } from '../types';

// Sizes and speeds are in world units (see config/world.ts); times are in milliseconds.
// The player walks at 70 and has 100 health.
export const MONSTERS: Record<MonsterId, MonsterDef> = {
    rat: {
        id: 'rat',
        class: 'swarm',
        name: 'Rat',
        color: 0x6fdc6f,
        radius: 3,
        maxHealth: 10,
        speed: 46,
        contactDamage: 5,
        weakTo: ['white'],
        resists: [],
    },
    slime: {
        id: 'slime',
        class: 'swarm',
        name: 'Slime',
        color: 0x4fd6ff,
        radius: 5,
        maxHealth: 26,
        speed: 30,
        contactDamage: 8,
        weakTo: ['red'],
        resists: ['uv'],
    },
    ghost: {
        id: 'ghost',
        class: 'stealth',
        name: 'Ghost',
        color: 0x6a4fa3,
        radius: 6,
        maxHealth: 60,
        speed: 34,
        contactDamage: 15,
        weakTo: [],
        resists: [],
    },
    ironclad: {
        id: 'ironclad',
        class: 'armor',
        name: 'Ironclad',
        color: 0x9aa0a8,
        radius: 7,
        maxHealth: 110,
        speed: 18,
        contactDamage: 10,
        weakTo: ['green'],
        resists: ['white', 'red', 'uv'],
    },
    bat: {
        id: 'bat',
        class: 'swarm',
        name: 'Bat',
        color: 0x6fdc6f,
        radius: 3,
        maxHealth: 8,
        speed: 50,
        contactDamage: 5,
        weakTo: [],
        resists: [],
    },
    golem: {
        id: 'golem',
        class: 'armor',
        name: 'Golem',
        color: 0x9aa0a8,
        radius: 10,
        maxHealth: 221,
        speed: 46,
        contactDamage: 16,
        weakTo: [],
        resists: [],
    },
    zigbat: {
        id: 'zigbat',
        class: 'speed',
        name: 'Zig-zag Bat',
        color: 0xffd23f,
        radius: 3,
        maxHealth: 14,
        speed: 60,
        contactDamage: 6,
        weakTo: [],
        resists: [],
    },
    skitter: {
        id: 'skitter',
        class: 'speed',
        name: 'Skitter',
        color: 0xffd23f,
        radius: 5,
        maxHealth: 36,
        speed: 62,
        contactDamage: 9,
        weakTo: [],
        resists: [],
    },
    wraith: {
        id: 'wraith',
        class: 'stealth',
        name: 'Wraith',
        color: 0xd0507a,
        radius: 6,
        maxHealth: 44,
        speed: 50,
        contactDamage: 12,
        weakTo: [],
        resists: [],
    },
    snowman: {
        id: 'snowman',
        class: 'projectile',
        name: 'Snowman',
        color: 0xbfe9ff,
        radius: 7,
        maxHealth: 55,
        speed: 20,
        contactDamage: 8,
        weakTo: [],
        resists: [],
    },
    acidSlime: {
        id: 'acidSlime',
        class: 'projectile',
        name: 'Acid Slime',
        color: 0x9be35a,
        radius: 8,
        maxHealth: 70,
        speed: 16,
        contactDamage: 10,
        weakTo: [],
        resists: [],
    },
    prism: {
        id: 'prism',
        class: 'boss',
        name: 'The Prism',
        color: 0xff7ad9,
        radius: 13,
        // About two minutes of fighting through the era rules: see PRISM
        // v2.4 took a fifth off the 1400 it began with; v2.5 a tenth more
        maxHealth: 1008,
        speed: 24,
        contactDamage: 14,
        weakTo: [],
        resists: [],
    },
};

/** Shared by everything that walks */
export const MOVEMENT = {
    /** Milliseconds for a monster to swing its velocity round to a new heading */
    turnTime: 110,
    /** How often a monster re-plans its route */
    replanEvery: 140,
    /** Monsters closer than their radii plus this push each other apart */
    separation: 3,
    separationStrength: 0.9,
    /** How often a monster looks at its neighbours; the push is held in between (cheap with 60 alive) */
    crowdEvery: 70,
    /** A monster that touches the player bounces off, so one mistake is one hit */
    bounceSpeed: 70,
    bounceDuration: 180,
};

/** Shared by everything that flies */
export const FLIGHT = {
    /** How far below a flyer its shadow lies */
    height: 5,
    /** The flutter up and down, in world units, and how fast it goes (radians per millisecond) */
    bob: 1.4,
    bobRate: 0.011,
};

export const SWARMLET = {
    /** Sideways weave, as a fraction of forward speed */
    wobble: 0.55,
    wobbleRate: 0.006,
    /** Each one aims at its own spot around the player until it is this close */
    encircleRadius: 14,
    commitDistance: 26,
    /** Speeds differ by up to this fraction so the flock strings out */
    speedSpread: 0.18,
    separation: 5,
};

/** How a stealth enemy hides, dashes and is exposed. The ghost and the wraith differ only in these. */
export interface StealthTuning {
    hiddenAlpha: number;
    /** The shimmer an attentive player can spot, once every shimmerPeriod */
    shimmerAlpha: number;
    shimmerPeriod: number;
    /** Starts a dash from this far away, if it can see the player */
    dashRange: number;
    windup: number;
    windupAlpha: number;
    dashSpeed: number;
    dashDuration: number;
    /** Dashes in a row; each after the first has its own short wind-up */
    dashes: number;
    chainWindup: number;
    recover: number;
    /** Ultraviolet freezes it for this long... */
    exposeStun: number;
    /** ...and it stays visible, and can be hurt by any ray, for this long after that */
    revealFor: number;
    /** True if it keeps attacking while it can be seen */
    attacksRevealed: boolean;
}

export const STEALTH: Record<'ghost' | 'wraith', StealthTuning> = {
    ghost: {
        hiddenAlpha: 0.05,
        shimmerAlpha: 0.16,
        shimmerPeriod: 1700,
        dashRange: 58,
        windup: 550,
        windupAlpha: 0.55,
        dashSpeed: 165,
        dashDuration: 420,
        dashes: 1,
        chainWindup: 0,
        recover: 900,
        exposeStun: 800,
        revealFor: 3000,
        attacksRevealed: false,
    },
    // The ghost's meaner relative: quicker, dashes twice, does not wait to be hidden again
    wraith: {
        hiddenAlpha: 0.07,
        shimmerAlpha: 0.26,
        shimmerPeriod: 1200,
        dashRange: 66,
        windup: 420,
        windupAlpha: 0.6,
        dashSpeed: 185,
        dashDuration: 330,
        dashes: 2,
        chainWindup: 280,
        recover: 650,
        exposeStun: 500,
        revealFor: 1500,
        attacksRevealed: true,
    },
};

/** Shared by both stealth enemies */
export const EXPOSURE = {
    /** Ultraviolet halves a stealth enemy's health no more often than this */
    every: 1000,
    /** Halving stops here: an exposure that would leave less than this finishes it */
    finishBelow: 4,
};

export const IRONCLAD = {
    /** It tries to stay between these distances from the player */
    nearRange: 54,
    farRange: 92,
    windup: 650,
    cooldown: 2300,
    /** First throw comes this long after it appears */
    firstThrow: 1200,
    projectileSpeed: 78,
    projectileDamage: 14,
};

export const SLIME = {
    /** It squashes down for this long before every hop: the tell */
    crouch: 170,
    hopSpeed: 92,
    hopTime: 250,
    /** It sits still between hops for a time between these two, so it can be side-stepped */
    rest: [380, 620],
    separation: 4,
};

export const BAT = {
    /** Speeds differ by up to this fraction so a flock does not arrive as one blob */
    speedSpread: 0.15,
    separation: 4,
};

/** MONSTERS.golem.speed is its full rolling speed */
export const GOLEM = {
    /** It rocks on the spot for this long, facing where it will go, before every roll */
    windup: 700,
    /** Time to reach full speed */
    spinUp: 450,
    /** A roll never lasts longer than this */
    maxRoll: 2100,
    /** It carries on this far past where the player was, then has to stop and turn */
    overshoot: 30,
    /** Rolling to a corner on its way round something, it goes at least this far */
    minRoll: 28,
    /** It plans its route as if it were this wide (its body is MONSTERS.golem.radius) */
    planRadius: 7,
    /** It stops to turn when the player is more than this many degrees off its line */
    giveUpAngle: 75,
    rest: 420,
    /** Fraction of a push that moves it at all */
    knockback: 0.12,
    /** After its touch hurts, it stands still for this long so the player can get clear */
    touchRest: 700,
};

/** MONSTERS.zigbat.speed is its speed towards the player */
export const ZIGBAT = {
    /** Sideways speed as a fraction of forward speed */
    swing: 1.35,
    /** Milliseconds for one full left-right-left */
    period: 760,
    /** Closer than this it stops weaving and comes straight in */
    straightenWithin: 16,
    separation: 4,
};

export const SKITTER = {
    /** It starts a bite from this far away, if it can see the player */
    biteRange: 36,
    windup: 320,
    lungeSpeed: 150,
    lungeTime: 250,
    recover: 560,
    /** Hurt, it bolts for this long at this speed to somewhere else */
    fleeSpeed: 170,
    fleeTime: 340,
    /** It cannot bolt again for this long: the window in which a second hit lands */
    fleeCooldown: 1500,
    /** It bolts away from the player, turned by up to this many degrees either way */
    fleeTurn: 65,
};

export const PROJECTILE = {
    radius: 3,
    lifetime: 5000,
    /** Never more than this many in the air; the oldest goes first */
    cap: 48,
    /** What a projectile pushed back by White does to an enemy it hits */
    deflectDamage: 8,
    deflectedLifetime: 1600,
    /** How high a lobbed projectile rises at the top of its arc */
    lobHeight: 16,
};

/** Keeps its distance like the Ironclad; its snowballs land where the player stood and leave ice */
export const SNOWMAN = {
    nearRange: 50,
    farRange: 96,
    windup: 600,
    cooldown: 2100,
    firstThrow: 1000,
    projectileSpeed: 85,
    projectileDamage: 8,
    /** A snowball lands this far past where the player was when it was thrown */
    overshoot: 6,
};

/** Lobs acid over everything onto where the player is standing; the marker shows where */
export const ACID_SLIME = {
    nearRange: 44,
    farRange: 104,
    windup: 700,
    cooldown: 3000,
    firstThrow: 1400,
    /** Time in the air: how long the player has to step off the marker */
    flight: 900,
};

/** Ice patches and acid pools (src/entities/Hazard.ts) */
export const HAZARD = {
    /** Never more than this many on the floor; the oldest goes first */
    cap: 14,
    /** The last part of a patch's life is spent fading out */
    fade: 900,
    /** A new patch this close to one of the same kind renews it instead */
    merge: 7,
    ice: {
        radius: 11,
        lifetime: 6000,
        /** The player's speed on ice, as a fraction */
        slow: 0.55,
        /** Milliseconds for his velocity to catch up with the keys: the slide */
        grip: 230,
    },
    acid: {
        radius: 10,
        lifetime: 5000,
        damage: 4,
        /** Milliseconds between burns while he stands in it */
        tick: 700,
        /** Crossing a pool quicker than this costs nothing */
        grace: 250,
    },
};

/** How the Prism fights in one era, as multiples of its plain (Golden) numbers */
export interface PrismEra {
    speed: number;
    windup: number;
    dashSpeed: number;
    /** The pause between attacks */
    rest: number;
}

/**
 * The boss. A loop of three attacks: dash, dash, then switch the era (docs/DESIGN.md section 6).
 * MONSTERS.prism.speed is its walking speed in the Golden era.
 */
export const PRISM = {
    /** The eras it cycles through; it starts in the one the room is drawn in */
    eras: ['goldenAge', 'cyberpunk', 'retro', 'manga'] as ArtStyle[],
    /** Still and harmless for this long when it appears, so the fight never starts with a hit */
    intro: 1400,

    /** Starts a dash from this far away, if it can see the player */
    dashRange: 100,
    windup: 800,
    dashSpeed: 150,
    dashDuration: 560,
    recover: 700,
    /** After a dash it walks for at least this long before the next attack */
    rest: 900,
    /** After its touch hurts the player it draws back for this long, so they can get away */
    touchRecover: 900,
    backOffSpeed: 44,

    /** The coming era shows over its head for this long; it stands still and can be hit freely (v2.6) */
    telegraph: 2000,
    /** Dashes between one era switch and the next */
    attacksPerEra: 3,
    /** A beat after the switch before it moves again */
    swapPause: 600,
    /** Nothing hurts it for this long after a switch; it blinks until it can be hurt again (v2.6) */
    swapShield: 1000,

    era: {
        goldenAge: { speed: 1, windup: 1, dashSpeed: 1, rest: 1 },
        cyberpunk: { speed: 1.6, windup: 0.7, dashSpeed: 1.25, rest: 0.6 },
        retro: { speed: 1.2, windup: 1, dashSpeed: 1.05, rest: 1 },
        manga: { speed: 1, windup: 1.1, dashSpeed: 0.95, rest: 1.1 },
        plain: { speed: 1, windup: 1, dashSpeed: 1, rest: 1 },
    } as Record<ArtStyle, PrismEra>,

    /**
     * Company arrives with every switch: one on the first, one more each time after. Who comes
     * depends on the era it has switched to.
     */
    minions: {
        byEra: {
            // Armour comes first: it is what the eras themselves show least of
            goldenAge: ['golem', 'ironclad', 'rat'],
            cyberpunk: ['ironclad', 'zigbat', 'skitter'],
            retro: ['golem', 'ghost', 'wraith'],
            manga: ['ironclad', 'snowman', 'acidSlime'],
            plain: [],
        } as Record<ArtStyle, MonsterId[]>,
        /** How many arrive with every switch (v2.4) */
        perSwitch: 2,
        /** Never more than this many alive beside the boss: with 3 already there, a switch brings 1 */
        limit: 4,
        radius: 34,
        /** Not called when the boss is nearly dead, so none arrives after it falls */
        minHealth: 0.12,
    },

    /** Retro: it fades out between attacks; only Ultraviolet lets the other rays bite properly */
    stealth: {
        hiddenAlpha: 0.08,
        shimmerAlpha: 0.24,
        windupAlpha: 0.65,
        /** Damage it takes while hidden, as a fraction */
        hiddenMultiplier: 0,
        stun: 600,
        revealFor: 4000,
        /** What each exposure costs it, no more than once every exposeEvery */
        uvDamage: 40,
        exposeEvery: 1000,
    },

    /** Manga: every dash ends in a ring of shards for White to push back */
    shards: {
        count: 10,
        speed: 66,
        damage: 10,
        /** What a shard pushed back into the Prism costs it: the way to hurt it with White alone */
        returnDamage: 45,
    },
};

export const SPAWN = {
    /** How long the marker shows before the monster appears */
    telegraph: 600,
    /** Monsters never appear closer to the player than this */
    minDistance: 56,
    /** If the player walks onto a marker, the spawn moves and is announced again */
    crowdedDistance: 26,
    retries: 3,
};

export const HEART = {
    heal: 25,
    /** Chance that a dying monster leaves a heart */
    dropChance: {
        rat: 0.04,
        slime: 0.08,
        ghost: 0.14,
        ironclad: 0.18,
        bat: 0.04,
        golem: 0.25,
        zigbat: 0.06,
        skitter: 0.1,
        wraith: 0.12,
        snowman: 0.14,
        acidSlime: 0.16,
        prism: 0,
    } as Record<MonsterId, number>,
    /** Below this fraction of health, drops are more likely */
    lowHealth: 0.3,
    lowHealthMultiplier: 3,
    /** A dropped heart blinks out after this long */
    lifetime: 14000,
    /** A heart waits at the start after this many deaths in the same room */
    mercyDeaths: 2,
};
