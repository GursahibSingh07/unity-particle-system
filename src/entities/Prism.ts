import Phaser from 'phaser';
import { PRISM } from '../config/monsters';
import { RADIATIONS } from '../config/radiation';
import { Events } from '../events';
import type { MonsterDef, RadiationId } from '../types';
import { closingRing, puff } from './effects';
import { Monster, type MonsterWorld } from './Monster';
import { Projectile } from './Projectile';

const WEAK = 2;
const RESIST = 0.25;
const HIDDEN_ALPHA = 0.07;
const WINDUP_ALPHA = 0.6;

type Action = 'move' | 'windup' | 'attack' | 'recover' | 'shift';

/**
 * The boss. Four phases, each weak to one radiation (its colour shows which) and each
 * fighting like the monster that shares that weakness.
 */
export class Prism extends Monster {
    /** 0 to 3 */
    phase = 0;

    private action: Action = 'shift';
    private actionUntil: number;
    private nextAttackAt = 0;
    private attackAngle = 0;
    private volleys = 0;
    private revealedUntil = 0;
    /** True while a `recover` is the retreat after touching the player */
    private backingOff = false;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        // Opens with the same pause as a phase change, so the fight never starts with a hit
        this.actionUntil = scene.time.now + PRISM.phaseShift;
        this.applyTint();
        scene.game.events.emit(Events.BOSS_PHASE, 1, this.weakness);
    }

    get weakness(): RadiationId {
        return PRISM.phases[this.phase].weakTo;
    }

    /** True while it cannot be seen or hurt (Ultraviolet phase, until revealed) */
    get hidden() {
        return this.weakness === 'ultraviolet' && this.action !== 'shift' && !this.revealed;
    }

    get hurtsOnTouch() {
        // Invisible contact damage would be unfair: only the dash itself hurts
        if (this.weakness === 'ultraviolet') {
            return this.action === 'attack';
        }
        return this.action !== 'shift' && this.action !== 'recover';
    }

    private get revealed() {
        return this.scene.time.now < this.revealedUntil;
    }

    /** Health at which the current phase ends */
    private get phaseFloor() {
        let floor = 0;
        for (let i = this.phase + 1; i < PRISM.phases.length; i++) {
            floor += PRISM.phases[i].health;
        }
        return floor;
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.active) {
            this.updateAlpha(this.scene.time.now);
        }
    }

    takeDamage(type: RadiationId, amount: number): boolean {
        if (this.action === 'shift') {
            return false;
        }
        if (type === 'ultraviolet' && this.weakness === 'ultraviolet') {
            this.reveal();
        }

        const last = this.phase === PRISM.phases.length - 1;
        const floor = this.phaseFloor;
        // Damage does not spill into the next phase, however big the hit
        const multiplier = this.multiplierFor(type);
        const room = multiplier > 0 ? (this.health - floor) / multiplier : 0;
        const landed = super.takeDamage(type, last ? amount : Math.min(amount, room));
        if (this.active && !last && this.health <= floor + 0.001) {
            this.health = floor;
            this.nextPhase();
        }
        return landed;
    }

    // Far too heavy to push around
    knockback() {}

    onTouchedPlayer() {
        // It draws back rather than grinding the player into a corner
        this.body.setVelocity(0, 0);
        this.action = 'recover';
        this.backingOff = true;
        this.actionUntil = this.scene.time.now + PRISM.touchRecover;
    }

    kill() {
        // Its swarm goes with it
        for (const child of this.world.monsters.getChildren().slice()) {
            if (child !== this && child.active) {
                (child as Monster).kill();
            }
        }
        for (const projectile of this.world.projectiles.getChildren().slice()) {
            (projectile as Projectile).shatter();
        }
        super.kill();
    }

    protected multiplierFor(type: RadiationId): number {
        if (this.hidden) {
            return 0;
        }
        return type === this.weakness ? WEAK : RESIST;
    }

    protected baseTint() {
        return RADIATIONS[this.weakness].color;
    }

    protected behave(now: number, delta: number) {
        if (this.action === 'shift') {
            this.body.setVelocity(0, 0);
            if (now >= this.actionUntil) {
                this.action = 'move';
                this.nextAttackAt = now + 1200;
            }
            return;
        }
        if (this.action === 'recover') {
            if (this.backingOff) {
                // Away from the player, so someone standing still is not hit again at once
                const away = this.angleToPlayer() + Math.PI;
                this.steer(Math.cos(away) * PRISM.backOffSpeed, Math.sin(away) * PRISM.backOffSpeed, delta);
            } else {
                this.steer(0, 0, delta);
            }
            if (now >= this.actionUntil) {
                this.action = 'move';
                this.backingOff = false;
            }
            return;
        }

        switch (this.weakness) {
            case 'radio':
                this.summonPhase(now, delta);
                break;
            case 'infrared':
                this.chargePhase(now, delta, PRISM.chaseSpeed, PRISM.chargeRange, {
                    windup: PRISM.chargeWindup,
                    speed: PRISM.chargeSpeed,
                    duration: PRISM.chargeDuration,
                    recover: 500,
                    cooldown: PRISM.chargeCooldown,
                });
                break;
            case 'ultraviolet':
                this.chargePhase(now, delta, PRISM.stalkSpeed, PRISM.dashRange, {
                    windup: PRISM.dashWindup,
                    speed: PRISM.dashSpeed,
                    duration: PRISM.dashDuration,
                    recover: PRISM.dashRecover,
                    cooldown: 0,
                });
                break;
            case 'gamma':
                this.volleyPhase(now, delta);
                break;
        }
    }

    private nextPhase() {
        const now = this.scene.time.now;
        this.phase++;
        this.action = 'shift';
        this.backingOff = false;
        this.actionUntil = now + PRISM.phaseShift;
        this.revealedUntil = 0;
        this.stunnedUntil = 0;
        this.volleys = 0;
        this.body.setVelocity(0, 0);
        this.applyTint();
        puff(this.scene, this.x, this.y, this.baseTint(), 12, 26);
        this.scene.game.events.emit(Events.BOSS_PHASE, this.phase + 1, this.weakness);
    }

    private startWindup(now: number, duration: number) {
        this.action = 'windup';
        this.actionUntil = now + duration;
        this.attackAngle = this.angleToPlayer();
        closingRing(this.scene, this.x, this.y, this.def.radius + 8, this.baseTint(), duration);
        this.scene.game.events.emit(Events.MONSTER_WINDUP, this.def.id, this.x, this.y);
    }

    /** Radio phase: drift after the player, calling swarmlets */
    private summonPhase(now: number, delta: number) {
        if (this.action === 'windup') {
            this.steer(0, 0, delta);
            if (now >= this.actionUntil) {
                const offset = Math.random() * Math.PI * 2;
                for (let i = 0; i < PRISM.summonCount; i++) {
                    const angle = offset + (i / PRISM.summonCount) * Math.PI * 2;
                    this.world.summon(
                        'swarmlet',
                        this.x + Math.cos(angle) * PRISM.summonRadius,
                        this.y + Math.sin(angle) * PRISM.summonRadius,
                    );
                }
                this.action = 'move';
                this.nextAttackAt = now + PRISM.summonCooldown;
            }
            return;
        }

        this.chase(now, delta, this.def.speed);
        // Its own body counts as one member of the group
        const minions = this.world.monsters.countActive(true) - 1;
        if (now >= this.nextAttackAt && minions + PRISM.summonCount <= PRISM.summonLimit) {
            this.startWindup(now, PRISM.summonWindup);
        }
    }

    /** Infrared and Ultraviolet phases: close in, then rush in a straight line */
    private chargePhase(
        now: number,
        delta: number,
        walkSpeed: number,
        range: number,
        rush: { windup: number; speed: number; duration: number; recover: number; cooldown: number },
    ) {
        switch (this.action) {
            case 'windup':
                this.steer(0, 0, delta);
                if (now >= this.actionUntil) {
                    this.action = 'attack';
                    this.actionUntil = now + rush.duration;
                    this.body.setVelocity(
                        Math.cos(this.attackAngle) * rush.speed,
                        Math.sin(this.attackAngle) * rush.speed,
                    );
                }
                break;
            case 'attack':
                if (now >= this.actionUntil || this.body.velocity.lengthSq() < 100) {
                    this.action = 'recover';
                    this.backingOff = false;
                    this.actionUntil = now + rush.recover;
                    this.nextAttackAt = now + rush.recover + rush.cooldown;
                }
                break;
            default:
                if (now >= this.nextAttackAt && this.distanceToPlayer() <= range && this.seesPlayer()) {
                    this.startWindup(now, rush.windup);
                } else {
                    this.chase(now, delta, walkSpeed);
                }
        }
    }

    /** Gamma phase: hold a distance and throw fans and rings of projectiles */
    private volleyPhase(now: number, delta: number) {
        if (this.action === 'windup') {
            this.steer(0, 0, delta);
            if (now >= this.actionUntil) {
                this.throwVolley();
                this.action = 'move';
                this.nextAttackAt = now + PRISM.volleyCooldown;
            }
            return;
        }

        if (now >= this.nextAttackAt) {
            this.startWindup(now, PRISM.volleyWindup);
            return;
        }

        const distance = this.distanceToPlayer();
        if (distance > PRISM.farRange) {
            this.chase(now, delta, this.def.speed);
        } else if (distance < PRISM.nearRange) {
            const away = this.angleToPlayer() + Math.PI;
            this.steer(Math.cos(away) * this.def.speed, Math.sin(away) * this.def.speed, delta);
        } else {
            this.steer(0, 0, delta);
        }
    }

    private throwVolley() {
        this.volleys++;
        const angles: number[] = [];
        if (this.volleys % 3 === 0) {
            for (let i = 0; i < PRISM.ringCount; i++) {
                angles.push((i / PRISM.ringCount) * Math.PI * 2);
            }
        } else {
            // Aimed where the player is now, not where they were when the wind-up began
            const aim = this.angleToPlayer();
            const spread = Phaser.Math.DegToRad(PRISM.volleySpread);
            for (let i = 0; i < PRISM.volleyCount; i++) {
                angles.push(aim + (i - (PRISM.volleyCount - 1) / 2) * spread);
            }
        }

        const { world } = this;
        for (const angle of angles) {
            new Projectile(
                this.scene,
                world.projectiles,
                this.x + Math.cos(angle) * this.def.radius,
                this.y + Math.sin(angle) * this.def.radius,
                angle,
                PRISM.projectileSpeed,
                PRISM.projectileDamage,
                world.style,
            );
        }
    }

    private reveal() {
        // Only the flash that finds it stuns it; once visible it fights on until it fades again
        if (this.revealed) {
            return;
        }
        const now = this.scene.time.now;
        this.action = 'move';
        this.revealedUntil = now + PRISM.stunDuration + PRISM.revealLinger;
        this.stun(PRISM.stunDuration);
    }

    private updateAlpha(now: number) {
        if (this.action === 'shift') {
            this.setAlpha(Math.floor(now / 90) % 2 === 0 ? 1 : 0.55);
        } else if (this.weakness !== 'ultraviolet') {
            this.setAlpha(1);
        } else if (this.revealed) {
            const left = this.revealedUntil - now;
            this.setAlpha(left < 500 && Math.floor(now / 70) % 2 === 0 ? 0.5 : 1);
        } else if (this.action === 'windup') {
            this.setAlpha(Math.floor(now / 60) % 2 === 0 ? WINDUP_ALPHA : WINDUP_ALPHA * 0.5);
        } else if (this.action === 'attack') {
            this.setAlpha(WINDUP_ALPHA);
        } else {
            const glint = Math.max(0, Math.sin(now / 240) - 0.75) / 0.25;
            this.setAlpha(Phaser.Math.Linear(HIDDEN_ALPHA, 0.2, glint));
        }
    }
}
