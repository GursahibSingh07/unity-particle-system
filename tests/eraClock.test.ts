import { describe, expect, it } from 'vitest';
import { ERA } from '../src/config/flow';
import { checkpointBefore, checkpointSeconds, inSurge, pickEntry, spawnInterval, surgeSeconds } from '../src/systems/eraClock';
import type { ContinuousDef, SpawnEntry } from '../src/types';
import { TIMED_CASES } from './helpers';

const def = (change: Partial<ContinuousDef> = {}): ContinuousDef => ({
    duration: 120,
    spawnEvery: [4000, 2000],
    maxAlive: 10,
    table: [{ monster: 'rat', weight: 1 }],
    surge: 20,
    checkpointEvery: 45,
    ...change,
});

/** A repeatable random number generator (mulberry32), so a weight test can never flake */
function rng(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('surgeSeconds and checkpointSeconds', () => {
    it('use what the era says', () => {
        expect(surgeSeconds(def({ surge: 8 }))).toBe(8);
        expect(checkpointSeconds(def({ checkpointEvery: 10 }))).toBe(10);
    });

    it('fall back to the defaults in config/flow.ts', () => {
        expect(surgeSeconds(def({ surge: undefined }))).toBe(ERA.defaultSurge);
        expect(checkpointSeconds(def({ checkpointEvery: undefined }))).toBe(ERA.defaultCheckpointEvery);
    });

    it('never let the surge be longer than the era, or a checkpoint interval be under a second', () => {
        expect(surgeSeconds(def({ duration: 12, surge: 20 }))).toBe(12);
        expect(checkpointSeconds(def({ checkpointEvery: 0 }))).toBe(1);
        expect(checkpointSeconds(def({ checkpointEvery: -30 }))).toBe(1);
    });
});

describe('inSurge', () => {
    it('begins exactly `surge` seconds before the end and lasts to the end', () => {
        const era = def({ duration: 120, surge: 20 });
        expect(inSurge(era, 0)).toBe(false);
        expect(inSurge(era, 99.999)).toBe(false);
        expect(inSurge(era, 100)).toBe(true);
        expect(inSurge(era, 120)).toBe(true);
    });

    it('covers the whole of an era shorter than its surge', () => {
        expect(inSurge(def({ duration: 10, surge: 20 }), 0)).toBe(true);
    });

    it('never happens when the surge is 0, until the last instant', () => {
        const era = def({ surge: 0 });
        expect(inSurge(era, 119.9)).toBe(false);
        expect(inSurge(era, 120)).toBe(true);
    });
});

describe('checkpointBefore', () => {
    const era = def({ duration: 120, checkpointEvery: 45 });

    it.each([
        [0, 0],
        [44.999, 0],
        [45, 45],
        [60, 45],
        [89.9, 45],
        [90, 90],
        [119.9, 90],
        [120, 90],
    ])('a death at %ss goes back to %ss', (elapsed, expected) => {
        expect(checkpointBefore(era, elapsed)).toBe(expected);
    });

    it('never puts a checkpoint on the final second, where a retry would restart into nothing', () => {
        const short = def({ duration: 30, checkpointEvery: 10 });
        expect(checkpointBefore(short, 29.9)).toBe(20);
        expect(checkpointBefore(short, 30)).toBe(20);
        expect(checkpointBefore(def({ duration: 90, checkpointEvery: 45 }), 90)).toBe(45);
    });

    it('is 0 for an era shorter than one interval', () => {
        expect(checkpointBefore(def({ duration: 30, checkpointEvery: 45 }), 30)).toBe(0);
        expect(checkpointBefore(def({ duration: 45, checkpointEvery: 45 }), 45)).toBe(0);
    });

    it('does not run past the end of the era', () => {
        expect(checkpointBefore(era, 9999)).toBe(90);
    });

    it('is a multiple of the interval, never ahead of the clock and never falls as time passes', () => {
        for (const { label, continuous } of TIMED_CASES) {
            const every = checkpointSeconds(continuous);
            let previous = 0;
            for (let elapsed = 0; elapsed <= continuous.duration; elapsed += 0.5) {
                const checkpoint = checkpointBefore(continuous, elapsed);
                const where = `${label} at ${elapsed}s`;
                expect(checkpoint % every, where).toBe(0);
                expect(checkpoint, where).toBeLessThanOrEqual(elapsed);
                expect(checkpoint, where).toBeLessThan(continuous.duration);
                expect(checkpoint, where).toBeGreaterThanOrEqual(previous);
                previous = checkpoint;
            }
        }
    });
});

describe('spawnInterval', () => {
    it('starts at spawnEvery[0]', () => {
        expect(spawnInterval(def(), 0)).toBe(4000);
    });

    it('ramps in a straight line', () => {
        const era = def({ surge: 0 });
        expect(spawnInterval(era, 30)).toBeCloseTo(3500, 6);
        expect(spawnInterval(era, 60)).toBeCloseTo(3000, 6);
        expect(spawnInterval(era, 119.999)).toBeCloseTo(2000, 0);
    });

    it('ends at spawnEvery[1], cut by the surge', () => {
        expect(spawnInterval(def(), 120)).toBeCloseTo(2000 * ERA.surgeInterval, 6);
        expect(spawnInterval(def(), 9999), 'past the end').toBeCloseTo(2000 * ERA.surgeInterval, 6);
    });

    it('drops as the surge begins', () => {
        const era = def();
        const before = spawnInterval(era, 99.99);
        const after = spawnInterval(era, 100);
        expect(after).toBeCloseTo(before * ERA.surgeInterval, 0);
    });

    it('holds the start value before the clock starts', () => {
        expect(spawnInterval(def(), -5)).toBe(4000);
    });

    it('never goes below 50ms, whatever the data says', () => {
        expect(spawnInterval(def({ spawnEvery: [10, 1] }), 60)).toBe(50);
    });

    it('uses spawnEvery[1] for an era with no duration', () => {
        expect(spawnInterval(def({ duration: 0, surge: 0 }), 0)).toBe(2000 * ERA.surgeInterval);
    });

    it('never rises as a real era goes on, and matches its ends', () => {
        for (const { label, continuous } of TIMED_CASES) {
            const [first, last] = continuous.spawnEvery;
            const surging = surgeSeconds(continuous) >= continuous.duration;
            expect(spawnInterval(continuous, 0), `${label} at 0s`).toBe(surging ? first * ERA.surgeInterval : first);
            expect(spawnInterval(continuous, continuous.duration), `${label} at the end`).toBeCloseTo(
                Math.max(50, last * ERA.surgeInterval),
                6,
            );
            let previous = Infinity;
            for (let elapsed = 0; elapsed <= continuous.duration; elapsed += 0.25) {
                const interval = spawnInterval(continuous, elapsed);
                expect(interval, `${label} at ${elapsed}s`).toBeLessThanOrEqual(previous);
                expect(interval, `${label} at ${elapsed}s`).toBeGreaterThanOrEqual(50);
                previous = interval;
            }
        }
    });
});

describe('pickEntry', () => {
    const table: SpawnEntry[] = [
        { monster: 'rat', weight: 6 },
        { monster: 'bat', weight: 3, from: 10 },
        { monster: 'slime', weight: 1, from: 20, group: 2 },
        { monster: 'golem', weight: 0 },
    ];

    it('returns null for an empty table, or one where nothing can appear yet', () => {
        expect(pickEntry([], 50, 0.5)).toBeNull();
        expect(pickEntry([{ monster: 'rat', weight: 1, from: 30 }], 29.9, 0.5)).toBeNull();
        expect(pickEntry([{ monster: 'rat', weight: 0 }], 50, 0.5)).toBeNull();
    });

    it('respects `from`: a line is closed until its second, and open from it', () => {
        const random = rng(1);
        for (let i = 0; i < 500; i++) {
            expect(pickEntry(table, 9.99, random())?.monster, 'before 10s').toBe('rat');
        }
        const at10 = new Set<string>();
        const at20 = new Set<string>();
        for (let i = 0; i < 500; i++) {
            at10.add(pickEntry(table, 10, random())!.monster);
            at20.add(pickEntry(table, 20, random())!.monster);
        }
        expect([...at10].sort()).toEqual(['bat', 'rat']);
        expect([...at20].sort()).toEqual(['bat', 'rat', 'slime']);
    });

    it('treats a missing `from` as 0', () => {
        expect(pickEntry(table, 0, 0.99)?.monster).toBe('rat');
    });

    it('never picks a line with no weight', () => {
        const random = rng(2);
        for (let i = 0; i < 2000; i++) {
            expect(pickEntry(table, 60, random())?.monster).not.toBe('golem');
        }
    });

    it('splits the roll by weight, in table order', () => {
        // Open at 60s: rat 6, bat 3, slime 1 of 10
        expect(pickEntry(table, 60, 0)?.monster).toBe('rat');
        expect(pickEntry(table, 60, 0.599)?.monster).toBe('rat');
        expect(pickEntry(table, 60, 0.6)?.monster).toBe('bat');
        expect(pickEntry(table, 60, 0.899)?.monster).toBe('bat');
        expect(pickEntry(table, 60, 0.9)?.monster).toBe('slime');
        expect(pickEntry(table, 60, 0.999999)?.monster).toBe('slime');
    });

    it('returns the table line itself, group and all', () => {
        expect(pickEntry(table, 60, 0.95)).toBe(table[2]);
    });

    it('picks in proportion to weight over many rolls', () => {
        const random = rng(20260001);
        const counts: Record<string, number> = { rat: 0, bat: 0, slime: 0 };
        const rolls = 20000;
        for (let i = 0; i < rolls; i++) {
            counts[pickEntry(table, 60, random())!.monster]++;
        }
        expect(counts.rat / rolls).toBeCloseTo(0.6, 1);
        expect(counts.bat / rolls).toBeCloseTo(0.3, 1);
        expect(counts.slime / rolls).toBeCloseTo(0.1, 1);
    });

    it('can reach every line of every real table by the end of its era, and only open ones before', () => {
        for (const { label, continuous } of TIMED_CASES) {
            const picked = new Set<SpawnEntry>();
            for (let i = 0; i < 1000; i++) {
                picked.add(pickEntry(continuous.table, continuous.duration, i / 1000)!);
            }
            continuous.table.forEach((entry, i) => {
                if (entry.weight > 0) {
                    expect(picked.has(entry), `${label}: table line ${i + 1} (${entry.monster}) is never picked`).toBe(true);
                }
            });
            for (let elapsed = 0; elapsed < continuous.duration; elapsed += 5) {
                for (let i = 0; i < 50; i++) {
                    const entry = pickEntry(continuous.table, elapsed, i / 50);
                    expect(entry, `${label}: nothing can appear at ${elapsed}s`).not.toBeNull();
                    expect(entry!.from ?? 0, `${label}: ${entry!.monster} picked at ${elapsed}s`).toBeLessThanOrEqual(elapsed);
                }
            }
        }
    });
});
