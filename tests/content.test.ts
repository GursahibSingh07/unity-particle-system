import { describe, expect, it } from 'vitest';
import { LEVELS, SANDBOX } from '../src/config/levels';
import { HEART, MONSTERS, PRISM } from '../src/config/monsters';
import { DASH, DEFAULT_RULE, ENERGY, ERA_RULES, RAYS, RAY_VS_CLASS } from '../src/config/rays';
import { SQUARE_LAYOUT } from '../src/config/square';
import { BOSS_WORDS, ENDING, ERA_NAMES, ERA_RULE_LINES, GUIDE, MODE_NAMES, TITLE, UPGRADES } from '../src/config/text';
import { checkpointSeconds, surgeSeconds } from '../src/systems/eraClock';
import { floorInFront, validateLayout, validateRoom } from '../src/systems/roomLayout';
import type { EnemyClass, MonsterId, StyleId, UpgradeId, WeaponRule } from '../src/types';
import {
    ART_STYLES,
    ENEMY_CLASSES,
    ERA_CASES,
    LEVEL_CASES,
    MONSTER_IDS,
    RAY_IDS,
    RAY_MODES,
    ROOM_CASES,
    STYLE_IDS,
    TIMED_CASES,
    UPGRADE_IDS,
    findTiles,
    fireableRays,
    monstersOf,
    reachability,
} from './helpers';

// Everything below restates docs/DESIGN.md. When the design changes, change it here too.

/** Section 2: the eras in play order, and what each hands over as it begins */
const ERAS: { style: StyleId; grants: UpgradeId[]; timed: boolean }[] = [
    { style: 'goldenAge', grants: ['red', 'blue', 'green'], timed: true },
    { style: 'cyberpunk', grants: ['dash'], timed: true },
    { style: 'retro', grants: ['doubleDash', 'uv'], timed: true },
    { style: 'manga', grants: ['white'], timed: true },
    { style: 'finalPage', grants: [], timed: false },
];

/** Section 5: the weapon rule of each era */
const RULES: Record<Exclude<StyleId, 'plain'>, WeaponRule> = {
    goldenAge: { wheel: ['blue', 'red', 'green'], modes: ['rgb'], dashCharges: 0, dashCooldownMs: 0 },
    cyberpunk: { wheel: ['red', 'green'], modes: ['rgb'], dashCharges: 1, dashCooldownMs: 3000 },
    retro: {
        wheel: ['blue', 'red', 'green'],
        modes: ['rgb', 'uv'],
        overdrive: true,
        autoRotateMs: 5000,
        dashCharges: 2,
        dashCooldownMs: 5000,
    },
    manga: { wheel: [], modes: ['unprism'], dashCharges: 2, dashCooldownMs: 5000 },
    finalPage: { wheel: ['blue', 'red', 'green'], modes: ['rgb', 'uv', 'unprism'], dashCharges: 2, dashCooldownMs: 5000 },
};

/** Section 6: the class of every enemy */
const CLASSES: Record<MonsterId, EnemyClass> = {
    rat: 'swarm',
    slime: 'swarm',
    bat: 'swarm',
    ironclad: 'armor',
    golem: 'armor',
    zigbat: 'speed',
    skitter: 'speed',
    ghost: 'stealth',
    wraith: 'stealth',
    snowman: 'projectile',
    acidSlime: 'projectile',
    prism: 'boss',
};

/** Section 2: the order Golden's clock brings its enemies in (ideas.md v2.1: Golden is timed too) */
const GOLDEN_ORDER: MonsterId[][] = [['rat'], ['slime', 'bat'], ['ironclad'], ['golem']];

/** Section 2: the era each class first appears in (index into LEVELS), and the order within it */
const FIRST_APPEARANCE: { enemyClass: EnemyClass; era: number; order: MonsterId[] }[] = [
    { enemyClass: 'speed', era: 1, order: ['zigbat', 'skitter'] },
    { enemyClass: 'stealth', era: 2, order: ['ghost', 'wraith'] },
    { enemyClass: 'projectile', era: 3, order: ['snowman', 'acidSlime'] },
];

/** Captions are shown one line at a time in a caption box (src/config/text.ts) */
const CAPTION_LIMIT = 60;

const isId = (id: string): id is MonsterId => (MONSTER_IDS as readonly string[]).includes(id);
const squareOf = (layout: readonly string[]) => layout.map((row) => row.replace(/S/g, '#'));

