import { describe, expect, it } from 'vitest';
import { LEVELS, SANDBOX } from '../src/config/levels';
import * as monsterConfig from '../src/config/monsters';
import { MONSTERS } from '../src/config/monsters';
import { ENERGY, RADIATIONS } from '../src/config/radiation';
import { parseRoom, validateLayout } from '../src/systems/roomLayout';
import { LEVEL_CASES, MONSTER_IDS, RADIATION_IDS, ROOM_CASES, STYLE_IDS, reachability } from './helpers';

// Everything here is driven by the data in src/config, so levels, monsters and radiation
// added later are checked without touching this file.

/** Share of a room's walkable tiles that must be reachable from the player start */
const MIN_REACHABLE_SHARE = 0.6;

const isPositive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isColor = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff;

describe('radiation definitions', () => {
    const entries = Object.entries(RADIATIONS);

    it('defines at least one radiation', () => {
        expect(entries.length).toBeGreaterThan(0);
    });

    it.each(entries)('%s is a known id and matches its key in RADIATIONS', (key, def) => {
        expect(RADIATION_IDS, `"${key}" is not a RadiationId`).toContain(key);
        expect(def.id, `RADIATIONS.${key}.id`).toBe(key);
        expect(def.name.trim(), `RADIATIONS.${key}.name`).not.toBe('');
        expect(isColor(def.color), `RADIATIONS.${key}.color = ${def.color}`).toBe(true);
    });

    it.each(entries)('%s is selected by a whole-number key from 1 to 4', (key, def) => {
        expect(Number.isInteger(def.key), `RADIATIONS.${key}.key = ${def.key}`).toBe(true);
        expect(def.key, `RADIATIONS.${key}.key`).toBeGreaterThanOrEqual(1);
        expect(def.key, `RADIATIONS.${key}.key`).toBeLessThanOrEqual(4);
    });

    it('gives every radiation its own key', () => {
        const byKey = new Map<number, string[]>();
        for (const [id, def] of entries) {
            byKey.set(def.key, [...(byKey.get(def.key) ?? []), id]);
        }
        const clashes = [...byKey].filter(([, ids]) => ids.length > 1).map(([key, ids]) => `key ${key}: ${ids.join(', ')}`);
        expect(clashes, 'radiations sharing a key').toEqual([]);
    });

    it.each(entries)('%s has positive damage and an energy cost the pool can pay', (key, def) => {
        expect(isPositive(def.damage), `RADIATIONS.${key}.damage = ${def.damage}`).toBe(true);
        expect(isPositive(def.energyCost), `RADIATIONS.${key}.energyCost = ${def.energyCost}`).toBe(true);
        expect(def.energyCost, `RADIATIONS.${key}.energyCost is more than ENERGY.max`).toBeLessThanOrEqual(ENERGY.max);
    });

    it('has an energy pool that can recover', () => {
        expect(isPositive(ENERGY.max), `ENERGY.max = ${ENERGY.max}`).toBe(true);
        expect(isPositive(ENERGY.regenPerSecond), `ENERGY.regenPerSecond = ${ENERGY.regenPerSecond}`).toBe(true);
        expect(ENERGY.regenDelay, 'ENERGY.regenDelay').toBeGreaterThanOrEqual(0);
        expect(ENERGY.recoverAt, 'ENERGY.recoverAt').toBeGreaterThan(0);
        expect(ENERGY.recoverAt, 'ENERGY.recoverAt is more than ENERGY.max').toBeLessThanOrEqual(ENERGY.max);
    });
});

describe('monster definitions', () => {
    const entries = Object.entries(MONSTERS);

    it('defines at least one monster', () => {
        expect(entries.length).toBeGreaterThan(0);
    });

    it.each(entries)('%s is a known id and matches its key in MONSTERS', (key, def) => {
        expect(MONSTER_IDS, `"${key}" is not a MonsterId`).toContain(key);
        expect(def.id, `MONSTERS.${key}.id`).toBe(key);
        expect(def.name.trim(), `MONSTERS.${key}.name`).not.toBe('');
        expect(isColor(def.color), `MONSTERS.${key}.color = ${def.color}`).toBe(true);
    });

    it.each(entries)('%s has positive stats', (key, def) => {
        for (const stat of ['radius', 'maxHealth', 'speed', 'contactDamage'] as const) {
            expect(isPositive(def[stat]), `MONSTERS.${key}.${stat} = ${def[stat]}`).toBe(true);
        }
    });

    it.each(entries)('%s is weak to and resists only known radiation, without overlap', (key, def) => {
        for (const id of def.weakTo) {
            expect(RADIATION_IDS, `MONSTERS.${key}.weakTo has "${id}"`).toContain(id);
        }
        for (const id of def.resists) {
            expect(RADIATION_IDS, `MONSTERS.${key}.resists has "${id}"`).toContain(id);
        }
        const both = def.weakTo.filter((id) => def.resists.includes(id));
        expect(both, `MONSTERS.${key} is both weak to and resists`).toEqual([]);
    });
});

