import type { ArtStyle, EnemyClass, RayDef, RayId, WeaponRule } from '../types';

// Plain data (no Phaser): the five rays, what each is good against, and the rule every era puts
// on the EMW Machine. Distances and speeds are in world units (see config/world.ts), times in
// milliseconds. The player walks at 70; a rat has 10 health, a slime 40, an Ironclad 120.

export const RAYS: Record<RayId, RayDef> = {
    // The safe default: wide, cheap, hits everything in front. 40 a second to each target.
    blue: {
        id: 'blue',
        name: 'Blue',
        key: 1,
        color: 0x3fa9ff,
        damage: 12,
        energyCost: 8,
    },
    // Continuous laser: both values are per second, and the damage is what it does point-blank
    // (see RED.farDamage for what is left of it at full range)
    red: {
        id: 'red',
        name: 'Red',
        key: 2,
        color: 0xff4636,
        damage: 84,
        energyCost: 32,
    },
    // Slow to fire and hungry, but it bursts over an area and slows what it touches
    green: {
        id: 'green',
        name: 'Green',
        key: 3,
        color: 0x62f05a,
        damage: 13,
        energyCost: 28,
    },
    // Defensive: the damage is small, the push is the point
    white: {
        id: 'white',
        name: 'White',
        key: 4,
        color: 0xfff4d6,
        damage: 12,
        energyCost: 16,
    },
    // Does no damage of its own: a revealed stealth enemy loses half its health instead
    uv: {
        id: 'uv',
        name: 'UV',
        key: 5,
        color: 0xb48cff,
        damage: 0,
        energyCost: 12,
    },
};

/** How much of a ray's damage each class of enemy takes (docs/DESIGN.md section 5) */
export const RAY_VS_CLASS: Record<RayId, Record<EnemyClass, number>> = {
    blue: { swarm: 1, armor: 1, speed: 1, stealth: 1, projectile: 1, boss: 1 },
    red: { swarm: 1, armor: 1.5, speed: 1, stealth: 1, projectile: 1, boss: 1 },
    green: { swarm: 1, armor: 1, speed: 2, stealth: 1, projectile: 1, boss: 1 },
    white: { swarm: 1.5, armor: 0.25, speed: 0.25, stealth: 0.25, projectile: 1.5, boss: 0.25 },
    // Stealth enemies are hurt through exposeToUv(), not through this number
    uv: { swarm: 0, armor: 0, speed: 0, stealth: 1, projectile: 0, boss: 0 },
};

export const ENERGY = {
    max: 100,
    regenPerSecond: 26,
    /** Milliseconds after the last shot before energy starts to regenerate */
    regenDelay: 450,
    /** After running dry, the machine stays locked until energy is back to this */
    recoverAt: 22,
};

/** A cone flash in front, stopped by walls and by ray-blockers */
export const BLUE = {
    range: 60,
    /** Half of the cone's opening angle, in degrees */
    halfAngle: 30,
    cooldown: 300,
    flashDuration: 190,
};

/** A laser held on the aim line, stopped by walls and by the first ray-blocker */
export const RED = {
    range: 112,
    /** Fraction of the point-blank damage left at full range: 21 a second, under Blue's 40 */
    farDamage: 0.25,
    /** How wide the beam counts as when testing what it touches */
    hitWidth: 3,
    /** How wide it is drawn at the muzzle and at full range */
    nearWidth: 7,
    farWidth: 1,
};

/** Hold to charge, release a blob that bursts and slows */
export const GREEN = {
    chargeTime: 550,
    /** Any tap fires (v2.2): there is no charge too small */
    minCharge: 0,
    /**
     * Damage of an uncharged blob as a fraction of a full one. Two thirds means what a full
     * charge kills in two hits, a tap kills in three.
     */
    minPower: 0.67,
    /** How far an uncharged blob travels; a full charge goes the whole `range` */
    minRange: 30,
    /** The Handler walks at this fraction of his speed while charging */
    moveScale: 0.6,
    /** Pause after a blob before the next charge can start */
    cooldown: 160,
    blobSpeed: 175,
    blobRadius: 3.5,
    range: 132,
    burstRadius: 13,
    /** Enemies caught in the burst move at this fraction of their speed, for this long */
    slowFactor: 0.45,
    slowDuration: 2600,
    /** The burst leaves a puddle that keeps slowing whatever stands in it */
    puddleDuration: 7000,
    puddleEvery: 200,
    puddleSlowDuration: 500,
};

