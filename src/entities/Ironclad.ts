import Phaser from 'phaser';
import { IRONCLAD } from '../config/monsters';
import { Events } from '../events';
import type { MonsterDef } from '../types';
import { closingRing } from './effects';
import { Monster, type MonsterWorld } from './Monster';
import { Projectile } from './Projectile';

const WINDUP_FRAME = 2;

/** Slow and armoured. Keeps its distance and throws things after an obvious wind-up. */
export class Ironclad extends Monster {
    private windingUntil = 0;
    private nextThrowAt: number;
    private strafe = Math.random() < 0.5 ? 1 : -1;
    private nextTurnAt = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.nextThrowAt = scene.time.now + IRONCLAD.firstThrow + Math.random() * 600;
    }

    get isWindingUp() {
        return this.windingUntil > 0;
    }

    protected behave(now: number, delta: number) {
        if (this.windingUntil > 0) {
            this.body.setVelocity(0, 0);
            if (now >= this.windingUntil) {
                this.throwProjectile(now);
            }
            return;
        }

        const sees = this.seesPlayer();
        if (sees && now >= this.nextThrowAt) {
            this.windingUntil = now + IRONCLAD.windup;
            this.stop();
            this.setFrame(WINDUP_FRAME);
            closingRing(this.scene, this.x, this.y, this.def.radius + 5, 0xffffff, IRONCLAD.windup);
            this.scene.game.events.emit(Events.MONSTER_WINDUP, this.def.id, this.x, this.y);
            return;
        }

        const distance = this.distanceToPlayer();
        if (!sees || distance > IRONCLAD.farRange) {
            this.chase(now, delta, this.def.speed);
        } else if (distance < IRONCLAD.nearRange) {
            const away = this.angleToPlayer() + Math.PI;
            this.steer(Math.cos(away) * this.def.speed, Math.sin(away) * this.def.speed, delta);
        } else {
            // In range: circle slowly so it is not a sitting target
            const side = this.angleToPlayer() + (Math.PI / 2) * this.strafe;
            if (!this.body.blocked.none && now >= this.nextTurnAt) {
                // Walked into something: go round the other way, but do not dither against it
                this.strafe = -this.strafe;
                this.nextTurnAt = now + 800;
            }
            this.steer(Math.cos(side) * this.def.speed * 0.6, Math.sin(side) * this.def.speed * 0.6, delta);
        }
    }

    stun(duration: number) {
        super.stun(duration);
        this.cancelWindup();
    }

    knockback(fromX: number, fromY: number, speed: number, duration: number) {
        // Too heavy to be thrown about: it only shuffles
        super.knockback(fromX, fromY, speed * 0.3, duration);
    }

    private cancelWindup() {
        if (this.windingUntil > 0) {
            this.windingUntil = 0;
            this.playMove();
        }
    }

    private throwProjectile(now: number) {
        const { world } = this;
        new Projectile(
            this.scene,
            world.projectiles,
            this.x,
            this.y,
            this.angleToPlayer(),
            IRONCLAD.projectileSpeed,
            IRONCLAD.projectileDamage,
            world.style,
        );
        this.nextThrowAt = now + IRONCLAD.cooldown + Phaser.Math.Between(-200, 300);
        this.cancelWindup();
    }
}
