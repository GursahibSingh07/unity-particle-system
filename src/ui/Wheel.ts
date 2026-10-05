import Phaser from 'phaser';
import { ENERGY, RAYS } from '../config/rays';
import type { RayId, RayMode, WeaponRule } from '../types';
import { burst, burstPoints, keyCap, plate } from './draw';
import { DASH_ICON, RAY_ICON } from './eras';
import { LABELS, MODE_LABELS } from './labels';
import { Depth, GREY, INK, PAPER, RED, RED_DARK, WHITE, YELLOW, makeText, mix } from './theme';

/** The fourth argument of WEAPON_STATE (see src/events.ts) */
export interface WeaponStatus {
    ray: RayId | null;
    rotateInMs: number | null;
    warning: boolean;
    nextIndex: number | null;
}

const CX = 1172;
const CY = 610;
/** The wheel itself, the ring of energy around it, and the ink disc both sit on */
const WHEEL = 62;
const RING = 79;
const RING_WIDTH = 12;
const BACK = 92;
const HUB = 19;
/** The energy ring leaves this much open at the top, for the pointer */
const RING_GAP = Phaser.Math.DegToRad(30);
const RING_START = -Math.PI / 2 + RING_GAP;
const RING_SPAN = Math.PI * 2 - RING_GAP * 2;
const TOP = -Math.PI / 2;
const WELL = 0x3d3852;

/** Everything left of the wheel is right-aligned to this */
const STACK_RIGHT = -BACK - 12;
const PIP = 34;
const PIP_GAP = 6;
const PIPS_Y = 40;

const MODE_COLORS: Record<RayMode, number> = { rgb: PAPER, uv: RAYS.uv.color, unprism: WHITE };

/**
 * The colour wheel at the bottom right: which light will fire, how much energy is left, what
 * the wheel will do next, and the dash. Everything here is drawn from WEAPON_STATE, DASH_STATE
 * and ENERGY_CHANGED; no rule of the game is worked out on this side.
 */
export class Wheel {
    private readonly root: Phaser.GameObjects.Container;
    private readonly disc: Phaser.GameObjects.Container;
    private readonly energyG: Phaser.GameObjects.Graphics;
    private readonly wheel: Phaser.GameObjects.Container;
    private readonly wheelG: Phaser.GameObjects.Graphics;
    private readonly hubG: Phaser.GameObjects.Graphics;
    private readonly pointerG: Phaser.GameObjects.Graphics;
    private readonly emptyTag: Phaser.GameObjects.Container;
    private readonly dash: Phaser.GameObjects.Container;
    private readonly pipsG: Phaser.GameObjects.Graphics;
    private icons: Phaser.GameObjects.Image[] = [];
    private pipIcons: Phaser.GameObjects.Image[] = [];
    private dashParts: Phaser.GameObjects.GameObject[] = [];
    /** Key caps, the mode plate, the badges: rebuilt whenever the machine reports */
    private furniture: Phaser.GameObjects.GameObject[] = [];
    private nextBadge?: Phaser.GameObjects.Container;
    private emblem?: Phaser.GameObjects.Container;
    private spin?: Phaser.Tweens.Tween;

    private rule?: WeaponRule;
    private signature = '';
    private mode: RayMode = 'rgb';
    private index = 0;
    private status: WeaponStatus = { ray: null, rotateInMs: null, warning: false, nextIndex: null };
    private rotateIn: number | null = null;
    private clock = 0;
    private beat = false;

    private energy = 1;
    private energyMax = 1;
    private depleted = false;

    private dashLeft = 0;
    private dashMax = 0;
    private dashWait = 0;
    private dashTotal = 1;
    private gone = false;

