import { RAY_VS_CLASS, RED } from '../config/rays';
import type { MonsterDef, RayId } from '../types';

// Pure damage rules (no Phaser), so they can be unit tested.

/** How much a ray's damage is scaled against a monster: decided by its class alone */
export function damageMultiplier(monster: MonsterDef, type: RayId) {
    return RAY_VS_CLASS[type]?.[monster.class] ?? 1;
}

/**
 * The fraction of Red's point-blank damage that is left `distance` along the beam:
 * 1 at the muzzle, falling in a straight line to RED.farDamage at full range.
 */
export function redFalloff(distance: number) {
    const along = Math.min(1, Math.max(0, distance / RED.range));
    return 1 + (RED.farDamage - 1) * along;
}
