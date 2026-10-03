import type { MonsterDef, MonsterId } from '../types';

// Starter numbers so waves can spawn. Role C owns this file and the remaining monsters.
export const MONSTERS: Partial<Record<MonsterId, MonsterDef>> = {
    swarmlet: {
        id: 'swarmlet',
        name: 'Swarmlet',
        color: 0x6fdc6f,
        radius: 9,
        maxHealth: 10,
        speed: 150,
        contactDamage: 5,
        weakTo: ['radio'],
        resists: [],
    },
    frostling: {
        id: 'frostling',
        name: 'Frostling',
        color: 0x4fd6ff,
        radius: 16,
        maxHealth: 40,
        speed: 110,
        contactDamage: 12,
        weakTo: ['infrared'],
        resists: ['ultraviolet'],
    },
};
