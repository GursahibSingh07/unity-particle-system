import Phaser from 'phaser';
import { TORCH } from '../config/radiation';
import type { MonsterId } from '../types';
import { DEPTH } from './effects';

/** A flock moves off this far when it is startled */
const FLUTTER = 14;

/**
 * Someone in the ending: what a "monster" really was. They stand about their own business,
 * and all the torch can do is make them squint, turn away or step back.
 */
export class Bystander extends Phaser.GameObjects.Sprite {
    readonly kind: MonsterId;
    readonly radius: number;
    /** Small things (the pigeons) flutter off instead of stepping back, and can be walked through */
    readonly small: boolean;

    private nextReactAt = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, kind: MonsterId, radius: number) {
        super(scene, x, y, `${kind}-plain`, 0);
        this.kind = kind;
        this.radius = radius;
        this.small = radius < 5;

        scene.add.existing(this);
        this.setDepth(DEPTH.monster);
        if (!this.small) {
            scene.physics.add.existing(this, true);
            const body = this.body as Phaser.Physics.Arcade.StaticBody;
            body.setCircle(radius, this.width / 2 - radius, this.height / 2 - radius);
        }
    }

    /**
     * The torch (or the man holding it) is bothering them from (fromX, fromY).
     * `canStand` says whether a spot is free. Returns false if they are still reacting to the last time.
     */
    bother(fromX: number, fromY: number, canStand: (x: number, y: number) => boolean) {
        const now = this.scene.time.now;
        if (now < this.nextReactAt) {
            return false;
        }
        this.nextReactAt = now + TORCH.reactEvery;

        const angle = Math.atan2(this.y - fromY, this.x - fromX);
        const distance = this.small ? FLUTTER : TORCH.stepBack;
        const toX = this.x + Math.cos(angle) * distance;
        const toY = this.y + Math.sin(angle) * distance;
        // They turn their face away from the light
        this.setFlipX(fromX > this.x);

        if (this.small) {
            this.flutter(canStand(toX, toY) ? toX : this.x, canStand(toX, toY) ? toY : this.y);
        } else {
            this.flinch(canStand(toX, toY) ? toX : this.x, canStand(toX, toY) ? toY : this.y);
        }
        return true;
    }

    /** A person: a small start, a step back, and a moment with their eyes shielded */
    private flinch(toX: number, toY: number) {
        const body = this.body as Phaser.Physics.Arcade.StaticBody;
        this.setFrame(1);
        this.scene.tweens.add({
            targets: this,
            x: toX,
            y: toY,
            duration: 260,
            ease: 'Quad.easeOut',
            onUpdate: () => body.updateFromGameObject(),
        });
        this.scene.tweens.add({ targets: this, scaleY: 0.9, duration: 90, yoyo: true });
        this.scene.time.delayedCall(TORCH.reactEvery * 0.7, () => {
            if (this.active) {
                this.setFrame(0);
            }
        });
    }

    /** A pigeon: up, over and down a little further off */
    private flutter(toX: number, toY: number) {
        this.play('swarmlet-plain-move', true);
        this.scene.tweens.add({ targets: this, x: toX, duration: 420, ease: 'Sine.easeOut' });
        this.scene.tweens.add({
            targets: this,
            y: toY - 5,
            duration: 210,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this,
                    y: toY,
                    duration: 210,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        this.stop();
                        this.setFrame(0);
                    },
                });
            },
        });
    }
}
