import type { RadiationDef, RadiationId } from '../types';

export const RADIATIONS: Partial<Record<RadiationId, RadiationDef>> = {
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
    range: 170,
    cooldown: 700,
    knockbackSpeed: 420,
    knockbackDuration: 250,
};

/** Continuous beam along the aim direction, stopped by walls */
export const INFRARED = {
    range: 320,
    width: 10,
};