describe('the eras', () => {
    it('are exactly the five of the design, in order', () => {
        expect(LEVELS.map((level) => level.style)).toEqual(ERAS.map((era) => era.style));
    });

    it.each(ERA_CASES)('$label is one room, named as the cover and the pause page name it', ({ label, level }) => {
        expect(level.rooms, `${label}: an era is one room`).toHaveLength(1);
        expect(level.name, `${label}: name against ERA_NAMES.${level.style}`).toBe(ERA_NAMES[level.style]);
    });

    it.each(ERA_CASES)('$label is fought on the city square, with at most one cracked wall', ({ label, level }) => {
        const layout = level.rooms[0].layout;
        expect(squareOf(layout), `${label}: the layout must be SQUARE_LAYOUT (an S may replace a wall)`).toEqual([...SQUARE_LAYOUT]);
        expect(findTiles(layout, 'S').length, `${label}: cracked walls`).toBeLessThanOrEqual(1);
        for (const [col, row] of findTiles(layout, 'S')) {
            expect(SQUARE_LAYOUT[row][col], `${label}: the S at (${col}, ${row}) must replace a wall`).toBe('#');
        }
    });

    it.each(ERA_CASES)('$label hands over what docs/DESIGN.md section 2 says', ({ label, level, index }) => {
        const grants = level.grants ?? [];
        for (const id of grants) {
            expect(UPGRADE_IDS as readonly string[], `${label}: grant "${id}" is not an UpgradeId`).toContain(id);
        }
        expect(new Set(grants).size, `${label}: a grant is listed twice`).toBe(grants.length);
        expect([...grants].sort(), `${label}: grants`).toEqual([...ERAS[index].grants].sort());
    });

    it('never hand over the same thing twice across the game', () => {
        const all = LEVELS.flatMap((level) => level.grants ?? []);
        expect(new Set(all).size, `grants across the eras: ${all.join(', ')}`).toBe(all.length);
    });

    it.each(ERA_CASES)('$label spawns as the design says (waves or a clock)', ({ label, level, index }) => {
        const room = level.rooms[0];
        if (ERAS[index].timed) {
            expect(room.continuous, `${label}: a timed era needs \`continuous\``).toBeDefined();
            expect(room.waves, `${label}: a timed era has no waves`).toEqual([]);
        } else {
            expect(room.continuous, `${label}: an era of waves has no \`continuous\``).toBeUndefined();
            expect(room.waves.length, `${label}: waves`).toBeGreaterThan(0);
        }
    });

    it.each(ERA_CASES)('$label can be played with the rays its fallback list names', ({ label, level }) => {
        expect(level.radiations.length, `${label}: radiations`).toBeGreaterThan(0);
        for (const ray of level.radiations) {
            expect(RAY_IDS as readonly string[], `${label}: radiation "${ray}"`).toContain(ray);
        }
        // What the era's rule lets him fire must be something he has been given by then
        const rule = level.rule ?? ERA_RULES[level.style];
        for (const ray of fireableRays(rule)) {
            expect(level.radiations, `${label}: the rule fires ${ray}, which is not in its radiations`).toContain(ray);
        }
    });

    it.each(ERA_CASES)('$label only fires rays the player has been handed by then', ({ label, level, index }) => {
        const owned = new Set(LEVELS.slice(0, index + 1).flatMap((era) => era.grants ?? []));
        const rule = level.rule ?? ERA_RULES[level.style];
        for (const ray of fireableRays(rule)) {
            expect(owned.has(ray), `${label}: the rule fires ${ray}, which no era has handed over yet`).toBe(true);
        }
        if (rule.dashCharges === 1) {
            expect(owned.has('dash'), `${label}: one dash charge, but the dash was never handed over`).toBe(true);
        }
        if (rule.dashCharges >= 2) {
            expect(owned.has('doubleDash'), `${label}: two dash charges, but the double dash was never handed over`).toBe(true);
        }
    });

    it.each(ERA_CASES)('$label has intro captions that fit the caption box', ({ label, level }) => {
        const lines = level.introText ?? [];
        expect(lines.length, `${label}: intro captions`).toBeGreaterThan(0);
        lines.forEach((line, i) => {
            expect(line.trim(), `${label}: intro line ${i + 1} is empty`).not.toBe('');
            expect(line.length, `${label}: intro line ${i + 1} is ${line.length} characters: "${line}"`).toBeLessThanOrEqual(CAPTION_LIMIT);
        });
    });

    it('do not carry their own rule: the design table (ERA_RULES) is the only source', () => {
        for (const { label, level } of ERA_CASES) {
            if (level.rule) {
                expect(level.rule, `${label}: LevelDef.rule differs from ERA_RULES.${level.style}`).toEqual(ERA_RULES[level.style]);
            }
        }
    });
});

