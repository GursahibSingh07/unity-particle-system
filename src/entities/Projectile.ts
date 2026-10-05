import Phaser from 'phaser';
import { PROJECTILE } from '../config/monsters';
import { fitCircleBody, worldScale } from '../systems/artScale';
import type { ArtStyle } from '../types';
import { DEPTH, UNDERLAY, puff } from './effects';
import type { Monster } from './Monster';
import type { Player } from './Player';

export type ProjectileKind = 'lump' | 'snowball' | 'acid' | 'shard';

/** Frame of `projectiles-{style}` for each kind (docs/DESIGN.md section 9) */
const FRAMES: Record<ProjectileKind, number> = { lump: 0, snowball: 1, acid: 2, shard: 3 };
/** Until the v2 sheet exists every kind is the one old orb, told apart by colour */
const STAND_IN_TINT: Record<ProjectileKind, number | null> = {
    lump: null,
    snowball: 0xcdefff,
    acid: 0x9be35a,
    shard: 0xff9ae4,
};
/** A projectile that breaks on a wall leaves its mark this far back from it, on the floor */
const WALL_SETBACK = 6;

export interface ProjectileOptions {
    kind?: ProjectileKind;
    /** A straight shot lands after flying this far */
    range?: number;
    /**
     * Thrown in an arc onto this spot, taking `flight` milliseconds. It passes over everything and
     * touches nothing until it lands; `angle` and `speed` are ignored. A marker shows the spot.
     */
    lobTo?: { x: number; y: number };
    flight?: number;
    /** Colour of the landing marker */
    markerColor?: number;
    markerRadius?: number;
    /** Called where it lands or breaks (to leave ice or acid). Never called once it is deflected. */
    onEnd?: (x: number, y: number) => void;
}

/** An enemy that wants a say in what a pushed-back projectile does to it */
interface DeflectTarget {
    /** Returns false if it passed straight through */
    hitByDeflected?(damage: number): boolean;
}

/** Something thrown at the player. Breaks on walls and props; White pushes it back at the enemy. */
export class Projectile extends Phaser.GameObjects.Sprite {
    declare body: Phaser.Physics.Arcade.Body;

    readonly damage: number;
    readonly kind: ProjectileKind;
    /** Pushed away by White: no longer a threat to the player, and it hurts the enemies it hits */
    deflected = false;

    private expiresAt: number;
    /** When a straight shot with a range comes down; 0 for none */
    private landAt = 0;
    private onEnd: ((x: number, y: number) => void) | undefined;
    /** Unit vector it was thrown along */
    private dirX: number;
    private dirY: number;

    // Lobbed shots only
    private lobbed = false;
    private lobFrom = { x: 0, y: 0 };
    private lobTo = { x: 0, y: 0 };
    private lobStart = 0;
    private lobFlight = 1;
    private marker: Phaser.GameObjects.Arc | null = null;

    constructor(
        scene: Phaser.Scene,
        group: Phaser.Physics.Arcade.Group,
        x: number,
        y: number,
        angle: number,
        speed: number,
        damage: number,
        style: ArtStyle,
        options: ProjectileOptions = {},
    ) {
        super(scene, x, y, '__DEFAULT');
        this.damage = damage;
        this.kind = options.kind ?? 'lump';
        this.onEnd = options.onEnd;
        this.dirX = Math.cos(angle);
        this.dirY = Math.sin(angle);
        const now = scene.time.now;
        this.expiresAt = now + PROJECTILE.lifetime;

        // A bullet hell must not grow without limit: the oldest shot makes room
        if (group.getLength() >= PROJECTILE.cap) {
            (group.getChildren()[0] as Projectile).dissolve();
        }

        this.setStyle(style);
        scene.add.existing(this);
        // Joining the group creates the body; velocity has to be set afterwards
        group.add(this);
        worldScale(this);
        fitCircleBody(this, PROJECTILE.radius);
        this.setDepth(DEPTH.projectile);

        if (options.lobTo) {
            this.lobbed = true;
            this.lobFrom = { x, y };
            this.lobTo = { x: options.lobTo.x, y: options.lobTo.y };
            this.lobStart = now;
            this.lobFlight = Math.max(1, options.flight ?? 800);
            this.expiresAt = now + this.lobFlight + 1000;
            // In the air it is out of reach of the player, the walls and everything else
            this.body.checkCollision.none = true;
            this.addMarker(options.markerColor ?? 0xffffff, options.markerRadius ?? 8);
        } else {
            this.body.setVelocity(this.dirX * speed, this.dirY * speed);
            this.setRotation(angle);
            if (options.range !== undefined && speed > 0) {
                this.landAt = now + (options.range / speed) * 1000;
            }
        }
    }

    /** True while a lobbed shot is still in the air */
    get airborne() {
        return this.lobbed;
    }

