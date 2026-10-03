// The chiptune voices. Everything takes a BaseAudioContext so the same code plays live
// and renders into an OfflineAudioContext (used to measure the mix, since nobody can
// listen to it in a headless test).

export type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'sine' | 'sawtooth';

export interface Vibrato {
    /** Hz */
    rate: number;
    /** Cents */
    depth: number;
    /** Seconds before the wobble starts, so short notes stay straight */
    delay: number;
}

export interface ToneSpec {
    wave: Wave;
    freq: number;
    time: number;
    /** Seconds the note is held before its release */
    dur: number;
    gain: number;
    attack?: number;
    decay?: number;
    /** Fraction of gain held after the decay */
    sustain?: number;
    release?: number;
    /** Glide in from this frequency */
    slideFrom?: number;
    slideTime?: number;
    /** Sweep to this frequency across the whole note */
    slideTo?: number;
    vibrato?: Vibrato;
    /** Frequencies cycled quickly to fake a chord on one voice */
    arp?: number[];
    arpStep?: number;
}

export interface NoiseSpec {
    time: number;
    /** Seconds for the burst to die away */
    dur: number;
    gain: number;
    filter: BiquadFilterType;
    freq: number;
    freqTo?: number;
    q?: number;
    attack?: number;
}

export interface Mixer {
    ctx: BaseAudioContext;
    /** Music volume; tracks connect to `musicIn` */
    music: GainNode;
    musicIn: GainNode;
    sfx: GainNode;
    /** Lowers the music for `seconds`, then brings it back */
    duck(seconds: number): void;
}

const pulseWaves = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
    let byDuty = pulseWaves.get(ctx);
    if (!byDuty) {
        byDuty = new Map();
        pulseWaves.set(ctx, byDuty);
    }
    let wave = byDuty.get(duty);
    if (!wave) {
        // Fourier series of a rectangular pulse; the harmonic cap keeps high notes from aliasing
        const harmonics = 48;
        const real = new Float32Array(harmonics + 1);
        const imag = new Float32Array(harmonics + 1);
        for (let n = 1; n <= harmonics; n++) {
            real[n] = (4 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
        }
        wave = ctx.createPeriodicWave(real, imag);
        byDuty.set(duty, wave);
    }
    return wave;
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    let buffer = noiseBuffers.get(ctx);
    if (!buffer) {
        buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        // A fixed seed, so offline renders are repeatable
        let seed = 0x2f6e2b1;
        for (let i = 0; i < data.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
            data[i] = seed / 0x80000000;
        }
        noiseBuffers.set(ctx, buffer);
    }
    return buffer;
}

function setWave(ctx: BaseAudioContext, osc: OscillatorNode, wave: Wave) {
    if (wave === 'pulse12') {
        osc.setPeriodicWave(pulseWave(ctx, 0.125));
    } else if (wave === 'pulse25') {
        osc.setPeriodicWave(pulseWave(ctx, 0.25));
    } else if (wave === 'pulse50') {
        osc.type = 'square';
    } else {
        osc.type = wave;
    }
}

export function tone(ctx: BaseAudioContext, dest: AudioNode, spec: ToneSpec): void {
    const t = Math.max(0, spec.time);
    const dur = Math.max(0.005, spec.dur);
    // An attack longer than the note would leave the release scheduled inside the ramp
    const attack = Math.min(spec.attack ?? 0.004, dur * 0.5);
    const decay = spec.decay ?? 0.08;
    const sustain = spec.sustain ?? 0.7;
    const release = spec.release ?? 0.05;
    const end = t + dur + release;

    const osc = ctx.createOscillator();
    setWave(ctx, osc, spec.wave);
    const freq = osc.frequency;
    if (spec.arp && spec.arp.length > 1) {
        const step = spec.arpStep ?? 0.04;
        for (let i = 0, at = t; at < end; i++, at += step) {
            freq.setValueAtTime(spec.arp[i % spec.arp.length], at);
        }
    } else if (spec.slideFrom) {
        freq.setValueAtTime(spec.slideFrom, t);
        freq.exponentialRampToValueAtTime(spec.freq, t + Math.min(spec.slideTime ?? 0.06, dur));
    } else {
        freq.setValueAtTime(spec.freq, t);
    }
    if (spec.slideTo) {
        freq.exponentialRampToValueAtTime(spec.slideTo, t + dur);
    }

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(spec.gain, t + attack);
    amp.gain.setTargetAtTime(spec.gain * sustain, t + attack, decay / 3);
    amp.gain.setTargetAtTime(0, t + dur, release / 5);

    let lfo: OscillatorNode | null = null;
    const vibrato = spec.vibrato;
    if (vibrato && dur > vibrato.delay + 0.05) {
        lfo = ctx.createOscillator();
        lfo.frequency.value = vibrato.rate;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t + vibrato.delay);
        depth.gain.linearRampToValueAtTime(vibrato.depth, t + vibrato.delay + 0.08);
        lfo.connect(depth).connect(osc.detune);
        lfo.start(t);
        lfo.stop(end);
    }

    osc.connect(amp).connect(dest);
    osc.onended = () => amp.disconnect();
    osc.start(t);
    osc.stop(end);
}

