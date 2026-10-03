import type { RadiationDef, RadiationId } from '../types';

// Distances and speeds are in world units (see config/world.ts).

export const RADIATIONS: Record<RadiationId, RadiationDef> = {
    radio: {
        id: 'radio',
        name: 'Radio',
        key: 1,
        color: 0xc9a0ff,
        damage: 6,
        energyCost: 20,
    },
    infrared: {
        id: 'infrared',
        name: 'Infrared',
        key: 2,
        color: 0xff5a36,
        // Continuous beam: both values are per second
        damage: 40,
        energyCost: 30,
    },
    ultraviolet: {
        id: 'ultraviolet',
        name: 'Ultraviolet',
        key: 3,
        color: 0x5a78ff,
        damage: 14,
        energyCost: 24,
    },
    gamma: {
        id: 'gamma',
        name: 'Gamma',
        key: 4,
        color: 0x7dff6b,
        damage: 32,
        energyCost: 45,
    },
};

export const ENERGY = {
    max: 100,
    regenPerSecond: 22,
    /** Milliseconds after the last shot before energy starts to regenerate */
    regenDelay: 500,
    /** After running dry, the machine stays locked until energy is back to this */
    recoverAt: 25,
};

/** Ring pulse around the player */
export const RADIO = {
    range: 44,
    cooldown: 700,
    knockbackSpeed: 110,
    knockbackDuration: 250,
};

/** Continuous beam along the aim direction, stopped by walls */
export const INFRARED = {
    range: 84,
    width: 3,
};

/** Short, wide cone flash along the aim direction, stopped by walls */
export const ULTRAVIOLET = {
    range: 52,
    /** Half of the cone's opening angle, in degrees */
    halfAngle: 38,
    cooldown: 800,
    /** How long a revealed monster is frozen for */
    stunDuration: 2200,
    flashDuration: 220,
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

/** Hold to charge, release to fire a thin ray through everything */
export const GAMMA = {
    chargeTime: 750,
    width: 2,
    /** The Handler walks at this fraction of his speed while charging */
    moveScale: 0.55,
    knockbackSpeed: 60,
    knockbackDuration: 120,
    rayDuration: 260,
};