describe('Golden Era', () => {
    const table = LEVELS[0].rooms[0].continuous?.table ?? [];
    /** The first second each enemy can arrive, or Infinity if it never does */
    const firstAt = (monster: MonsterId) => Math.min(Infinity, ...table.filter((entry) => entry.monster === monster).map((entry) => entry.from ?? 0));

    it('runs on a two-minute clock', () => {
        expect(LEVELS[0].rooms[0].continuous?.duration).toBe(120);
    });

    it.each(GOLDEN_ORDER.map((monsters, i) => ({ step: i + 1, monsters })))(
        'step $step brings $monsters, after everything before it',
        ({ step, monsters }) => {
            for (const monster of monsters) {
                expect(firstAt(monster), `Golden never brings the ${monster}`).toBeLessThan(120);
                for (const earlier of GOLDEN_ORDER.slice(0, step - 1).flat()) {
                    expect(firstAt(monster), `Golden brings the ${monster} before the ${earlier}`).toBeGreaterThan(firstAt(earlier));
                }
            }
        },
    );

    it('only brings swarm and armour', () => {
        for (const { monster, where } of monstersOf(LEVELS[0].rooms[0])) {
            expect(['swarm', 'armor'], `Golden ${where}: ${monster} is ${MONSTERS[monster]?.class}`).toContain(MONSTERS[monster]?.class);
        }
    });
});

describe('first appearances (docs/DESIGN.md section 2)', () => {
    it.each(FIRST_APPEARANCE)('the $enemyClass class first appears in era $era + 1, in the stated order', ({ enemyClass, era, order }) => {
        LEVELS.slice(0, era).forEach((level, i) => {
            for (const { monster, where } of monstersOf(level.rooms[0])) {
                expect(MONSTERS[monster]?.class, `era ${i + 1} "${level.name}" ${where}: ${monster} arrives before its class is introduced`).not.toBe(
                    enemyClass,
                );
            }
        });

        const table = LEVELS[era].rooms[0].continuous?.table ?? [];
        const firstAt = (id: MonsterId) => {
            const times = table.filter((entry) => entry.monster === id).map((entry) => entry.from ?? 0);
            return times.length > 0 ? Math.min(...times) : null;
        };
        const label = `era ${era + 1} "${LEVELS[era].name}"`;
        for (const id of order) {
            expect(firstAt(id), `${label}: the ${id} never appears`).not.toBeNull();
        }
        for (let i = 1; i < order.length; i++) {
            expect(firstAt(order[i])!, `${label}: the ${order[i]} must not come before the ${order[i - 1]}`).toBeGreaterThanOrEqual(
                firstAt(order[i - 1])!,
            );
        }
    });
});

describe('the boss era', () => {
    const { level } = ERA_CASES[ERA_CASES.length - 1];

    it('is one wave of one Prism', () => {
        expect(level.style).toBe('finalPage');
        expect(level.rooms[0].waves).toHaveLength(1);
        expect(level.rooms[0].waves[0].spawns).toEqual([{ monster: 'prism', count: 1 }]);
    });

    it('has no grants and no secret', () => {
        expect(level.grants ?? []).toEqual([]);
        expect(level.rooms[0].secret).toBeUndefined();
        expect(findTiles(level.rooms[0].layout, 'S')).toEqual([]);
    });

    it('is the only place the Prism appears in the shipped game', () => {
        for (const { label, level: era } of ERA_CASES.slice(0, -1)) {
            for (const { monster, where } of monstersOf(era.rooms[0])) {
                expect(monster, `${label} ${where}`).not.toBe('prism');
            }
        }
    });

    it('cycles Golden, Cyberpunk, Retro, Manga, each with a rule and its own numbers', () => {
        expect(PRISM.eras).toEqual(['goldenAge', 'cyberpunk', 'retro', 'manga']);
        for (const style of PRISM.eras) {
            expect(ERA_RULES[style], `ERA_RULES.${style}`).toBeDefined();
            expect(PRISM.era[style], `PRISM.era.${style}`).toBeDefined();
            expect(BOSS_WORDS.swapped[style], `BOSS_WORDS.swapped.${style}`).toBeTruthy();
        }
        expect(PRISM.telegraph, 'the coming era must show "a few seconds beforehand"').toBeGreaterThanOrEqual(2000);
    });
});

