import { getCompiled, MusicPlayer } from './sequencer';
import { LOOPS, SFX, type LoopHandle } from './sfx';
import { createMixer, type Mixer } from './synth';
import type { LoopId, MusicId, SfxId } from './types';

export type { LoopId, MusicId, SfxId } from './types';

export const DEFAULT_MUSIC_VOLUME = 0.7;
export const DEFAULT_SFX_VOLUME = 0.9;

const FADE_OUT = 0.6;
const FADE_IN = 0.25;
/** Repeats of one effect inside this many seconds are dropped, so a beam hitting every frame does not turn to mush */
const DEFAULT_GAP = 0.06;

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

type ContextCtor = new (options?: AudioContextOptions) => AudioContext;

function contextCtor(): ContextCtor | undefined {
    const scope = globalThis as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
    return scope.AudioContext ?? scope.webkitAudioContext;
}

// Methods are arrow properties so they can be passed around as callbacks (`once('pointerdown', audio.unlock)`).
class AudioEngine {
    private ctx: AudioContext | null = null;
    private mixer: Mixer | null = null;
    /** What the game asked for, which may be ahead of what is sounding (before unlock) */
    private wanted: MusicId | null = null;
    private player: MusicPlayer | null = null;
    private musicVolume = DEFAULT_MUSIC_VOLUME;
    private sfxVolume = DEFAULT_SFX_VOLUME;
    private readonly lastPlayed = new Map<SfxId, number>();
    private readonly loops = new Map<LoopId, LoopHandle>();

    unlock = (): void => {
        if (!this.ctx) {
            const Ctor = contextCtor();
            if (!Ctor) {
                return;
            }
            try {
                this.ctx = new Ctor({ latencyHint: 'interactive' });
                this.mixer = createMixer(this.ctx, this.musicVolume, this.sfxVolume);
            } catch {
                this.ctx = null;
                this.mixer = null;
                return;
            }
            if (this.wanted) {
                this.startPlayer(this.wanted);
            }
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    };

    playMusic = (id: MusicId): void => {
        if (id === this.wanted) {
            return;
        }
        this.wanted = id;
        if (this.ctx) {
            this.startPlayer(id);
        }
    };

    stopMusic = (): void => {
        this.wanted = null;
        this.player?.stop(FADE_OUT);
        this.player = null;
    };

    sfx = (id: SfxId): void => {
        const def = SFX[id];
        if (!this.ctx || !this.mixer || !def) {
            return;
        }
        const now = this.ctx.currentTime;
        const last = this.lastPlayed.get(id);
        if (last !== undefined && now - last < (def.gap ?? DEFAULT_GAP)) {
            return;
        }
        this.lastPlayed.set(id, now);
        def.play(this.ctx, this.mixer.sfx, now + 0.005);
        if (def.duck) {
            this.mixer.duck(def.duck);
        }
    };

    setLoop = (id: LoopId, on: boolean): void => {
        if (!this.ctx || !this.mixer || !LOOPS[id]) {
            return;
        }
        const running = this.loops.get(id);
        if (on && !running) {
            this.loops.set(id, LOOPS[id](this.ctx, this.mixer.sfx, this.ctx.currentTime + 0.005));
        } else if (!on && running) {
            running.stop();
            this.loops.delete(id);
        }
    };

    setVolume = (music: number, sfx: number): void => {
        this.musicVolume = clamp01(music);
        this.sfxVolume = clamp01(sfx);
        if (this.ctx && this.mixer) {
            const now = this.ctx.currentTime;
            this.mixer.music.gain.setTargetAtTime(this.musicVolume, now, 0.02);
            this.mixer.sfx.gain.setTargetAtTime(this.sfxVolume, now, 0.02);
        }
    };

    private startPlayer(id: MusicId) {
        if (!this.ctx || !this.mixer) {
            return;
        }
        const previous = this.player;
        previous?.stop(FADE_OUT);
        this.player = new MusicPlayer(this.ctx, this.mixer.musicIn, getCompiled(id));
        // Let the old track get out of the way first, so two keys do not clash at full level
        this.player.start(FADE_IN, previous ? FADE_OUT * 0.5 : 0.06);
    }
}

export const audio = new AudioEngine();
