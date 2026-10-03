import Phaser from 'phaser';
import { MOVEMENT } from '../config/monsters';
import { Events } from '../events';
import { damageMultiplier } from '../systems/Combat';
import type { Navigator, Point } from '../systems/Navigation';
import type { Rect } from '../systems/roomLayout';
import type { ArtStyle, Damageable, MonsterDef, MonsterId, RadiationId } from '../types';
import { DEPTH, puff } from './effects';
import type { Player } from './Player';

const FLASH_MS = 70;
/** Continuous beams hit every frame; this keeps the HIT event (and its sound) from machine-gunning */
const HIT_EVENT_INTERVAL = 140;

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
    private routeFound = false;
    private nextPlanAt = 0;
    private flashUntil = 0;
    private lastHitEventAt = -Infinity;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, `${def.id}-${world.style}`, 0);
        this.def = def;
        this.health = def.maxHealth;
        this.world = world;
        this.style = world.style;

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCircle(def.radius, this.width / 2 - def.radius, this.height / 2 - def.radius);
        this.setDepth(DEPTH.monster);
        this.playMove();
        // Stagger planning so a wave does not re-plan all on the same frame
        this.nextPlanAt = scene.time.now + Math.random() * MOVEMENT.replanEvery;
    }

    /** False while touching this monster should not hurt (for example a hidden Shade) */
    get hurtsOnTouch() {
        return true;
    }

    get isStunned() {
        return this.scene.time.now < this.stunnedUntil;
    }

    update(_time: number, delta: number) {
        const now = this.scene.time.now;
        if (this.flashUntil && now >= this.flashUntil) {
            this.flashUntil = 0;
            this.applyTint();
        }

        if (now < this.shovedUntil) {
            return;
        }
        if (now < this.stunnedUntil) {
            this.body.setVelocity(0, 0);
            return;
        }
        this.behave(now, delta);
    }

    /** Returns false if the radiation did nothing at all (the monster is untouchable right now) */
    takeDamage(type: RadiationId, amount: number): boolean {
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
        }
        return true;
    }

    /** Freeze in place for `duration` milliseconds */
    stun(duration: number) {
        this.stunnedUntil = Math.max(this.stunnedUntil, this.scene.time.now + duration);
        this.body.setVelocity(0, 0);
    }

    /** Push away from a point and stop acting for `duration` milliseconds */
    knockback(fromX: number, fromY: number, speed: number, duration: number) {
        const angle = Phaser.Math.Angle.Between(fromX, fromY, this.x, this.y);
        this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.shovedUntil = this.scene.time.now + duration;
    }

    /** Called when this monster's touch has just hurt the player */
    onTouchedPlayer() {
        const { player } = this.world;
        this.knockback(player.x, player.y, MOVEMENT.bounceSpeed, MOVEMENT.bounceDuration);
    }

    kill() {
        if (!this.active) {
            return;
        }
        puff(this.scene, this.x, this.y, 0xffffff, this.def.radius > 8 ? 14 : 6, this.def.radius + 8);
        this.scene.game.events.emit(Events.MONSTER_KILLED, this.def.id, this.x, this.y);
        this.destroy();
    }

    /** What the monster does when it is free to act. The default is to chase the player. */
    protected behave(now: number, delta: number) {
        this.chase(now, delta, this.def.speed);
    }

    /** How much a radiation type's damage is scaled; 0 means it does nothing at all */
    protected multiplierFor(type: RadiationId): number {
        return damageMultiplier(this.def, type);
    }

    /** The tint this monster wears when it is not flashing; null for none */
    protected baseTint(): number | null {
        return null;
    }

    protected applyTint() {
        const tint = this.baseTint();
        this.setTintMode(Phaser.TintModes.MULTIPLY);
        if (tint === null) {
            this.clearTint();
        } else {
            this.setTint(tint);
        }
    }

    /** Redraw this monster in another art style (the boss page changes style mid-fight) */
    setStyle(style: ArtStyle) {
        if (style === this.style) {
            return;
        }
        const frame = this.frame.name;
        const moving = this.anims.isPlaying;
        this.style = style;
        this.anims.stop();
        this.setTexture(`${this.def.id}-${style}`, frame);
        if (moving) {
            this.playMove();
        }
    }

    protected playMove() {
        this.play(`${this.def.id}-${this.style}-move`, true);
    }

    protected distanceToPlayer() {
        const { player } = this.world;
        return Math.hypot(player.x - this.x, player.y - this.y);
    }

    protected angleToPlayer() {
        const { player } = this.world;
        return Math.atan2(player.y - this.y, player.x - this.x);
    }

    /** True if nothing solid lies between this monster's centre and the player's */
    protected seesPlayer() {
        const { player, nav } = this.world;
        return nav.canWalk(this.x, this.y, player.x, player.y, 0);
    }

    /**
     * The point to walk towards right now to get to the player, re-planned a few times a second.
     * `direct` is true when the player can be reached in a straight line.
     */
    protected routeToPlayer(now: number) {
        if (now >= this.nextPlanAt) {
            this.nextPlanAt = now + MOVEMENT.replanEvery;
            this.routeFound = this.world.nav.waypoint(this.x, this.y, this.def.radius, this.route);
        }
        const { goal } = this.world.nav;
        const direct = !this.routeFound || (this.route.x === goal.x && this.route.y === goal.y);
        // When the way is clear, follow the player's live position, not the planned one
        return { x: direct ? goal.x : this.route.x, y: direct ? goal.y : this.route.y, direct };
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
        let pushX = 0;
        let pushY = 0;
        for (const child of this.world.monsters.getChildren()) {
            const other = child as Monster;
            if (other === this || !other.active) {
                continue;
            }
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const reach = this.def.radius + other.def.radius + this.personalSpace;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq >= reach * reach || distanceSq === 0) {
                continue;
            }
            const distance = Math.sqrt(distanceSq);
            const strength = (reach - distance) / reach;
            pushX += (dx / distance) * strength;
            pushY += (dy / distance) * strength;
        }

        const push = Math.max(speed, this.def.speed) * MOVEMENT.separationStrength;
        let targetX = vx + pushX * push;
        let targetY = vy + pushY * push;
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
}