describe('rooms', () => {
    it('exist in every level', () => {
        for (const { label, level } of LEVEL_CASES) {
            expect(level.rooms?.length ?? 0, `${label}: rooms`).toBeGreaterThan(0);
        }
    });

    it.each(ROOM_CASES)('$label: the room is valid', ({ label, room }) => {
        expect(validateLayout(room.layout), `${label}: layout problems`).toEqual([]);
        expect(validateRoom(room), `${label}: room problems`).toEqual([]);
    });

    it.each(ROOM_CASES)('$label: every wave spawns defined enemies in whole positive numbers', ({ label, room }) => {
        room.waves.forEach((wave, w) => {
            const where = `${label} wave ${w + 1}`;
            expect(wave.spawns.length, `${where}: no spawn groups`).toBeGreaterThan(0);
            if (wave.delay !== undefined) {
                expect(wave.delay, `${where}: delay`).toBeGreaterThanOrEqual(0);
            }
            for (const group of wave.spawns) {
                expect(isId(group.monster), `${where}: unknown enemy "${group.monster}"`).toBe(true);
                expect(MONSTERS[group.monster], `${where}: "${group.monster}" is not in MONSTERS`).toBeDefined();
                expect(Number.isInteger(group.count), `${where}: ${group.monster} count ${group.count} is not a whole number`).toBe(true);
                expect(group.count, `${where}: ${group.monster} count`).toBeGreaterThan(0);
            }
        });
    });

    it.each(ROOM_CASES)('$label: streets for enemies to come in by, all of them open to the square', ({ label, room }) => {
        const entries = findTiles(room.layout, 'e');
        expect(entries.length, `${label}: street entries (e tiles)`).toBeGreaterThan(0);

        const reach = reachability(room.layout);
        expect(reach.unreachable, `${label}: tiles that cannot be walked to from the player start`).toEqual([]);
        expect(reach.reached, `${label}: walkable tiles`).toBeGreaterThan(20);
    });

    it.each(ROOM_CASES.filter((entry) => entry.room.secret))('$label: the secret can be found and collected', ({ label, level, room, shipped }) => {
        expect(RAY_IDS as readonly string[], `${label}: secret ray "${room.secret}"`).toContain(room.secret);
        const [crack] = findTiles(room.layout, 'S');
        expect(crack, `${label}: no S tile`).toBeDefined();
        const front = floorInFront(room.layout, crack[0], crack[1]);
        expect(front, `${label}: the S at (${crack[0]}, ${crack[1]}) has no paving in front of it for the upgrade to drop on`).not.toBeNull();
        expect(room.layout[front!.row][front!.col], `${label}: the upgrade would drop in a street mouth, under arriving enemies`).not.toBe('e');

        // The only ray that breaks the crack must be one the era lets him fire
        const rule = level.rule ?? (shipped ? ERA_RULES[level.style] : DEFAULT_RULE);
        expect(fireableRays(rule), `${label}: the secret needs ${room.secret}, which this era's rule cannot fire`).toContain(room.secret);
    });

    it('give every era but the boss a secret', () => {
        for (const { label, level } of ERA_CASES.slice(0, -1)) {
            expect(level.rooms[0].secret, `${label}: secret`).toBeDefined();
        }
    });

    it.each(ROOM_CASES.filter((entry) => entry.shipped))('$label: every enemy can be hurt under the era rule', ({ label, level, room }) => {
        if (level.style === 'finalPage') {
            // The Prism has its own rules for each era it switches to
            return;
        }
        const rays = fireableRays(level.rule ?? ERA_RULES[level.style]);
        for (const { monster, where } of monstersOf(room)) {
            const enemyClass = MONSTERS[monster].class;
            const best = Math.max(...rays.map((ray) => RAY_VS_CLASS[ray][enemyClass]));
            expect(best, `${label} ${where}: nothing on the wheel (${rays.join(', ')}) does full damage to the ${monster} (${enemyClass})`).toBeGreaterThanOrEqual(1);
            if (enemyClass === 'stealth') {
                expect(rays, `${label} ${where}: the ${monster} is untouchable without UV`).toContain('uv');
            }
        }
    });
});

