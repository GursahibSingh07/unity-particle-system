import Phaser from 'phaser';
import { ENERGY, GAMMA, INFRARED, RADIATIONS, RADIO, ULTRAVIOLET } from '../config/radiation';
import { ROOM } from '../config/world';
import { DEPTH, UNDERLAY, puff } from '../entities/effects';
import type { Monster } from '../entities/Monster';
import { MACHINE_LENGTH, type Player } from '../entities/Player';
import { Events } from '../events';
import type { RadiationDef, RadiationId } from '../types';
import { castRay, rayToRect, segmentClear } from './Navigation';
import type { Rect } from './roomLayout';

const SELECTED_KEY = 'selectedRadiation';
/** Rays drawn to shape the Ultraviolet cone around walls */
const CONE_RAYS = 14;
/** A little generosity on thin shots, so a graze counts */
const GRAZE = 1.5;

/** Distance from a point to the segment that starts at (x, y) and runs `length` along a unit vector */
function distanceToRay(px: number, py: number, x: number, y: number, dx: number, dy: number, length: number) {
    const along = Phaser.Math.Clamp((px - x) * dx + (py - y) * dy, 0, length);
    return Math.hypot(px - (x + dx * along), py - (y + dy * along));
}

/** The room's unbroken secret walls, and who to tell when radiation touches one */
export interface SecretWalls {
    tiles: Rect[];
    touch(tile: Rect, type: RadiationId): void;
}

/** The player's weapon: radiation selection, firing and the shared energy pool. */
export class EMWMachine {
    readonly maxEnergy = ENERGY.max;
    energy = ENERGY.max;
    selected: RadiationDef;

    /** The radiation types the player owns */
    private owned = new Set<RadiationId>();
    private beam: Phaser.GameObjects.Graphics;
    private nextShotAt = 0;
    private lastFiredAt = 0;
    /** Set when energy runs dry; firing is locked until it recovers */
    private depleted = false;
    private wasDown = false;
    /** The continuous beam or charge that BEAM was last emitted as on for */
    private beamOn: RadiationId | null = null;
    /** Milliseconds of Gamma charge, or -1 when not charging */
    private charge = -1;

    constructor(
        private scene: Phaser.Scene,
        private player: Player,
        private monsters: Phaser.Physics.Arcade.Group,
        private walls: Rect[],
        owned: RadiationId[],
        private secrets: SecretWalls | null = null,
    ) {
        for (const id of owned) {
            if (RADIATIONS[id]) {
                this.owned.add(id);
            } else {
                console.warn(`No radiation definition for "${id}"`);
            }
        }
        // Every key is wired up from the start; one for a type not yet owned does nothing
        for (const def of Object.values(RADIATIONS)) {
            const keyCode = Phaser.Input.Keyboard.KeyCodes.ZERO + def.key;
            const key = scene.input.keyboard!.addKey(keyCode);
            key.on('down', () => this.select(def.id));
            scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => key.off('down'));
        }

