import Phaser from 'phaser';
import { MONSTERS, PRISM } from '../config/monsters';
import { Events } from '../events';
import { worldScale } from '../systems/artScale';
import { segmentClear } from '../systems/Navigation';
import type { ArtStyle, MonsterDef, RayId } from '../types';
import { DEPTH, UNDERLAY, closingRing, puff } from './effects';
import { Monster, type MonsterWorld } from './Monster';
import { Projectile } from './Projectile';

type Action = 'intro' | 'approach' | 'windup' | 'dash' | 'recover' | 'telegraph' | 'swap';

const WINDUP_FRAME = 2;
/** Frame of `era-icons` for each era (docs/DESIGN.md section 9) */
const ERA_ICON: Partial<Record<ArtStyle, number>> = { goldenAge: 0, cyberpunk: 1, retro: 2, manga: 3 };
/** The colour each era is announced in, over its head and in its wind-up rings */
const ERA_COLOR: Record<ArtStyle, number> = {
    goldenAge: 0xffd23f,
    cyberpunk: 0x3ff0ff,
    retro: 0x9a7b4f,
    manga: 0xffffff,
    plain: 0xffffff,
};
/** The ray that says most about each era, sent with BOSS_PHASE for anything still listening to it */
const ERA_RAY: Record<ArtStyle, RayId> = {
    goldenAge: 'blue',
    cyberpunk: 'green',
    retro: 'uv',
    manga: 'white',
    plain: 'blue',
};
/** How far above its centre the coming era is shown */
const BADGE_LIFT = 11;
const BADGE_RADIUS = 5;

/**
 * The boss. A loop of three attacks: it dashes at the player, dashes again, then switches the
 * era. The coming era shows over its head first; when it lands the whole room is redrawn in it
 * and the machine obeys that era's rule (the Game scene does both, on ERA_SWAPPED). Each era
 * also changes how the Prism itself fights: see PRISM in config/monsters.ts.
 */
export class Prism extends Monster {
    /** The era it has the room in right now */
    era: ArtStyle;
    /** How many times it has switched the era */
    swaps = 0;
    private reportedHealth = -1;
    action: Action = 'intro';

    private actionUntil: number;
    private nextAttackAt = 0;
    /** Dashes made since the last switch; the third attack is the switch */
    private attacks = 0;
    private attackAngle = 0;
    /** True while a `recover` is the retreat after touching the player */
    private backingOff = false;

    // Retro: hidden between attacks until Ultraviolet finds it
    private revealedUntil = 0;
    private nextExposeAt = 0;
    /** Set while damage that ignores the ray table is going through takeDamage */
    private direct = false;

