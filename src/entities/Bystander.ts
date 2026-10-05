import Phaser from 'phaser';
import { ENDING_SCENE } from '../config/flow';
import { TORCH } from '../config/rays';
import { worldScale } from '../systems/artScale';
import type { MonsterId } from '../types';
import { DEPTH } from './effects';

/** An animal moves off this far when it is startled */
const FLUTTER = 14;
/** Frame of a person's sheet in which they react (shield their eyes, raise a hand), where the sheet has one */
const REACT_FRAME = 2;
/** Someone walking turns round only when really heading the other way, as the monsters do */
const TURN_SPEED = 4;

export interface BystanderOptions {
    /** Pigeons and dogs: they scurry off instead of stepping back, and can be walked through */
    animal?: boolean;
    /** Points to walk round, over and over; without it they stand where they are put */
    route?: { x: number; y: number }[];
    /** What the player bumps into; it is kept on them as they step back */
    obstacle?: Phaser.GameObjects.Zone;
}

/**
 * Someone in the ending: what a "monster" really was. They are about their own business, and
 * all the torch can do is make them squint, turn away or step back.
 */
export class Bystander extends Phaser.GameObjects.Sprite {
    readonly kind: MonsterId;
    readonly radius: number;
    readonly animal: boolean;

    private route: { x: number; y: number }[];
    private leg = 0;
    private obstacle: Phaser.GameObjects.Zone | null;
    private nextReactAt = 0;
    private reactingUntil = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, kind: MonsterId, radius: number, options: BystanderOptions = {}) {
        super(scene, x, y, `${kind}-plain`, 0);
        this.kind = kind;
        this.radius = radius;
        this.animal = options.animal ?? false;
        this.route = options.route ?? [];
        this.obstacle = options.obstacle ?? null;

        scene.add.existing(this);
        worldScale(this);
        this.setDepth(DEPTH.monster);
    }

    get walks() {
        return this.route.length > 1;
    }

    /** Walk the route. Someone with a torch standing in the way is waited for, at a distance. */
    update(delta: number, playerX: number, playerY: number) {
        if (!this.walks) {
            return;
        }
        const now = this.scene.time.now;
        const waiting =
            now < this.reactingUntil ||
            Math.hypot(playerX - this.x, playerY - this.y) < ENDING_SCENE.walkerPause + this.radius;
        if (waiting) {
            if (now >= this.reactingUntil) {
                this.rest();
            }
            return;
        }

        const target = this.route[this.leg];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.hypot(dx, dy);
        const step = (ENDING_SCENE.walkerSpeed * delta) / 1000;
        if (distance <= step) {
            this.setPosition(target.x, target.y);
            this.leg = (this.leg + 1) % this.route.length;
            return;
        }
        this.setPosition(this.x + (dx / distance) * step, this.y + (dy / distance) * step);
        // The side-on drawings face right
        if (Math.abs(dx / distance) * ENDING_SCENE.walkerSpeed >= TURN_SPEED) {
            this.setFlipX(dx < 0);
        }
        this.playMove();
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
        this.reactingUntil = now + TORCH.reactEvery * 0.7;

        const angle = Math.atan2(this.y - fromY, this.x - fromX);
        const distance = this.animal ? FLUTTER : TORCH.stepBack;
        const toX = this.x + Math.cos(angle) * distance;
        const toY = this.y + Math.sin(angle) * distance;
        const free = canStand(toX, toY);

        if (this.animal) {
            // It hurries off the way it is now facing
            this.setFlipX(toX < this.x);
            this.flutter(free ? toX : this.x, free ? toY : this.y);
        } else {
            this.flinch(free ? toX : this.x, free ? toY : this.y);
        }
        return true;
    }

    /** A person: a small start, a step back, and a moment with their eyes shielded */
    private flinch(toX: number, toY: number) {
        this.anims.stop();
        this.setFrame(this.texture.has(String(REACT_FRAME)) ? REACT_FRAME : 1);
        this.scene.tweens.add({
            targets: this,
            x: toX,
            y: toY,
            duration: 260,
            ease: 'Quad.easeOut',
            onUpdate: () => this.carryObstacle(),
        });
        this.scene.tweens.add({ targets: this, scaleY: this.scaleY * 0.92, duration: 90, yoyo: true });
        this.scene.time.delayedCall(TORCH.reactEvery * 0.7, () => {
            if (this.active) {
                this.rest();
            }
        });
    }

    /** A pigeon or a dog: up, over and down a little further off */
    private flutter(toX: number, toY: number) {
        this.playMove();
        this.scene.tweens.add({ targets: this, x: toX, duration: 420, ease: 'Sine.easeOut' });
        this.scene.tweens.add({
            targets: this,
            y: toY - 4,
            duration: 210,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this,
                    y: toY,
                    duration: 210,
                    ease: 'Quad.easeIn',
                    onComplete: () => this.rest(),
                });
            },
        });
    }

    private playMove() {
        const key = `${this.kind}-plain-move`;
        if (this.scene.anims.exists(key)) {
            this.play(key, true);
        }
    }

    private rest() {
        this.anims.stop();
        this.setFrame(0);
    }

    private carryObstacle() {
        if (this.obstacle) {
            this.obstacle.setPosition(this.x, this.y);
            (this.obstacle.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
        }
    }
}
