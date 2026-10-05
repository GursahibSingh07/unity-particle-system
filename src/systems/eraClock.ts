import { ERA } from '../config/flow';
import type { ContinuousDef, SpawnEntry } from '../types';

// The arithmetic of a timed era (no Phaser), so it can be unit tested. Times are in seconds
// since the era's clock started unless they say otherwise.

export const surgeSeconds = (def: ContinuousDef) => Math.min(def.duration, def.surge ?? ERA.defaultSurge);

export const checkpointSeconds = (def: ContinuousDef) => Math.max(1, def.checkpointEvery ?? ERA.defaultCheckpointEvery);

/** True once the final surge has begun */
export function inSurge(def: ContinuousDef, elapsed: number) {
    return elapsed >= def.duration - surgeSeconds(def);
}

/** The time a death at `elapsed` goes back to: the last checkpoint passed (0 before the first) */
export function checkpointBefore(def: ContinuousDef, elapsed: number) {
    const every = checkpointSeconds(def);
    const last = Math.floor(Math.min(elapsed, def.duration) / every) * every;
    // A checkpoint on the final second would restart into nothing
    return last >= def.duration ? Math.max(0, last - every) : last;
}

/**
 * Milliseconds between arrivals at `elapsed`: it ramps in a straight line from spawnEvery[0] to
 * spawnEvery[1] over the era, and the surge cuts it shorter still.
 */
export function spawnInterval(def: ContinuousDef, elapsed: number) {
    const t = def.duration > 0 ? Math.min(1, Math.max(0, elapsed / def.duration)) : 1;
    const interval = def.spawnEvery[0] + (def.spawnEvery[1] - def.spawnEvery[0]) * t;
    return Math.max(50, inSurge(def, elapsed) ? interval * ERA.surgeInterval : interval);
}

/**
 * Pick a line of the spawn table by weight, among those whose `from` has passed.
 * `roll` is a random number in [0, 1). Returns null if nothing can appear yet.
 */
export function pickEntry(table: SpawnEntry[], elapsed: number, roll: number): SpawnEntry | null {
    const open = table.filter((entry) => (entry.from ?? 0) <= elapsed && entry.weight > 0);
    const total = open.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) {
        return null;
    }
    let left = roll * total;
    for (const entry of open) {
        left -= entry.weight;
        if (left < 0) {
            return entry;
        }
    }
    return open[open.length - 1];
}