export function noise(ctx: BaseAudioContext, dest: AudioNode, spec: NoiseSpec): void {
    const t = Math.max(0, spec.time);
    const attack = spec.attack ?? 0.001;
    const end = t + attack + spec.dur;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = spec.filter;
    filter.Q.value = spec.q ?? 0.7;
    filter.frequency.setValueAtTime(spec.freq, t);
    if (spec.freqTo) {
        filter.frequency.exponentialRampToValueAtTime(spec.freqTo, end);
    }

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(spec.gain, t + attack);
    amp.gain.setTargetAtTime(0, t + attack, spec.dur / 4);

    source.connect(filter).connect(amp).connect(dest);
    source.onended = () => amp.disconnect();
    // Start somewhere different in the buffer each time, so repeated hits are not identical
    source.start(t, (t * 7.3) % 0.9);
    source.stop(end);
}

/** One hit of the percussion channel: k kick, s snare, h closed hat, o open hat, c crash */
export function drum(ctx: BaseAudioContext, dest: AudioNode, kind: string, time: number, gain: number): void {
    switch (kind) {
        case 'k':
            tone(ctx, dest, {
                wave: 'sine',
                freq: 170,
                slideTo: 48,
                time,
                dur: 0.1,
                gain: gain * 1.5,
                attack: 0.001,
                decay: 0.12,
                sustain: 0,
                release: 0.03,
            });
            noise(ctx, dest, { time, dur: 0.02, gain: gain * 0.4, filter: 'lowpass', freq: 1200 });
            break;
        case 's':
            noise(ctx, dest, { time, dur: 0.13, gain: gain * 1.1, filter: 'bandpass', freq: 2400, q: 0.5 });
            tone(ctx, dest, {
                wave: 'triangle',
                freq: 240,
                slideTo: 150,
                time,
                dur: 0.05,
                gain: gain * 0.7,
                attack: 0.001,
                decay: 0.06,
                sustain: 0,
                release: 0.02,
            });
            break;
        case 'h':
            noise(ctx, dest, { time, dur: 0.035, gain: gain * 0.5, filter: 'highpass', freq: 7000 });
            break;
        case 'o':
            noise(ctx, dest, { time, dur: 0.16, gain: gain * 0.45, filter: 'highpass', freq: 6000 });
            break;
        case 'c':
            noise(ctx, dest, { time, dur: 0.5, gain: gain * 0.6, filter: 'highpass', freq: 4500 });
            tone(ctx, dest, {
                wave: 'sine',
                freq: 170,
                slideTo: 48,
                time,
                dur: 0.1,
                gain: gain * 1.5,
                attack: 0.001,
                decay: 0.12,
                sustain: 0,
                release: 0.03,
            });
            break;
    }
}

/** Music and effects share one limiter, so a busy moment squashes instead of clipping */
export function createMixer(ctx: BaseAudioContext, musicVolume: number, sfxVolume: number): Mixer {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    // The compressor adds make-up gain of its own; this trims it back under full scale
    const trim = ctx.createGain();
    trim.gain.value = 0.85;
    limiter.connect(trim).connect(ctx.destination);

    const music = ctx.createGain();
    music.gain.value = musicVolume;
    const ducker = ctx.createGain();
    const musicIn = ctx.createGain();
    musicIn.connect(ducker).connect(music).connect(limiter);

    const sfx = ctx.createGain();
    sfx.gain.value = sfxVolume;
    sfx.connect(limiter);

    const duck = (seconds: number) => {
        const now = ctx.currentTime;
        const g = ducker.gain;
        g.cancelScheduledValues(now);
        g.setTargetAtTime(0.25, now, 0.02);
        g.setTargetAtTime(1, now + seconds, 0.15);
    };

    return { ctx, music, musicIn, sfx, duck };
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#4' or 'Bb3' to a MIDI note number; NaN if it is not a note name */
export function midiOf(name: string): number {
    const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!match) {
        return NaN;
    }
    const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
    return SEMITONES[match[1]] + accidental + (Number(match[3]) + 1) * 12;
}

export function freqOfMidi(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export function hz(name: string): number {
    return freqOfMidi(midiOf(name));
}
