import Phaser from 'phaser';
import { DEPTH } from './effects';

const SCALE = 1.6;

/** The prize behind a secret wall: raises maximum health. Never expires, always collectable. */
export class HealthUpgrade extends Phaser.GameObjects.Image {
    declare body: Phaser.Physics.Arcade.Body;

    constructor(scene: Phaser.Scene, group: Phaser.Physics.Arcade.Group, x: number, y: number) {
        super(scene, x, y, 'heart', 0);

        scene.add.existing(this);
        group.add(this);
        this.setDepth(DEPTH.pickup).setScale(SCALE);

        // Bigger than a dropped heart and beating, so it reads as something else
        const pulse = scene.tweens.add({
            targets: this,
            scale: SCALE * 1.3,
            duration: 420,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
        this.once(Phaser.GameObjects.Events.DESTROY, () => pulse.remove());
    }
}
