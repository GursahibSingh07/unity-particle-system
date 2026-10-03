import Phaser from 'phaser';
import { Events } from '../events';
import { damageMultiplier } from '../systems/Combat';
import type { Damageable, MonsterDef, RadiationId } from '../types';

// Minimal monster so the core loop is testable: a circle that chases the player.
// Role C owns this file (shapes, behaviours, telegraphs).
export class Monster extends Phaser.GameObjects.Arc implements Damageable {
    declare body: Phaser.Physics.Arcade.Body;

    readonly def: MonsterDef;
    health: number;

    private target: Phaser.GameObjects.Components.Transform;
    private stunnedUntil = 0;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        def: MonsterDef,
        target: Phaser.GameObjects.Components.Transform,
    ) {
        super(scene, x, y, def.radius, 0, 360, false, def.color);
        this.def = def;
        this.health = def.maxHealth;
        this.target = target;

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCircle(def.radius);
    }

    update() {
        if (this.scene.time.now < this.stunnedUntil) {
            return;
        }
        this.scene.physics.moveToObject(this, this.target, this.def.speed);
    }

    takeDamage(type: RadiationId, amount: number) {
        this.health -= amount * damageMultiplier(this.def, type);
        if (this.health <= 0) {
            this.kill();
        }
    }

    /** Push away from a point and stop chasing for `duration` milliseconds */
    knockback(fromX: number, fromY: number, speed: number, duration: number) {
        const angle = Phaser.Math.Angle.Between(fromX, fromY, this.x, this.y);
        this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.stunnedUntil = this.scene.time.now + duration;
    }

    kill() {
        this.scene.game.events.emit(Events.MONSTER_KILLED, this.def.id);
        this.destroy();
    }
}
