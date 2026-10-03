import type { MonsterDef, RadiationId } from '../types';

const WEAK_MULTIPLIER = 2;
const RESIST_MULTIPLIER = 0.25;

/** How much a radiation type's damage is scaled against a monster */
export function damageMultiplier(monster: MonsterDef, type: RadiationId) {
    if (monster.weakTo.includes(type)) {
        return WEAK_MULTIPLIER;
    }
    if (monster.resists.includes(type)) {
        return RESIST_MULTIPLIER;
    }
    return 1;
}
