import Phaser from 'phaser';
import { ENERGY, INFRARED, RADIATIONS, RADIO } from '../config/radiation';
import type { Monster } from '../entities/Monster';
import { MACHINE_LENGTH, type Player } from '../entities/Player';
import { Events } from '../events';
import type { RadiationDef, RadiationId } from '../types';

/** The player's weapon: radiation selection, firing and the shared energy pool. */
export class EMWMachine {
    readonly maxEnergy = ENERGY.max;
    energy = ENERGY.max;
    selected: RadiationDef;

    private radiations: RadiationDef[] = [];
    private beam: Phaser.GameObjects.Graphics;
    private nextPulseAt = 0;
    private lastFiredAt = 0;
    /** Set when energy runs dry; firing is locked until it recovers */
    private depleted = false;

    constructor(
        private scene: Phaser.Scene,
        private player: Player,
        private monsters: Phaser.Physics.Arcade.Group,
        private walls: Phaser.Geom.Rectangle[],
        available: RadiationId[],
    ) {
        for (const id of available) {
            const def = RADIATIONS[id];
            if (!def) {
                console.warn(`No radiation definition for "${id}"`);
                continue;
            }
            const keyCode = Phaser.Input.Keyboard.KeyCodes.ZERO + def.key;
            const key = scene.input.keyboard!.addKey(keyCode);
            key.on('down', () => this.select(def));
            scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => key.off('down'));
            this.radiations.push(def);
        }

        this.selected = this.radiations[0];
        this.beam = scene.add.graphics();
    }

    update(delta: number) {
        this.beam.clear();

        const now = this.scene.time.now;
        let fired = false;
        if (this.scene.input.activePointer.leftButtonDown() && !this.player.isDead && !this.depleted) {
            fired = this.fire(delta);
        }

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
    }

    private select(def: RadiationDef) {
        if (def !== this.selected) {
            this.selected = def;
            this.scene.game.events.emit(Events.RADIATION_CHANGED, def.id);
        }
    }

    private fire(delta: number) {
        switch (this.selected.id) {
            case 'radio':
                return this.fireRadio();
            case 'infrared':
                return this.fireInfrared(delta);
            default:
                return false;
        }
    }

    private fireRadio() {
        const def = this.selected;
        const now = this.scene.time.now;
        if (now < this.nextPulseAt || this.energy < def.energyCost) {
            return false;
        }

        this.nextPulseAt = now + RADIO.cooldown;
        this.setEnergy(this.energy - def.energyCost);

        const { x, y } = this.player;
        for (const monster of this.activeMonsters()) {
            const reach = RADIO.range + monster.def.radius;
            if (Phaser.Math.Distance.Between(x, y, monster.x, monster.y) > reach) {
                continue;
            }
            monster.takeDamage(def.id, def.damage);
            if (monster.active) {
                monster.knockback(x, y, RADIO.knockbackSpeed, RADIO.knockbackDuration);
            }
        }

        const ring = this.scene.add.circle(x, y, RADIO.range).setStrokeStyle(4, def.color).setScale(0.15);
        this.scene.tweens.add({
            targets: ring,
            scale: 1,
            alpha: 0,
            duration: 300,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy(),
        });
        return true;
    }

    private fireInfrared(delta: number) {
        const def = this.selected;
        const seconds = delta / 1000;
        this.setEnergy(this.energy - def.energyCost * seconds);

        const { x, y, aimAngle } = this.player;
        const cos = Math.cos(aimAngle);
        const sin = Math.sin(aimAngle);
        const reach = MACHINE_LENGTH + INFRARED.range;
        const line = new Phaser.Geom.Line(
            x + cos * MACHINE_LENGTH,
            y + sin * MACHINE_LENGTH,
            x + cos * reach,
            y + sin * reach,
        );

        // Walls stop the beam at the nearest point it touches
        let nearest = INFRARED.range;
        for (const wall of this.walls) {
            for (const hit of Phaser.Geom.Intersects.GetLineToRectangle(line, wall)) {
                nearest = Math.min(nearest, Phaser.Math.Distance.Between(line.x1, line.y1, hit.x, hit.y));
            }
        }
        line.x2 = line.x1 + cos * nearest;
        line.y2 = line.y1 + sin * nearest;

        // Hits are measured from the player's centre so point-blank monsters still burn
        const hitLine = new Phaser.Geom.Line(x, y, line.x2, line.y2);
        const circle = new Phaser.Geom.Circle();
        for (const monster of this.activeMonsters()) {
            circle.setTo(monster.x, monster.y, monster.def.radius + INFRARED.width / 2);
            if (Phaser.Geom.Intersects.LineToCircle(hitLine, circle)) {
                monster.takeDamage(def.id, def.damage * seconds);
            }
        }

        this.beam.lineStyle(INFRARED.width, def.color, 0.85);
        this.beam.lineBetween(line.x1, line.y1, line.x2, line.y2);
        this.beam.lineStyle(INFRARED.width / 3, 0xffffff, 0.9);
        this.beam.lineBetween(line.x1, line.y1, line.x2, line.y2);
        return true;
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
