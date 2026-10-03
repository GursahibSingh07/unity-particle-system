import Phaser from 'phaser';
import { SHADE } from '../config/monsters';
import { ULTRAVIOLET } from '../config/radiation';
import { Events } from '../events';
import type { MonsterDef, RadiationId } from '../types';
import { Monster, type MonsterWorld } from './Monster';

type ShadeState = 'stalk' | 'windup' | 'dash' | 'recover';

/** Nearly invisible and untouchable until Ultraviolet reveals it. Creeps close, then dashes. */
export class Shade extends Monster {
    private mode: ShadeState = 'stalk';
    private modeUntil = 0;
    private revealedUntil = 0;
    private dashAngle = 0;
    private shimmerOffset = Math.random() * SHADE.shimmerPeriod;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.setAlpha(SHADE.hiddenAlpha);
        // Give the player a moment before the first dash
        this.modeUntil = scene.time.now + SHADE.recover;
        this.mode = 'recover';
    }

    get revealed() {
        return this.scene.time.now < this.revealedUntil;
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

    takeDamage(type: RadiationId, amount: number): boolean {
        if (type === 'ultraviolet') {
            this.reveal();
        }
        return super.takeDamage(type, amount);
    }

    protected multiplierFor(type: RadiationId): number {
        return this.revealed ? super.multiplierFor(type) : 0;
    }

    protected behave(now: number, delta: number) {
        switch (this.mode) {
            case 'stalk':
                if (!this.revealed && this.distanceToPlayer() <= SHADE.dashRange && this.seesPlayer()) {
                    this.startWindup(now);
                } else {
                    this.chase(now, delta, this.def.speed);
                }
                break;
            case 'windup':
                this.body.setVelocity(0, 0);
                if (now >= this.modeUntil) {
                    this.mode = 'dash';
                    this.modeUntil = now + SHADE.dashDuration;
                    this.body.setVelocity(
                        Math.cos(this.dashAngle) * SHADE.dashSpeed,
                        Math.sin(this.dashAngle) * SHADE.dashSpeed,
                    );
                }
                break;
            case 'dash':
                // Stops early if a wall has killed its speed
                if (now >= this.modeUntil || this.body.velocity.lengthSq() < 100) {
                    this.rest(now);
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

    onTouchedPlayer() {
        this.body.setVelocity(0, 0);
        this.rest(this.scene.time.now);
    }

    private startWindup(now: number) {
        this.mode = 'windup';
        this.modeUntil = now + SHADE.windup;
        // The direction is fixed now, so stepping aside during the wind-up dodges it
        this.dashAngle = this.angleToPlayer();
        this.scene.game.events.emit(Events.MONSTER_WINDUP, this.def.id, this.x, this.y);
    }

    private rest(now: number) {
        this.mode = 'recover';
        this.modeUntil = now + SHADE.recover;
    }

    private reveal() {
        const now = this.scene.time.now;
        this.mode = 'recover';
        this.modeUntil = now + ULTRAVIOLET.stunDuration;
        this.revealedUntil = now + ULTRAVIOLET.stunDuration + SHADE.revealLinger;
        this.stun(ULTRAVIOLET.stunDuration);
    }

    private updateAlpha(now: number) {
        if (this.revealed) {
            // Flicker just before it fades away again
            const left = this.revealedUntil - now;
            this.setAlpha(left < 500 && Math.floor(now / 70) % 2 === 0 ? 0.5 : 1);
        } else if (this.mode === 'windup') {
            this.setAlpha(Math.floor(now / 60) % 2 === 0 ? SHADE.windupAlpha : SHADE.windupAlpha * 0.5);
        } else if (this.mode === 'dash') {
            this.setAlpha(SHADE.windupAlpha);
        } else {
            const wave = Math.sin(((now + this.shimmerOffset) / SHADE.shimmerPeriod) * Math.PI * 2);
            // Mostly at the hidden alpha, with a brief glint once per period
            const glint = Math.max(0, wave - 0.7) / 0.3;
            this.setAlpha(Phaser.Math.Linear(SHADE.hiddenAlpha, SHADE.shimmerAlpha, glint));
        }
    }
}
