import Phaser from 'phaser';
import { ART_SCALE } from '../config/world';
import { DEPTH } from './effects';

/** A little bigger than a dropped heart, so it reads as something else */
const SCALE = ART_SCALE * 1.4;
/** The player cannot pick it up until it has landed */
const HOP_HEIGHT = 9;

/** The prize from a cracked wall: raises maximum health. Never expires, always collectable. */
export class HealthUpgrade extends Phaser.GameObjects.Image {
    declare body: Phaser.Physics.Arcade.Body;

    /** False while it is still tumbling out of the wall */
    landed = false;

    /**
     * @param from Where it comes out of the wall; it hops from there to (x, y)
     * @param dropTime How long the hop takes; 0 puts it straight on the floor
     */
    constructor(
        scene: Phaser.Scene,
        group: Phaser.Physics.Arcade.Group,
        x: number,
        y: number,
        from: { x: number; y: number } = { x, y },
        dropTime = 0,
    ) {
        super(scene, from.x, from.y, scene.textures.exists('upgrade') ? 'upgrade' : 'heart', 0);

        scene.add.existing(this);
        group.add(this);
        this.setDepth(DEPTH.pickup).setScale(SCALE);

        const settle = () => {
            if (!this.active) {
                return;
            }
            this.landed = true;
            this.setPosition(x, y);
            // Beating, so it catches the eye among the paving
            const pulse = scene.tweens.add({
                targets: this,
                scale: SCALE * 1.25,
                duration: 420,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
            });
            this.once(Phaser.GameObjects.Events.DESTROY, () => pulse.remove());
        };

        if (dropTime <= 0) {
            settle();
            return;
        }
        scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: dropTime,
            onUpdate: (tween) => {
                if (!this.active) {
                    return;
                }
                const t = tween.getValue() ?? 1;
                this.setPosition(
                    Phaser.Math.Linear(from.x, x, t),
                    Phaser.Math.Linear(from.y, y, t) - Math.sin(t * Math.PI) * HOP_HEIGHT,
                );
            },
            onComplete: settle,
        });
    }
}
