import Phaser from 'phaser';
import { EXPOSURE, STEALTH, type StealthTuning } from '../config/monsters';
import { Events } from '../events';
import type { MonsterDef, RayId } from '../types';
import type { MonsterWorld } from './Monster';
import { StandInMonster } from './StandIn';

type GhostMode = 'stalk' | 'windup' | 'dash' | 'recover';

const WINDUP_FRAME = 2;
/** An exposure is shown as a strong hit: the biggest word the hit words have */
const EXPOSE_MULTIPLIER = 2;

/**
 * The stealth class. Nearly invisible and untouchable by every ray until Ultraviolet exposes it;
 * it creeps close, then dashes after a wind-up. The ghost and the wraith are the same creature
 * with different numbers (STEALTH in config/monsters.ts).
 */
export class Ghost extends StandInMonster {
    mode: GhostMode = 'recover';

    protected tuning: StealthTuning;
    private modeUntil: number;
    private revealedUntil = 0;
    private nextExposeAt = 0;
    private exposing = false;
    private dashAngle = 0;
    private dashesLeft = 0;
    private shimmerOffset: number;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.tuning = STEALTH[def.id === 'wraith' ? 'wraith' : 'ghost'];
        this.shimmerOffset = Math.random() * this.tuning.shimmerPeriod;
        this.setAlpha(this.tuning.hiddenAlpha);
        // Give the player a moment before the first dash
        this.modeUntil = scene.time.now + this.tuning.recover;
    }

    /** True while Ultraviolet has it showing: only then can a ray hurt it */
    get revealed() {
        // Asked of a ghost that has just been removed, the answer is simply no
        return this.active && this.scene.time.now < this.revealedUntil;
    }

    get hurtsOnTouch() {
        return this.mode === 'dash';
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.active) {
            this.updateAlpha(this.scene.time.now);
        }
    }

    takeDamage(type: RayId, amount: number): boolean {
        if (!this.active) {
            return false;
        }
        if (this.exposing) {
            return super.takeDamage(type, amount);
        }
        if (type === 'uv') {
            // Ultraviolet never wounds it like the other rays: it exposes it
            return this.exposeToUv();
        }
        return this.revealed ? super.takeDamage(type, amount) : false;
    }

    /** Ultraviolet: show it, freeze it for a moment and take half of what health it has left */
    exposeToUv(): boolean {
        if (!this.active) {
            return false;
        }
        const now = this.scene.time.now;
        const { tuning } = this;
        // Held in the light it stays in view, but the halving has its own clock
        this.revealedUntil = Math.max(this.revealedUntil, now + tuning.revealFor);
        if (now < this.nextExposeAt) {
            return true;
        }
        this.nextExposeAt = now + EXPOSURE.every;
        this.revealedUntil = now + tuning.exposeStun + tuning.revealFor;

        this.mode = 'recover';
        this.modeUntil = now + tuning.exposeStun;
        this.dashesLeft = 0;
        this.playMove();
        this.stun(tuning.exposeStun);

        const half = this.health / 2;
        if (half < EXPOSURE.finishBelow) {
            this.kill();
            return true;
        }
        this.exposing = true;
        super.takeDamage('uv', half / EXPOSE_MULTIPLIER);
        this.exposing = false;
        return true;
    }

    // While it cannot be seen there is nothing there to push or to slow
    knockback(fromX: number, fromY: number, speed: number, duration: number) {
        if (this.revealed) {
            super.knockback(fromX, fromY, speed, duration);
        }
    }

    slow(factor: number, duration: number) {
        if (this.revealed) {
            super.slow(factor, duration);
        }
    }

    onTouchedPlayer() {
        this.body.setVelocity(0, 0);
        this.dashesLeft = 0;
        this.rest(this.scene.time.now);
    }

    protected multiplierFor(type: RayId): number {
        return this.exposing ? EXPOSE_MULTIPLIER : super.multiplierFor(type);
    }

    protected behave(now: number, delta: number) {
        const { tuning } = this;
        switch (this.mode) {
            case 'stalk': {
                const ready = tuning.attacksRevealed || !this.revealed;
                if (ready && this.distanceToPlayer() <= tuning.dashRange && this.seesPlayer()) {
                    this.dashesLeft = tuning.dashes;
                    this.startWindup(now, tuning.windup);
                } else {
                    this.chase(now, delta, this.def.speed);
                }
                break;
            }
            case 'windup':
                this.body.setVelocity(0, 0);
                if (now >= this.modeUntil) {
                    this.mode = 'dash';
                    this.modeUntil = now + tuning.dashDuration;
                    this.dashesLeft--;
                    this.playMove();
                    this.body.setVelocity(
                        Math.cos(this.dashAngle) * tuning.dashSpeed,
                        Math.sin(this.dashAngle) * tuning.dashSpeed,
                    );
                }
                break;
            case 'dash':
                // Stops early if a wall has killed its speed
                if (now >= this.modeUntil || this.body.velocity.lengthSq() < 100) {
                    if (this.dashesLeft > 0) {
                        // The wraith turns on the spot and comes straight back
                        this.startWindup(now, tuning.chainWindup);
                    } else {
                        this.rest(now);
                    }
                }
                break;
            case 'recover':
                this.steer(0, 0, delta);
                if (now >= this.modeUntil) {
                    this.mode = 'stalk';
                }
                break;
        }
    }

    private startWindup(now: number, duration: number) {
        this.mode = 'windup';
        this.modeUntil = now + duration;
        // The direction is fixed now, so stepping aside during the wind-up dodges it
        this.dashAngle = this.angleToPlayer();
        this.body.setVelocity(0, 0);
        this.showFrame(WINDUP_FRAME);
        this.scene.game.events.emit(Events.MONSTER_WINDUP, this.def.id, this.x, this.y);
    }

    private rest(now: number) {
        this.mode = 'recover';
        this.modeUntil = now + this.tuning.recover;
    }

    private updateAlpha(now: number) {
        const { tuning } = this;
        if (this.revealed) {
            // Flicker just before it fades away again
            const left = this.revealedUntil - now;
            this.setAlpha(left < 500 && Math.floor(now / 70) % 2 === 0 ? 0.5 : 1);
        } else if (this.mode === 'windup') {
            this.setAlpha(Math.floor(now / 60) % 2 === 0 ? tuning.windupAlpha : tuning.windupAlpha * 0.5);
        } else if (this.mode === 'dash') {
            this.setAlpha(tuning.windupAlpha);
        } else {
            const wave = Math.sin(((now + this.shimmerOffset) / tuning.shimmerPeriod) * Math.PI * 2);
            // Mostly at the hidden alpha, with a brief glint once per period
            const glint = Math.max(0, wave - 0.7) / 0.3;
            this.setAlpha(Phaser.Math.Linear(tuning.hiddenAlpha, tuning.shimmerAlpha, glint));
        }
    }
}

/** The aggressive one: faster, hidden again sooner, and it dashes twice in a row */
export class Wraith extends Ghost {}
