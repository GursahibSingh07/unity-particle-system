import { describe, expect, it } from 'vitest';
import { getCompiled, validateTracks } from '../src/audio/sequencer';
import { TRACKS } from '../src/audio/tracks';
import type { MusicId } from '../src/audio/types';

// The score is compiled in Node: no AudioContext is created, nothing is played.

const ids = Object.keys(TRACKS) as MusicId[];

describe('music', () => {
    it('has a track for every part of the game', () => {
        // docs/DESIGN.md, Audio: v2 adds `cyberpunk` and `retro`
        for (const id of ['cyberpunk', 'retro']) {
            expect(ids as string[], `no "${id}" track in TRACKS`).toContain(id);
        }
        expect(ids.length).toBeGreaterThanOrEqual(5);
    });

    it('validateTracks() finds no problems in the score', () => {
        expect(validateTracks()).toEqual([]);
    });

    it.each(ids.map((id) => ({ id })))('$id compiles to events with no errors', ({ id }) => {
        const compiled = getCompiled(id);
        expect(compiled.errors, `track "${id}"`).toEqual([]);
        expect(compiled.events.length, `track "${id}" has no notes`).toBeGreaterThan(0);
    });
});
