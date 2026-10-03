import Phaser from 'phaser';
import { Events } from '../events';
import type { ArtStyle } from '../types';
import { DEPTH } from './effects';

const SPRITE_SIZE = 16;
/** Much smaller than the sprite on purpose: near misses should feel like misses */
const BODY_RADIUS = 4;
const SPEED = 70;
const INVULNERABLE_MS = 600;

/** Health before any secrets are found */
export const BASE_MAX_HEALTH = 100;
/** Distance from the player's hands to the tip of the EMW Machine */
export const MACHINE_LENGTH = 12;
/** The machine is held this far below the sprite's centre, so it sits in his hands */
export const MACHINE_DROP = 2;

type Direction = 'down' | 'up' | 'left' | 'right';
type MoveKeys = Record<Direction, Phaser.Input.Keyboard.Key>;

/** First frame of each direction's walk cycle in the player sheet */
const IDLE_FRAME: Record<Direction, number> = { down: 0, up: 2, left: 4, right: 6 };

export class Player extends Phaser.GameObjects.Container {
    declare body: Phaser.Physics.Arcade.Body;

    maxHealth: number;
    health: number;
    /** Direction the EMW Machine points, in radians */
    aimAngle = 0;
    /** Multiplies walking speed; the EMW Machine lowers it while charging */
    speedScale = 1;
    /** While true he stands still and ignores the keys and the mouse (item cards, the ending) */
    frozen = false;
    /** Dev only: nothing hurts him */
    invincible = false;

    private sprite: Phaser.GameObjects.Sprite;
    private machine: Phaser.GameObjects.Image;
    private keys: MoveKeys;
    private invulnerableUntil = 0;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        private style: ArtStyle,
        maxHealth = BASE_MAX_HEALTH,
    ) {
        super(scene, x, y);
        this.maxHealth = maxHealth;
        this.health = maxHealth;

        this.sprite = scene.add.sprite(0, 0, `player-${style}`, 0);
        this.machine = scene.add.image(0, MACHINE_DROP, `machine-${style}`, 0).setOrigin(0, 0.5);
        this.add([this.sprite, this.machine]);
        this.setSize(SPRITE_SIZE, SPRITE_SIZE);

        scene.add.existing(this);
        this.setDepth(DEPTH.player);
        scene.physics.add.existing(this);
        const offset = SPRITE_SIZE / 2 - BODY_RADIUS;
        this.body.setCircle(BODY_RADIUS, offset, offset);
        this.body.setCollideWorldBounds(true);

        this.keys = scene.input.keyboard!.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        }) as MoveKeys;
    }

    get isDead() {
        return this.health <= 0;
    }

    /** Where the machine is held: radiation is aimed and fired from here */
    get handY() {
        return this.y + MACHINE_DROP;
    }

    update() {
        if (this.isDead) {
            this.sprite.stop();
            return;
        }
        if (this.frozen) {
            this.body.setVelocity(0, 0);
            this.sprite.stop();
            this.sprite.setFrame(IDLE_FRAME[this.facing()]);
            return;
        }

        const { up, down, left, right } = this.keys;
        const direction = new Phaser.Math.Vector2(
            Number(right.isDown) - Number(left.isDown),
            Number(down.isDown) - Number(up.isDown),
        );
        const moving = direction.lengthSq() > 0;
        direction.normalize().scale(SPEED * this.speedScale);
        this.body.setVelocity(direction.x, direction.y);

        const pointer = this.scene.input.activePointer;
        pointer.updateWorldPoint(this.scene.cameras.main);
        this.aim(Phaser.Math.Angle.Between(this.x, this.handY, pointer.worldX, pointer.worldY));

        // The body faces where the machine points, like a twin-stick Zelda
        if (moving) {
            this.sprite.play(`player-${this.style}-walk-${this.facing()}`, true);
        } else {
            this.sprite.stop();
            this.sprite.setFrame(IDLE_FRAME[this.facing()]);
        }
    }

    /** Point the machine (and so the body) along an angle */
    aim(angle: number) {
        this.aimAngle = angle;
        this.machine.rotation = angle;
        // Holding the machine "behind" the body when facing up
        this.machine.setDepth(this.facing() === 'up' ? -1 : 1);
        this.sort('depth');
    }

    /** Redraw him in another art style (the boss page changes style mid-fight) */
    setStyle(style: ArtStyle) {
        this.style = style;
        const frame = this.sprite.frame.name;
        this.sprite.stop();
        this.sprite.setTexture(`player-${style}`, frame);
        this.machine.setTexture(`machine-${style}`, 0);
    }

    /** Returns true if the damage landed (false while dead or just after a previous hit) */
    hurt(amount: number) {
        if (this.invincible || this.isDead || this.scene.time.now < this.invulnerableUntil) {
            return false;
        }

        this.health = Math.max(0, this.health - amount);
        this.invulnerableUntil = this.scene.time.now + INVULNERABLE_MS;
        this.scene.game.events.emit(Events.PLAYER_HEALTH_CHANGED, this.health, this.maxHealth);

        if (this.isDead) {
            this.body.setVelocity(0, 0);
            this.setAlpha(0.3);
            this.scene.game.events.emit(Events.PLAYER_DIED);
            return true;
        }

        this.scene.tweens.add({
            targets: this,
            alpha: 0.3,
            duration: INVULNERABLE_MS / 6,
            yoyo: true,
            repeat: 2,
        });
        return true;
    }

    /** Restores health; returns false (and does nothing) at full health */
    heal(amount: number) {
        if (this.isDead || this.health >= this.maxHealth) {
            return false;
        }
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.scene.game.events.emit(Events.PLAYER_HEALTH_CHANGED, this.health, this.maxHealth);
        return true;
    }

    /** A health upgrade: a bigger maximum, filled to the top */
    raiseMaxHealth(maxHealth: number) {
        if (this.isDead) {
            return;
        }
        this.maxHealth = maxHealth;
        this.health = maxHealth;
        this.scene.game.events.emit(Events.PLAYER_HEALTH_CHANGED, this.health, this.maxHealth);
    }

    private facing(): Direction {
        const degrees = Phaser.Math.RadToDeg(this.aimAngle);
        if (degrees >= -45 && degrees < 45) {
            return 'right';
        }
        if (degrees >= 45 && degrees < 135) {
            return 'down';
        }
        if (degrees >= -135 && degrees < -45) {
            return 'up';
        }
        return 'left';
    }
}
