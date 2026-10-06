import Phaser from 'phaser';
import { GOLEM } from '../config/monsters';
import { Events } from '../events';
import type { MonsterDef } from '../types';
import { closingRing } from './effects';
import { Monster, type MonsterWorld } from './Monster';

type GolemState = 'rest' | 'windup' | 'roll';

/** Degrees it rocks either way while winding up */
const ROCK = 9;
const STALL_CHECK = 260;
const GIVE_UP = Math.cos(Phaser.Math.DegToRad(GOLEM.giveUpAngle));

/**
 * A boulder that rays stop at. It rocks, then rolls in a straight line it cannot change, runs
 * on past where the player was, and has to stop and turn: step off its line, and use the turn.
 */
export class Golem extends Monster {
    private mode: GolemState = 'rest';
    private modeUntil: number;
    private rollStart = 0;
    private dirX = 1;
    private dirY = 0;
    /** How far this roll is meant to go, and where it began */
    private rollLength = 0;
    private fromX = 0;
    private fromY = 0;
    /** For noticing that it has stopped getting anywhere */
    private progress = 0;
    private progressAt = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.modeUntil = scene.time.now + GOLEM.rest;
        this.anims.pause();
    }

    get blocksRays() {
        return true;
    }

    protected get planRadius() {
        // Resting against a wall it is closer to it than its own radius allows a straight line
        // from; planning a little narrow lets it see its way out along the wall
        return GOLEM.planRadius;
    }

    get isRolling() {
        return this.mode === 'roll';
    }

    protected behave(now: number, delta: number) {
        switch (this.mode) {
            case 'rest':
                this.steer(0, 0, delta);
                if (now >= this.modeUntil) {
                    this.startWindup(now);
                }
                break;
            case 'windup':
                this.body.setVelocity(0, 0);
                this.setAngle(Math.sin((this.modeUntil - now) / 55) * ROCK);
                if (now >= this.modeUntil) {
                    this.setAngle(0);
                    this.mode = 'roll';
                    this.rollStart = now;
                    this.fromX = this.x;
                    this.fromY = this.y;
                    this.progress = 0;
                    this.progressAt = now;
                    this.anims.resume();
                }
                break;
            case 'roll':
                this.roll(now);
                break;
        }
    }

    stun(duration: number) {
        if (!this.active) {
            return;
        }
        super.stun(duration);
        this.rest(this.scene.time.now, GOLEM.rest);
    }

    knockback(fromX: number, fromY: number, speed: number, duration: number) {
        if (!this.active) {
            return;
        }
        // Far too heavy to throw: a push only checks it
        super.knockback(fromX, fromY, speed * GOLEM.knockback, duration);
    }

    onTouchedPlayer() {
        // It does not bounce; it stops dead, and gives the player a moment to get out from under it
        this.body.setVelocity(0, 0);
        this.rest(this.scene.time.now, GOLEM.touchRest);
    }

    private startWindup(now: number) {
        const target = this.routeToPlayer(now);
        const distance = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        // The line is fixed now: where it points is where it goes
        this.dirX = (target.x - this.x) / distance;
        this.dirY = (target.y - this.y) / distance;
        // Round a corner it only rolls as far as the corner
        this.rollLength = target.direct ? distance + GOLEM.overshoot : Math.max(distance, GOLEM.minRoll);
        this.mode = 'windup';
        this.modeUntil = now + GOLEM.windup;
        closingRing(this.scene, this.x, this.y, this.def.radius + 6, 0xffffff, GOLEM.windup);
        this.scene.game.events.emit(Events.MONSTER_WINDUP, this.def.id, this.x, this.y);
    }

    private roll(now: number) {
        const elapsed = now - this.rollStart;
        const speed = this.def.speed * Math.min(1, 0.25 + (0.75 * elapsed) / GOLEM.spinUp);
        const travelled = (this.x - this.fromX) * this.dirX + (this.y - this.fromY) * this.dirY;

        const { player } = this.world;
        const toX = player.x - this.x;
        const toY = player.y - this.y;
        const range = Math.hypot(toX, toY) || 1;
        // The player has got well off its line and it has had a fair run at them
        const lost = travelled > GOLEM.overshoot && (toX * this.dirX + toY * this.dirY) / range < GIVE_UP;

        // Something solid is in the way: it is being stopped, or it is no longer getting anywhere
        // (grazing along a wall does not count: only a wall it is rolling into)
        const { blocked } = this.body;
        let stuck =
            elapsed > 120 &&
            ((this.dirX > 0.3 && blocked.right) ||
                (this.dirX < -0.3 && blocked.left) ||
                (this.dirY > 0.3 && blocked.down) ||
                (this.dirY < -0.3 && blocked.up));
        if (now - this.progressAt >= STALL_CHECK) {
            stuck ||= travelled - this.progress < 1;
            this.progress = travelled;
            this.progressAt = now;
        }

        if (travelled >= this.rollLength || elapsed >= GOLEM.maxRoll || lost || stuck) {
            this.body.setVelocity(0, 0);
            this.rest(now, GOLEM.rest);
            return;
        }
        this.body.setVelocity(this.dirX * speed, this.dirY * speed);
    }

    private rest(now: number, duration: number) {
        this.mode = 'rest';
        this.modeUntil = now + duration;
        this.setAngle(0);
        this.anims.pause();
    }
}
