import type { Vibrato, Wave } from './synth';
import type { MusicId } from './types';

// The score. All of it is original, written for this game.
//
// A pitched line is a string of tokens: `C5:4` is C5 for 4 steps, `r:4` a rest, no length
// means 2 steps, `C4+E4+G4:8` a chord, `~D5:3` glides in from the previous note, and `|` is
// a bar line (checked by validateTracks, ignored otherwise). A drum line has one character
// per step: k kick, s snare, h hat, o open hat, c crash, anything else silent.

export interface Instrument {
    wave: Wave;
    gain: number;
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    /** Fraction of a note's length that is held; lower is more staccato */
    gate: number;
    vibrato?: Vibrato;
    /** How a chord token plays: cycled on one voice, or all notes together */
    chord?: 'arp' | 'stack';
}

export interface Section {
    bars: number;
    lead?: string;
    harmony?: string;
    bass?: string;
    drums?: string;
}

export interface Track {
    bpm: number;
    stepsPerBeat: number;
    stepsPerBar: number;
    loop: boolean;
    lead: Instrument;
    harmony: Instrument;
    bass: Instrument;
    drumGain: number;
    sections: Section[];
}

const bars = (...list: string[]) => list.join(' | ');

/** A broken chord over three notes: low, middle, high, middle */
function broken(chord: string, steps = 16, len = 2): string {
    const notes = chord.split(' ');
    const order = [0, 1, 2, 1];
    const out: string[] = [];
    for (let i = 0; i < steps / len; i++) {
        out.push(`${notes[order[i % 4]]}:${len}`);
    }
    return out.join(' ');
}

