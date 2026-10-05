import type Phaser from 'phaser';
import { ERA } from '../config/flow';
import { Events } from '../events';
import type { ContinuousDef } from '../types';
import { checkpointBefore, inSurge, pickEntry, spawnInterval } from './eraClock';
import type { WaveDirector } from './WaveDirector';

export interface EraHooks {
    /** A checkpoint was passed, `seconds` into the era */
    onCheckpoint(seconds: number): void;
    /** The clock ran out */
    onTimeUp(): void;
}

/**
 * A timed era: the clock, and the enemies that keep coming up the streets until it runs out.
 * The clock only moves when update() is called, so it stands still under captions, cards and
 * the pause screen. It emits ERA_TIMER every second, CHECKPOINT and SURGE.
 */
export class EraSpawner {
    private elapsedMs: number;
    private nextSpawnIn = ERA.firstSpawn;
    private running = false;
    private finished = false;
    private surging = false;
    private shownSeconds = -1;

    /** @param startAt Seconds already on the clock: the checkpoint a retry starts from */
    constructor(
        private scene: Phaser.Scene,
        private def: ContinuousDef,
        private waves: WaveDirector,
        private monsters: Phaser.Physics.Arcade.Group,
        startAt: number,
        private hooks: EraHooks,
    ) {
        this.elapsedMs = Math.max(0, Math.min(startAt, def.duration)) * 1000;
    }

    /** Seconds since the era's clock started */
    get elapsed() {
        return this.elapsedMs / 1000;
    }

    get secondsLeft() {
        return Math.max(0, Math.ceil(this.def.duration - this.elapsed - 1e-6));
    }

    /** The time a death right now would go back to */
    get checkpoint() {
        return checkpointBefore(this.def, this.elapsed);
    }

    get isRunning() {
        return this.running;
    }

    get isSurging() {
        return this.surging;
    }

    /** True once the clock has run out */
    get isOver() {
        return this.finished;
    }

    /** Tell the HUD what is on the clock without starting it */
    announce() {
        this.shownSeconds = this.secondsLeft;
        this.scene.game.events.emit(Events.ERA_TIMER, this.secondsLeft, this.def.duration);
    }

    start() {
        if (this.finished) {
            return;
        }
        this.running = true;
        this.announce();
        this.checkSurge();
    }

    stop() {
        this.running = false;
    }

    update(delta: number) {
        if (!this.running) {
            return;
        }
        this.advance(delta);
        if (this.running) {
            this.spawn(delta);
        }
    }

    /** Dev only: wind the clock on, passing every checkpoint and the surge on the way */
    skip(seconds: number) {
        if (this.running) {
            this.advance(seconds * 1000);
        }
    }

    private advance(delta: number) {
        const { def } = this;
        const before = this.checkpoint;
        this.elapsedMs = Math.min(def.duration * 1000, this.elapsedMs + delta);

        const reached = this.checkpoint;
        if (reached > before) {
            this.hooks.onCheckpoint(reached);
            this.scene.game.events.emit(Events.CHECKPOINT);
        }
        this.checkSurge();
        if (this.secondsLeft !== this.shownSeconds) {
            this.announce();
        }

        if (this.elapsedMs >= def.duration * 1000) {
            this.running = false;
            this.finished = true;
            this.hooks.onTimeUp();
        }
    }

    private checkSurge() {
        if (this.surging || !inSurge(this.def, this.elapsed)) {
            return;
        }
        this.surging = true;
        // Whatever was being waited for now comes at the surge's pace
        this.nextSpawnIn = Math.min(this.nextSpawnIn, spawnInterval(this.def, this.elapsed));
        this.scene.game.events.emit(Events.SURGE);
    }

    private spawn(delta: number) {
        this.nextSpawnIn -= delta;
        if (this.nextSpawnIn > 0) {
            return;
        }
        const { def } = this;
        // Those announced but not yet through the street mouth count too
        const room = def.maxAlive - this.monsters.countActive(true) - this.waves.incoming;
        const entry = room > 0 ? pickEntry(def.table, this.elapsed, Math.random()) : null;
        if (!entry) {
            this.nextSpawnIn = ERA.fullRetry;
            return;
        }
        this.waves.spawnFromEntry(entry.monster, Math.min(entry.group ?? 1, room));
        this.nextSpawnIn = spawnInterval(def, this.elapsed);
    }
}
