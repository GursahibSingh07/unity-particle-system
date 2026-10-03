import { hz, noise, tone, type Wave } from './synth';
import type { LoopId, SfxId } from './types';

export interface SfxDef {
    /** Seconds until the sound has died away */
    dur: number;
    /** Seconds to hold the music down for */
    duck?: number;
    /** Repeats of this sound closer together than this many seconds are ignored */
    gap?: number;
    play(ctx: BaseAudioContext, dest: AudioNode, time: number): void;
}

export interface LoopHandle {
    stop(): void;
}

/** A quick run of notes on one voice; the last one rings for `hold` seconds */
function run(
    ctx: BaseAudioContext,
    dest: AudioNode,
    time: number,
    notes: string[],
    step: number,
    hold: number,
    wave: Wave,
    gain: number,
) {
    notes.forEach((name, i) => {
        const last = i === notes.length - 1;
        tone(ctx, dest, {
            wave,
            freq: hz(name),
            time: time + i * step,
            dur: last ? hold : step * 0.85,
            gain,
            decay: last ? 0.3 : 0.06,
            sustain: last ? 0.5 : 0.7,
            release: last ? 0.2 : 0.03,
            vibrato: last ? { rate: 7, depth: 14, delay: 0.12 } : undefined,
        });
    });
}