// Tuning tables that sit next to MONSTERS. They are optional: each check runs only while
// the table it reads is still exported.
describe('monster tuning', () => {
    const config = monsterConfig as Record<string, any>;

    it.skipIf(!config.PRISM?.phases)('gives The Prism phases whose health adds up to its maxHealth', () => {
        const phases: { weakTo: string; health: number }[] = config.PRISM.phases;
        expect(phases.length, 'PRISM.phases').toBeGreaterThan(0);
        phases.forEach((phase, i) => {
            expect(RADIATION_IDS, `PRISM.phases[${i}].weakTo = "${phase.weakTo}"`).toContain(phase.weakTo);
            expect(isPositive(phase.health), `PRISM.phases[${i}].health = ${phase.health}`).toBe(true);
        });
        const total = phases.reduce((sum, phase) => sum + phase.health, 0);
        expect(total, 'sum of PRISM.phases health against MONSTERS.prism.maxHealth').toBe(MONSTERS.prism?.maxHealth);
    });

    it.skipIf(!config.HEART?.dropChance)('gives every heart drop chance as a probability', () => {
        for (const [id, chance] of Object.entries<number>(config.HEART.dropChance)) {
            expect(MONSTER_IDS, `HEART.dropChance has "${id}"`).toContain(id);
            expect(chance, `HEART.dropChance.${id}`).toBeGreaterThanOrEqual(0);
            expect(chance, `HEART.dropChance.${id}`).toBeLessThanOrEqual(1);
        }
    });
});

describe('levels', () => {
    it('has at least one shipped level', () => {
        expect(LEVELS.length).toBeGreaterThan(0);
        expect(SANDBOX).toBeDefined();
    });

    it.each(LEVEL_CASES)('$label has a name, a known style and at least one room', ({ label, level }) => {
        expect(level.name.trim(), `${label}: name`).not.toBe('');
        expect(STYLE_IDS, `${label}: style "${level.style}"`).toContain(level.style);
        expect(level.rooms.length, `${label}: number of rooms`).toBeGreaterThan(0);
    });

    it.each(LEVEL_CASES)('$label lists only known radiation, without repeats', ({ label, level }) => {
        expect(level.radiations.length, `${label}: number of radiations`).toBeGreaterThan(0);
        for (const id of level.radiations) {
            expect(RADIATION_IDS, `${label}: radiation "${id}" is not a RadiationId`).toContain(id);
        }
        expect(new Set(level.radiations).size, `${label}: radiations has repeats`).toBe(level.radiations.length);
    });

    // The sandbox may list radiation that is still being built; a shipped level may not
    it.each(LEVEL_CASES.filter((c) => c.shipped))(
        '$label only gives the player radiation that is defined in RADIATIONS',
        ({ label, level }) => {
            const missing = level.radiations.filter((id) => !RADIATIONS[id]);
            expect(missing, `${label}: radiations with no definition in src/config/radiation.ts`).toEqual([]);
        },
    );

    it('gives each shipped level its own name', () => {
        const names = LEVELS.map((level) => level.name);
        expect(new Set(names).size, `level names: ${names.join(', ')}`).toBe(names.length);
    });
});

describe('rooms', () => {
    it('has rooms to check', () => {
        expect(ROOM_CASES.length).toBeGreaterThan(0);
    });

    it.each(ROOM_CASES)('$label has a valid layout', ({ label, room }) => {
        expect(validateLayout(room.layout), `${label}: layout problems`).toEqual([]);
    });

    it.each(ROOM_CASES)('$label has at least one wave, and every wave spawns something', ({ label, room }) => {
        expect(room.waves.length, `${label}: number of waves`).toBeGreaterThan(0);
        room.waves.forEach((wave, w) => {
            expect(wave.spawns.length, `${label} wave ${w + 1}: number of spawn groups`).toBeGreaterThan(0);
        });
    });

    it.each(ROOM_CASES)('$label only spawns monsters defined in MONSTERS', ({ label, room }) => {
        room.waves.forEach((wave, w) => {
            for (const group of wave.spawns) {
                expect(
                    MONSTERS[group.monster],
                    `${label} wave ${w + 1}: monster "${group.monster}" has no definition in src/config/monsters.ts`,
                ).toBeDefined();
            }
        });
    });

    it.each(ROOM_CASES)('$label has whole, positive spawn counts and sane wave delays', ({ label, room }) => {
        room.waves.forEach((wave, w) => {
            for (const group of wave.spawns) {
                const where = `${label} wave ${w + 1}: count of "${group.monster}" = ${group.count}`;
                expect(Number.isInteger(group.count), where).toBe(true);
                expect(group.count, where).toBeGreaterThan(0);
            }
            if (wave.delay !== undefined) {
                const where = `${label} wave ${w + 1}: delay = ${wave.delay}`;
                expect(Number.isFinite(wave.delay), where).toBe(true);
                expect(wave.delay, where).toBeGreaterThanOrEqual(0);
            }
        });
    });

    it.each(ROOM_CASES)('$label does not wall the player in', ({ label, room }) => {
        const { walkable, reached, unreachable } = reachability(room.layout);
        expect(walkable, `${label}: walkable tiles`).toBeGreaterThan(1);
        // At least one step is possible from the start
        expect(reached, `${label}: the player start has no free tile next to it`).toBeGreaterThan(1);
        expect(
            reached / walkable,
            `${label}: only ${reached} of ${walkable} floor tiles can be reached from P; ` +
                `cut off (col, row): ${unreachable.slice(0, 12).join(' ')}`,
        ).toBeGreaterThanOrEqual(MIN_REACHABLE_SHARE);
    });

    it.each(ROOM_CASES)('$label starts the player on a free tile inside the room', ({ label, room }) => {
        const parsed = parseRoom(room.layout);
        const inside = (rect: { x: number; y: number; width: number; height: number }) =>
            parsed.start.x >= rect.x &&
            parsed.start.x < rect.x + rect.width &&
            parsed.start.y >= rect.y &&
            parsed.start.y < rect.y + rect.height;
        expect(parsed.solids.some(inside), `${label}: the player start is inside a solid tile`).toBe(false);
    });
});