/** A ring around the player that pushes enemies and projectiles away */
export const WHITE = {
    range: 37,
    cooldown: 600,
    knockbackSpeed: 170,
    knockbackDuration: 280,
    deflectSpeed: 140,
    ringDuration: 260,
};

/** A cone that reveals stealth enemies and does nothing to anything else */
export const UV = {
    range: 72,
    /** Half of the cone's opening angle, in degrees */
    halfAngle: 32,
    cooldown: 450,
    flashDuration: 300,
    /** Everything caught in the cone is dazzled for this long, hidden or not */
    stun: 100,
};

export const WHEEL = {
    /** A self-turning wheel warns this long before it moves */
    warnMs: 1000,
};

export const DASH = {
    speed: 280,
    /** 280 for 150ms is 42 units: a little over two and a half tiles */
    duration: 150,
    /** Nothing can hurt him for this long after the dash ends */
    grace: 130,
    /** A press this long before a dash becomes possible still counts */
    buffer: 130,
    /** Space also puts captions away: no dash for this long after one closes */
    unblockDelay: 160,
    /** Pause between the end of one dash and the start of the next */
    chainDelay: 60,
    ghostEvery: 26,
    ghostFade: 210,
};

/** No dash, the full wheel: the Golden era's rule, and the default for a level without one */
const GOLDEN_RULE: WeaponRule = {
    wheel: ['blue', 'red', 'green'],
    modes: ['rgb'],
    dashCharges: 0,
    dashCooldownMs: 0,
};

/** What each era does to the machine and the dash (docs/DESIGN.md section 5) */
export const ERA_RULES: Record<ArtStyle | 'finalPage', WeaponRule> = {
    goldenAge: GOLDEN_RULE,
    cyberpunk: {
        wheel: ['red', 'green'],
        modes: ['rgb'],
        dashCharges: 1,
        dashCooldownMs: 3000,
    },
    retro: {
        wheel: ['blue', 'red', 'green'],
        modes: ['rgb', 'uv'],
        overdrive: true,
        autoRotateMs: 5000,
        dashCharges: 2,
        dashCooldownMs: 5000,
    },
    manga: {
        wheel: [],
        modes: ['unprism'],
        dashCharges: 2,
        dashCooldownMs: 5000,
    },
    // The boss starts with everything; each era it switches to brings that era's rule
    finalPage: {
        wheel: ['blue', 'red', 'green'],
        modes: ['rgb', 'uv', 'unprism'],
        dashCharges: 2,
        dashCooldownMs: 5000,
    },
    // The ending: there is no machine, only a pocket torch
    plain: {
        wheel: [],
        modes: ['rgb'],
        dashCharges: 0,
        dashCooldownMs: 0,
    },
};

/** Everything switched on, for the sandbox and for anything that has no era */
export const DEFAULT_RULE: WeaponRule = {
    wheel: ['blue', 'red', 'green'],
    modes: ['rgb', 'uv', 'unprism'],
    dashCharges: 2,
    dashCooldownMs: 3000,
};

/** How often a secret wall sparks dully when the wrong radiation touches it (milliseconds) */
export const SECRET_RESIST_INTERVAL = 350;

/**
 * The ending: what the EMW Machine really is. A pocket torch with a weak yellow cone that
 * does nothing but make people squint.
 */
export const TORCH = {
    color: 0xffe07a,
    alpha: 0.3,
    range: 42,
    /** Half of the cone's opening angle, in degrees */
    halfAngle: 17,
    /** A person dazzled by it does not react again for this long */
    reactEvery: 1600,
    /** How far someone steps back from the light */
    stepBack: 6,
};
