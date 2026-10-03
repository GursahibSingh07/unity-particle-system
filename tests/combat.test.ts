import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../src/config/monsters';
import { damageMultiplier } from '../src/systems/Combat';
import type { MonsterDef } from '../src/types';
import { RADIATION_IDS } from './helpers';

const monster = (weakTo: MonsterDef['weakTo'], resists: MonsterDef['resists']): MonsterDef => ({
    id: 'swarmlet',
    name: 'Test monster',
    color: 0xffffff,
    radius: 4,
    maxHealth: 10,
    speed: 10,
    contactDamage: 1,
    weakTo,
    resists,
});

describe('damageMultiplier', () => {
    it('doubles damage for a weakness', () => {
        expect(damageMultiplier(monster(['radio'], []), 'radio')).toBe(2);
    });

    it('quarters damage for a resistance', () => {
        expect(damageMultiplier(monster([], ['gamma']), 'gamma')).toBe(0.25);
    });

    it('leaves damage alone otherwise', () => {
        expect(damageMultiplier(monster(['radio'], ['gamma']), 'infrared')).toBe(1);
        expect(damageMultiplier(monster([], []), 'ultraviolet')).toBe(1);
    });

    it('handles several weaknesses and resistances on one monster', () => {
        const def = monster(['radio', 'infrared'], ['ultraviolet', 'gamma']);
        expect(RADIATION_IDS.map((id) => damageMultiplier(def, id))).toEqual([2, 2, 0.25, 0.25]);
    });
});

// Every defined monster against every radiation, so monsters added later are covered too
const pairs = Object.values(MONSTERS).flatMap((def) => RADIATION_IDS.map((radiation) => ({ def, radiation })));

describe('damageMultiplier for the defined monsters', () => {
    it('has monsters to check', () => {
        expect(pairs.length).toBeGreaterThan(0);
    });

    it.each(pairs)('$def.id hit by $radiation', ({ def, radiation }) => {
        const expected = def.weakTo.includes(radiation) ? 2 : def.resists.includes(radiation) ? 0.25 : 1;
        expect(damageMultiplier(def, radiation), `${def.id} hit by ${radiation}`).toBe(expected);
    });
});