    constructor(private readonly scene: Phaser.Scene) {
        const back = scene.add.graphics();
        // A paper keyline outside the ink, so the disc holds on the dark squares too
        back.fillStyle(INK, 0.45).fillCircle(5, 6, BACK + 3);
        back.fillStyle(PAPER, 1).fillCircle(0, 0, BACK + 3);
        back.fillStyle(INK, 1).fillCircle(0, 0, BACK);

        this.energyG = scene.add.graphics();
        this.wheelG = scene.add.graphics();
        this.wheel = scene.add.container(0, 0, [this.wheelG]);
        this.hubG = scene.add.graphics();
        this.pointerG = scene.add.graphics();

        const emptyG = scene.add.graphics();
        const emptyText = makeText(scene, 0, 0, LABELS.energyEmpty, 20, { bold: true, color: PAPER }).setOrigin(0.5);
        const emptyWidth = Math.ceil(emptyText.width) + 18;
        plate(emptyG, -emptyWidth / 2, -16, emptyWidth, 32, RED);
        this.emptyTag = scene.add.container(0, 30, [emptyG, emptyText]).setAngle(-6).setVisible(false);

        this.disc = scene.add.container(0, 0, [back, this.energyG, this.wheel, this.hubG, this.pointerG, this.emptyTag]);

        this.pipsG = scene.add.graphics();
        this.dash = scene.add.container(0, 0, [this.pipsG]).setVisible(false);

        this.root = scene.add.container(CX, CY, [this.dash, this.disc]).setDepth(Depth.hud + 1).setVisible(false);
        this.disc.setVisible(false);
    }

    /** WEAPON_STATE: the whole truth about the machine, each time anything about it changes */
    setState(rule: WeaponRule, mode: RayMode, index: number, status: WeaponStatus) {
        if (!rule || !Array.isArray(rule.wheel) || !Array.isArray(rule.modes)) {
            return;
        }
        const signature = JSON.stringify([rule.wheel, rule.modes, !!rule.overdrive, rule.autoRotateMs ?? 0]);
        const rebuilt = signature !== this.signature;
        const modeChanged = mode !== this.mode;
        this.rule = rule;
        this.status = {
            ray: status?.ray ?? null,
            rotateInMs: status?.rotateInMs ?? null,
            warning: !!status?.warning,
            nextIndex: status?.nextIndex ?? null,
        };
        this.rotateIn = this.status.rotateInMs;
        this.mode = mode;
        if (this.dashWait > 0 && rule.dashCooldownMs > 0) {
            this.dashTotal = Math.max(rule.dashCooldownMs, this.dashWait);
        }

        const size = rule.wheel.length;
        const next = size > 0 ? Phaser.Math.Clamp(Math.floor(index) || 0, 0, size - 1) : 0;
        if (rebuilt) {
            this.signature = signature;
            this.index = next;
            this.buildWheel();
        } else if (next !== this.index) {
            this.turnTo(next);
        }
        this.drawWheel();
        this.buildFurniture(rebuilt || modeChanged);
        this.drawEnergy();
        this.drawHub();
        this.drawPointer();
        this.show();
    }

    setEnergy(energy: number, max: number) {
        this.energy = energy;
        this.energyMax = Math.max(1, max);
        // The machine's own lock-out: dry until it has climbed back to the recovery mark
        if (energy <= 0) {
            this.depleted = true;
        } else if (energy >= ENERGY.recoverAt) {
            this.depleted = false;
        }
        this.drawEnergy();
    }

    /** DASH_STATE: `wait` is how long until the next charge comes back */
    setDash(left: number, max: number, wait: number) {
        const rebuilt = max !== this.dashMax;
        this.dashLeft = Phaser.Math.Clamp(left, 0, max);
        this.dashMax = Math.max(0, max);
        this.dashWait = Math.max(0, wait || 0);
        if (this.dashWait > 0) {
            this.dashTotal = Math.max(this.rule?.dashCooldownMs ?? 0, this.dashWait, 1);
        }
        if (rebuilt) {
            this.buildDash();
        }
        this.drawPips();
        this.show();
    }

