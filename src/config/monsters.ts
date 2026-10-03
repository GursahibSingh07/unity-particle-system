import type { MonsterDef, MonsterId, RadiationId } from '../types';

// Sizes and speeds are in world units (see config/world.ts); times are in milliseconds.
// The player walks at 70 and has 100 health.
export const MONSTERS: Record<MonsterId, MonsterDef> = {
    swarmlet: {
        id: 'swarmlet',
        name: 'Swarmlet',
        color: 0x6fdc6f,
        radius: 3,
        maxHealth: 10,
        speed: 42,
        contactDamage: 5,
        weakTo: ['radio'],
        resists: [],
    },
    frostling: {
        id: 'frostling',
        name: 'Frostling',
        color: 0x4fd6ff,
        radius: 6,
        maxHealth: 40,
        speed: 30,
        contactDamage: 12,
        weakTo: ['infrared'],
        resists: ['ultraviolet'],
    },
    shade: {
        id: 'shade',
        name: 'Shade',
        color: 0x6a4fa3,
        radius: 6,
        maxHealth: 60,
        speed: 34,
        contactDamage: 15,
        weakTo: ['ultraviolet'],
        resists: [],
    },
    ironclad: {
        id: 'ironclad',
        name: 'Ironclad',
        color: 0x9aa0a8,
        radius: 7,
        maxHealth: 120,
        speed: 18,
        contactDamage: 10,
        weakTo: ['gamma'],
        resists: ['radio', 'infrared', 'ultraviolet'],
    },
    prism: {
        id: 'prism',
        name: 'The Prism',
        color: 0xff7ad9,
        radius: 13,
        maxHealth: 1390,
        speed: 16,
        contactDamage: 12,
        // The Prism's weakness changes with its phase: see PRISM.phases
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
    /** A monster that touches the player bounces off, so one mistake is one hit */
    bounceSpeed: 70,
    bounceDuration: 180,
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

export const SHADE = {
    hiddenAlpha: 0.05,
    /** The shimmer an attentive player can spot */
    shimmerAlpha: 0.16,
    shimmerPeriod: 1700,
    /** Starts a dash from this far away, if it can see the player */
    dashRange: 58,
    windup: 550,
    windupAlpha: 0.55,
    dashSpeed: 165,
    dashDuration: 420,
    recover: 900,
    /** How long it stays visible (and hurtable) after the stun wears off */
    revealLinger: 1600,
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

export const PROJECTILE = {
    radius: 3,
    lifetime: 5000,
};

export interface PrismPhase {
    weakTo: RadiationId;
    /** Health in this phase; they add up to MONSTERS.prism.maxHealth */
    health: number;
}

export const PRISM = {
    phases: [
        { weakTo: 'radio', health: 170 },
        { weakTo: 'infrared', health: 560 },
        { weakTo: 'ultraviolet', health: 300 },
        { weakTo: 'gamma', health: 360 },
    ] as PrismPhase[],
    /** Untouchable and still for this long while it changes colour */
    phaseShift: 1100,
    /** After its touch hurts the player it draws back for this long, so they can get away */
    touchRecover: 900,
    backOffSpeed: 44,

    // Radio phase: drifts after the player and calls swarmlets
    summonWindup: 800,
    summonCooldown: 5000,
    summonCount: 4,
    summonLimit: 8,
    summonRadius: 30,

    // Infrared phase: chases, with a short charge
    chaseSpeed: 30,
    chargeWindup: 650,
    chargeCooldown: 3200,
    chargeSpeed: 135,
    chargeDuration: 640,
    chargeRange: 90,

    // Ultraviolet phase: fades out and dashes like a Shade
    stalkSpeed: 28,
    dashRange: 80,
    dashWindup: 750,
    dashSpeed: 150,
    dashDuration: 520,
    dashRecover: 1100,
    stunDuration: 1500,
    revealLinger: 3000,

    // Gamma phase: keeps away and throws volleys
    volleyWindup: 750,
    volleyCooldown: 2600,
    volleyCount: 5,
    /** Degrees between neighbouring projectiles in a fan */
    volleySpread: 14,
    /** Every third volley is a full ring of this many */
    ringCount: 10,
    projectileSpeed: 84,
    projectileDamage: 12,
    nearRange: 60,
    farRange: 100,
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
        swarmlet: 0.04,
        frostling: 0.1,
        shade: 0.14,
        ironclad: 0.18,
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
