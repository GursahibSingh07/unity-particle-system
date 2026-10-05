import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../src/config/monsters';
import { BLUE, RAYS, RAY_VS_CLASS, RED } from '../src/config/rays';
import { damageMultiplier, redFalloff } from '../src/systems/Combat';
import type { EnemyClass, MonsterDef, RayId } from '../src/types';
import { ENEMY_CLASSES, RAY_IDS } from './helpers';

const ofClass = (enemyClass: EnemyClass): MonsterDef => ({
    id: 'rat',
    name: 'Test monster',
    class: enemyClass,
    color: 0xffffff,
    radius: 4,
    maxHealth: 10,
    speed: 10,
    contactDamage: 1,
    // The class decides, not these: they are set against the table on purpose
    weakTo: ['uv'],
    resists: ['blue', 'red', 'green', 'white'],
});

// docs/DESIGN.md section 5, restated: change the design and this table together
const NON_BOSS = ENEMY_CLASSES.filter((enemyClass) => enemyClass !== 'boss');
function designed(ray: RayId, enemyClass: EnemyClass): number {
    if (enemyClass === 'boss') {
        // "The boss counts as 1x for Blue, Red and Green, 0.25x for White, 0x for UV"
        return { blue: 1, red: 1, green: 1, white: 0.25, uv: 0 }[ray];
    }
    switch (ray) {
        case 'blue':
            // ideas.md v2.3: the cone is strong against a swarm
            return enemyClass === 'swarm' ? 1.5 : 1;
        case 'red':
            return enemyClass === 'armor' ? 1.5 : 1;
        case 'green':
            return enemyClass === 'speed' ? 2 : 1;
        case 'white':
            return enemyClass === 'swarm' || enemyClass === 'projectile' ? 1.5 : 0.25;
        case 'uv':
            // Stealth enemies are hurt through exposeToUv(); the table only has to let UV touch them
            return enemyClass === 'stealth' ? RAY_VS_CLASS.uv.stealth : 0;
    }
}

const classPairs = RAY_IDS.flatMap((ray) => ENEMY_CLASSES.map((enemyClass) => ({ ray, enemyClass })));

describe('RAY_VS_CLASS', () => {
    it('has a row for every ray and a number for every class', () => {
        expect(Object.keys(RAY_VS_CLASS).sort()).toEqual([...RAY_IDS].sort());
        for (const ray of RAY_IDS) {
            expect(Object.keys(RAY_VS_CLASS[ray]).sort(), `RAY_VS_CLASS.${ray}`).toEqual([...ENEMY_CLASSES].sort());
        }
    });

    it.each(classPairs)('$ray against $enemyClass matches docs/DESIGN.md section 5', ({ ray, enemyClass }) => {
        expect(RAY_VS_CLASS[ray][enemyClass], `RAY_VS_CLASS.${ray}.${enemyClass}`).toBe(designed(ray, enemyClass));
    });

    it('lets UV touch stealth enemies and nothing else', () => {
        expect(RAY_VS_CLASS.uv.stealth, 'RAY_VS_CLASS.uv.stealth').toBeGreaterThan(0);
        for (const enemyClass of ENEMY_CLASSES.filter((one) => one !== 'stealth')) {
            expect(RAY_VS_CLASS.uv[enemyClass], `RAY_VS_CLASS.uv.${enemyClass}`).toBe(0);
        }
    });

    it('gives every non-boss class a ray that is better than Blue against it, or leaves it to Blue', () => {
        // The hit words teach this: each class must have something that is at least Blue's equal
        for (const enemyClass of NON_BOSS) {
            const best = Math.max(...RAY_IDS.map((ray) => RAY_VS_CLASS[ray][enemyClass]));
            expect(best, `best multiplier against ${enemyClass}`).toBeGreaterThanOrEqual(1);
        }
    });
});

describe('damageMultiplier', () => {
    it.each(classPairs)('$ray against the $enemyClass class is RAY_VS_CLASS', ({ ray, enemyClass }) => {
        expect(damageMultiplier(ofClass(enemyClass), ray), `${ray} against class ${enemyClass}`).toBe(RAY_VS_CLASS[ray][enemyClass]);
    });

    it('is decided by the class alone, not by the v1 weakTo and resists lists', () => {
        const def = ofClass('swarm');
        expect(damageMultiplier(def, 'uv'), 'uv is in weakTo, but the class says 0').toBe(0);
        expect(damageMultiplier(def, 'white'), 'white is in resists, but the class says 1.5').toBe(1.5);
    });
});

// Every defined enemy against every ray, so enemies added later are covered too
const monsterPairs = Object.values(MONSTERS).flatMap((def) => RAY_IDS.map((ray) => ({ id: def.id, def, ray })));

describe('damageMultiplier for the defined enemies', () => {
    it('has enemies to check', () => {
        expect(monsterPairs.length).toBeGreaterThan(0);
    });

    it.each(monsterPairs)('$id hit by $ray', ({ def, ray }) => {
        expect(damageMultiplier(def, ray), `${def.id} (${def.class}) hit by ${ray}`).toBe(RAY_VS_CLASS[ray][def.class]);
    });
});

describe('redFalloff', () => {
    const steps = Array.from({ length: 101 }, (_, i) => (RED.range * i) / 100);

    it('is 1 at the muzzle and RED.farDamage at full range', () => {
        expect(redFalloff(0)).toBe(1);
        expect(redFalloff(RED.range)).toBeCloseTo(RED.farDamage, 10);
    });

    it('never rises with distance', () => {
        for (let i = 1; i < steps.length; i++) {
            expect(redFalloff(steps[i]), `redFalloff(${steps[i].toFixed(1)})`).toBeLessThanOrEqual(redFalloff(steps[i - 1]));
        }
        expect(redFalloff(RED.range), 'full range against the muzzle').toBeLessThan(redFalloff(0));
    });

    it('is strongest at 0', () => {
        for (const distance of steps.slice(1)) {
            expect(redFalloff(distance), `redFalloff(${distance.toFixed(1)})`).toBeLessThan(redFalloff(0));
        }
    });

    it('stays between 0 and 1, and holds its end values outside the beam', () => {
        for (const distance of steps) {
            expect(redFalloff(distance)).toBeGreaterThan(0);
            expect(redFalloff(distance)).toBeLessThanOrEqual(1);
        }
        expect(redFalloff(-50), 'behind the muzzle').toBe(1);
        expect(redFalloff(RED.range * 3), 'past full range').toBeCloseTo(RED.farDamage, 10);
    });

    it('leaves Red above Blue up close and below Blue at full range (damage per second)', () => {
        // Blue is one flash per cooldown; Red's damage is already per second
        const bluePerSecond = RAYS.blue.damage / (BLUE.cooldown / 1000);
        const redNear = RAYS.red.damage * redFalloff(0);
        const redFar = RAYS.red.damage * redFalloff(RED.range);
        expect(redNear, `Red at the muzzle (${redNear}/s) against Blue (${bluePerSecond}/s)`).toBeGreaterThan(bluePerSecond);
        expect(redFar, `Red at full range (${redFar}/s) against Blue (${bluePerSecond}/s)`).toBeLessThan(bluePerSecond);
    });
});
