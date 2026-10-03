import Phaser from 'phaser';
import { HEART } from '../config/monsters';
import { DEPTH } from './effects';

const BLINK_MS = 2500;

/** A pickup that restores health. Left alone it blinks out, unless it is `lasting`. */
export class Heart extends Phaser.GameObjects.Image {
    declare body: Phaser.Physics.Arcade.Body;

    private expiresAt: number;

    constructor(
        scene: Phaser.Scene,
        group: Phaser.Physics.Arcade.Group,
        x: number,
        y: number,
        lasting = false,
    ) {
        super(scene, x, y, 'heart', 0);
        this.expiresAt = lasting ? Infinity : scene.time.now + HEART.lifetime;

        scene.add.existing(this);
        group.add(this);
        this.setDepth(DEPTH.pickup);

        // A small hop so a drop catches the eye
        this.setScale(0.4);
        scene.tweens.add({ targets: this, scale: 1, duration: 260, ease: 'Back.easeOut' });
    }

    update() {
        const left = this.expiresAt - this.scene.time.now;
        if (left <= 0) {
            this.destroy();
        } else if (left < BLINK_MS) {
            this.setVisible(Math.floor(left / 120) % 2 === 0);
        }
    }
}
