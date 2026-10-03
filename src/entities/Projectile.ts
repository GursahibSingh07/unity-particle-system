import Phaser from 'phaser';
import { PROJECTILE } from '../config/monsters';
import type { ArtStyle } from '../types';
import { DEPTH, puff } from './effects';

/** Something thrown at the player. Breaks on walls and props. */
export class Projectile extends Phaser.GameObjects.Sprite {
    declare body: Phaser.Physics.Arcade.Body;

    readonly damage: number;
    private expiresAt: number;

    constructor(
        scene: Phaser.Scene,
        group: Phaser.Physics.Arcade.Group,
        x: number,
        y: number,
        angle: number,
        speed: number,
        damage: number,
        style: ArtStyle,
    ) {
        super(scene, x, y, `projectile-${style}`, 0);
        this.damage = damage;
        this.expiresAt = scene.time.now + PROJECTILE.lifetime;

        scene.add.existing(this);
        // Joining the group creates the body; velocity has to be set afterwards
        group.add(this);
        this.body.setCircle(
            PROJECTILE.radius,
            this.width / 2 - PROJECTILE.radius,
            this.height / 2 - PROJECTILE.radius,
        );
        this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.setRotation(angle);
        this.setDepth(DEPTH.projectile);
    }

    update() {
        if (this.scene.time.now >= this.expiresAt) {
            this.destroy();
        }
    }

    /** Redraw in another art style (the boss page changes style mid-fight) */
    setStyle(style: ArtStyle) {
        this.setTexture(`projectile-${style}`, 0);
    }

    /** Break apart, on hitting a wall or the player */
    shatter() {
        if (!this.active) {
            return;
        }
        puff(this.scene, this.x, this.y, 0xffffff, 4, 6);
        this.destroy();
    }
}