describe('timed eras', () => {
    it('are the four the design names', () => {
        const timed = ERA_CASES.filter(({ level }) => level.rooms[0].continuous).map(({ level }) => level.style);
        expect(timed).toEqual(['goldenAge', 'cyberpunk', 'retro', 'manga']);
    });

    it.each(TIMED_CASES)('$label: the clock, the cap and the pace are sane', ({ label, continuous }) => {
        const { duration, spawnEvery, maxAlive } = continuous;
        expect(duration, `${label}: duration`).toBeGreaterThan(0);
        expect(Number.isInteger(duration), `${label}: duration ${duration} should be whole seconds (the HUD clock shows them)`).toBe(true);

        expect(spawnEvery, `${label}: spawnEvery`).toHaveLength(2);
        for (const [i, interval] of spawnEvery.entries()) {
            expect(interval, `${label}: spawnEvery[${i}]`).toBeGreaterThanOrEqual(300);
            expect(interval, `${label}: spawnEvery[${i}] is longer than the era`).toBeLessThan(duration * 1000);
        }
        expect(spawnEvery[1], `${label}: arrivals must not slow down as the era goes on`).toBeLessThanOrEqual(spawnEvery[0]);

        expect(Number.isInteger(maxAlive), `${label}: maxAlive ${maxAlive} is not a whole number`).toBe(true);
        expect(maxAlive, `${label}: maxAlive`).toBeGreaterThan(0);
        expect(maxAlive, `${label}: maxAlive (more than this has never been run at full frame rate)`).toBeLessThanOrEqual(60);
    });

    it.each(TIMED_CASES)('$label: the surge and the checkpoints fit inside the era', ({ label, continuous }) => {
        const surge = surgeSeconds(continuous);
        const every = checkpointSeconds(continuous);
        expect(continuous.surge ?? 1, `${label}: surge`).toBeGreaterThan(0);
        expect(surge, `${label}: the surge must be shorter than the era`).toBeLessThan(continuous.duration);
        expect(continuous.checkpointEvery ?? 1, `${label}: checkpointEvery`).toBeGreaterThan(0);
        expect(every, `${label}: no checkpoint is ever reached`).toBeLessThan(continuous.duration);
        expect(every, `${label}: a death must not cost more than a minute`).toBeLessThanOrEqual(60);
    });

    it.each(TIMED_CASES)('$label: the spawn table is valid', ({ label, continuous }) => {
        const { table, duration, maxAlive } = continuous;
        expect(table.length, `${label}: the table is empty`).toBeGreaterThan(0);

        table.forEach((entry, i) => {
            const where = `${label} table line ${i + 1} (${entry.monster})`;
            expect(isId(entry.monster), `${where}: unknown enemy`).toBe(true);
            expect(MONSTERS[entry.monster], `${where}: not in MONSTERS`).toBeDefined();
            expect(entry.monster, `${where}: the boss does not come up the street`).not.toBe('prism');
            expect(entry.weight, `${where}: weight`).toBeGreaterThan(0);
            const group = entry.group ?? 1;
            expect(Number.isInteger(group), `${where}: group ${group} is not a whole number`).toBe(true);
            expect(group, `${where}: group`).toBeGreaterThan(0);
            expect(group, `${where}: a group larger than maxAlive (${maxAlive}) can never arrive whole`).toBeLessThanOrEqual(maxAlive);
            const from = entry.from ?? 0;
            expect(from, `${where}: from`).toBeGreaterThanOrEqual(0);
            expect(from, `${where}: from ${from}s is not before the end of the era (${duration}s), so it never appears`).toBeLessThan(duration);
        });

        const atStart = table.filter((entry) => (entry.from ?? 0) === 0);
        expect(atStart.length, `${label}: nothing can appear at 0:00`).toBeGreaterThan(0);
    });
});

