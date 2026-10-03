import Phaser from 'phaser';
import { Events } from '../events';

const RADIUS = 20;
const SPEED = 260;
const MAX_HEALTH = 100;
const INVULNERABLE_MS = 600;

/** Distance from the player's centre to the tip of the EMW Machine */
export const MACHINE_LENGTH = 38;

type MoveKeys = Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

export class Player extends Phaser.GameObjects.Container {
    declare body: Phaser.Physics.Arcade.Body;

    readonly maxHealth = MAX_HEALTH;
    health = MAX_HEALTH;
    /** Direction the EMW Machine points, in radians */
    aimAngle = 0;

    private machine: Phaser.GameObjects.Rectangle;
    private keys: MoveKeys;
    private invulnerableUntil = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);

        // Placeholder art: a circle for the player and a bar for the EMW Machine
        this.machine = scene.add.rectangle(0, 0, MACHINE_LENGTH, 8, 0xffffff).setOrigin(0, 0.5);
        this.add([this.machine, scene.add.circle(0, 0, RADIUS, 0xffd23f)]);
        this.setSize(RADIUS * 2, RADIUS * 2);

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCircle(RADIUS);
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

    update() {
        if (this.isDead) {
            return;
        }

        const { up, down, left, right } = this.keys;
        const direction = new Phaser.Math.Vector2(
            Number(right.isDown) - Number(left.isDown),
            Number(down.isDown) - Number(up.isDown),
        );
        direction.normalize().scale(SPEED);
        this.body.setVelocity(direction.x, direction.y);

        const pointer = this.scene.input.activePointer;
        pointer.updateWorldPoint(this.scene.cameras.main);
        this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, pointer.worldX, pointer.worldY);
        this.machine.rotation = this.aimAngle;
    }

    hurt(amount: number) {
        if (this.isDead || this.scene.time.now < this.invulnerableUntil) {
            return;
        }

        this.health = Math.max(0, this.health - amount);
        this.invulnerableUntil = this.scene.time.now + INVULNERABLE_MS;
        this.scene.game.events.emit(Events.PLAYER_HEALTH_CHANGED, this.health, this.maxHealth);

        if (this.isDead) {
            this.body.setVelocity(0, 0);
            this.setAlpha(0.3);
            this.scene.game.events.emit(Events.PLAYER_DIED);
            return;
        }

        this.scene.tweens.add({
            targets: this,
            alpha: 0.3,
            duration: INVULNERABLE_MS / 6,
            yoyo: true,
            repeat: 2,
        });
    }
}