    update() {
        const now = this.scene.time.now;
        if (this.lobbed) {
            const t = (now - this.lobStart) / this.lobFlight;
            if (t >= 1) {
                this.lobbed = false;
                this.setPosition(this.lobTo.x, this.lobTo.y);
                this.shatter();
                return;
            }
            const rise = Math.sin(t * Math.PI);
            this.setPosition(
                Phaser.Math.Linear(this.lobFrom.x, this.lobTo.x, t),
                Phaser.Math.Linear(this.lobFrom.y, this.lobTo.y, t) - rise * PROJECTILE.lobHeight,
            );
            worldScale(this, 1 + rise * 0.5);
            return;
        }
        if (this.landAt && now >= this.landAt) {
            this.shatter();
        } else if (now >= this.expiresAt) {
            this.dissolve();
        }
    }

    /** Redraw in another art style (the boss changes the era mid-fight) */
    setStyle(style: ArtStyle) {
        const sheet = `projectiles-${style}`;
        if (this.scene.textures.exists(sheet)) {
            this.setTexture(sheet, FRAMES[this.kind]);
        } else if (this.scene.textures.exists(`projectile-${style}`)) {
            this.setTexture(`projectile-${style}`, 0);
            const tint = STAND_IN_TINT[this.kind];
            if (this.deflected) {
                return;
            }
            // Manga has no colours to tell them apart by
            if (tint !== null && style !== 'manga') {
                this.setTint(tint);
            } else {
                this.clearTint();
            }
        }
    }

    /**
     * White pushes it away from a point. From then on it is no threat to the player, leaves
     * nothing on the floor, and hurts the first enemy it runs into.
     */
    deflect(fromX: number, fromY: number, speed: number) {
        if (!this.active) {
            return;
        }
        if (this.lobbed) {
            // Knocked out of the air: it carries on along the ground from where it was over
            const t = Phaser.Math.Clamp((this.scene.time.now - this.lobStart) / this.lobFlight, 0, 1);
            this.lobbed = false;
            this.setPosition(
                Phaser.Math.Linear(this.lobFrom.x, this.lobTo.x, t),
                Phaser.Math.Linear(this.lobFrom.y, this.lobTo.y, t),
            );
            worldScale(this);
            this.body.reset(this.x, this.y);
            this.body.checkCollision.none = false;
        }
        this.removeMarker();

        let angle = Phaser.Math.Angle.Between(fromX, fromY, this.x, this.y);
        if (this.x === fromX && this.y === fromY) {
            angle = Math.atan2(-this.dirY, -this.dirX);
        }
        this.dirX = Math.cos(angle);
        this.dirY = Math.sin(angle);
        this.body.setVelocity(this.dirX * speed, this.dirY * speed);
        this.setRotation(angle);

        this.deflected = true;
        this.onEnd = undefined;
        this.landAt = 0;
        this.expiresAt = this.scene.time.now + PROJECTILE.deflectedLifetime;
        // Turned to light: it is the player's now
        this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    }

    /** Called when it overlaps the player. A dashing player passes straight through. */
    hitPlayer(player: Player) {
        if (!this.active || this.deflected || this.lobbed) {
            return;
        }
        if ((player as unknown as { isDashing?: boolean }).isDashing === true) {
            return;
        }
        player.hurt(this.damage);
        this.shatter();
    }

    /** Called when it overlaps an enemy. Only a deflected projectile does anything. */
    hitMonster(monster: Monster) {
        if (!this.active || !this.deflected || !monster.active) {
            return;
        }
        const target = monster as Monster & DeflectTarget;
        const landed = target.hitByDeflected
            ? target.hitByDeflected(PROJECTILE.deflectDamage)
            : monster.takeDamage('white', PROJECTILE.deflectDamage);
        // A hidden ghost is not there to be hit
        if (landed) {
            this.shatter();
        }
    }

    /** Break apart where it is: on a wall, on the player, or on landing */
    shatter() {
        if (!this.active || this.lobbed) {
            return;
        }
        const onEnd = this.onEnd;
        this.onEnd = undefined;
        let { x, y } = this;
        if (onEnd && !this.body.blocked.none) {
            x -= this.dirX * WALL_SETBACK;
            y -= this.dirY * WALL_SETBACK;
        }
        puff(this.scene, this.x, this.y, 0xffffff, 4, 6);
        this.destroy();
        onEnd?.(x, y);
    }

    /** Vanish and leave nothing behind, for when the room is being cleared up */
    dissolve() {
        if (!this.active) {
            return;
        }
        this.onEnd = undefined;
        this.destroy();
    }

    destroy(fromScene?: boolean) {
        this.removeMarker();
        super.destroy(fromScene);
    }

    private addMarker(color: number, radius: number) {
        const marker = this.scene.add
            .circle(this.lobTo.x, this.lobTo.y, radius, color, 0.4)
            .setStrokeStyle(1.5, UNDERLAY.color, 0.9)
            .setDepth(DEPTH.pickup)
            .setScale(0.35);
        this.marker = marker;
        // It fills out as the shot comes down, so the size says how long is left
        this.scene.tweens.add({ targets: marker, scale: 1, duration: this.lobFlight });
    }

    private removeMarker() {
        if (this.marker) {
            this.scene?.tweens.killTweensOf(this.marker);
            this.marker.destroy();
            this.marker = null;
        }
    }
}
