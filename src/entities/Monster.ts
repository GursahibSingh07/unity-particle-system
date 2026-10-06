import Phaser from 'phaser';
import { FLIGHT, MOVEMENT } from '../config/monsters';
import { Events } from '../events';
import { fitCircleBody, worldScale } from '../systems/artScale';
import { damageMultiplier } from '../systems/Combat';
import type { Navigator, Point } from '../systems/Navigation';
import type { Rect } from '../systems/roomLayout';
import type { ArtStyle, Damageable, MonsterDef, MonsterId, RayId } from '../types';
import { DEPTH, UNDERLAY, puff } from './effects';
import type { Player } from './Player';

const FLASH_MS = 70;
/** Continuous beams hit every frame; this keeps the HIT event (and its sound) from machine-gunning */
const HIT_EVENT_INTERVAL = 140;
/** What a slowed monster is tinted, so the player can see Green working */
const SLOW_TINT = 0x8dffb0;
/** A slow can never stop a monster dead: that is what stun() is for */
const SLOWEST = 0.05;
/** The side-on drawings face right. A monster turns round only when it is really going the other way... */
const TURN_SPEED = 8;
/** ...and not again for this long, so one weaving up the screen does not flicker */
const TURN_HOLD = 240;

/** Everything a monster needs to know about the room it is in */
export interface MonsterWorld {
    player: Player;
    nav: Navigator;
    /** Tiles that stop movement and projectiles */
    solids: Rect[];
    /** Tiles that also stop radiation */
    walls: Rect[];
    /** The art style new monsters and projectiles are drawn in; the boss page changes it */
    style: ArtStyle;
    monsters: Phaser.Physics.Arcade.Group;
    projectiles: Phaser.Physics.Arcade.Group;
    /** Announce, then spawn, a monster on open floor near a point */
    summon(id: MonsterId, x: number, y: number): void;
}

/** Where routeToPlayer() says to head; one object per monster, reused every frame */
interface Heading extends Point {
    /** True when the player can be reached in a straight line */
    direct: boolean;
}

/** A monster that walks to the player around walls. Other behaviours build on this. */
export class Monster extends Phaser.GameObjects.Sprite implements Damageable {
    declare body: Phaser.Physics.Arcade.Body;

    readonly def: MonsterDef;
    health: number;

    protected world: MonsterWorld;
    protected style: ArtStyle;
    /** Frozen in place (cannot act) until this time */
    protected stunnedUntil = 0;
    /** Being pushed (cannot act, keeps its velocity) until this time */
    protected shovedUntil = 0;
    /** Space this monster keeps from its neighbours, on top of their radii */
    protected personalSpace = MOVEMENT.separation;

    private route: Point = { x: 0, y: 0 };
    private heading: Heading = { x: 0, y: 0, direct: true };
    private routeFound = false;
    private nextPlanAt = 0;
    private flashUntil = 0;
    private lastHitEventAt = -Infinity;

    private slowFactor = 1;
    private slowUntil = 0;
    /** The factor the body's velocity is scaled by right now (1 when it is at full speed) */
    private slowApplied = 1;

    /** The push away from neighbours, worked out a few times a second rather than every frame */
    private crowdX = 0;
    private crowdY = 0;
    private nextCrowdAt = 0;

