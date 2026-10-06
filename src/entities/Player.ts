import Phaser from 'phaser';
import { DASH } from '../config/rays';
import { Events } from '../events';
import { worldScale } from '../systems/artScale';
import type { ArtStyle, WeaponRule } from '../types';
import { DEPTH, UNDERLAY } from './effects';

/** The room he takes up in the world, whatever size his sprite is drawn at */
const FOOTPRINT = 16;
/** Much smaller than the sprite on purpose: near misses should feel like misses */
const BODY_RADIUS = 4;
const SPEED = 70;
const INVULNERABLE_MS = 600;

/** Health before any secrets are found */
export const BASE_MAX_HEALTH = 100;
/** Distance from the player's hands to the tip of the EMW Machine */
export const MACHINE_LENGTH = 12;
/**
 * Where the machine is held, measured down from the body's anchor (which is at hip height).
 * Negative lifts it: this puts it at his chest, in his hands. Any lower and it juts from the hips.
 */
export const MACHINE_DROP = -4;
/** How much of the machine's length is drawn when he points it at the viewer */
const TOWARDS_VIEWER = 0.5;

type Direction = 'down' | 'up' | 'left' | 'right';
type MoveKeys = Record<Direction, Phaser.Input.Keyboard.Key>;

const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];

/** How a player sheet is laid out: both run down, up, left, right */
interface SheetLayout {
    perDirection: number;
    /** Offset of the standing frame within a direction's frames */
    idle: number;
    /** Offset of the frame shown while dashing */
    dash: number;
    /** Where his waist is, as a fraction of the frame's height: the sprite is hung from there */
    originY: number;
}

/** v1: 16x16, two walk frames per direction (8 frames) */
const SHEET_V1: SheetLayout = { perDirection: 2, idle: 0, dash: 1, originY: 0.5 };
/** v2: 32x48, idle, walk A, walk B and dash per direction (16 frames); the head rises above the footprint */
const SHEET_V2: SheetLayout = { perDirection: 4, idle: 0, dash: 3, originY: 2 / 3 };

/** The two tints a dash's afterimages alternate between, so the trail reads on any ground */
const GHOST_TINTS = [0xdff4ff, UNDERLAY.color];

export class Player extends Phaser.GameObjects.Container {
    declare body: Phaser.Physics.Arcade.Body;

    maxHealth: number;
    health: number;
    /** Direction the EMW Machine points, in radians */
    aimAngle = 0;
    /**
     * Multiplies walking speed. This one belongs to floor hazards (ice sets it below 1 and puts
     * it back); anything else that slows him uses setSpeedFactor(), so the two never overwrite
     * each other.
     */
    speedScale = 1;
    /** While true he stands still and ignores the keys and the mouse (item cards, the ending) */
    frozen = false;
    /** Dev only: nothing hurts him */
    invincible = false;
    /**
     * Asked before every dash. Space also puts captions and cards away, so the scene answers
     * false while one of those is up.
     */
    dashAllowed: () => boolean = () => true;

    private sprite: Phaser.GameObjects.Sprite;
    private machine: Phaser.GameObjects.Image;
    /** A dot of the active ray's colour on the end of the machine */
    private lens: Phaser.GameObjects.Arc;
    private keys: MoveKeys;
    private invulnerableUntil = 0;
    private speedFactors = new Map<string, number>();

    private dashMax = 0;
    private dashCooldown = 0;
    private dashCharges = 0;
    /** Milliseconds until each spent charge comes back, soonest first */
    private dashReturns: number[] = [];
    private dashUntil = 0;
    private dashVelocity = new Phaser.Math.Vector2();
    private dashFacing: Direction = 'down';
    private dashFrom = new Phaser.Math.Vector2();
    private dashPressedAt = -Infinity;
    private dashBlockedUntil = 0;
    private nextDashAt = 0;
    private nextGhostAt = 0;
    private ghosts = 0;
    private streak: Phaser.GameObjects.Graphics | null = null;

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