describe('ERA_RULES', () => {
    it('has a rule for every style', () => {
        expect(Object.keys(ERA_RULES).sort()).toEqual([...STYLE_IDS].sort());
    });

    it.each(Object.entries(RULES))('%s matches docs/DESIGN.md section 5', (style, rule) => {
        expect(ERA_RULES[style as StyleId], `ERA_RULES.${style}`).toEqual(rule);
    });

    it.each(STYLE_IDS.map((style) => ({ style, rule: ERA_RULES[style] })))('$style is a rule the machine can run', ({ style, rule }) => {
        expect(rule.modes.length, `ERA_RULES.${style}: modes`).toBeGreaterThan(0);
        for (const mode of rule.modes) {
            expect(RAY_MODES as readonly string[], `ERA_RULES.${style}: mode "${mode}"`).toContain(mode);
        }
        expect(new Set(rule.modes).size, `ERA_RULES.${style}: a mode is listed twice`).toBe(rule.modes.length);
        for (const ray of rule.wheel) {
            expect(['blue', 'red', 'green'], `ERA_RULES.${style}: "${ray}" is not a colour of the wheel`).toContain(ray);
        }
        expect(new Set(rule.wheel).size, `ERA_RULES.${style}: a colour is on the wheel twice`).toBe(rule.wheel.length);
        expect(Number.isInteger(rule.dashCharges), `ERA_RULES.${style}: dashCharges`).toBe(true);
        expect(rule.dashCharges, `ERA_RULES.${style}: dashCharges`).toBeGreaterThanOrEqual(0);
        if (rule.dashCharges > 0) {
            expect(rule.dashCooldownMs, `ERA_RULES.${style}: a dash needs a cooldown`).toBeGreaterThan(0);
        }
        if (rule.autoRotateMs !== undefined) {
            expect(rule.autoRotateMs, `ERA_RULES.${style}: autoRotateMs`).toBeGreaterThan(1000);
            expect(rule.wheel.length, `ERA_RULES.${style}: a wheel that turns by itself needs colours to turn through`).toBeGreaterThanOrEqual(2);
        }
        if (style !== 'plain') {
            expect(fireableRays(rule).length, `ERA_RULES.${style}: nothing can be fired`).toBeGreaterThan(0);
        }
    });

    it('DEFAULT_RULE (the sandbox) has everything switched on', () => {
        expect([...fireableRays(DEFAULT_RULE)].sort()).toEqual([...RAY_IDS].sort());
        expect(DEFAULT_RULE.dashCharges).toBe(2);
        expect(DEFAULT_RULE.dashCooldownMs).toBeGreaterThan(0);
    });

    it('the dash is short, and safe for a moment after it ends', () => {
        expect(DASH.speed).toBeGreaterThan(0);
        expect(DASH.duration).toBeGreaterThan(0);
        expect(DASH.grace).toBeGreaterThanOrEqual(0);
        // "A short burst": never across the whole square
        expect((DASH.speed * DASH.duration) / 1000).toBeLessThan(96);
    });
});

describe('MONSTERS', () => {
    it('covers exactly the twelve enemies', () => {
        expect(MONSTER_IDS).toHaveLength(12);
        expect(Object.keys(MONSTERS).sort()).toEqual([...MONSTER_IDS].sort());
    });

    it.each(MONSTER_IDS.map((id) => ({ id })))('$id: id, class and stats', ({ id }) => {
        const def = MONSTERS[id];
        expect(def.id, `MONSTERS.${id}.id`).toBe(id);
        expect(def.name.trim(), `MONSTERS.${id}.name`).not.toBe('');
        expect(ENEMY_CLASSES as readonly string[], `MONSTERS.${id}.class "${def.class}"`).toContain(def.class);
        expect(def.class, `MONSTERS.${id}.class against docs/DESIGN.md section 6`).toBe(CLASSES[id]);
        expect(def.maxHealth, `MONSTERS.${id}.maxHealth`).toBeGreaterThan(0);
        expect(def.radius, `MONSTERS.${id}.radius`).toBeGreaterThan(0);
        expect(def.speed, `MONSTERS.${id}.speed`).toBeGreaterThan(0);
        expect(def.contactDamage, `MONSTERS.${id}.contactDamage`).toBeGreaterThan(0);
        expect(Number.isInteger(def.color) && def.color >= 0 && def.color <= 0xffffff, `MONSTERS.${id}.color`).toBe(true);
    });

    it('has two of each class and one boss', () => {
        const count = (enemyClass: EnemyClass) => MONSTER_IDS.filter((id) => MONSTERS[id].class === enemyClass).length;
        expect(count('swarm')).toBe(3);
        for (const enemyClass of ['armor', 'speed', 'stealth', 'projectile'] as const) {
            expect(count(enemyClass), `${enemyClass} enemies`).toBe(2);
        }
        expect(count('boss')).toBe(1);
    });

    it('are all used somewhere in the shipped game', () => {
        const used = new Set(ERA_CASES.flatMap(({ level }) => level.rooms.flatMap((room) => monstersOf(room).map((entry) => entry.monster))));
        for (const id of MONSTER_IDS) {
            expect(used.has(id), `the ${id} never appears in any era`).toBe(true);
        }
    });

    it('are all in the sandbox, so each can be tried alone', () => {
        const used = new Set(SANDBOX.rooms.flatMap((room) => monstersOf(room).map((entry) => entry.monster)));
        for (const id of MONSTER_IDS) {
            expect(used.has(id), `the ${id} is in no sandbox room`).toBe(true);
        }
    });
});