    /** Flyers cast one on the ground beneath them */
    private shadow: Phaser.GameObjects.Ellipse | null = null;
    private nextFaceAt = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, `${def.id}-${world.style}`, 0);
        this.def = def;
        this.health = def.maxHealth;
        this.world = world;
        this.style = world.style;

        scene.add.existing(this);
        scene.physics.add.existing(this);
        // Frame sizes differ between art sets, so the body is fitted to whatever was loaded
        worldScale(this);
        fitCircleBody(this, def.radius);
        this.setDepth(this.flying ? DEPTH.flyer : DEPTH.monster);
        if (this.flying) {
            this.shadow = scene.add
                .ellipse(x, y + FLIGHT.height, def.radius * 2, def.radius, UNDERLAY.color, 0.3)
                .setDepth(DEPTH.shadow);
        }
        this.playMove();
        // Stagger planning so a wave does not re-plan all on the same frame
        this.nextPlanAt = scene.time.now + Math.random() * MOVEMENT.replanEvery;
        this.nextCrowdAt = scene.time.now + Math.random() * MOVEMENT.crowdEvery;
    }

    /**
     * False while touching this monster should not hurt (for example a hidden ghost).
     * Nothing hurts a dashing player; subclasses that override this get that from Player.hurt().
     */
    get hurtsOnTouch(): boolean {
        return !this.playerIsDashing();
    }

    /** True for an enemy that Blue, Red and Green stop at, shielding whatever is behind it */
    get blocksRays(): boolean {
        return false;
    }

    /** True for an enemy that passes over the fountain and the street furniture (walls still stop it) */
    get flying(): boolean {
        return false;
    }

    get isStunned() {
        return this.scene.time.now < this.stunnedUntil;
    }

    get isSlowed() {
        return this.scene.time.now < this.slowUntil;
    }

    update(_time: number, delta: number) {
        const now = this.scene.time.now;
        if (this.flashUntil && now >= this.flashUntil) {
            this.flashUntil = 0;
            this.applyTint();
        }
        if (this.slowUntil && now >= this.slowUntil) {
            this.slowUntil = 0;
            this.slowFactor = 1;
            if (!this.flashUntil) {
                this.applyTint();
            }
        }
        this.shadow?.setPosition(this.x, this.y + FLIGHT.height);

        if (now < this.shovedUntil) {
            return;
        }
        if (now < this.stunnedUntil) {
            this.body.setVelocity(0, 0);
            this.slowApplied = 1;
            return;
        }

        // Behaviours think at full speed; the slow is applied to whatever velocity they ask for
        // and taken off again before they next look at it
        const velocity = this.body.velocity;
        if (this.slowApplied !== 1) {
            velocity.x /= this.slowApplied;
            velocity.y /= this.slowApplied;
            this.slowApplied = 1;
        }
        this.behave(now, delta);
        if (!this.active) {
            return;
        }
        this.faceTravel(now);
        if (this.slowFactor === 1 || now < this.shovedUntil) {
            return;
        }
        velocity.x *= this.slowFactor;
        velocity.y *= this.slowFactor;
        this.slowApplied = this.slowFactor;
    }

    /** Returns false if the radiation did nothing at all (the monster is untouchable right now) */
    takeDamage(type: RayId, amount: number): boolean {
        if (!this.active) {
            return false;
        }
        const multiplier = this.multiplierFor(type);
        if (multiplier <= 0 || !this.active) {
            return false;
        }

        const now = this.scene.time.now;
        if (now - this.lastHitEventAt >= HIT_EVENT_INTERVAL) {
            this.lastHitEventAt = now;
            this.scene.game.events.emit(Events.HIT, this.x, this.y, multiplier);
            this.flashUntil = now + FLASH_MS;
            this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        }

        this.health -= amount * multiplier;
        if (this.health <= 0) {
            this.kill();
        } else {
            this.onHurt(type, now);
        }
        return true;
    }

    /**
     * Move at `factor` of normal speed (0.5 is half) for `duration` milliseconds.
     * Slows do not stack: the strongest one in force wins, and a weaker one never shortens it.
     */
    slow(factor: number, duration: number) {
        if (!this.active || duration <= 0) {
            return;
        }
        const now = this.scene.time.now;
        factor = Phaser.Math.Clamp(factor, SLOWEST, 1);
        const inForce = now < this.slowUntil;
        if (inForce && factor > this.slowFactor) {
            return;
        }
        this.slowUntil = inForce && factor === this.slowFactor ? Math.max(this.slowUntil, now + duration) : now + duration;
        this.slowFactor = factor;
        if (!this.flashUntil) {
            this.applyTint();
        }
    }

    /** Ultraviolet fell on this monster. Stealth enemies are revealed and return true; nothing else cares. */
    exposeToUv(): boolean {
        return false;
    }

    /** Freeze in place for `duration` milliseconds */
    stun(duration: number) {
        if (!this.active) {
            return;
        }
        this.stunnedUntil = Math.max(this.stunnedUntil, this.scene.time.now + duration);
        this.body.setVelocity(0, 0);
        this.slowApplied = 1;
    }

    /** Push away from a point and stop acting for `duration` milliseconds */
    knockback(fromX: number, fromY: number, speed: number, duration: number) {
        if (!this.active) {
            return;
        }
        const angle = Phaser.Math.Angle.Between(fromX, fromY, this.x, this.y);
        this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.slowApplied = 1;
        this.shovedUntil = this.scene.time.now + duration;
    }

    /** Called when this monster's touch has just hurt the player */
    onTouchedPlayer() {
        const { player } = this.world;
        this.knockback(player.x, player.y, MOVEMENT.bounceSpeed, MOVEMENT.bounceDuration);
    }

    /** Arcade physics asks this before stopping the monster at a solid tile centred on (x, y) */
    stoppedBy(x: number, y: number) {
        return !this.flying || this.world.nav.isWall(x, y);
    }

    kill() {
        if (!this.active) {
            return;
        }
        puff(this.scene, this.x, this.y, 0xffffff, this.def.radius > 8 ? 14 : 6, this.def.radius + 8);
        this.scene.game.events.emit(Events.MONSTER_KILLED, this.def.id, this.x, this.y);
        this.destroy();
    }

    /**
     * Go without dying: nothing is counted, written up or dropped. For when the era's clock runs
     * out and whatever is left is swept away. It pops after `delay` milliseconds.
     */
    banish(delay: number, duration: number) {
        if (!this.active) {
            return;
        }
        const scene = this.scene;
        // No longer there to be touched or hit; update() is not called for it again
        this.setActive(false);
        this.body.setVelocity(0, 0);
        this.body.enable = false;
        this.anims.stop();
        scene.tweens.add({
            targets: this,
            delay,
            duration,
            scaleX: this.scaleX * 1.6,
            scaleY: this.scaleY * 1.6,
            alpha: 0,
            ease: 'Quad.easeOut',
            onStart: () => {
                // Even what was hiding is seen for the instant it goes
                this.setAlpha(1).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
                puff(scene, this.x, this.y, 0xffffff, this.def.radius > 8 ? 10 : 5, this.def.radius + 8);
            },
            onComplete: () => this.destroy(),
        });
    }

    destroy(fromScene?: boolean) {
        this.shadow?.destroy();
        this.shadow = null;
        super.destroy(fromScene);
    }

    /** What the monster does when it is free to act. The default is to chase the player. */
    protected behave(now: number, delta: number) {
        this.chase(now, delta, this.def.speed);
    }

    /** Turn to face the way it is travelling */
    private faceTravel(now: number) {
        const vx = this.body.velocity.x;
        if (now < this.nextFaceAt || Math.abs(vx) < TURN_SPEED || vx < 0 === this.flipX) {
            return;
        }
        this.setFlipX(vx < 0);
        this.nextFaceAt = now + TURN_HOLD;
    }

    /** Called when a ray has hurt this monster and it lived */
    protected onHurt(_type: RayId, _now: number) {}

    /** How much a radiation type's damage is scaled; 0 means it does nothing at all */
    protected multiplierFor(type: RayId): number {
        return damageMultiplier(this.def, type);
    }

    /** The tint this monster wears when it is not flashing; null for none */
    protected baseTint(): number | null {
        return null;
    }

    protected applyTint() {
        const tint = this.baseTint() ?? (this.isSlowed ? SLOW_TINT : null);
        this.setTintMode(Phaser.TintModes.MULTIPLY);
        if (tint === null) {
            this.clearTint();
        } else {
            this.setTint(tint);
        }
    }

    /** Redraw this monster in another art style (the boss changes the era mid-fight) */
    setStyle(style: ArtStyle) {
        if (style === this.style || !this.scene.textures.exists(`${this.def.id}-${style}`)) {
            return;
        }
        const index = this.frameIndex();
        const moving = this.anims.isPlaying;
        this.style = style;
        this.anims.stop();
        this.setTexture(`${this.def.id}-${style}`);
        this.showFrame(index);
        // The new sheet may have frames of another size
        worldScale(this);
        fitCircleBody(this, this.def.radius);
        if (moving) {
            this.playMove();
        }
    }

    protected playMove() {
        const key = `${this.def.id}-${this.style}-move`;
        if (this.scene.anims.exists(key)) {
            this.play(key, true);
        }
    }

    /** Show a single frame of the sheet (a wind-up pose); falls back to the first if the sheet is shorter */
    protected showFrame(index: number) {
        this.anims.stop();
        this.setFrame(this.texture.has(String(index)) ? index : 0);
    }

    private frameIndex() {
        const index = Number(this.frame.name);
        return Number.isFinite(index) ? index : 0;
    }

    protected playerIsDashing() {
        return this.world.player.isDashing;
    }

    protected distanceToPlayer() {
        const { player } = this.world;
        return Math.hypot(player.x - this.x, player.y - this.y);
    }

    protected angleToPlayer() {
        const { player } = this.world;
        return Math.atan2(player.y - this.y, player.x - this.x);
    }

    /** The width it plans its route for; a big body may plan narrower than it is and nudge through */
    protected get planRadius() {
        return this.def.radius;
    }

    /** True if nothing solid lies between this monster's centre and the player's */
    protected seesPlayer() {
        const { player, nav } = this.world;
        return nav.canWalk(this.x, this.y, player.x, player.y, 0);
    }

    /**
     * The point to head for right now to get to the player, re-planned a few times a second.
     * `direct` is true when the player can be reached in a straight line. The object returned
     * is reused on the next call.
     */
    protected routeToPlayer(now: number): Heading {
        if (now >= this.nextPlanAt) {
            this.nextPlanAt = now + MOVEMENT.replanEvery;
            this.routeFound = this.world.nav.waypoint(this.x, this.y, this.planRadius, this.route, this.flying);
        }
        const { goal } = this.world.nav;
        const direct = !this.routeFound || (this.route.x === goal.x && this.route.y === goal.y);
        // When the way is clear, follow the player's live position, not the planned one
        const heading = this.heading;
        heading.x = direct ? goal.x : this.route.x;
        heading.y = direct ? goal.y : this.route.y;
        heading.direct = direct;
        return heading;
    }

    protected chase(now: number, delta: number, speed: number) {
        const target = this.routeToPlayer(now);
        this.walkTowards(target.x, target.y, speed, delta);
    }

    protected walkTowards(x: number, y: number, speed: number, delta: number) {
        const distance = Math.hypot(x - this.x, y - this.y);
        if (distance < 0.5) {
            this.steer(0, 0, delta);
            return;
        }
        this.steer(((x - this.x) / distance) * speed, ((y - this.y) / distance) * speed, delta);
    }

    /** Ease towards a velocity, nudged away from any neighbours that are too close */
    protected steer(vx: number, vy: number, delta: number) {
        const speed = Math.hypot(vx, vy);
        const now = this.scene.time.now;
        if (now >= this.nextCrowdAt) {
            this.nextCrowdAt = now + MOVEMENT.crowdEvery;
            this.feelCrowd();
        }

        const push = Math.max(speed, this.def.speed) * MOVEMENT.separationStrength;
        let targetX = vx + this.crowdX * push;
        let targetY = vy + this.crowdY * push;
        // Being pushed must not make a monster faster than it was trying to go
        const limit = Math.max(speed, this.def.speed * 0.5);
        const length = Math.hypot(targetX, targetY);
        if (length > limit) {
            targetX = (targetX / length) * limit;
            targetY = (targetY / length) * limit;
        }

        const blend = 1 - Math.exp(-delta / MOVEMENT.turnTime);
        const velocity = this.body.velocity;
        this.body.setVelocity(
            velocity.x + (targetX - velocity.x) * blend,
            velocity.y + (targetY - velocity.y) * blend,
        );
    }

    /** Work out which way the neighbours are pushing. Flyers and walkers do not crowd each other. */
    private feelCrowd() {
        let pushX = 0;
        let pushY = 0;
        const flying = this.flying;
        const radius = this.def.radius + this.personalSpace;
        const others = this.world.monsters.getChildren();
        for (let i = 0; i < others.length; i++) {
            const other = others[i] as Monster;
            if (other === this || !other.active) {
                continue;
            }
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const reach = radius + other.def.radius;
            // Most of a crowd is nowhere near: reject those before any multiplying
            if (dx >= reach || dx <= -reach || dy >= reach || dy <= -reach) {
                continue;
            }
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq >= reach * reach || distanceSq === 0 || other.flying !== flying) {
                continue;
            }
            const distance = Math.sqrt(distanceSq);
            const strength = (reach - distance) / (reach * distance);
            pushX += dx * strength;
            pushY += dy * strength;
        }
        this.crowdX = pushX;
        this.crowdY = pushY;
    }
}