export const SFX: Record<SfxId, SfxDef> = {
    // A ring pushing outward: a warbling upward sweep over a soft thump
    radio: {
        dur: 0.35,
        play(ctx, dest, time) {
            tone(ctx, dest, {
                wave: 'pulse50',
                freq: 150,
                slideTo: 620,
                time,
                dur: 0.2,
                gain: 0.2,
                sustain: 0.6,
                release: 0.08,
                vibrato: { rate: 32, depth: 260, delay: 0 },
            });
            noise(ctx, dest, { time, dur: 0.26, gain: 0.22, filter: 'bandpass', freq: 500, freqTo: 2600, q: 1.2 });
            tone(ctx, dest, { wave: 'triangle', freq: 130, slideTo: 55, time, dur: 0.12, gain: 0.42, sustain: 0, decay: 0.15 });
        },
    },
    // A camera flash: all top end
    ultraviolet: {
        dur: 0.3,
        play(ctx, dest, time) {
            tone(ctx, dest, { wave: 'pulse12', freq: 2900, slideTo: 1500, time, dur: 0.11, gain: 0.26, sustain: 0.3 });
            tone(ctx, dest, { wave: 'sine', freq: 1900, slideTo: 3900, time, dur: 0.08, gain: 0.24, sustain: 0.2 });
            noise(ctx, dest, { time, dur: 0.24, gain: 0.5, filter: 'highpass', freq: 5200 });
        },
    },
    // The released ray: a hard zap falling a long way
    gamma: {
        dur: 0.45,
        play(ctx, dest, time) {
            tone(ctx, dest, { wave: 'sawtooth', freq: 2400, slideTo: 90, time, dur: 0.3, gain: 0.17, sustain: 0.7, release: 0.08 });
            tone(ctx, dest, { wave: 'triangle', freq: 110, slideTo: 40, time, dur: 0.26, gain: 0.34, sustain: 0.6, release: 0.1 });
            noise(ctx, dest, { time, dur: 0.3, gain: 0.2, filter: 'lowpass', freq: 7000, freqTo: 300 });
        },
    },
    // "FZZT!": the big one. Crackle, a falling buzz, a thump and a sparkle on top.
    hitWeak: {
        dur: 0.35,
        gap: 0.09,
        play(ctx, dest, time) {
            noise(ctx, dest, { time, dur: 0.24, gain: 0.44, filter: 'bandpass', freq: 3400, freqTo: 600, q: 0.9 });
            tone(ctx, dest, {
                wave: 'pulse25',
                freq: 1320,
                slideTo: 300,
                time,
                dur: 0.16,
                gain: 0.25,
                sustain: 0.6,
                release: 0.06,
                vibrato: { rate: 45, depth: 180, delay: 0 },
            });
            tone(ctx, dest, { wave: 'triangle', freq: 210, slideTo: 60, time, dur: 0.14, gain: 0.52, sustain: 0.3, decay: 0.15 });
            tone(ctx, dest, { wave: 'pulse12', freq: 1760, time: time + 0.06, dur: 0.04, gain: 0.09, sustain: 0.4 });
            tone(ctx, dest, { wave: 'pulse12', freq: 2637, time: time + 0.11, dur: 0.07, gain: 0.09, sustain: 0.4 });
        },
    },
    // An ordinary blip
    hitNormal: {
        dur: 0.12,
        gap: 0.09,
        play(ctx, dest, time) {
            tone(ctx, dest, { wave: 'pulse50', freq: 540, slideTo: 380, time, dur: 0.05, gain: 0.3, sustain: 0.4, release: 0.03 });
            noise(ctx, dest, { time, dur: 0.05, gain: 0.25, filter: 'bandpass', freq: 1800 });
        },
    },
    // "tink": small, high and dead
    hitResist: {
        dur: 0.08,
        gap: 0.12,
        play(ctx, dest, time) {
            tone(ctx, dest, { wave: 'triangle', freq: 2350, time, dur: 0.015, gain: 0.5, decay: 0.03, sustain: 0, release: 0.03 });
            tone(ctx, dest, { wave: 'sine', freq: 3520, time, dur: 0.01, gain: 0.2, decay: 0.02, sustain: 0, release: 0.02 });
        },
    },
    monsterDie: {
        dur: 0.45,
        play(ctx, dest, time) {
            run(ctx, dest, time, ['A5', 'E5', 'C5', 'A4', 'E4'], 0.045, 0.08, 'pulse25', 0.2);
            noise(ctx, dest, { time: time + 0.04, dur: 0.34, gain: 0.3, filter: 'bandpass', freq: 1600, freqTo: 180, q: 0.8 });
        },
    },
    playerHurt: {
        dur: 0.3,
        gap: 0.15,
        play(ctx, dest, time) {
            tone(ctx, dest, {
                wave: 'sawtooth',
                freq: 320,
                slideTo: 105,
                time,
                dur: 0.18,
                gain: 0.32,
                sustain: 0.7,
                release: 0.06,
                vibrato: { rate: 38, depth: 220, delay: 0 },
            });
            noise(ctx, dest, { time, dur: 0.12, gain: 0.34, filter: 'lowpass', freq: 900 });
        },
    },
    // A slow fall, then the floor drops out
    playerDie: {
        dur: 1.5,
        duck: 1.4,
        play(ctx, dest, time) {
            const notes = ['B4', 'A4', 'F4', 'D4'];
            notes.forEach((name, i) => {
                tone(ctx, dest, { wave: 'pulse50', freq: hz(name), time: time + i * 0.14, dur: 0.12, gain: 0.13 });
                tone(ctx, dest, { wave: 'triangle', freq: hz(name) / 2, time: time + i * 0.14, dur: 0.12, gain: 0.25 });
            });
            const fall = time + notes.length * 0.14;
            tone(ctx, dest, {
                wave: 'pulse50',
                freq: hz('B3'),
                slideTo: hz('B2'),
                time: fall,
                dur: 0.6,
                gain: 0.13,
                sustain: 0.6,
                release: 0.25,
                vibrato: { rate: 6, depth: 40, delay: 0.1 },
            });
            tone(ctx, dest, { wave: 'triangle', freq: hz('B2'), slideTo: hz('B1'), time: fall, dur: 0.6, gain: 0.25, release: 0.25 });
        },
    },
    // Up the tonic chord in two voices
    roomClear: {
        dur: 0.8,
        play(ctx, dest, time) {
            run(ctx, dest, time, ['G5', 'C6', 'E6', 'G6'], 0.075, 0.32, 'pulse25', 0.12);
            run(ctx, dest, time, ['E5', 'G5', 'C6', 'E6'], 0.075, 0.32, 'pulse12', 0.07);
            tone(ctx, dest, { wave: 'triangle', freq: hz('C3'), time, dur: 0.5, gain: 0.25, release: 0.1 });
        },
    },
    // Three rising chords, subdominant to dominant to home, and the last one is held
    itemGet: {
        dur: 1.7,
        duck: 1.6,
        play(ctx, dest, time) {
            const step = 0.085;
            run(ctx, dest, time, ['F5', 'A5', 'C6', 'G5', 'B5', 'D6', 'C6', 'E6', 'G6'], step, 0.75, 'pulse25', 0.12);
            const home = time + 8 * step;
            tone(ctx, dest, { wave: 'pulse12', freq: hz('E6'), time: home, dur: 0.75, gain: 0.06, release: 0.2 });
            tone(ctx, dest, { wave: 'pulse12', freq: hz('C6'), time: home, dur: 0.75, gain: 0.06, release: 0.2 });
            const bass = { wave: 'triangle' as Wave, gain: 0.26, release: 0.06 };
            tone(ctx, dest, { ...bass, freq: hz('F3'), time, dur: step * 2.6 });
            tone(ctx, dest, { ...bass, freq: hz('G3'), time: time + 3 * step, dur: step * 2.6 });
            tone(ctx, dest, { ...bass, freq: hz('C3'), time: time + 6 * step, dur: step * 2 + 0.75, release: 0.2 });
            noise(ctx, dest, { time: home, dur: 0.4, gain: 0.07, filter: 'highpass', freq: 6000 });
        },
    },
    // A lid creaking up, then the catch
    chestOpen: {
        dur: 0.3,
        play(ctx, dest, time) {
            noise(ctx, dest, { time, dur: 0.2, gain: 0.2, filter: 'bandpass', freq: 400, freqTo: 1900, q: 2, attack: 0.03 });
            tone(ctx, dest, { wave: 'triangle', freq: 190, slideTo: 520, time, dur: 0.16, gain: 0.22, attack: 0.02, release: 0.04 });
            tone(ctx, dest, { wave: 'pulse50', freq: hz('G4'), time: time + 0.18, dur: 0.03, gain: 0.1, sustain: 0.3 });
        },
    },
    // A lydian climb with an echo: "something was here all along"
    secret: {
        dur: 1.2,
        duck: 1.0,
        play(ctx, dest, time) {
            const notes = ['E5', 'A#5', 'G#5', 'B5', 'D#6', 'G#6'];
            run(ctx, dest, time, notes, 0.095, 0.4, 'pulse12', 0.17);
            run(ctx, dest, time + 0.14, notes, 0.095, 0.3, 'triangle', 0.16);
        },
    },
    // Turning the dial on the machine
    switch: {
        dur: 0.1,
        play(ctx, dest, time) {
            noise(ctx, dest, { time, dur: 0.02, gain: 0.24, filter: 'highpass', freq: 3000 });
            tone(ctx, dest, { wave: 'triangle', freq: 480, slideTo: 960, time: time + 0.01, dur: 0.05, gain: 0.4, sustain: 0.5, release: 0.03 });
        },
    },
    // Two flat low buzzes: nothing in the tank
    denied: {
        dur: 0.2,
        gap: 0.2,
        play(ctx, dest, time) {
            tone(ctx, dest, { wave: 'pulse50', freq: 155, time, dur: 0.05, gain: 0.12, sustain: 0.9, release: 0.02 });
            tone(ctx, dest, { wave: 'pulse50', freq: 147, time: time + 0.09, dur: 0.06, gain: 0.12, sustain: 0.9, release: 0.02 });
        },
    },
    heart: {
        dur: 0.4,
        play(ctx, dest, time) {
            run(ctx, dest, time, ['E6', 'A6', 'C#7'], 0.07, 0.16, 'triangle', 0.2);
        },
    },
    // A rumble swelling into a tritone, then a falling crash
    bossPhase: {
        dur: 1.4,
        duck: 1.2,
        play(ctx, dest, time) {
            noise(ctx, dest, { time, dur: 0.5, gain: 0.22, filter: 'lowpass', freq: 200, freqTo: 3200, attack: 0.4 });
            const growl = { wave: 'pulse50' as Wave, time, dur: 0.5, gain: 0.09, attack: 0.3, sustain: 1, release: 0.05 };
            tone(ctx, dest, { ...growl, freq: hz('C3'), vibrato: { rate: 12, depth: 60, delay: 0 } });
            tone(ctx, dest, { ...growl, freq: hz('F#3'), vibrato: { rate: 13, depth: 60, delay: 0 } });
            const hit = time + 0.52;
            tone(ctx, dest, { wave: 'pulse25', freq: hz('C5'), slideTo: hz('C4'), time: hit, dur: 0.4, gain: 0.15, release: 0.2 });
            tone(ctx, dest, { wave: 'triangle', freq: hz('C3'), slideTo: hz('C2'), time: hit, dur: 0.4, gain: 0.34, release: 0.2 });
            noise(ctx, dest, { time: hit, dur: 0.6, gain: 0.2, filter: 'highpass', freq: 3000 });
        },
    },
    uiSelect: {
        dur: 0.12,
        play(ctx, dest, time) {
            tone(ctx, dest, { wave: 'pulse25', freq: 880, time, dur: 0.03, gain: 0.22 });
            tone(ctx, dest, { wave: 'pulse25', freq: 1320, time: time + 0.035, dur: 0.05, gain: 0.22, release: 0.04 });
        },
    },
};