/** Moves every note in a line by whole octaves */
function shift(line: string, octaves: number): string {
    return line.replace(/([A-G][#b]?)(\d)/g, (_, name: string, octave: string) => `${name}${Number(octave) + octaves}`);
}

// ---------------------------------------------------------------------------------------
// The main theme, in C major. Golden Age plays it as a march, the title plays it gently,
// cyberpunk drops it into A minor, the ending plays it alone, and the boss bends it into
// C minor.
// ---------------------------------------------------------------------------------------

const THEME_HEAD = bars(
    'C5:3 C5:1 E5 G5 G5:4 E5 G5', // C
    'A5:3 G5:1 E5:4 C5:4 D5 E5', // C
    'F5:3 F5:1 A5 C6 C6:4 A5 F5', // F
    'G5:3 A5:1 G5 F5 D5:4 r G4', // G
    'C6:4 B5 A5 G5:4 E5:4', // Am
    'A5:4 G5 F5 E5:4 C5:4', // F
);
/** Ends on the dominant, so it wants to be answered */
const THEME_A = bars(THEME_HEAD, 'F5:4 E5 D5 A5:4 F5:4', 'G5:3 G5:1 G5 A5 B5:4 G5 r');
/** The answer: a run up to the high tonic */
const THEME_A2 = bars(THEME_HEAD, 'D5 E5 F5 A5 G5 A5 B5 D6', 'C6:8 G5 E5 C5:4');
const THEME_B = bars(
    'A5:6 C6 A5:4 F5:4', // F
    'G5:6 B5 G5:4 D5:4', // G
    'G5:4 E5 G5 B5:6 A5', // Em
    'A5:8 r E5 A5 C6', // Am
    'D6:6 C6 A5:4 F5:4', // Dm
    'B5:6 A5 G5:4 D5:4', // G
    'E5:3 E5:1 G5 C6 C6:4 G5:4', // C
    'D5 G5 B5 D6 D6:6 r', // G
);

const C = 'E4 G4 C5';
const F = 'F4 A4 C5';
const G = 'D4 G4 B4';
const AM = 'E4 A4 C5';
const DM = 'D4 F4 A4';
const EM = 'E4 G4 B4';

const THEME_HARMONY_HEAD = bars(broken(C), broken(C), broken(F), broken(G), broken(AM), broken(F));
const THEME_HARMONY_A = bars(THEME_HARMONY_HEAD, broken(DM), broken(G));
const THEME_HARMONY_A2 = bars(THEME_HARMONY_HEAD, `${broken(DM, 8)} ${broken(G, 8)}`, broken(C));
const THEME_HARMONY_B = bars(
    broken(F),
    broken(G),
    broken(EM),
    broken(AM),
    broken(DM),
    broken(G),
    broken(C),
    broken(G),
);

/** March bass: root, fifth, root, and a pick-up back to the root */
const march = (root: string, fifth: string) => `${root}:4 ${fifth}:4 ${root}:4 ${fifth} ${root}`;

const MARCH_HEAD = bars(
    march('C3', 'G2'),
    march('C3', 'G2'),
    march('F3', 'C3'),
    march('G2', 'D3'),
    march('A2', 'E3'),
    march('F3', 'C3'),
);
const MARCH_A = bars(MARCH_HEAD, march('D3', 'A2'), 'G2:4 D3:4 G2 A2 B2 G2');
const MARCH_A2 = bars(MARCH_HEAD, 'D3:4 A2:4 G2:4 B2:4', 'C3:4 G2:4 C3:4 r:4');
const MARCH_B = bars(
    march('F3', 'C3'),
    march('G2', 'D3'),
    march('E3', 'B2'),
    march('A2', 'E3'),
    march('D3', 'A2'),
    march('G2', 'D3'),
    march('C3', 'G2'),
    'G2:4 D3:4 G2 A2 B2 D3',
);

const goldenAge: Track = {
    bpm: 132,
    stepsPerBeat: 4,
    stepsPerBar: 16,
    loop: true,
    lead: {
        wave: 'pulse25',
        gain: 0.15,
        attack: 0.004,
        decay: 0.09,
        sustain: 0.75,
        release: 0.05,
        gate: 0.85,
        vibrato: { rate: 6, depth: 14, delay: 0.22 },
    },
    harmony: { wave: 'pulse12', gain: 0.055, attack: 0.003, decay: 0.08, sustain: 0.45, release: 0.04, gate: 0.7 },
    bass: { wave: 'triangle', gain: 0.3, attack: 0.004, decay: 0.12, sustain: 0.8, release: 0.04, gate: 0.7 },
    drumGain: 0.16,
    sections: [
        {
            bars: 8,
            lead: THEME_A,
            harmony: THEME_HARMONY_A,
            bass: MARCH_A,
            drums: 'c.h.s.h.k.k.s.h.' + 'k.h.s.h.k.k.s.h.'.repeat(6) + 'k.h.s.h.k.s.s.ss',
        },
        {
            bars: 8,
            lead: THEME_A2,
            harmony: THEME_HARMONY_A2,
            bass: MARCH_A2,
            drums: 'k.h.s.h.k.k.s.h.'.repeat(6) + 'k.s.k.s.k.s.ssss' + 'c.h.s.h.k.k.s...',
        },
        {
            bars: 8,
            lead: THEME_B,
            harmony: THEME_HARMONY_B,
            bass: MARCH_B,
            drums: 'c.hhs.h.k.hhs.h.' + 'k.hhs.h.k.hhs.h.'.repeat(6) + 'k.h.s.h.s.s.ssss',
        },
    ],
};

const title: Track = {
    bpm: 104,
    stepsPerBeat: 4,
    stepsPerBar: 16,
    loop: true,
    lead: {
        wave: 'pulse50',
        gain: 0.11,
        attack: 0.01,
        decay: 0.12,
        sustain: 0.7,
        release: 0.09,
        gate: 0.92,
        vibrato: { rate: 5.5, depth: 12, delay: 0.25 },
    },
    harmony: { wave: 'pulse25', gain: 0.045, attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.08, gate: 0.8 },
    bass: { wave: 'triangle', gain: 0.26, attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.1, gate: 0.9 },
    drumGain: 0.09,
    sections: [
        {
            bars: 8,
            lead: THEME_A,
            harmony: THEME_HARMONY_A,
            bass: bars('C3:8 G2:8', 'C3:8 E3:8', 'F3:8 C3:8', 'G2:8 D3:8', 'A2:8 E3:8', 'F3:8 C3:8', 'D3:8 A2:8', 'G2:8 B2:8'),
        },
        {
            bars: 8,
            lead: THEME_A2,
            harmony: THEME_HARMONY_A2,
            bass: bars('C3:8 G2:8', 'C3:8 E3:8', 'F3:8 C3:8', 'G2:8 D3:8', 'A2:8 E3:8', 'F3:8 C3:8', 'D3:8 G2:8', 'C3:12 r:4'),
            drums: 'h...h...h...h.h.'.repeat(7) + 'h...h...h.......',
        },
    ],
};

// One voice, an octave down, with room to breathe. It does not loop: the last note is
// held and then there is nothing.
const ending: Track = {
    bpm: 80,
    stepsPerBeat: 4,
    stepsPerBar: 16,
    loop: false,
    lead: {
        wave: 'triangle',
        gain: 0.34,
        attack: 0.02,
        decay: 0.3,
        sustain: 0.8,
        release: 0.25,
        gate: 0.95,
        vibrato: { rate: 4.5, depth: 9, delay: 0.5 },
    },
    harmony: { wave: 'triangle', gain: 0, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1, gate: 0.8 },
    bass: { wave: 'triangle', gain: 0, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1, gate: 0.8 },
    drumGain: 0,
    sections: [
        {
            bars: 8,
            lead: shift(bars(THEME_HEAD, 'F5:4 E5 D5 A5:4 F5:4', 'G5:12 r:4'), -1),
        },
        {
            bars: 10,
            lead: shift(bars(THEME_HEAD, 'D5:4 F5:4 G5:4 B5:4', 'C6:16', 'r:8 G5:4 E5:4', 'C5:16'), -1),
        },
    ],
};

// ---------------------------------------------------------------------------------------
// Cyberpunk: the main theme moved down a third into A minor, its relative, so the tune is
// recognisably the same one with the sun gone out of it. A square-wave bass runs sixteenths
// underneath and the chords are only blips on the off-beats.
// ---------------------------------------------------------------------------------------

/** Sixteenths on a synth bass: root, fifth and octave, never resting */
const pump = (root: string, fifth: string, octave: string) => {
    const half = [root, root, octave, root, fifth, root, octave, fifth].map((note) => `${note}:1`).join(' ');
    return `${half} ${half}`;
};
/** Four off-beat blips to the bar */
const blips = (chord: string) => `r:2 ${chord}:1 r:3 ${chord}:1 r:3 ${chord}:1 r:3 ${chord}:1 r:1`;

const CY_AM = 'A4+C5+E5';
const CY_F = 'A4+C5+F5';
const CY_G = 'G4+B4+D5';
const CY_E = 'G#4+B4+E5';
const CY_DM = 'A4+D5+F5';

const CY_THEME_HEAD = bars(
    'A4:3 A4:1 C5 E5 E5:4 C5 E5', // Am: the theme's first bar, a third lower
    'F5:3 E5:1 C5:4 A4:4 B4 C5', // Am
    'F5:3 F5:1 A5 C6 C6:4 A5 F5', // F: quoted note for note
    'G5:3 A5:1 G5 E5 D5:4 r:4', // G
    'C6:4 B5 A5 E5:4 C5:4', // Am
    'A5:4 G5 E5 D5:4 C5:4', // Am
);
const CY_BASS_HEAD = bars(
    pump('A2', 'E3', 'A3'),
    pump('A2', 'E3', 'A3'),
    pump('F2', 'C3', 'F3'),
    pump('G2', 'D3', 'G3'),
    pump('A2', 'E3', 'A3'),
    pump('A2', 'E3', 'A3'),
);
const CY_BLIPS_HEAD = bars(blips(CY_AM), blips(CY_AM), blips(CY_F), blips(CY_G), blips(CY_AM), blips(CY_AM));
const CY_BEAT = 'k.h.s.hhk.k.s.h.';

const cyberpunk: Track = {
    bpm: 126,
    stepsPerBeat: 4,
    stepsPerBar: 16,
    loop: true,
    lead: {
        wave: 'pulse12',
        gain: 0.16,
        attack: 0.006,
        decay: 0.12,
        sustain: 0.65,
        release: 0.07,
        gate: 0.88,
        vibrato: { rate: 5.5, depth: 12, delay: 0.25 },
    },
    harmony: {
        wave: 'pulse25',
        gain: 0.1,
        attack: 0.002,
        decay: 0.05,
        sustain: 0.3,
        release: 0.05,
        gate: 0.9,
        chord: 'stack',
    },
    bass: { wave: 'pulse50', gain: 0.2, attack: 0.002, decay: 0.05, sustain: 0.7, release: 0.02, gate: 0.6 },
    drumGain: 0.15,
    sections: [
        {
            // The machine starting up: bass and drums alone
            bars: 4,
            harmony: bars('r:16', 'r:16', blips(CY_F), blips(CY_E)),
            bass: bars(pump('A2', 'E3', 'A3'), pump('A2', 'E3', 'A3'), pump('F2', 'C3', 'F3'), pump('E2', 'B2', 'E3')),
            drums: 'c...k...k...k...' + 'k...k...k...k.h.' + 'k.h.k.h.k.h.k.h.' + 'k.h.k.h.k.s.ssss',
        },
        {
            bars: 8,
            lead: bars(CY_THEME_HEAD, 'F5:4 E5 D5 C5:4 A4:4', 'B4:3 B4:1 B4 E5 G#5:4 E5 r'), // F, E
            harmony: bars(CY_BLIPS_HEAD, blips(CY_F), blips(CY_E)),
            bass: bars(CY_BASS_HEAD, pump('F2', 'C3', 'F3'), pump('E2', 'B2', 'E3')),
            drums: 'c.h.s.hhk.k.s.h.' + CY_BEAT.repeat(6) + 'k.h.s.hhk.s.s.ss',
        },
        {
            bars: 8,
            lead: bars(
                'A5:6 F5 D5:4 F5:4', // Dm
                'A5:6 G5 F5:4 D5:4', // Dm
                'E5:6 C5 A4:4 C5:4', // Am
                'E5:8 r:4 A4 C5', // Am
                'F5:6 A5 C6:4 A5:4', // F
                'C6:3 C6:1 A5 F5 A5:4 F5:4', // F
                'E5:6 G#5 B5:4 G#5:4', // E
                'E6:8 D6 B5 G#5 E5', // E
            ),
            harmony: bars(
                blips(CY_DM),
                blips(CY_DM),
                blips(CY_AM),
                blips(CY_AM),
                blips(CY_F),
                blips(CY_F),
                blips(CY_E),
                blips(CY_E),
            ),
            bass: bars(
                pump('D2', 'A2', 'D3'),
                pump('D2', 'A2', 'D3'),
                pump('A2', 'E3', 'A3'),
                pump('A2', 'E3', 'A3'),
                pump('F2', 'C3', 'F3'),
                pump('F2', 'C3', 'F3'),
                pump('E2', 'B2', 'E3'),
                pump('E2', 'B2', 'E3'),
            ),
            drums: 'c.hhs.h.k.hhs.h.' + 'k.hhs.h.k.hhs.h.'.repeat(6) + 'k.s.k.s.kss.ssss',
        },
        {
            bars: 8,
            lead: bars(CY_THEME_HEAD, 'F5:4 E5 D5 C5:4 D5:4', 'E5:12 r:4'), // F, E: left hanging for the loop
            harmony: bars(CY_BLIPS_HEAD, blips(CY_F), blips(CY_E)),
            bass: bars(CY_BASS_HEAD, pump('F2', 'C3', 'F3'), 'E2:1 E2:1 E3:1 E2:1 B2:1 E2:1 E3:1 B2:1 E2 E2 G#2 B2'),
            drums: 'c.h.s.hhk.k.s.h.' + CY_BEAT.repeat(6) + 'k.h.s.h.k.k.s...',
        },
    ],
};

// ---------------------------------------------------------------------------------------
// Retro: what is left of the old noir tune. D minor, 12 steps to the bar so it still
// swings, but the walking bass has stopped walking and nags on one note, the chords are
// bare fifths, and the melody keeps losing its place.
// ---------------------------------------------------------------------------------------

/** A long-short pulse stuck on one note, with a single step out at the end of the bar */
const nag = (root: string, turn: string) =>
    `${root}:2 ${root}:1 ${root}:2 ${root}:1 ${root}:2 ${root}:1 ${root}:2 ${turn}:1`;
/** One bare fifth on the last beat */
const hollow = (fifth: string) => `r:9 ${fifth}:2 r:1`;

const R_D = 'D4+A4';
const R_G = 'G3+D4';
const R_BB = 'Bb3+F4';
const R_A = 'A3+E4';
const R_C = 'C4+G4';
const RETRO_TICK = 'k.hh.hh.hh.h';

const retro: Track = {
    bpm: 100,
    stepsPerBeat: 3,
    stepsPerBar: 12,
    loop: true,
    lead: {
        wave: 'pulse12',
        gain: 0.12,
        attack: 0.02,
        decay: 0.2,
        sustain: 0.6,
        release: 0.12,
        gate: 0.9,
        vibrato: { rate: 5, depth: 22, delay: 0.3 },
    },
    harmony: {
        wave: 'triangle',
        gain: 0.1,
        attack: 0.005,
        decay: 0.1,
        sustain: 0.4,
        release: 0.08,
        gate: 0.6,
        chord: 'stack',
    },
    bass: { wave: 'triangle', gain: 0.34, attack: 0.004, decay: 0.1, sustain: 0.6, release: 0.04, gate: 0.6 },
    drumGain: 0.08,
    sections: [
        {
            bars: 8,
            lead: bars(
                'r:3 A4:2 D5:1 F5:6', // Dm: the noir pick-up
                'E5:2 D5:1 A4:9', // Dm
                'r:12',
                'r:3 Bb4:2 D5:1 ~A4:6', // Dm: starts the answer and gives up
                'r:3 D5:2 F5:1 Bb5:3 A5:3', // Bb
                'G5:2 E5:1 C#5:9', // A
                'r:12',
                'r:6 A4:2 C#5:1 E5:3', // A
            ),
            harmony: bars(
                hollow(R_D),
                'r:12',
                hollow(R_G),
                'r:12',
                hollow(R_BB),
                hollow(R_A),
                'r:12',
                hollow(R_A),
            ),
            bass: bars(
                nag('D3', 'A2'),
                nag('D3', 'C3'),
                nag('G2', 'A2'),
                nag('D3', 'A2'),
                nag('Bb2', 'A2'),
                nag('A2', 'C#3'),
                nag('D3', 'A2'),
                nag('A2', 'C#3'),
            ),
            drums: RETRO_TICK.repeat(8),
        },
        {
            bars: 8,
            lead: bars(
                'D5:3 G5:3 Bb5:2 A5:1 G5:3', // Gm
                'E5:9 r:3', // C
                'r:12',
                'Bb5:2 A5:1 F5:6 D5:3', // Bb
                'E5:3 G5:3 Bb5:6', // Em7b5
                'A5:2 G5:1 E5:3 ~C#5:6', // A
                'D5:9 r:3', // Dm
                'r:12',
            ),
            harmony: bars('r:12', hollow(R_C), 'r:12', hollow(R_BB), 'r:12', hollow(R_A), hollow(R_D), 'r:12'),
            bass: bars(
                nag('G2', 'Bb2'),
                nag('C3', 'E3'),
                nag('F2', 'A2'),
                nag('Bb2', 'D3'),
                nag('E2', 'G2'),
                nag('A2', 'C#3'),
                nag('D3', 'A2'),
                'A2:3 G2:3 E2:3 C#3:3',
            ),
            drums: RETRO_TICK.repeat(7) + 'k.hh.hs..s.s',
        },
        {
            // Nothing but the pulse, and one fifth that does not resolve
            bars: 4,
            harmony: bars('r:12', hollow(R_D), 'r:12', hollow(R_A)),
            bass: bars(nag('D3', 'D3'), nag('D3', 'Eb3'), nag('D3', 'D3'), nag('D3', 'C#3')),
            drums: RETRO_TICK.repeat(4),
        },
    ],
};

// ---------------------------------------------------------------------------------------
// Manga: E minor, fast, with a lifted G major middle. Black and white: the tune, the bass
// and the drums, and nothing in between them.
// ---------------------------------------------------------------------------------------

/** Octave-jumping eighths */
const drive = (low: string, high: string) => `${low} ${low} ${high} ${low} ${low} ${high} ${low} ${high}`;

const MANGA_RIFF = 'E5 B5 A5 G5 F#5 G5 E5:4';
const MANGA_A_HEAD = bars(
    MANGA_RIFF, // Em
    'E5 B5 A5 G5 F#5:1 G5:1 A5 B5:4', // Em
    'C6:4 B5 G5 E5:4 G5 E5', // C
    'D5 F#5 A5 D6 C6:1 B5:1 A5 F#5:4', // D
    MANGA_RIFF, // Em
    'E5 B5 A5 G5 B5 D6 E6:4', // Em
    'E6 D6 C6 G5 C6 B5 A5 G5', // C
);
const MANGA_A_BASS = bars(
    drive('E2', 'E3'),
    drive('E2', 'E3'),
    drive('C3', 'C4'),
    drive('D3', 'D4'),
    drive('E2', 'E3'),
    drive('E2', 'E3'),
    drive('C3', 'C4'),
);
const MANGA_B_HEAD = bars(
    'B5:6 D6 B5:4 G5:4', // G
    'A5:6 D6 A5:4 F#5:4', // D
    'G5:4 F#5 G5 B5:4 E5:4', // Em
    'E5 G5 C6 E6 D6:4 C6:4', // C
    'B5:6 D6 G6:4 D6:4', // G
    'A5 D6 F#6:4 E6 D6 A5:4', // D
);
const MANGA_B_BASS = bars(
    drive('G2', 'G3'),
    drive('D3', 'D4'),
    drive('E2', 'E3'),
    drive('C3', 'C4'),
    drive('G2', 'G3'),
    drive('D3', 'D4'),
);
const MANGA_BEAT = 'k.h.s.h.k.khs.h.';

const manga: Track = {
    bpm: 168,
    stepsPerBeat: 4,
    stepsPerBar: 16,
    loop: true,
    lead: {
        wave: 'pulse25',
        gain: 0.14,
        attack: 0.003,
        decay: 0.07,
        sustain: 0.7,
        release: 0.04,
        gate: 0.8,
        vibrato: { rate: 7, depth: 16, delay: 0.18 },
    },
    // Unused: the sixteenth-note chords that filled the middle were taken out for v2
    harmony: { wave: 'pulse12', gain: 0, attack: 0.002, decay: 0.05, sustain: 0.4, release: 0.03, gate: 0.6 },
    bass: { wave: 'triangle', gain: 0.31, attack: 0.003, decay: 0.07, sustain: 0.75, release: 0.03, gate: 0.65 },
    drumGain: 0.17,
    sections: [
        {
            bars: 8,
            lead: bars(MANGA_A_HEAD, 'F#5 A5 D6:4 B5 F#5 D#5 B4'), // D, then B to turn round
            bass: bars(MANGA_A_BASS, 'D3 D3 D4 D3 B2 B2 B3 B2'),
            drums: 'c.h.s.h.k.khs.h.' + MANGA_BEAT.repeat(6) + 'k.h.s.h.k.s.ssss',
        },
        {
            bars: 8,
            lead: bars(MANGA_A_HEAD, 'D6 A5 F#5 A5 D6 F#6 D6:4'), // D, opening out to G
            bass: bars(MANGA_A_BASS, 'D3 D3 D4 D3 D3 E3 F#3 D3'),
            drums: MANGA_BEAT.repeat(7) + 'k.s.k.s.kss.ssss',
        },
        {
            bars: 8,
            lead: bars(MANGA_B_HEAD, 'G5 C6 E6 C6 G5 C6 E6 G6', 'F#6:4 D#6:4 B5 F#5 B5 D#6'), // C, B
            bass: bars(MANGA_B_BASS, drive('C3', 'C4'), drive('B2', 'B3')),
            drums: 'c.h.s.hhk.h.s.hh' + 'k.h.s.hhk.h.s.hh'.repeat(6) + 'k.h.s.h.s.s.ssss',
        },
        {
            bars: 8,
            lead: bars(MANGA_B_HEAD, 'A5 C6 E6 C6 A5 C6 E6 A6', 'B5 B5 B5 B5 D#6 D#6 F#6 F#6'), // Am, B
            bass: bars(MANGA_B_BASS, drive('A2', 'A3'), 'B2 B2 B2 B2 B2 B2 B3 B3'),
            drums: 'k.h.s.hhk.h.s.hh'.repeat(7) + 'ssssk.k.s.s.ssss',
        },
    ],
};

// ---------------------------------------------------------------------------------------
// Boss: C minor. Each eight bars quotes one level: the main theme turned minor, the retro
// pick-up and fall, then the manga riff.
// ---------------------------------------------------------------------------------------

/** A 3+3+2 pulse, which never quite sits down */
const lurch = (root: string, turn: string) => `${root}:3 ${root}:3 ${root}:2 ${root}:3 ${root}:3 ${turn}:2`;

const B_CM = 'C4 Eb4 G4';
const B_FM = 'C4 F4 Ab4';
const B_G = 'B3 D4 G4';
const B_AB = 'C4 Eb4 Ab4';
const B_BB = 'D4 F4 Bb4';
const B_DDIM = 'D4 F4 Ab4';
const BOSS_OSTINATO = 'C4:1 Eb4:1 G4:1 Ab4:1 G4:1 Eb4:1 C4:1 Eb4:1 C4:1 Eb4:1 G4:1 Ab4:1 G4:1 Eb4:1 D4:1 Eb4:1';
const BOSS_RIFF = 'C5 G5 F5 Eb5 D5 Eb5 C5:4';

const boss: Track = {
    bpm: 150,
    stepsPerBeat: 4,
    stepsPerBar: 16,
    loop: true,
    lead: {
        wave: 'pulse25',
        gain: 0.14,
        attack: 0.003,
        decay: 0.08,
        sustain: 0.7,
        release: 0.05,
        gate: 0.85,
        vibrato: { rate: 7, depth: 20, delay: 0.2 },
    },
    harmony: {
        wave: 'pulse12',
        gain: 0.048,
        attack: 0.002,
        decay: 0.06,
        sustain: 0.45,
        release: 0.03,
        gate: 0.65,
        chord: 'arp',
    },
    bass: { wave: 'triangle', gain: 0.32, attack: 0.003, decay: 0.1, sustain: 0.8, release: 0.03, gate: 0.8 },
    drumGain: 0.16,
    sections: [
        {
            bars: 4,
            harmony: bars(BOSS_OSTINATO, BOSS_OSTINATO, broken(B_AB, 16, 1), broken(B_G, 16, 1)),
            bass: bars(lurch('C3', 'Eb3'), lurch('C3', 'G2'), lurch('Ab2', 'C3'), lurch('G2', 'B2')),
            drums: 'c...k...k...k...' + 'k...k...k...k.s.' + 'k.h.k.h.k.h.k.s.' + 'k.s.k.s.ksksssss',
        },
        {
            bars: 8,
            lead: bars(
                'C5:3 C5:1 Eb5 G5 G5:4 Eb5 G5', // Cm
                'Ab5:3 G5:1 Eb5:4 C5:4 D5 Eb5', // Cm
                'F5:3 F5:1 Ab5 C6 C6:4 Ab5 F5', // Fm
                'G5:3 Ab5:1 G5 F5 D5:4 B4:4', // G
                'C6:4 Bb5 Ab5 G5:4 Eb5:4', // Ab
                'Ab5:4 G5 F5 Eb5:4 C5:4', // Fm
                'D5 Eb5 F5 Ab5 G5 Ab5 B5 D6', // Ddim, G
                'C6:8 r:8', // Cm
            ),
            harmony: bars(
                broken(B_CM, 16, 1),
                broken(B_CM, 16, 1),
                broken(B_FM, 16, 1),
                broken(B_G, 16, 1),
                broken(B_AB, 16, 1),
                broken(B_FM, 16, 1),
                `${broken(B_DDIM, 8, 1)} ${broken(B_G, 8, 1)}`,
                BOSS_OSTINATO,
            ),
            bass: bars(
                lurch('C3', 'Eb3'),
                lurch('C3', 'G2'),
                lurch('F2', 'Ab2'),
                lurch('G2', 'B2'),
                lurch('Ab2', 'C3'),
                lurch('F2', 'Ab2'),
                'D3:3 D3:3 D3:2 G2:3 G2:3 B2:2',
                lurch('C3', 'G2'),
            ),
            drums: 'c.h.s.hkk.h.s.h.' + 'k.h.s.hkk.h.s.h.'.repeat(6) + 'k.h.s.hkk.s.ssss',
        },
        {
            bars: 8,
            lead: bars(
                'r:4 C5:3 F5:1 Ab5:8', // Fm
                'G5:3 Eb5:1 ~C5:8 r:4', // Cm
                'r:4 Eb5:3 Ab5:1 C6:8', // Ab
                'B5:3 G5:1 ~D5:8 r:4', // G
                'r:4 F5:3 Ab5:1 C6:8', // Fm
                'Eb6:3 D6:1 C6:4 G5:8', // Cm
                'Ab5:4 G5:4 F5:4 Eb5:4', // Ab
                'D5:4 G5:4 B5:4 D6:4', // G
            ),
            harmony: bars(
                'C4+F4+Ab4:16',
                'C4+Eb4+G4:16',
                'C4+Eb4+Ab4:16',
                'B3+D4+G4:16',
                'C4+F4+Ab4:16',
                'C4+Eb4+G4:16',
                'C4+Eb4+Ab4:16',
                'B3+D4+G4:8 D4+G4+B4:8',
            ),
            bass: bars(
                'F2:8 F2:4 C3:4',
                'C3:8 C3:4 G2:4',
                'Ab2:8 Ab2:4 Eb3:4',
                'G2:8 G2:4 D3:4',
                'F2:8 F2:4 C3:4',
                'C3:8 C3:4 Eb3:4',
                'Ab2:4 Ab2:4 Ab2:4 Ab2:4',
                'G2 G2 G2 G2 G2 A2 B2 D3',
            ),
            drums: 'c..h..h.s..h..h.' + 'k..h..h.s..h..h.'.repeat(6) + 'k.k.s.k.ksksssss',
        },
        {
            bars: 8,
            lead: bars(
                BOSS_RIFF, // Cm
                'C5 G5 F5 Eb5 D5:1 Eb5:1 F5 G5:4', // Cm
                'Ab5:4 G5 Eb5 C5:4 Eb5 C5', // Ab
                'Bb4 D5 F5 Bb5 Ab5:1 G5:1 F5 D5:4', // Bb
                BOSS_RIFF, // Cm
                'C5 G5 F5 Eb5 G5 Bb5 C6:4', // Cm
                'C6 Bb5 Ab5 Eb5 Ab5 G5 F5 Eb5', // Ab
                'D5 G5 B5 G5 D6:4 B5 G5', // G
            ),
            harmony: bars(
                broken(B_CM, 16, 1),
                broken(B_CM, 16, 1),
                broken(B_AB, 16, 1),
                broken(B_BB, 16, 1),
                broken(B_CM, 16, 1),
                broken(B_CM, 16, 1),
                broken(B_AB, 16, 1),
                broken(B_G, 16, 1),
            ),
            bass: bars(
                drive('C3', 'C4'),
                drive('C3', 'C4'),
                drive('Ab2', 'Ab3'),
                drive('Bb2', 'Bb3'),
                drive('C3', 'C4'),
                drive('C3', 'C4'),
                drive('Ab2', 'Ab3'),
                'G2 G2 G3 G2 G2 A2 B2 D3',
            ),
            drums: 'c.hks.h.k.hks.hs' + 'k.hks.h.k.hks.hs'.repeat(6) + 'k.s.k.s.ssssssss',
        },
    ],
};

export const TRACKS: Record<MusicId, Track> = {
    title,
    goldenAge,
    cyberpunk,
    retro,
    // The old id for the Retro era
    noir: retro,
    manga,
    boss,
    ending,
};