        this.sprite = worldScale(scene.add.sprite(0, 0, `player-${style}`, 0));
        this.sprite.setOrigin(0.5, this.sheet.originY);
        this.machine = worldScale(scene.add.image(0, MACHINE_DROP, `machine-${style}`, 0).setOrigin(0, 0.5));
        this.lens = scene.add.circle(0, 0, 1.4, 0xffffff).setStrokeStyle(0.8, UNDERLAY.color, 0.9).setVisible(false);
        this.add([this.sprite, this.machine, this.lens]);
        // The container itself is never scaled, so its body is sized in world units directly
        this.setSize(FOOTPRINT, FOOTPRINT);

        scene.add.existing(this);
        this.setDepth(DEPTH.player);
        scene.physics.add.existing(this);
        const offset = FOOTPRINT / 2 - BODY_RADIUS;
        // A box: arcade physics slides a box along walls cleanly, where a circle snags on corners
        this.body.setSize(BODY_RADIUS * 2, BODY_RADIUS * 2, false);
        this.body.setOffset(offset, offset);
        this.body.setCollideWorldBounds(true);

        const keyboard = scene.input.keyboard!;
        this.keys = keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
        }) as MoveKeys;
        const dashKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        const onDash = () => {
            this.dashPressedAt = this.scene.time.now;
        };
        dashKey.on('down', onDash);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            dashKey.off('down', onDash);
            this.streak?.destroy();
            this.streak = null;
        });
        this.aim(0);
    }

    get isDead() {
        return this.health <= 0;
    }

    /** True for the length of a dash: nothing can hurt him and enemies are passed through */
    get isDashing() {
        return this.scene.time.now < this.dashUntil;
    }

    /** Where the machine is held: radiation is aimed and fired from here */
    get handY() {
        return this.y + MACHINE_DROP;
    }

    /** Dash charges ready to use right now */
    get dashesLeft() {
        return this.dashCharges;
    }

    /** Walking speed right now, as a fraction of normal: the hazard's scale times every named factor */
    get speedMultiplier() {
        let scale = this.speedScale;
        for (const factor of this.speedFactors.values()) {
            scale *= factor;
        }
        return Math.max(0, scale);
    }

    /**
     * Slow (or speed) him under a name of the caller's own, without touching anyone else's
     * factor. A factor of 1 removes it.
     */
    setSpeedFactor(name: string, factor: number) {
        if (factor === 1) {
            this.speedFactors.delete(name);
        } else {
            this.speedFactors.set(name, factor);
        }
    }

    /** The era's rule changed (or began): how many dash charges there are and how fast they return */
    setRule(rule: WeaponRule) {
        const max = Math.max(0, Math.floor(rule.dashCharges));
        this.dashMax = max;
        this.dashCooldown = Math.max(0, rule.dashCooldownMs);
        // Charges already on their way back stay on their way back, as far as the new rule has room
        this.dashReturns = this.dashReturns.slice(0, max).map((left) => Math.min(left, this.dashCooldown));
        this.dashCharges = max - this.dashReturns.length;
        this.emitDashState();
    }

    /** Tell the HUD where the dash stands */
    emitDashState() {
        this.scene.game.events.emit(Events.DASH_STATE, this.dashCharges, this.dashMax, this.dashReturns[0] ?? 0);
    }

    /** Show the active ray's colour on the end of the machine; null for none */
    setLens(color: number | null) {
        this.lens.setVisible(color !== null);
        if (color !== null) {
            this.lens.setFillStyle(color);
        }
    }

    update() {
        const now = this.scene.time.now;
        this.rechargeDash(this.scene.game.loop.delta);

        if (this.isDead) {
            this.sprite.stop();
            this.endDash();
            return;
        }
        if (this.frozen || !this.dashAllowed()) {
            // The same press of Space that closed a caption must not also be a dash
            this.dashBlockedUntil = now + DASH.unblockDelay;
        }
        if (this.frozen) {
            this.endDash();
            this.body.setVelocity(0, 0);
            this.sprite.stop();
            this.sprite.setFrame(this.frameFor(this.facing(), this.sheet.idle));
            return;
        }

        const pointer = this.scene.input.activePointer;
        pointer.updateWorldPoint(this.scene.cameras.main);
        this.aim(Phaser.Math.Angle.Between(this.x, this.handY, pointer.worldX, pointer.worldY));

        if (now < this.dashUntil) {
            // Committed: the keys are ignored until it is over, but he can still aim and fire
            this.body.setVelocity(this.dashVelocity.x, this.dashVelocity.y);
            this.drawDash(now);
            return;
        }
        if (this.dashUntil) {
            this.endDash();
        }

        const { up, down, left, right } = this.keys;
        const direction = new Phaser.Math.Vector2(
            Number(right.isDown) - Number(left.isDown),
            Number(down.isDown) - Number(up.isDown),
        );
        const moving = direction.lengthSq() > 0;
        direction.normalize();

        if (now - this.dashPressedAt <= DASH.buffer && this.tryDash(now, moving ? direction : null)) {
            return;
        }

        direction.scale(SPEED * this.speedMultiplier);
        this.body.setVelocity(direction.x, direction.y);

        // The body faces where the machine points, like a twin-stick Zelda
        if (moving) {
            this.sprite.play(`player-${this.style}-walk-${this.facing()}`, true);
        } else {
            this.sprite.stop();
            this.sprite.setFrame(this.frameFor(this.facing(), this.sheet.idle));
        }
    }

    /** Point the machine (and so the body) along an angle */
    aim(angle: number) {
        this.aimAngle = angle;
        this.machine.rotation = angle;
        // Pointed at the viewer it is foreshortened: at full length it hung down the middle of
        // his body from chest to feet, which read as something else entirely
        const reach = this.facing() === 'down' ? TOWARDS_VIEWER : 1;
        this.machine.scaleX = this.machine.scaleY * reach;
        const tip = (MACHINE_LENGTH - 1) * reach;
        this.lens.setPosition(Math.cos(angle) * tip, MACHINE_DROP + Math.sin(angle) * tip);
        // Holding the machine "behind" the body when facing up
        const depth = this.facing() === 'up' ? -1 : 1;
        this.machine.setDepth(depth);
        this.lens.setDepth(depth);
        this.sort('depth');
    }

    /** Redraw him in another art style (the boss page changes style mid-fight) */
    setStyle(style: ArtStyle) {
        this.style = style;
        const frame = this.sprite.frame.name;
        this.sprite.stop();
        this.sprite.setTexture(`player-${style}`, frame);
        this.sprite.setOrigin(0.5, this.sheet.originY);
        this.machine.setTexture(`machine-${style}`, 0);
    }

    /** Returns true if the damage landed (false while dead, dashing, or just after a previous hit) */
    hurt(amount: number) {
        const now = this.scene.time.now;
        if (this.invincible || this.isDead || now < this.dashUntil || now < this.invulnerableUntil) {
            return false;
        }

        this.health = Math.max(0, this.health - amount);
        this.invulnerableUntil = now + INVULNERABLE_MS;
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

    /** The old art has two frames a direction, the v2 art four: told apart by counting them */
    private get sheet(): SheetLayout {
        // frameTotal counts the texture's own base frame as well
        const frames = this.scene.textures.get(`player-${this.style}`).frameTotal - 1;
        return frames >= DIRECTIONS.length * SHEET_V2.perDirection ? SHEET_V2 : SHEET_V1;
    }

    private frameFor(direction: Direction, offset: number) {
        return DIRECTIONS.indexOf(direction) * this.sheet.perDirection + offset;
    }

    /** Starts a dash if one is to be had. `direction` is a unit vector, or null to go where he aims. */
    private tryDash(now: number, direction: Phaser.Math.Vector2 | null) {
        if (now < this.dashBlockedUntil) {
            // Space was meant for a caption
            this.dashPressedAt = -Infinity;
            return false;
        }
        if (this.dashMax <= 0) {
            this.dashPressedAt = -Infinity;
            return false;
        }
        if (this.dashCharges <= 0) {
            // Tell him once; the press is not kept for when a charge returns
            this.dashPressedAt = -Infinity;
            this.scene.game.events.emit(Events.DENIED);
            return false;
        }
        if (now < this.nextDashAt) {
            // A second press during a dash waits for it to end
            return false;
        }

        const dx = direction ? direction.x : Math.cos(this.aimAngle);
        const dy = direction ? direction.y : Math.sin(this.aimAngle);
        this.dashPressedAt = -Infinity;
        this.dashCharges--;
        this.dashReturns.push(this.dashCooldown);
        this.dashReturns.sort((a, b) => a - b);
        this.dashUntil = now + DASH.duration;
        this.nextDashAt = this.dashUntil + DASH.chainDelay;
        this.invulnerableUntil = Math.max(this.invulnerableUntil, this.dashUntil + DASH.grace);
        this.dashVelocity.set(dx * DASH.speed, dy * DASH.speed);
        this.dashFrom.set(this.x, this.y);
        if (Math.abs(dx) >= Math.abs(dy)) {
            this.dashFacing = dx >= 0 ? 'right' : 'left';
        } else {
            this.dashFacing = dy >= 0 ? 'down' : 'up';
        }

        this.body.setVelocity(this.dashVelocity.x, this.dashVelocity.y);
        this.sprite.stop();
        this.sprite.setFrame(this.frameFor(this.dashFacing, this.sheet.dash));
        this.streak?.destroy();
        this.streak = this.scene.add.graphics().setDepth(DEPTH.player - 0.2);
        this.nextGhostAt = now;
        this.ghosts = 0;
        this.drawDash(now);

        this.scene.game.events.emit(Events.DASHED, this.dashCharges, this.dashMax);
        this.emitDashState();
        return true;
    }

    /** The streak behind him and the afterimages he leaves along it */
    private drawDash(now: number) {
        const streak = this.streak;
        if (streak) {
            // Fattest at his heels, a point where he set off
            const angle = Math.atan2(this.y - this.dashFrom.y, this.x - this.dashFrom.x);
            const nx = -Math.sin(angle);
            const ny = Math.cos(angle);
            const shape = (half: number) => [
                new Phaser.Math.Vector2(this.dashFrom.x, this.dashFrom.y),
                new Phaser.Math.Vector2(this.x + nx * half, this.y + ny * half),
                new Phaser.Math.Vector2(this.x - nx * half, this.y - ny * half),
            ];
            streak.clear();
            streak.fillStyle(UNDERLAY.color, UNDERLAY.alpha);
            streak.fillPoints(shape(5), true);
            streak.fillStyle(0xffffff, 0.75);
            streak.fillPoints(shape(3), true);
        }

        if (now >= this.nextGhostAt) {
            this.nextGhostAt = now + DASH.ghostEvery;
            const ghost = worldScale(
                this.scene.add.image(this.x, this.y, this.sprite.texture.key, this.sprite.frame.name),
            );
            ghost
                .setOrigin(0.5, this.sheet.originY)
                .setTint(GHOST_TINTS[this.ghosts++ % GHOST_TINTS.length])
                .setTintMode(Phaser.TintModes.FILL)
                .setAlpha(0.6)
                .setDepth(DEPTH.player - 0.1);
            this.scene.tweens.add({
                targets: ghost,
                alpha: 0,
                duration: DASH.ghostFade,
                onComplete: () => ghost.destroy(),
            });
        }
    }

    private endDash() {
        if (!this.dashUntil) {
            return;
        }
        this.dashUntil = 0;
        const streak = this.streak;
        this.streak = null;
        if (streak) {
            this.scene.tweens.add({
                targets: streak,
                alpha: 0,
                duration: 140,
                onComplete: () => streak.destroy(),
            });
        }
    }

    private rechargeDash(delta: number) {
        if (this.dashReturns.length === 0) {
            return;
        }
        let returned = false;
        for (let i = 0; i < this.dashReturns.length; i++) {
            this.dashReturns[i] -= delta;
        }
        while (this.dashReturns.length > 0 && this.dashReturns[0] <= 0) {
            this.dashReturns.shift();
            this.dashCharges = Math.min(this.dashMax, this.dashCharges + 1);
            returned = true;
        }
        if (returned) {
            this.emitDashState();
        }
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
