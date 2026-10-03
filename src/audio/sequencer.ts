import { drum, freqOfMidi, midiOf, tone } from './synth';
import { TRACKS, type Instrument, type Track } from './tracks';
import type { MusicId } from './types';

type Channel = 'lead' | 'harmony' | 'bass';
const CHANNELS: Channel[] = ['lead', 'harmony', 'bass'];

interface NoteEvent {
    kind: 'note';
    step: number;
    len: number;
    channel: Channel;
    midi: number[];
    /** MIDI note to glide in from */
    from?: number;
}

interface DrumEvent {
    kind: 'drum';
    step: number;
    hit: string;
}

type SeqEvent = NoteEvent | DrumEvent;

export interface CompiledTrack {
    track: Track;
    events: SeqEvent[];
    steps: number;
    bars: number;
    /** Seconds per step */
    stepTime: number;
    /** Seconds for one pass through the track */
    duration: number;
    errors: string[];
}

const TOKEN = /^(~?)([A-G][#b]?-?\d(?:\+[A-G][#b]?-?\d)*)(?::(\d+))?$/;
const REST = /^r(?::(\d+))?$/;
const DRUM_HITS = 'kshoc';

function compileLine(
    line: string,
    channel: Channel,
    offset: number,
    track: Track,
    where: string,
    events: SeqEvent[],
    errors: string[],
): number {
    let step = 0;
    let previous: number | undefined;
    for (const token of line.split(/\s+/)) {
        if (token === '') {
            continue;
        }
        if (token === '|') {
            if (step % track.stepsPerBar !== 0) {
                errors.push(`${where}: bar line at step ${step} is not on a bar boundary`);
            }
            continue;
        }
        const rest = REST.exec(token);
        if (rest) {
            step += Number(rest[1] ?? 2);
            continue;
        }
        const note = TOKEN.exec(token);
        if (!note) {
            errors.push(`${where}: cannot read "${token}"`);
            continue;
        }
        const midi = note[2].split('+').map(midiOf);
        const len = Number(note[3] ?? 2);
        const event: NoteEvent = { kind: 'note', step: offset + step, len, channel, midi };
        if (note[1] && previous !== undefined) {
            event.from = previous;
        }
        events.push(event);
        previous = midi[0];
        step += len;
    }
    return step;
}

export function compileTrack(track: Track, name = 'track'): CompiledTrack {
    const events: SeqEvent[] = [];
    const errors: string[] = [];
    let offset = 0;
    track.sections.forEach((section, index) => {
        const length = section.bars * track.stepsPerBar;
        for (const channel of CHANNELS) {
            const line = section[channel];
            if (line === undefined) {
                continue;
            }
            const where = `${name} section ${index} ${channel}`;
            const steps = compileLine(line, channel, offset, track, where, events, errors);
            if (steps !== length) {
                errors.push(`${where}: ${steps} steps, expected ${length}`);
            }
        }
        if (section.drums !== undefined) {
            const hits = section.drums.replace(/[\s|]/g, '');
            if (hits.length !== length) {
                errors.push(`${name} section ${index} drums: ${hits.length} steps, expected ${length}`);
            }
            for (let i = 0; i < hits.length; i++) {
                if (DRUM_HITS.includes(hits[i])) {
                    events.push({ kind: 'drum', step: offset + i, hit: hits[i] });
                }
            }
        }
        offset += length;
    });
    events.sort((a, b) => a.step - b.step);
    const stepTime = 60 / track.bpm / track.stepsPerBeat;
    return {
        track,
        events,
        steps: offset,
        bars: offset / track.stepsPerBar,
        stepTime,
        duration: offset * stepTime,
        errors,
    };
}

const compiled = new Map<MusicId, CompiledTrack>();

export function getCompiled(id: MusicId): CompiledTrack {
    let result = compiled.get(id);
    if (!result) {
        result = compileTrack(TRACKS[id], id);
        compiled.set(id, result);
    }
    return result;
}

/** Problems in the score (wrong bar lengths, unreadable notes). Empty when all is well. Runs without any audio. */
export function validateTracks(): string[] {
    const errors: string[] = [];
    for (const id of Object.keys(TRACKS) as MusicId[]) {
        errors.push(...getCompiled(id).errors);
    }
    return errors;
}

function playNote(
    ctx: BaseAudioContext,
    dest: AudioNode,
    instrument: Instrument,
    event: NoteEvent,
    time: number,
    stepTime: number,
) {
    if (instrument.gain <= 0) {
        return;
    }
    const length = event.len * stepTime;
    const base = {
        wave: instrument.wave,
        time,
        // The release must fit inside the gap before the next note, or fast lines smear
        dur: Math.max(0.02, length * instrument.gate),
        gain: instrument.gain,
        attack: instrument.attack,
        decay: instrument.decay,
        sustain: instrument.sustain,
        release: instrument.release,
        vibrato: instrument.vibrato,
    };
    const freqs = event.midi.map(freqOfMidi);
    if (freqs.length > 1 && instrument.chord === 'stack') {
        for (const freq of freqs) {
            tone(ctx, dest, { ...base, freq, gain: instrument.gain / Math.sqrt(freqs.length) });
        }
        return;
    }
    tone(ctx, dest, {
        ...base,
        freq: freqs[0],
        arp: freqs.length > 1 ? freqs : undefined,
        arpStep: stepTime / 2,
        slideFrom: event.from !== undefined ? freqOfMidi(event.from) : undefined,
        slideTime: 0.09,
    });
}

export function scheduleEvent(ctx: BaseAudioContext, dest: AudioNode, song: CompiledTrack, event: SeqEvent, time: number) {
    if (event.kind === 'drum') {
        if (song.track.drumGain > 0) {
            drum(ctx, dest, event.hit, time, song.track.drumGain);
        }
        return;
    }
    playNote(ctx, dest, song.track[event.channel], event, time, song.stepTime);
}

/** Schedules the notes of `passes` passes that begin inside [from, to). Only for offline rendering. */
export function scheduleRange(
    ctx: BaseAudioContext,
    dest: AudioNode,
    song: CompiledTrack,
    passes: number,
    from: number,
    to: number,
) {
    for (let pass = 0; pass < passes; pass++) {
        for (const event of song.events) {
            const time = pass * song.duration + event.step * song.stepTime;
            if (time >= from && time < to) {
                scheduleEvent(ctx, dest, song, event, time);
            }
        }
    }
}

const TICK_MS = 25;
const LOOKAHEAD = 0.2;
/** Browsers slow timers in hidden tabs to about one a second, so look further ahead there */
const HIDDEN_LOOKAHEAD = 1.6;

/** Plays one track live, handing notes to the audio clock a little ahead of time */
export class MusicPlayer {
    readonly out: GainNode;
    private readonly ctx: BaseAudioContext;
    private readonly song: CompiledTrack;
    private timer: ReturnType<typeof setInterval> | null = null;
    private passStart = 0;
    private index = 0;
    finished = false;

    constructor(ctx: BaseAudioContext, dest: AudioNode, song: CompiledTrack) {
        this.ctx = ctx;
        this.song = song;
        this.out = ctx.createGain();
        this.out.connect(dest);
    }

    start(fadeIn: number, delay = 0.06) {
        const now = this.ctx.currentTime;
        this.passStart = now + delay;
        this.index = 0;
        this.out.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, now);
        if (fadeIn > 0) {
            this.out.gain.linearRampToValueAtTime(1, now + delay + fadeIn);
        }
        this.timer = setInterval(() => this.tick(), TICK_MS);
        this.tick();
    }

    stop(fadeOut: number) {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        const now = this.ctx.currentTime;
        const gain = this.out.gain;
        gain.cancelScheduledValues(now);
        gain.setTargetAtTime(0, now, Math.max(0.005, fadeOut / 4));
        // Notes already handed to the clock keep sounding under the fade; cut the cord afterwards
        setTimeout(() => this.out.disconnect(), (fadeOut + LOOKAHEAD + 0.5) * 1000);
    }

    private tick() {
        const { song, ctx } = this;
        const hidden = typeof document !== 'undefined' && document.hidden;
        const horizon = ctx.currentTime + (hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
        // Bounded, so a clock that jumped far ahead cannot spin here
        for (let guard = 0; guard < 4000; guard++) {
            if (this.index >= song.events.length) {
                if (!song.track.loop) {
                    this.finished = true;
                    if (this.timer !== null) {
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                    return;
                }
                this.passStart += song.duration;
                this.index = 0;
                // After a long stall, rejoin on the beat instead of replaying the missed passes
                if (this.passStart + song.duration < ctx.currentTime) {
                    const missed = Math.floor((ctx.currentTime - this.passStart) / song.duration);
                    this.passStart += missed * song.duration;
                }
            }
            const event = song.events[this.index];
            const time = this.passStart + event.step * song.stepTime;
            if (time > horizon) {
                return;
            }
            // Late notes are dropped: a burst of catch-up notes sounds worse than a gap
            if (time >= ctx.currentTime - 0.02) {
                scheduleEvent(ctx, this.out, song, event, time);
            }
            this.index++;
        }
    }
}
