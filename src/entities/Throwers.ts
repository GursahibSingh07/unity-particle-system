import Phaser from 'phaser';
import { ACID_SLIME, HAZARD, SNOWMAN } from '../config/monsters';
import { Events } from '../events';
import type { MonsterDef } from '../types';
import { closingRing } from './effects';
import { Hazards } from './Hazard';
import type { MonsterWorld } from './Monster';
import { Projectile } from './Projectile';
import { StandInMonster } from './StandIn';

const WINDUP_FRAME = 2;

interface ThrowerTuning {
    /** It tries to stay between these distances from the player */
    nearRange: number;
    farRange: number;
    windup: number;
    cooldown: number;
    /** First throw comes this long after it appears */
    firstThrow: number;
}

/**
 * The projectile class: keeps its distance, circles, and throws after an obvious wind-up.
 * What it throws, and what that leaves on the floor, is up to the subclass.
 */
abstract class Thrower extends StandInMonster {
    private windingUntil = 0;
    private nextThrowAt: number;
    private strafe = Math.random() < 0.5 ? 1 : -1;
    private nextTurnAt = 0;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        def: MonsterDef,
        world: MonsterWorld,
        private tuning: ThrowerTuning,
    ) {
        super(scene, x, y, def, world);
        this.nextThrowAt = scene.time.now + tuning.firstThrow + Math.random() * 600;
    }

    get isWindingUp() {
        return this.windingUntil > 0;
    }

    stun(duration: number) {
        if (!this.active) {
            return;
        }
        super.stun(duration);
        this.cancelWindup();
    }

    knockback(fromX: number, fromY: number, speed: number, duration: number) {
        if (!this.active) {
            return;
        }
        super.knockback(fromX, fromY, speed, duration);
        this.cancelWindup();
    }

    /** True when the player is somewhere this one could throw at */
    protected abstract canThrow(sees: boolean, distance: number): boolean;
    protected abstract release(): void;

    protected behave(now: number, delta: number) {
        const { tuning } = this;
        if (this.windingUntil > 0) {
            this.body.setVelocity(0, 0);
            if (now >= this.windingUntil) {
                this.release();
                this.nextThrowAt = now + tuning.cooldown + Phaser.Math.Between(-200, 300);
                this.cancelWindup();
            }
            return;
        }

        const sees = this.seesPlayer();
        const distance = this.distanceToPlayer();
        if (now >= this.nextThrowAt && this.canThrow(sees, distance)) {
            this.windingUntil = now + tuning.windup;
            this.showFrame(WINDUP_FRAME);
            closingRing(this.scene, this.x, this.y, this.def.radius + 5, this.def.color, tuning.windup);
            this.scene.game.events.emit(Events.MONSTER_WINDUP, this.def.id, this.x, this.y);
            return;
        }

        if (!sees || distance > tuning.farRange) {
            this.chase(now, delta, this.def.speed);
        } else if (distance < tuning.nearRange) {
            const away = this.angleToPlayer() + Math.PI;
            this.steer(Math.cos(away) * this.def.speed, Math.sin(away) * this.def.speed, delta);
        } else {
            // In range: circle slowly so it is not a sitting target
            const side = this.angleToPlayer() + (Math.PI / 2) * this.strafe;
            if (!this.body.blocked.none && now >= this.nextTurnAt) {
                // Walked into something: go round the other way, but do not dither against it
                this.strafe = -this.strafe;
                this.nextTurnAt = now + 800;
            }
            this.steer(Math.cos(side) * this.def.speed * 0.6, Math.sin(side) * this.def.speed * 0.6, delta);
        }
    }

    private cancelWindup() {
        if (this.windingUntil > 0) {
            this.windingUntil = 0;
            this.playMove();
        }
    }
}

/** Throws snowballs that come down where the player was standing and leave ice there */
export class Snowman extends Thrower {
    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world, SNOWMAN);
    }

    protected canThrow(sees: boolean) {
        return sees;
    }

    protected release() {
        const { world, scene } = this;
        new Projectile(
            scene,
            world.projectiles,
            this.x,
            this.y,
            this.angleToPlayer(),
            SNOWMAN.projectileSpeed,
            SNOWMAN.projectileDamage,
            world.style,
            {
                kind: 'snowball',
                range: this.distanceToPlayer() + SNOWMAN.overshoot,
                onEnd: (x, y) => Hazards.of(scene)?.add('ice', x, y),
            },
        );
    }
}

/** A bloated slime that lobs acid over everything onto the spot where the player stands */
export class AcidSlime extends Thrower {
    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world, ACID_SLIME);
    }

    // The arc clears props and the fountain, so it does not need to see him
    protected canThrow(_sees: boolean, distance: number) {
        return distance <= ACID_SLIME.farRange * 1.25;
    }

    protected release() {
        const { world, scene } = this;
        const { player } = world;
        new Projectile(scene, world.projectiles, this.x, this.y, this.angleToPlayer(), 0, 0, world.style, {
            kind: 'acid',
            lobTo: { x: player.x, y: player.y + 3 },
            flight: ACID_SLIME.flight,
            markerColor: this.def.color,
            markerRadius: HAZARD.acid.radius,
            onEnd: (x, y) => Hazards.of(scene)?.add('acid', x, y),
        });
    }
}
