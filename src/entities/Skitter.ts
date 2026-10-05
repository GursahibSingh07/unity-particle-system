import Phaser from 'phaser';
import { SKITTER } from '../config/monsters';
import { Events } from '../events';
import type { MonsterDef, RayId } from '../types';
import { closingRing, puff } from './effects';
import { Monster, type MonsterWorld } from './Monster';

type SkitterState = 'hunt' | 'windup' | 'lunge' | 'recover' | 'flee';

const FLEE_TURN = Phaser.Math.DegToRad(SKITTER.fleeTurn);

/**
 * Quick on its feet: runs in, crouches, bites. Hurt, it bolts somewhere else before coming
 * back, so the player has to find it again; then for a moment it cannot bolt at all.
 */
export class Skitter extends Monster {
    private mode: SkitterState = 'hunt';
    private modeUntil = 0;
    private dirX = 0;
    private dirY = 0;
    private nextFleeAt = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        // A moment before its first bite, so one that appears close by is not a free hit
        this.mode = 'recover';
        this.modeUntil = scene.time.now + SKITTER.recover;
    }

    get hurtsOnTouch() {
        // Running away through the player is not an attack
        return this.mode !== 'flee' && super.hurtsOnTouch;
    }

    /** True while a hit would not make it bolt */
    get isWinded() {
        return this.mode !== 'flee' && this.scene.time.now < this.nextFleeAt;
    }

    protected behave(now: number, delta: number) {
        switch (this.mode) {
            case 'hunt':
                if (this.distanceToPlayer() <= SKITTER.biteRange && this.seesPlayer()) {
                    this.startWindup(now);
                } else {
                    this.chase(now, delta, this.def.speed);
                }
                break;
            case 'windup':
                this.body.setVelocity(0, 0);
                if (now >= this.modeUntil) {
                    this.mode = 'lunge';
                    this.modeUntil = now + SKITTER.lungeTime;
                    this.playMove();
                }
                break;
            case 'lunge':
                this.body.setVelocity(this.dirX * SKITTER.lungeSpeed, this.dirY * SKITTER.lungeSpeed);
                if (now >= this.modeUntil || !this.body.blocked.none) {
                    this.settle(now);
                }
                break;
            case 'flee':
                this.body.setVelocity(this.dirX * SKITTER.fleeSpeed, this.dirY * SKITTER.fleeSpeed);
                if (now >= this.modeUntil) {
                    this.mode = 'hunt';
                }
                break;
            case 'recover':
                this.steer(0, 0, delta);
                if (now >= this.modeUntil) {
                    this.mode = 'hunt';
                }
                break;
        }
    }

    stun(duration: number) {
        super.stun(duration);
        if (this.mode === 'windup' || this.mode === 'lunge') {
            this.settle(this.scene.time.now);
        }
    }

    onTouchedPlayer() {
        super.onTouchedPlayer();
        this.settle(this.scene.time.now);
    }

    protected onHurt(_type: RayId, now: number) {
        if (now < this.nextFleeAt || this.isStunned) {
            return;
        }
        this.nextFleeAt = now + SKITTER.fleeTime + SKITTER.fleeCooldown;
        this.pickEscape();
        this.mode = 'flee';
        this.modeUntil = now + SKITTER.fleeTime;
        this.playMove();
        puff(this.scene, this.x, this.y, this.def.color, 4, 7);
    }

    private startWindup(now: number) {
        const angle = this.angleToPlayer();
        // The direction is fixed now, so stepping aside during the crouch dodges the bite
        this.dirX = Math.cos(angle);
        this.dirY = Math.sin(angle);
        this.mode = 'windup';
        this.modeUntil = now + SKITTER.windup;
        this.anims.pause();
        closingRing(this.scene, this.x, this.y, this.def.radius + 4, 0xffffff, SKITTER.windup);
        this.scene.game.events.emit(Events.MONSTER_WINDUP, this.def.id, this.x, this.y);
    }

    private settle(now: number) {
        this.mode = 'recover';
        this.modeUntil = now + SKITTER.recover;
        this.playMove();
    }

    /** Away from the player and off to one side, whichever side has the room to run */
    private pickEscape() {
        const { nav } = this.world;
        const away = this.angleToPlayer() + Math.PI;
        const reach = (SKITTER.fleeSpeed * SKITTER.fleeTime) / 1000;
        const side = Math.random() < 0.5 ? 1 : -1;
        const turn = FLEE_TURN * Phaser.Math.FloatBetween(0.5, 1);
        let angle = away;
        // Tried in order: one side, the other, straight back, then sideways along whatever is behind it
        for (let attempt = 0; attempt < 5; attempt++) {
            const offset = attempt === 2 ? 0 : attempt < 2 ? turn : Math.PI / 2;
            angle = away + offset * (attempt % 2 === 0 ? side : -side);
            const x = this.x + Math.cos(angle) * reach;
            const y = this.y + Math.sin(angle) * reach;
            if (nav.canWalk(this.x, this.y, x, y, this.def.radius)) {
                break;
            }
        }
        this.dirX = Math.cos(angle);
        this.dirY = Math.sin(angle);
    }
}