describe('HEART', () => {
    it.each(MONSTER_IDS.map((id) => ({ id })))('dropChance.$id is a probability', ({ id }) => {
        const chance = HEART.dropChance[id];
        expect(typeof chance, `HEART.dropChance.${id} is missing`).toBe('number');
        expect(chance, `HEART.dropChance.${id}`).toBeGreaterThanOrEqual(0);
        expect(chance, `HEART.dropChance.${id}`).toBeLessThanOrEqual(1);
        // More likely when he is low: that must still be a probability
        expect(chance * HEART.lowHealthMultiplier, `HEART.dropChance.${id} at low health`).toBeLessThanOrEqual(1);
    });

    it('names no enemy that does not exist', () => {
        expect(Object.keys(HEART.dropChance).sort()).toEqual([...MONSTER_IDS].sort());
    });

    it('heals something, and mercy comes after two deaths', () => {
        expect(HEART.heal).toBeGreaterThan(0);
        expect(HEART.mercyDeaths).toBe(2);
        expect(HEART.lowHealth).toBeGreaterThan(0);
        expect(HEART.lowHealth).toBeLessThan(1);
    });
});

describe('RAYS', () => {
    it('covers exactly the five rays', () => {
        expect(Object.keys(RAYS).sort()).toEqual([...RAY_IDS].sort());
    });

    it.each(RAY_IDS.map((id) => ({ id })))('$id: id, name, cost and damage', ({ id }) => {
        const def = RAYS[id];
        expect(def.id, `RAYS.${id}.id`).toBe(id);
        expect(def.name.trim(), `RAYS.${id}.name`).not.toBe('');
        expect(def.energyCost, `RAYS.${id}.energyCost`).toBeGreaterThan(0);
        expect(def.energyCost, `RAYS.${id}.energyCost can never be paid from a pool of ${ENERGY.max}`).toBeLessThanOrEqual(ENERGY.max);
        if (id === 'uv') {
            // "0x others": it reveals and halves, it has no damage of its own
            expect(def.damage, 'RAYS.uv.damage').toBe(0);
        } else {
            expect(def.damage, `RAYS.${id}.damage`).toBeGreaterThan(0);
        }
        expect(Number.isInteger(def.color) && def.color >= 0 && def.color <= 0xffffff, `RAYS.${id}.color`).toBe(true);
    });

    it('have different colours', () => {
        const colors = RAY_IDS.map((id) => RAYS[id].color);
        expect(new Set(colors).size).toBe(colors.length);
    });

    it('share one energy pool that comes back', () => {
        expect(ENERGY.max).toBeGreaterThan(0);
        expect(ENERGY.regenPerSecond).toBeGreaterThan(0);
        expect(ENERGY.recoverAt).toBeGreaterThan(0);
        expect(ENERGY.recoverAt).toBeLessThan(ENERGY.max);
    });
});