        // Keep the player's choice from the previous room
        const remembered = scene.registry.get(SELECTED_KEY) as RadiationId | undefined;
        const first = Object.values(RADIATIONS).find((def) => this.owned.has(def.id)) ?? RADIATIONS.radio;
        this.selected = remembered && this.owned.has(remembered) ? RADIATIONS[remembered] : first;
        this.beam = scene.add.graphics().setDepth(DEPTH.effect);
        // A room can end mid-beam; whoever is listening must hear it stop
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.setBeam(null));
    }

    /** True while a Gamma shot is being charged */
    get isCharging() {
        return this.charge >= 0;
    }

    update(delta: number) {
        this.beam.clear();

        const now = this.scene.time.now;
        const down = this.scene.input.activePointer.leftButtonDown() && !this.player.isDead;
        const pressed = down && !this.wasDown;
        this.wasDown = down;

        let fired = false;
        if (this.selected.id === 'gamma') {
            fired = this.updateGamma(down, pressed, delta);
        } else if (down && !this.depleted) {
            fired = this.fire(delta, pressed);
        } else if (pressed) {
            this.deny();
        }

        let beaming: RadiationId | null = null;
        if (this.isCharging) {
            beaming = 'gamma';
        } else if (fired && this.selected.id === 'infrared') {
            beaming = 'infrared';
        }
        this.setBeam(beaming);

        if (fired) {
            this.lastFiredAt = now;
        } else if (now - this.lastFiredAt >= ENERGY.regenDelay) {
            this.setEnergy(this.energy + (ENERGY.regenPerSecond * delta) / 1000);
        }

        if (this.energy <= 0) {
            this.depleted = true;
        } else if (this.energy >= ENERGY.recoverAt) {
            this.depleted = false;
        }
    }

    /** Clear any beam left on screen, for when the room ends mid-shot */
    stop() {
        this.beam.clear();
        this.cancelCharge();
        this.setBeam(null);
    }

    /** Add a radiation type to the ones the player can select */
    unlock(id: RadiationId) {
        this.owned.add(id);
    }

    /** Switch to a radiation type; does nothing if the player does not own it yet */
    select(id: RadiationId) {
        const def = RADIATIONS[id];
        if (!def || !this.owned.has(id)) {
            return;
        }
        if (def !== this.selected) {
            this.cancelCharge();
            this.setBeam(null);
            this.selected = def;
            this.scene.registry.set(SELECTED_KEY, def.id);
            this.scene.game.events.emit(Events.RADIATION_CHANGED, def.id);
        }
    }

    private deny() {
        this.scene.game.events.emit(Events.DENIED);
    }

    /** Emits BEAM when a continuous beam or charge starts or stops */
    private setBeam(id: RadiationId | null) {
        if (id === this.beamOn) {
            return;
        }
        if (this.beamOn) {
            this.scene.game.events.emit(Events.BEAM, this.beamOn, false);
        }
        this.beamOn = id;
        if (id) {
            this.scene.game.events.emit(Events.BEAM, id, true);
        }
    }

    private fire(delta: number, pressed: boolean) {
        switch (this.selected.id) {
            case 'radio':
                return this.fireShot(pressed, RADIO.cooldown, () => this.fireRadio());
            case 'infrared':
                return this.fireInfrared(delta);
            case 'ultraviolet':
                return this.fireShot(pressed, ULTRAVIOLET.cooldown, () => this.fireUltraviolet());
            default:
                return false;
        }
    }

    /** One-off shots: pay, start the cooldown, announce. Holding fire repeats them. */
    private fireShot(pressed: boolean, cooldown: number, shoot: () => void) {
        const def = this.selected;
        const now = this.scene.time.now;
        if (this.energy < def.energyCost) {
            if (pressed) {
                this.deny();
            }
            return false;
        }
        if (now < this.nextShotAt) {
            return false;
        }

        this.nextShotAt = now + cooldown;
        this.setEnergy(this.energy - def.energyCost);
        this.scene.game.events.emit(Events.SHOT, def.id);
        shoot();
        return true;
    }

    private fireRadio() {
        const def = this.selected;
        const { x, y } = this.player;
        for (const monster of this.activeMonsters()) {
            const reach = RADIO.range + monster.def.radius;
            if (Phaser.Math.Distance.Between(x, y, monster.x, monster.y) > reach) {
                continue;
            }
            if (monster.takeDamage(def.id, def.damage) && monster.active) {
                monster.knockback(x, y, RADIO.knockbackSpeed, RADIO.knockbackDuration);
            }
        }

        for (const tile of this.secretTiles()) {
            const nearX = Phaser.Math.Clamp(x, tile.x, tile.x + tile.width);
            const nearY = Phaser.Math.Clamp(y, tile.y, tile.y + tile.height);
            if (Math.hypot(nearX - x, nearY - y) <= RADIO.range) {
                this.secrets!.touch(tile, def.id);
            }
        }

        const shadow = this.scene.add
            .circle(x, y, RADIO.range)
            .setStrokeStyle(3.5, UNDERLAY.color, UNDERLAY.alpha)
            .setScale(0.15)
            .setDepth(DEPTH.effect);
        const ring = this.scene.add
            .circle(x, y, RADIO.range)
            .setStrokeStyle(1.5, def.color)
            .setScale(0.15)
            .setDepth(DEPTH.effect);
        this.scene.tweens.add({
            targets: shadow,
            scale: 1,
            alpha: 0,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => shadow.destroy(),
        });
        this.scene.tweens.add({
            targets: ring,
            scale: 1,
            alpha: 0,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy(),
        });
    }

    private fireInfrared(delta: number) {
        const def = this.selected;
        const seconds = delta / 1000;
        this.setEnergy(this.energy - def.energyCost * seconds);

        const { x, handY: y, aimAngle } = this.player;
        const cos = Math.cos(aimAngle);
        const sin = Math.sin(aimAngle);

        // Walls stop the beam at the nearest point it touches. It is measured from the
        // player's hands so point-blank monsters still burn.
        const range = MACHINE_LENGTH + INFRARED.range;
        const reach = castRay(x, y, aimAngle, range, this.walls);
        if (reach < range) {
            this.touchSecretAt(x, y, cos, sin, reach, def.id);
        }
        for (const monster of this.activeMonsters()) {
            const distance = distanceToRay(monster.x, monster.y, x, y, cos, sin, reach);
            if (distance <= monster.def.radius + INFRARED.width / 2) {
                monster.takeDamage(def.id, def.damage * seconds);
            }
        }

        if (reach > MACHINE_LENGTH) {
            const x1 = x + cos * MACHINE_LENGTH;
            const y1 = y + sin * MACHINE_LENGTH;
            const x2 = x + cos * reach;
            const y2 = y + sin * reach;
            this.beam.lineStyle(INFRARED.width + 2, UNDERLAY.color, UNDERLAY.alpha);
            this.beam.lineBetween(x1, y1, x2, y2);
            this.beam.lineStyle(INFRARED.width, def.color, 0.9);
            this.beam.lineBetween(x1, y1, x2, y2);
            this.beam.lineStyle(INFRARED.width / 3, 0xffffff, 0.9);
            this.beam.lineBetween(x1, y1, x2, y2);
        }
        return true;
    }

    private fireUltraviolet() {
        const def = this.selected;
        const { x, handY: y, aimAngle } = this.player;
        const halfAngle = Phaser.Math.DegToRad(ULTRAVIOLET.halfAngle);

        for (const monster of this.activeMonsters()) {
            const distance = Phaser.Math.Distance.Between(x, y, monster.x, monster.y);
            const radius = monster.def.radius;
            if (distance > ULTRAVIOLET.range + radius) {
                continue;
            }
            // A monster is inside the cone if any part of its body is
            const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(monster.y - y, monster.x - x) - aimAngle));
            const cover = distance > radius ? Math.asin(radius / distance) : Math.PI;
            if (off > halfAngle + cover) {
                continue;
            }
            if (!segmentClear(x, y, monster.x, monster.y, this.walls)) {
                continue;
            }
            monster.takeDamage(def.id, def.damage);
        }

        // The flash is a fan of rays, each cut short by the first wall it meets
        const points = [new Phaser.Math.Vector2(x, y)];
        for (let i = 0; i <= CONE_RAYS; i++) {
            const angle = aimAngle - halfAngle + (i / CONE_RAYS) * halfAngle * 2;
            const reach = castRay(x, y, angle, ULTRAVIOLET.range, this.walls);
            if (reach < ULTRAVIOLET.range) {
                this.touchSecretAt(x, y, Math.cos(angle), Math.sin(angle), reach, def.id);
            }
            points.push(new Phaser.Math.Vector2(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach));
        }
        const flash = this.scene.add.graphics().setDepth(DEPTH.effect);
        flash.lineStyle(2.5, UNDERLAY.color, UNDERLAY.alpha);
        flash.strokePoints(points, true);
        flash.fillStyle(def.color, 0.75);
        flash.fillPoints(points, true);
        flash.lineStyle(1, 0xffffff, 0.8);
        flash.strokePoints(points.slice(1), false);
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: ULTRAVIOLET.flashDuration,
            ease: 'Quad.easeIn',
            onComplete: () => flash.destroy(),
        });
    }

    /** Gamma charges while fire is held and fires on release, if the charge is complete */
    private updateGamma(down: boolean, pressed: boolean, delta: number) {
        const def = this.selected;
        if (!this.isCharging) {
            if (pressed) {
                if (this.depleted || this.energy < def.energyCost) {
                    this.deny();
                } else {
                    this.charge = 0;
                    this.player.speedScale = GAMMA.moveScale;
                }
            }
            return this.isCharging;
        }

        if (!down) {
            const ready = this.charge >= GAMMA.chargeTime;
            this.cancelCharge();
            if (ready) {
                this.fireGamma();
            }
            return ready;
        }

        this.charge += delta;
        this.drawCharge();
        return true;
    }

    private cancelCharge() {
        this.charge = -1;
        this.player.speedScale = 1;
    }

    /** Distance to where a ray from inside the room leaves it */
    private gammaReach(x: number, y: number, cos: number, sin: number) {
        let toSide = Infinity;
        if (cos !== 0) {
            toSide = ((cos > 0 ? ROOM.x + ROOM.width : ROOM.x) - x) / cos;
        }
        let toEnd = Infinity;
        if (sin !== 0) {
            toEnd = ((sin > 0 ? ROOM.y + ROOM.height : ROOM.y) - y) / sin;
        }
        return Math.max(0, Math.min(toSide, toEnd));
    }

    private drawCharge() {
        const def = this.selected;
        const { x, handY: y, aimAngle } = this.player;
        const cos = Math.cos(aimAngle);
        const sin = Math.sin(aimAngle);
        const progress = Math.min(1, this.charge / GAMMA.chargeTime);
        const ready = progress >= 1;
        const tipX = x + cos * MACHINE_LENGTH;
        const tipY = y + sin * MACHINE_LENGTH;
        const reach = this.gammaReach(x, y, cos, sin);

        // A faint sight line shows where the ray will go; it flickers brightly when ready
        const flicker = ready && Math.floor(this.scene.time.now / 80) % 2 === 0;
        let alpha = 0.1 + progress * 0.15;
        if (ready) {
            alpha = flicker ? 0.7 : 0.45;
        }
        this.beam.lineStyle(2.5, UNDERLAY.color, alpha * UNDERLAY.alpha);
        this.beam.lineBetween(tipX, tipY, x + cos * reach, y + sin * reach);
        this.beam.lineStyle(1, def.color, alpha);
        this.beam.lineBetween(tipX, tipY, x + cos * reach, y + sin * reach);
        this.beam.fillStyle(UNDERLAY.color, UNDERLAY.alpha);
        this.beam.fillCircle(tipX, tipY, 2 + progress * 2.5);
        this.beam.fillStyle(flicker ? 0xffffff : def.color, 0.9);
        this.beam.fillCircle(tipX, tipY, 1 + progress * 2.5);
    }

    private fireGamma() {
        const def = this.selected;
        this.setEnergy(this.energy - def.energyCost);
        this.scene.game.events.emit(Events.SHOT, def.id);

        const { x, handY: y, aimAngle } = this.player;
        const cos = Math.cos(aimAngle);
        const sin = Math.sin(aimAngle);
        const reach = this.gammaReach(x, y, cos, sin);

        for (const tile of this.secretTiles()) {
            if (rayToRect(x, y, cos, sin, tile) <= reach) {
                this.secrets!.touch(tile, def.id);
            }
        }

        // Nothing stops it: every monster on the line is hit
        for (const monster of this.activeMonsters()) {
            const distance = distanceToRay(monster.x, monster.y, x, y, cos, sin, reach);
            if (distance > monster.def.radius + GAMMA.width / 2 + GRAZE) {
                continue;
            }
            if (monster.takeDamage(def.id, def.damage) && monster.active) {
                monster.knockback(x, y, GAMMA.knockbackSpeed, GAMMA.knockbackDuration);
            }
        }

        const startX = x + cos * MACHINE_LENGTH;
        const startY = y + sin * MACHINE_LENGTH;
        const endX = x + cos * reach;
        const endY = y + sin * reach;
        const ray = this.scene.add.graphics().setDepth(DEPTH.effect);
        ray.lineStyle(GAMMA.width + 4, UNDERLAY.color, UNDERLAY.alpha);
        ray.lineBetween(startX, startY, endX, endY);
        ray.lineStyle(GAMMA.width + 2, def.color, 0.9);
        ray.lineBetween(startX, startY, endX, endY);
        ray.lineStyle(GAMMA.width, 0xffffff, 1);
        ray.lineBetween(startX, startY, endX, endY);
        this.scene.tweens.add({
            targets: ray,
            alpha: 0,
            duration: GAMMA.rayDuration,
            ease: 'Quad.easeIn',
            onComplete: () => ray.destroy(),
        });
        puff(this.scene, endX, endY, def.color, 5, 8);
    }

    /** A copy, because touching a secret wall can remove it from the list */
    private secretTiles() {
        return this.secrets ? this.secrets.tiles.slice() : [];
    }

    /** Tell the secret wall, if any, that a ray stopped by the walls after `reach` ended on */
    private touchSecretAt(x: number, y: number, dx: number, dy: number, reach: number, type: RadiationId) {
        for (const tile of this.secretTiles()) {
            if (Math.abs(rayToRect(x, y, dx, dy, tile) - reach) < 0.05) {
                this.secrets!.touch(tile, type);
                return;
            }
        }
    }

    /** A copy, because damaging a monster can remove it from the group */
    private activeMonsters() {
        return this.monsters.getChildren().filter((child) => child.active) as Monster[];
    }

    private setEnergy(value: number) {
        const energy = Phaser.Math.Clamp(value, 0, this.maxEnergy);
        if (energy !== this.energy) {
            this.energy = energy;
            this.scene.game.events.emit(Events.ENERGY_CHANGED, energy, this.maxEnergy);
        }
    }
}
