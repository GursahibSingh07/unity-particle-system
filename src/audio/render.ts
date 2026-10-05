import { DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME } from './index';
import { getCompiled, scheduleRange } from './sequencer';
import { LOOPS, SFX } from './sfx';
import { createMixer, type Mixer } from './synth';
import type { LoopId, MusicId, SfxId } from './types';

// Renders through the same voices and mixer as the live engine, into a buffer instead of
// the speakers. Not used by the game: it exists so tests and tools can measure the sound.

export interface Measurement {
    seconds: number;
    peak: number;
    rms: number;
    /** Loudest RMS over any 50 ms window */
    loudest: number;
    /** Seconds of near-silence at the start */
    leadingSilence: number;
    /** Samples that are NaN or infinite */
    bad: number;
}

const RATE = 44100;
const WINDOW = 1;

/**
 * Renders `seconds` of sound, calling `schedule` for one window at a time just before it
 * is needed. Handing a whole track's oscillators to the context at once is very slow.
 */
async function render(seconds: number, schedule: (mixer: Mixer, from: number, to: number) => void): Promise<AudioBuffer> {
    const ctx = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
    const mixer = createMixer(ctx, DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME);
    schedule(mixer, 0, WINDOW);
    for (let from = WINDOW; from < seconds; from += WINDOW) {
        const start = from;
        void ctx.suspend(start - 0.05).then(() => {
            schedule(mixer, start, start + WINDOW);
            void ctx.resume();
        });
    }
    return ctx.startRendering();
}

export function renderMusic(id: MusicId, passes = 1, tail = 0.5): Promise<AudioBuffer> {
    const song = getCompiled(id);
    return render(song.duration * passes + tail, (mixer, from, to) => {
        scheduleRange(mixer.ctx, mixer.musicIn, song, passes, from, to);
    });
}

export function renderSfx(id: SfxId): Promise<AudioBuffer> {
    return render(SFX[id].dur + 0.3, (mixer, from) => {
        if (from === 0) {
            SFX[id].play(mixer.ctx, mixer.sfx, 0.005);
        }
    });
}

export function renderLoop(id: LoopId, seconds = 2): Promise<AudioBuffer> {
    return render(seconds, (mixer, from) => {
        if (from === 0) {
            LOOPS[id](mixer.ctx, mixer.sfx, 0.005);
        }
    });
}

/** Worst case for the limiter: a track with effects fired over the top of it, eight a second */
export function renderBusy(
    id: MusicId,
    effects: SfxId[],
    seconds = 6,
    loops: LoopId[] = ['infrared'],
): Promise<AudioBuffer> {
    const song = getCompiled(id);
    const spacing = 0.125;
    return render(seconds, (mixer, from, to) => {
        scheduleRange(mixer.ctx, mixer.musicIn, song, 1, from, to);
        if (from === 0) {
            for (const loop of loops) {
                LOOPS[loop](mixer.ctx, mixer.sfx, 0.2);
            }
        }
        for (let i = Math.ceil(from / spacing); i * spacing < to; i++) {
            if (i >= 4) {
                SFX[effects[i % effects.length]].play(mixer.ctx, mixer.sfx, i * spacing);
            }
        }
    });
}

export function measure(buffer: AudioBuffer): Measurement {
    const data = buffer.getChannelData(0);
    const window = Math.floor(buffer.sampleRate * 0.05);
    let peak = 0;
    let sum = 0;
    let bad = 0;
    let loudest = 0;
    let windowSum = 0;
    let first = -1;
    for (let i = 0; i < data.length; i++) {
        const value = data[i];
        if (!Number.isFinite(value)) {
            bad++;
            continue;
        }
        const magnitude = Math.abs(value);
        if (magnitude > peak) {
            peak = magnitude;
        }
        if (first < 0 && magnitude > 0.001) {
            first = i;
        }
        sum += value * value;
        windowSum += value * value;
        if ((i + 1) % window === 0) {
            loudest = Math.max(loudest, Math.sqrt(windowSum / window));
            windowSum = 0;
        }
    }
    return {
        seconds: data.length / buffer.sampleRate,
        peak,
        rms: Math.sqrt(sum / data.length),
        loudest,
        leadingSilence: first < 0 ? data.length / buffer.sampleRate : first / buffer.sampleRate,
        bad,
    };
}