    private comingEra: ArtStyle | null = null;
    private badge: Phaser.GameObjects.Graphics;
    private icon: Phaser.GameObjects.Image | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.era = PRISM.eras.includes(world.style) ? world.style : PRISM.eras[0];
        this.actionUntil = scene.time.now + PRISM.intro;
        this.badge = scene.add.graphics().setDepth(DEPTH.effect).setVisible(false);
        scene.game.events.emit(Events.BOSS_PHASE, 1, ERA_RAY[this.era]);
    }

    /** The era that follows the current one in its cycle */
    get nextEra(): ArtStyle {
        const eras = PRISM.eras;
        return eras[(eras.indexOf(this.era) + 1) % eras.length];
    }

    /** True while it is faded out (Retro, between attacks, until Ultraviolet exposes it) */
    get hidden() {
        return (
            this.era === 'retro' &&
            (this.action === 'approach' || this.action === 'recover') &&
            this.scene.time.now >= this.revealedUntil
        );
    }

    /**
     * It floats: the fountain and the street furniture are no obstacle to something this size,
     * which could not otherwise get round the square at all. Walls still stop it.
     */
    get flying() {
        return true;
    }

    get hurtsOnTouch() {
        // Standing still to show the coming era is the player's opening, not a trap; and what
        // cannot be seen must not hurt, so a hidden Prism only hurts with its dash
        if (this.hidden) {
            return false;
        }
        return this.action === 'approach' || this.action === 'windup' || this.action === 'dash';
    }

    private get tempo() {
        return PRISM.era[this.era];
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.active) {
            this.updateLook(this.scene.time.now);
            this.reportHealth();
        }
    }

    /** For the health bar: said once when it appears and again whenever it changes */
    private reportHealth() {
        if (this.health !== this.reportedHealth) {
            this.reportedHealth = this.health;
            this.scene.game.events.emit(Events.BOSS_HEALTH, Math.max(0, this.health), this.def.maxHealth);
        }
    }

    takeDamage(type: RayId, amount: number): boolean {
        if (type === 'uv' && !this.direct) {
            return this.exposeToUv();
        }
        return super.takeDamage(type, amount);
    }

    /** Retro only: Ultraviolet shows it, stops it for a moment and lets the other rays bite */
    exposeToUv(): boolean {
        if (!this.active || this.era !== 'retro' || this.action === 'intro' || this.action === 'swap') {
            return false;
        }
        const now = this.scene.time.now;
        const { stealth } = PRISM;
        const wasHidden = this.hidden;
        this.revealedUntil = Math.max(this.revealedUntil, now + stealth.revealFor);
        if (now < this.nextExposeAt) {
            return true;
        }
        this.nextExposeAt = now + stealth.exposeEvery;
        if (wasHidden) {
            // Caught creeping up: it loses its stride, and has to start its approach again
            this.action = 'approach';
            this.nextAttackAt = now + stealth.stun + PRISM.rest * this.tempo.rest;
            this.stun(stealth.stun);
        }
        this.strike(stealth.uvDamage);
        return true;
    }

    /** A shard pushed back by White came home. This is how White alone can hurt it. */
    hitByDeflected(_damage: number): boolean {
        if (!this.active || this.action === 'intro') {
            return false;
        }
        this.strike(PRISM.shards.returnDamage);
        return true;
    }

    // Far too heavy to push around
    knockback() {}

    onTouchedPlayer() {
        // It draws back rather than grinding the player into a corner
        this.body.setVelocity(0, 0);
        if (this.action === 'dash') {
            this.attacks++;
        }
        this.playMove();
        this.action = 'recover';
        this.backingOff = true;
        this.actionUntil = this.scene.time.now + PRISM.touchRecover;
        this.nextAttackAt = this.actionUntil + PRISM.rest * this.tempo.rest;
    }

    kill() {
        if (!this.active) {
            return;
        }
        // Everything it brought goes with it
        for (const child of this.world.monsters.getChildren().slice()) {
            if (child !== this && child.active) {
                (child as Monster).kill();
            }
        }
        for (const projectile of this.world.projectiles.getChildren().slice()) {
            (projectile as Projectile).dissolve();
        }
        this.scene.game.events.emit(Events.BOSS_HEALTH, 0, this.def.maxHealth);
        super.kill();
    }

    destroy(fromScene?: boolean) {
        this.badge?.destroy();
        this.icon?.destroy();
        this.icon = null;
        super.destroy(fromScene);
    }

    protected multiplierFor(type: RayId): number {
        if (this.direct) {
            return 1;
        }
        if (this.action === 'intro' || type === 'uv') {
            return 0;
        }
        const multiplier = super.multiplierFor(type);
        return this.hidden ? multiplier * PRISM.stealth.hiddenMultiplier : multiplier;
    }

    /** Only walls hide the player from something that looks over the furniture */
    protected seesPlayer() {
        const { player, walls } = this.world;
        return segmentClear(this.x, this.y, player.x, player.y, walls);
    }

    protected behave(now: number, delta: number) {
        const tempo = this.tempo;
        switch (this.action) {
            case 'intro':
            case 'swap':
                this.body.setVelocity(0, 0);
                if (now >= this.actionUntil) {
                    this.action = 'approach';
                    this.nextAttackAt = now + PRISM.rest * tempo.rest;
                }
                break;

            case 'recover':
                if (this.backingOff) {
                    // Away from the player, so someone standing still is not hit again at once
                    const away = this.angleToPlayer() + Math.PI;
                    this.steer(Math.cos(away) * PRISM.backOffSpeed, Math.sin(away) * PRISM.backOffSpeed, delta);
                } else {
                    this.steer(0, 0, delta);
                }
                if (now >= this.actionUntil) {
                    this.action = 'approach';
                    this.backingOff = false;
                }
                break;

            case 'approach':
                if (this.attacks >= PRISM.attacksPerEra) {
                    this.startTelegraph(now);
                } else if (
                    now >= this.nextAttackAt &&
                    this.distanceToPlayer() <= PRISM.dashRange &&
                    this.seesPlayer()
                ) {
                    this.startWindup(now, PRISM.windup * tempo.windup);
                } else {
                    this.chase(now, delta, this.def.speed * tempo.speed);
                }
                break;

            case 'windup':
                this.steer(0, 0, delta);
                if (now >= this.actionUntil) {
                    const speed = PRISM.dashSpeed * tempo.dashSpeed;
                    this.action = 'dash';
                    this.actionUntil = now + PRISM.dashDuration;
                    this.playMove();
                    this.body.setVelocity(Math.cos(this.attackAngle) * speed, Math.sin(this.attackAngle) * speed);
                }
                break;

            case 'dash':
                // Stops early if a wall has killed its speed
                if (now >= this.actionUntil || this.body.velocity.lengthSq() < 100) {
                    this.attacks++;
                    this.action = 'recover';
                    this.backingOff = false;
                    this.actionUntil = now + PRISM.recover;
                    this.nextAttackAt = this.actionUntil + PRISM.rest * tempo.rest;
                    if (this.era === 'manga') {
                        this.shedShards();
                    }
                }
                break;

            case 'telegraph':
                this.steer(0, 0, delta);
                if (now >= this.actionUntil) {
                    this.swapEra(now);
                }
                break;
        }
    }

    private startWindup(now: number, duration: number) {
        this.action = 'windup';
        this.actionUntil = now + duration;
        // The direction is fixed now, so stepping aside during the wind-up dodges it
        this.attackAngle = this.angleToPlayer();
        this.showFrame(WINDUP_FRAME);
        closingRing(this.scene, this.x, this.y, this.def.radius + 8, ERA_COLOR[this.era], duration);
        this.scene.game.events.emit(Events.MONSTER_WINDUP, this.def.id, this.x, this.y);
    }

    /** The third attack: show the coming era over its head, then switch */
    private startTelegraph(now: number) {
        this.action = 'telegraph';
        this.actionUntil = now + PRISM.telegraph;
        this.comingEra = this.nextEra;
        this.showFrame(WINDUP_FRAME);
        this.badge.setVisible(true);
        const frame = ERA_ICON[this.comingEra];
        if (frame !== undefined && this.scene.textures.exists('era-icons')) {
            this.icon = worldScale(this.scene.add.image(this.x, this.y, 'era-icons', frame)).setDepth(DEPTH.effect);
        }
        this.scene.game.events.emit(Events.BOSS_TELEGRAPH, this.comingEra, PRISM.telegraph);
    }

    private swapEra(now: number) {
        const era = this.comingEra ?? this.nextEra;
        this.comingEra = null;
        this.badge.clear().setVisible(false);
        this.icon?.destroy();
        this.icon = null;

        this.era = era;
        this.swaps++;
        this.attacks = 0;
        this.revealedUntil = 0;
        this.action = 'swap';
        this.actionUntil = now + PRISM.swapPause;
        this.playMove();
        puff(this.scene, this.x, this.y, ERA_COLOR[era], 12, 26);

        // The Game scene redraws the room (this sprite included) and gives the machine the era's rule
        const events = this.scene.game.events;
        events.emit(Events.ERA_SWAPPED, era);
        events.emit(Events.BOSS_PHASE, this.swaps + 1, ERA_RAY[era]);

        this.callMinions(PRISM.minions.perSwitch);
    }

    /** Company with every switch, one more each time, announced like any other spawn */
    private callMinions(wanted: number) {
        const { minions } = PRISM;
        const ids = minions.byEra[this.era];
        const count = wanted;
        if (ids.length === 0 || count <= 0) {
            return;
        }
        // Its own body counts as one member of the group
        let alive = this.world.monsters.countActive(true) - 1;
        if (this.health < this.def.maxHealth * minions.minHealth) {
            return;
        }
        const offset = Math.random() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
            const id = ids[i % ids.length];
            if (alive >= minions.limit || !MONSTERS[id]) {
                return;
            }
            alive++;
            const angle = offset + (i / count) * Math.PI * 2;
            this.world.summon(id, this.x + Math.cos(angle) * minions.radius, this.y + Math.sin(angle) * minions.radius);
        }
    }

    /** Manga: a ring of shards from where the dash ended, one of them straight at the player */
    private shedShards() {
        const { shards } = PRISM;
        const { world } = this;
        const aim = this.angleToPlayer();
        for (let i = 0; i < shards.count; i++) {
            const angle = aim + (i / shards.count) * Math.PI * 2;
            new Projectile(
                this.scene,
                world.projectiles,
                this.x + Math.cos(angle) * this.def.radius,
                this.y + Math.sin(angle) * this.def.radius,
                angle,
                shards.speed,
                shards.damage,
                world.style,
                { kind: 'shard' },
            );
        }
    }

    /** Damage that does not go through the ray table (an exposure, a shard coming home) */
    private strike(amount: number) {
        this.direct = true;
        super.takeDamage('white', amount);
        this.direct = false;
    }

    private updateLook(now: number) {
        const { stealth } = PRISM;
        if (this.action === 'intro' || this.action === 'swap') {
            this.setAlpha(Math.floor(now / 90) % 2 === 0 ? 1 : 0.55);
        } else if (this.era !== 'retro' || this.action === 'telegraph') {
            this.setAlpha(1);
        } else if (now < this.revealedUntil) {
            // Flicker just before it fades away again
            const left = this.revealedUntil - now;
            this.setAlpha(left < 500 && Math.floor(now / 70) % 2 === 0 ? 0.5 : 1);
        } else if (this.action === 'windup') {
            this.setAlpha(Math.floor(now / 60) % 2 === 0 ? stealth.windupAlpha : stealth.windupAlpha * 0.6);
        } else if (this.action === 'dash') {
            this.setAlpha(stealth.windupAlpha);
        } else {
            const glint = Math.max(0, Math.sin(now / 240) - 0.75) / 0.25;
            this.setAlpha(Phaser.Math.Linear(stealth.hiddenAlpha, stealth.shimmerAlpha, glint));
        }

        if (this.action === 'telegraph' && this.comingEra) {
            this.drawBadge(this.comingEra, (this.actionUntil - now) / PRISM.telegraph);
        }
    }

    /**
     * The coming era over its head, with a ring that runs down to the switch. Each era has its
     * own shape as well as its own colour. When the `era-icons` sheet exists its icon is shown
     * in place of the shape.
     */
    private drawBadge(era: ArtStyle, left: number) {
        const x = this.x;
        const y = this.y - this.def.radius - BADGE_LIFT;
        const r = BADGE_RADIUS;
        const color = ERA_COLOR[era];
        const g = this.badge;
        g.clear();

        // The countdown
        g.lineStyle(3, UNDERLAY.color, 0.75);
        g.strokeCircle(x, y, r + 3.5);
        g.lineStyle(1.5, color, 1);
        g.beginPath();
        g.arc(x, y, r + 3.5, -Math.PI / 2, -Math.PI / 2 + Phaser.Math.Clamp(left, 0, 1) * Math.PI * 2);
        g.strokePath();

        if (this.icon) {
            this.icon.setPosition(x, y);
            return;
        }

        g.fillStyle(UNDERLAY.color, 0.9);
        g.fillCircle(x, y, r + 1.5);
        g.fillStyle(color, 1);
        switch (era) {
            case 'cyberpunk':
                // A neon diamond
                g.fillTriangle(x - r, y, x, y - r, x + r, y);
                g.fillTriangle(x - r, y, x, y + r, x + r, y);
                break;
            case 'retro':
                // A dull, square screen
                g.fillRect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
                break;
            case 'manga':
                // Half ink, half paper
                g.fillCircle(x, y, r);
                g.fillStyle(0x111111, 1);
                g.slice(x, y, r, Math.PI / 2, Math.PI * 1.5, false);
                g.fillPath();
                break;
            default:
                // The sun
                g.fillCircle(x, y, r * 0.8);
        }
    }
}