/** A sustained voice built from oscillators run through one gain, faded out when stopped */
function sustained(
    ctx: BaseAudioContext,
    dest: AudioNode,
    time: number,
    level: number,
    build: (out: AudioNode, sources: AudioScheduledSourceNode[]) => void,
): LoopHandle {
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.setTargetAtTime(level, time, 0.03);
    out.connect(dest);
    const sources: AudioScheduledSourceNode[] = [];
    build(out, sources);
    for (const source of sources) {
        source.start(time);
    }
    return {
        stop() {
            const now = ctx.currentTime;
            out.gain.cancelScheduledValues(now);
            out.gain.setTargetAtTime(0, now, 0.02);
            for (const source of sources) {
                source.stop(now + 0.2);
            }
            sources[0].onended = () => out.disconnect();
        },
    };
}

export const LOOPS: Record<LoopId, (ctx: BaseAudioContext, dest: AudioNode, time: number) => LoopHandle> = {
    // A warm low hum with a slow shimmer, like a heater element
    infrared(ctx, dest, time) {
        return sustained(ctx, dest, time, 0.22, (out, sources) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 750;
            const tremolo = ctx.createGain();
            tremolo.gain.value = 0.8;
            filter.connect(tremolo).connect(out);

            const low = ctx.createOscillator();
            low.type = 'triangle';
            low.frequency.value = 98;
            const lowGain = ctx.createGain();
            lowGain.gain.value = 0.5;
            low.connect(lowGain).connect(filter);

            const high = ctx.createOscillator();
            high.type = 'sawtooth';
            high.frequency.value = 196;
            high.detune.value = 9;
            const highGain = ctx.createGain();
            highGain.gain.value = 0.12;
            high.connect(highGain).connect(filter);

            const lfo = ctx.createOscillator();
            lfo.frequency.value = 7;
            const depth = ctx.createGain();
            depth.gain.value = 0.2;
            lfo.connect(depth).connect(tremolo.gain);

            sources.push(low, high, lfo);
        });
    },
    // Climbs for about a second, then holds at the top, fluttering faster: ready to fire
    gammaCharge(ctx, dest, time) {
        return sustained(ctx, dest, time, 0.4, (out, sources) => {
            const tremolo = ctx.createGain();
            tremolo.gain.value = 0.7;
            tremolo.connect(out);

            const main = ctx.createOscillator();
            main.type = 'square';
            main.frequency.setValueAtTime(180, time);
            main.frequency.exponentialRampToValueAtTime(1440, time + 1);
            const mainGain = ctx.createGain();
            mainGain.gain.value = 0.14;
            main.connect(mainGain).connect(tremolo);

            const under = ctx.createOscillator();
            under.type = 'triangle';
            under.frequency.setValueAtTime(90, time);
            under.frequency.exponentialRampToValueAtTime(720, time + 1);
            const underGain = ctx.createGain();
            underGain.gain.value = 0.3;
            under.connect(underGain).connect(tremolo);

            const lfo = ctx.createOscillator();
            lfo.frequency.setValueAtTime(6, time);
            lfo.frequency.linearRampToValueAtTime(26, time + 1);
            const depth = ctx.createGain();
            depth.gain.value = 0.3;
            lfo.connect(depth).connect(tremolo.gain);

            sources.push(main, under, lfo);
        });
    },
};