describe('text', () => {
    it('the cover has a name, a tagline and a prompt', () => {
        for (const [key, value] of Object.entries(TITLE)) {
            expect(value.trim(), `TITLE.${key}`).not.toBe('');
        }
    });

    it('names every era and every mode', () => {
        for (const style of STYLE_IDS) {
            expect(ERA_NAMES[style]?.trim(), `ERA_NAMES.${style}`).toBeTruthy();
        }
        for (const style of ART_STYLES) {
            expect(ERA_RULE_LINES[style]?.trim(), `ERA_RULE_LINES.${style}`).toBeTruthy();
        }
        for (const mode of RAY_MODES) {
            expect(MODE_NAMES[mode]?.trim(), `MODE_NAMES.${mode}`).toBeTruthy();
        }
    });

    it('GUIDE has a page for exactly the twelve enemies', () => {
        expect(Object.keys(GUIDE).sort()).toEqual([...MONSTER_IDS].sort());
    });

    it.each(MONSTER_IDS.map((id) => ({ id })))('GUIDE.$id has a title, a note and a truth that fit the page', ({ id }) => {
        const page = GUIDE[id];
        expect(page.title.trim(), `GUIDE.${id}.title`).not.toBe('');
        expect(page.note.trim(), `GUIDE.${id}.note`).not.toBe('');
        expect(page.truth.trim(), `GUIDE.${id}.truth`).not.toBe('');
        expect(page.title.length, `GUIDE.${id}.title is ${page.title.length} characters`).toBeLessThanOrEqual(20);
        expect(page.note.length, `GUIDE.${id}.note is ${page.note.length} characters`).toBeLessThanOrEqual(200);
        expect(page.truth.length, `GUIDE.${id}.truth is ${page.truth.length} characters`).toBeLessThanOrEqual(140);
        expect(page.truth, `GUIDE.${id}: the truth must not be the note again`).not.toBe(page.note);
    });

    it('UPGRADES has a card for exactly the seven upgrades', () => {
        expect(Object.keys(UPGRADES).sort()).toEqual([...UPGRADE_IDS].sort());
    });

    it.each(UPGRADE_IDS.map((id) => ({ id })))('UPGRADES.$id has a title and a line that fit the card', ({ id }) => {
        const card = UPGRADES[id];
        expect(card.title.trim(), `UPGRADES.${id}.title`).not.toBe('');
        expect(card.line.trim(), `UPGRADES.${id}.line`).not.toBe('');
        expect(card.title.length, `UPGRADES.${id}.title is ${card.title.length} characters`).toBeLessThanOrEqual(16);
        expect(card.line.length, `UPGRADES.${id}.line is ${card.line.length} characters: "${card.line}"`).toBeLessThanOrEqual(CAPTION_LIMIT);
    });

    it('every granted upgrade has a card', () => {
        for (const { label, level } of ERA_CASES) {
            for (const id of level.grants ?? []) {
                expect(UPGRADES[id], `${label}: no UPGRADES card for "${id}"`).toBeDefined();
            }
        }
    });

    it.each([
        ['reveal', ENDING.reveal],
        ['arrest', ENDING.arrest],
    ])('the ending captions (%s) fit the caption box', (name, lines) => {
        expect(lines.length).toBeGreaterThan(0);
        lines.forEach((line, i) => {
            expect(line.trim(), `ENDING.${name}[${i}] is empty`).not.toBe('');
            expect(line.length, `ENDING.${name}[${i}] is ${line.length} characters: "${line}"`).toBeLessThanOrEqual(CAPTION_LIMIT);
        });
    });

    it('the arrest report ends with the charge', () => {
        expect(ENDING.report.length).toBeGreaterThan(2);
        expect(ENDING.report.at(-1)).toBe('CHARGE: Causing mild annoyance to the public.');
        ENDING.report.forEach((line, i) => {
            expect(line.trim(), `ENDING.report[${i}] is empty`).not.toBe('');
            expect(line.length, `ENDING.report[${i}] is ${line.length} characters: "${line}"`).toBeLessThanOrEqual(CAPTION_LIMIT);
        });
        // One "Label: value" entry per line after the heading
        for (const line of ENDING.report.slice(1)) {
            expect(line, `ENDING.report line "${line}"`).toMatch(/^[^:]+: \S/);
        }
    });

    it('the credits disclose AI use and point at CREDITS.md (jam rule)', () => {
        const credits = ENDING.credits.join('\n');
        expect(credits).toMatch(/AI/);
        expect(credits).toMatch(/CREDITS\.md/);
        expect(ENDING.guideHeading.trim()).not.toBe('');
    });
});