    /** DASHED: a kick on the pips, so the spend is felt without looking */
    dashed() {
        if (this.dashMax <= 0) {
            return;
        }
        const pop = this.scene.add.graphics();
        const x = this.pipX(Math.min(this.dashLeft, this.dashMax - 1)) + PIP / 2;
        burst(pop, burstPoints(0, 0, 30, 16, 9, 0.2, 4), YELLOW, INK, 3);
        pop.setPosition(x, PIPS_Y).setScale(0.4);
        this.dash.add(pop);
        this.scene.tweens.add({
            targets: pop,
            scale: 1.2,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => pop.destroy(),
        });
    }

    /** The ending: there never was a machine */
    goPlain() {
        this.gone = true;
        this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 400, onComplete: () => this.root.setVisible(false) });
    }

    /** `frozen` while the game is paused: the countdowns here must not run ahead of it */
    update(delta: number, frozen: boolean) {
        if (this.gone || !this.root.visible) {
            return;
        }
        this.clock += delta;
        if (!frozen) {
            if (this.rotateIn !== null) {
                this.rotateIn = Math.max(0, this.rotateIn - delta);
            }
            if (this.dashWait > 0 && this.dashLeft < this.dashMax) {
                this.dashWait = Math.max(0, this.dashWait - delta);
                this.drawPips();
            }
        }
        if (this.rotateIn !== null) {
            this.drawHub();
            if (this.status.warning) {
                const beat = Math.floor(this.clock / 110) % 2 === 0;
                if (beat !== this.beat) {
                    // The colour about to arrive flashes on the wheel, at the pointer and on its badge
                    this.beat = beat;
                    this.drawPointer();
                    this.drawWheel();
                    this.nextBadge?.setScale(beat ? 1.25 : 1);
                }
            }
        }
        if (this.depleted) {
            this.emptyTag.setVisible(Math.floor(this.clock / 180) % 3 !== 2);
            this.drawEnergy();
        }
    }

    private get hasWeapon() {
        return !!this.rule && this.status.ray !== null;
    }

    private show() {
        if (this.gone) {
            return;
        }
        this.disc.setVisible(this.hasWeapon);
        this.dash.setVisible(this.dashMax > 0);
        for (const part of this.furniture) {
            (part as Phaser.GameObjects.Container).setVisible(this.hasWeapon);
        }
        this.root.setVisible(this.hasWeapon || this.dashMax > 0);
    }

    private get step() {
        return (Math.PI * 2) / Math.max(1, this.rule?.wheel.length ?? 1);
    }

    private buildWheel() {
        for (const icon of this.icons) {
            icon.destroy();
        }
        this.icons = [];
        this.spin?.stop();
        const wheel = this.rule!.wheel;
        wheel.forEach((id) => {
            const icon = this.scene.add.image(0, 0, 'icons', RAY_ICON[id] ?? 0);
            this.icons.push(icon);
            this.wheel.add(icon);
        });
        this.wheel.setRotation(this.index * this.step);
        this.keepUpright();
    }

    /** Indices run anticlockwise, so turning right (E, the next index) spins the wheel clockwise */
    private angleOf(index: number) {
        return TOP - index * this.step;
    }

    private turnTo(next: number) {
        const size = this.rule!.wheel.length;
        let steps = (((next - this.index) % size) + size) % size;
        if (steps > size / 2) {
            steps -= size;
        }
        this.index = next;
        this.spin?.stop();
        // Whole turns pile up otherwise; the target is always the nearest way round
        const target = this.wheel.rotation + steps * this.step;
        this.spin = this.scene.tweens.add({
            targets: this.wheel,
            rotation: target,
            duration: 150,
            ease: 'Back.easeOut',
            onUpdate: () => this.keepUpright(),
            onComplete: () => {
                this.wheel.setRotation(this.index * this.step);
                this.keepUpright();
            },
        });
        // A click of the pointer, so the snap is felt
        this.pointerG.setY(-5);
        this.scene.tweens.add({ targets: this.pointerG, y: 0, duration: 130, ease: 'Back.easeOut' });
    }

    private keepUpright() {
        for (const icon of this.icons) {
            icon.setRotation(-this.wheel.rotation);
        }
    }

    private drawWheel() {
        const g = this.wheelG;
        const wheel = this.rule!.wheel;
        const size = wheel.length;
        const inRgb = this.mode === 'rgb';
        g.clear();
        this.wheel.setVisible(inRgb && size > 0);
        if (size === 0) {
            return;
        }
        g.fillStyle(PAPER, 1).fillCircle(0, 0, WHEEL + 4);
        wheel.forEach((id, i) => {
            const active = i === this.index;
            const color = RAYS[id]?.color ?? GREY;
            const flashing = this.status.warning && this.beat && i === this.status.nextIndex;
            const fill = active || flashing ? color : mix(color, INK, 0.55);
            const middle = this.angleOf(i);
            if (size === 1) {
                g.fillStyle(fill, 1).fillCircle(0, 0, WHEEL);
            } else {
                g.fillStyle(fill, 1);
                g.slice(0, 0, WHEEL, middle - this.step / 2, middle + this.step / 2, false);
                g.fillPath();
            }
            const icon = this.icons[i];
            if (icon) {
                const reach = size === 1 ? 0 : active ? 37 : 40;
                icon.setPosition(Math.cos(middle) * reach, Math.sin(middle) * reach)
                    .setScale(active ? 2 : 1)
                    .setAlpha(active ? 1 : 0.75);
            }
        });
        if (size > 1) {
            g.lineStyle(4, INK, 1);
            for (let i = 0; i < size; i++) {
                const edge = this.angleOf(i) + this.step / 2;
                g.lineBetween(0, 0, Math.cos(edge) * WHEEL, Math.sin(edge) * WHEEL);
            }
        }
        g.lineStyle(4, INK, 1).strokeCircle(0, 0, WHEEL);
    }

    private drawEnergy() {
        const g = this.energyG;
        g.clear();
        if (!this.hasWeapon) {
            this.emptyTag.setVisible(false);
            return;
        }
        const color = this.status.ray ? RAYS[this.status.ray].color : GREY;
        const fraction = Phaser.Math.Clamp(this.energy / this.energyMax, 0, 1);
        const arc = (from: number, to: number, width: number, fill: number, alpha = 1) => {
            g.lineStyle(width, fill, alpha).beginPath();
            g.arc(0, 0, RING, RING_START + RING_SPAN * from, RING_START + RING_SPAN * to, false);
            g.strokePath();
        };

        const blink = Math.floor(this.clock / 180) % 2 === 0;
        arc(0, 1, RING_WIDTH, this.depleted ? (blink ? RED : RED_DARK) : WELL);
        if (fraction > 0.004) {
            // Locked out, what has come back is shown grey: it is there, but it cannot be used yet
            arc(0, fraction, RING_WIDTH, this.depleted ? GREY : color);
            arc(0, fraction, 3, WHITE, this.depleted ? 0.25 : 0.5);
        }
        // Quarter marks, to judge whether there is enough for one more shot
        g.lineStyle(2, INK, 0.7);
        for (let i = 1; i < 4; i++) {
            const angle = RING_START + (RING_SPAN * i) / 4;
            g.lineBetween(
                Math.cos(angle) * (RING - RING_WIDTH / 2),
                Math.sin(angle) * (RING - RING_WIDTH / 2),
                Math.cos(angle) * (RING + RING_WIDTH / 2),
                Math.sin(angle) * (RING + RING_WIDTH / 2),
            );
        }
        if (this.depleted) {
            // Where it has to climb back to
            const angle = RING_START + RING_SPAN * (ENERGY.recoverAt / this.energyMax);
            g.lineStyle(4, YELLOW, 1).lineBetween(
                Math.cos(angle) * (RING - RING_WIDTH / 2 - 2),
                Math.sin(angle) * (RING - RING_WIDTH / 2 - 2),
                Math.cos(angle) * (RING + RING_WIDTH / 2 + 2),
                Math.sin(angle) * (RING + RING_WIDTH / 2 + 2),
            );
        } else {
            this.emptyTag.setVisible(false);
        }
        this.disc.setAlpha(1);
        this.wheel.setAlpha(this.depleted ? 0.45 : 1);
        this.emblem?.setAlpha(this.depleted ? 0.45 : 1);
    }

    /** The hub: plain on a free wheel; a padlock inside a draining ring on a locked one */
    private drawHub() {
        const g = this.hubG;
        g.clear();
        const size = this.rule?.wheel.length ?? 0;
        if (size < 2) {
            return;
        }
        const locked = this.rotateIn !== null && !!this.rule?.autoRotateMs;
        if (locked) {
            // How long until the wheel turns by itself, run round its rim
            const left = Phaser.Math.Clamp(this.rotateIn! / this.rule!.autoRotateMs!, 0, 1);
            if (left > 0.004) {
                g.lineStyle(6, this.status.warning ? (this.beat ? WHITE : RED) : YELLOW, 1).beginPath();
                g.arc(0, 0, WHEEL + 4, TOP, TOP + Math.PI * 2 * left, false);
                g.strokePath();
            }
        }
        if (this.mode !== 'rgb') {
            return;
        }
        g.fillStyle(INK, 1).fillCircle(0, 0, HUB);
        if (!locked) {
            g.fillStyle(PAPER, 1).fillCircle(0, 0, HUB - 5);
            g.fillStyle(INK, 1).fillCircle(0, 0, 4);
            return;
        }
        const flash = this.status.warning && this.beat;
        g.fillStyle(flash ? RED : PAPER, 1).fillCircle(0, 0, HUB - 4);
        // The padlock
        const ink = flash ? PAPER : INK;
        g.lineStyle(3, ink, 1).beginPath();
        g.arc(0, -3, 5, Math.PI, 0, false);
        g.strokePath();
        g.fillStyle(ink, 1).fillRect(-7, -3, 14, 11);
        g.fillStyle(flash ? RED : PAPER, 1).fillRect(-1, 0, 2, 5);
    }

    private drawPointer() {
        const g = this.pointerG;
        g.clear();
        const flash = this.status.warning && this.beat;
        const tipY = this.mode === 'rgb' && (this.rule?.wheel.length ?? 0) > 0 ? -WHEEL + 6 : -WHEEL - 2;
        const points = [new Phaser.Math.Vector2(-15, -BACK - 8), new Phaser.Math.Vector2(15, -BACK - 8), new Phaser.Math.Vector2(0, tipY)];
        g.fillStyle(flash ? RED : PAPER, 1).fillPoints(points, true);
        g.lineStyle(4, INK, 1).strokePoints(points, true, true);
    }

    private add<T extends Phaser.GameObjects.GameObject>(part: T) {
        this.furniture.push(part);
        this.root.add(part);
        return part;
    }

    private buildFurniture(pop: boolean) {
        for (const part of this.furniture) {
            this.scene.tweens.killTweensOf(part);
            part.destroy();
        }
        this.furniture = [];
        this.nextBadge = undefined;
        this.emblem = undefined;
        const rule = this.rule!;
        const size = rule.wheel.length;
        const scene = this.scene;

        // UV and white light are not on the wheel: their emblem takes its place
        if (this.mode !== 'rgb' && this.status.ray) {
            const g = scene.add.graphics();
            const ray = this.status.ray;
            const color = RAYS[ray].color;
            if (this.mode === 'uv') {
                g.fillStyle(PAPER, 1).fillCircle(0, 0, WHEEL + 4);
                g.fillStyle(mix(color, INK, 0.55), 1).fillCircle(0, 0, WHEEL);
                g.fillStyle(color, 1).fillCircle(0, 0, WHEEL - 9);
                g.fillStyle(mix(color, INK, 0.3), 1).fillCircle(0, 4, WHEEL - 16);
                g.lineStyle(5, WHITE, 0.8).beginPath();
                g.arc(0, 0, WHEEL - 16, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(262), false);
                g.strokePath();
                g.lineStyle(4, INK, 1).strokeCircle(0, 0, WHEEL);
            } else {
                burst(g, burstPoints(0, 0, WHEEL + 6, WHEEL - 16, 14, 0.12, 9), color, INK, 4);
                g.fillStyle(WHITE, 1).fillCircle(0, 0, WHEEL - 22);
            }
            const icon = scene.add.image(0, 0, 'icons', RAY_ICON[ray] ?? 0).setScale(3);
            this.emblem = scene.add.container(0, 0, [g, icon]);
            this.disc.addAt(this.emblem, this.disc.getIndex(this.hubG));
            this.furniture.push(this.emblem);
            if (pop) {
                this.emblem.setScale(0.6);
                scene.tweens.add({ targets: this.emblem, scale: 1, duration: 150, ease: 'Back.easeOut' });
            }
        }

        const locked = !!rule.autoRotateMs && size >= 2;
        if (this.mode === 'rgb' && size >= 2 && !locked) {
            // The wheel is turned by hand
            const g = scene.add.graphics();
            const caps = scene.add.container(0, 0, [g]);
            for (const [label, x] of [
                ['Q', -74],
                ['E', 74],
            ] as [string, number][]) {
                g.fillStyle(PAPER, 1).fillRect(x - 15, -BACK - 9, 30, 32);
                caps.add(keyCap(scene, g, label, x, -BACK + 6, 16).text);
            }
            this.add(caps);
        }
        if (locked && this.status.nextIndex !== null) {
            // What the wheel will turn to, waiting where the Q cap would be
            const id = rule.wheel[this.status.nextIndex];
            if (id) {
                const g = scene.add.graphics();
                g.fillStyle(PAPER, 1).fillCircle(0, 0, 21);
                g.fillStyle(INK, 1).fillCircle(0, 0, 19);
                g.fillStyle(RAYS[id].color, 1).fillCircle(0, 0, 15);
                // An arrow towards the pointer: this is what comes next
                g.fillStyle(PAPER, 1).fillTriangle(22, -9, 22, 9, 35, 0);
                g.lineStyle(3, INK, 1).strokeTriangle(22, -9, 22, 9, 35, 0);
                const icon = scene.add.image(0, 0, 'icons', RAY_ICON[id] ?? 0);
                this.nextBadge = this.add(scene.add.container(-78, -BACK + 4, [g, icon]));
            }
        }

        // The mode plate, with its key when there is more than one mode to switch between
        const stackY = rule.overdrive ? -50 : -34;
        if (rule.modes.length > 1 || this.mode !== 'rgb') {
            const g = scene.add.graphics();
            const parts: Phaser.GameObjects.GameObject[] = [g];
            const switchable = rule.modes.length > 1;
            const label = MODE_LABELS[this.mode] ?? String(this.mode).toUpperCase();
            const letters =
                this.mode === 'rgb'
                    ? [...label].map((char, i) => ({ char, color: [RAYS.red.color, RAYS.green.color, RAYS.blue.color][i] ?? PAPER }))
                    : [{ char: label, color: MODE_COLORS[this.mode] }];
            const texts = letters.map(({ char, color }) => makeText(scene, 0, 0, char, 26, { bold: true, color }).setOrigin(0, 0.5));
            const lettering = texts.reduce((sum, text) => sum + Math.ceil(text.width) + 1, 0);
            const width = lettering + 22 + (switchable ? 36 : 0);
            plate(g, -width, -19, width, 38, INK);
            let x = -width + 11;
            if (switchable) {
                parts.push(keyCap(scene, g, 'F', x + 13, -1, 16, YELLOW).text);
                x += 36;
            }
            for (const text of texts) {
                text.setPosition(x, 0);
                x += Math.ceil(text.width) + 1;
                parts.push(text);
            }
            const modePlate = this.add(scene.add.container(STACK_RIGHT, stackY, parts));
            if (pop) {
                modePlate.setScale(1.3);
                scene.tweens.add({ targets: modePlate, scale: 1, duration: 140, ease: 'Back.easeOut' });
            }
        }

        if (rule.overdrive) {
            const text = makeText(scene, 0, 0, LABELS.overdrive, 17, { bold: true, color: YELLOW }).setOrigin(0.5);
            const width = Math.ceil(text.width) + 20;
            const g = scene.add.graphics();
            const shape = [
                new Phaser.Math.Vector2(-width / 2 + 6, -14),
                new Phaser.Math.Vector2(width / 2 + 6, -14),
                new Phaser.Math.Vector2(width / 2 - 6, 14),
                new Phaser.Math.Vector2(-width / 2 - 6, 14),
            ];
            g.fillStyle(RED, 1).fillPoints(shape, true);
            g.lineStyle(6, PAPER, 1).strokePoints(shape, true, true);
            g.lineStyle(3, INK, 1).strokePoints(shape, true, true);
            const badge = this.add(scene.add.container(STACK_RIGHT - width / 2 - 4, -8, [g, text]).setAngle(-4));
            scene.tweens.add({ targets: badge, scale: 1.08, duration: 260, yoyo: true, repeat: -1 });
        }
    }

    private pipX(index: number) {
        return STACK_RIGHT - (this.dashMax - index) * (PIP + PIP_GAP) + PIP_GAP;
    }

    private buildDash() {
        for (const part of [...this.pipIcons, ...this.dashParts]) {
            part.destroy();
        }
        this.pipIcons = [];
        this.dashParts = [];
        if (this.dashMax <= 0) {
            return;
        }
        for (let i = 0; i < this.dashMax; i++) {
            const icon = this.scene.add.image(this.pipX(i) + PIP / 2, PIPS_Y, 'icons', DASH_ICON);
            this.pipIcons.push(icon);
            this.dash.add(icon);
        }
        const under = this.scene.add.graphics();
        const g = this.scene.add.graphics();
        const centre = Math.round((this.pipX(0) + STACK_RIGHT) / 2);
        const capY = PIPS_Y + PIP / 2 + 20;
        const cap = keyCap(this.scene, g, LABELS.spaceKey, centre, capY, 14);
        under.fillStyle(PAPER, 1).fillRect(centre - cap.width / 2 - 2, capY - cap.height / 2 - 2, cap.width + 4, cap.height + 7);
        this.dashParts.push(under, g, cap.text);
        this.dash.add([under, g, cap.text]);
    }

    private drawPips() {
        const g = this.pipsG;
        g.clear();
        for (let i = 0; i < this.dashMax; i++) {
            const x = this.pipX(i);
            const y = PIPS_Y - PIP / 2;
            const ready = i < this.dashLeft;
            // Only the first empty pip is on its way back; the ones after it wait their turn
            const filling = i === this.dashLeft && this.dashWait > 0 ? 1 - Phaser.Math.Clamp(this.dashWait / this.dashTotal, 0, 1) : 0;
            g.fillStyle(PAPER, 1).fillRect(x - 2, y - 2, PIP + 4, PIP + 4);
            g.fillStyle(INK, 1).fillRect(x, y, PIP, PIP);
            g.fillStyle(ready ? YELLOW : WELL, 1).fillRect(x + 3, y + 3, PIP - 6, PIP - 6);
            if (!ready && filling > 0) {
                const height = Math.round((PIP - 6) * filling);
                g.fillStyle(mix(YELLOW, INK, 0.3), 1).fillRect(x + 3, y + PIP - 3 - height, PIP - 6, height);
            }
            if (ready) {
                g.fillStyle(WHITE, 0.6).fillRect(x + 3, y + 3, PIP - 6, 3);
            }
            this.pipIcons[i]?.setAlpha(ready ? 1 : 0.3);
        }
    }
}
