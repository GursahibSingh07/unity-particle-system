import Phaser from 'phaser';
import { BANNERS, GUIDE } from '../config/text';
import type { ArtStyle, MonsterId, StyleId } from '../types';
import { burst, burstPoints, halftoneFade, panel, pixelNumber, plate } from './draw';
import { ERA_ICON, eraName } from './eras';
import { LABELS } from './labels';
import { Depth, HUD_STRIP, INK, PAPER, RED, SCREEN_HEIGHT, SCREEN_WIDTH, STYLE_THEME, WHITE, YELLOW, makeText } from './theme';

const BANNER_Y = 290;
const TOAST_WIDTH = 330;
const TOAST_HEIGHT = 68;

/** The big banner over the room, and the small notices that slide in at the edge */
export class Overlays {
    private banner?: Phaser.GameObjects.Container;
    private toasts: Phaser.GameObjects.Container[] = [];
    private secretAt = -99999;
    private telegraph?: { box: Phaser.GameObjects.Container; digits: Phaser.GameObjects.Graphics; left: number; shown: number };
    private hazards: Partial<Record<string, Phaser.GameObjects.Container>> = {};

    constructor(private readonly scene: Phaser.Scene) {}

    /** An empty string clears the banner */
    setBanner(message: string) {
        if (message && message === BANNERS.secret) {
            // The secret has its own flourish; if the event already raised it, do not say it twice
            if (this.scene.time.now - this.secretAt > 1500) {
                this.secretFlourish();
            }
            return;
        }
        this.banner?.destroy();
        this.banner = undefined;
        if (!message) {
            return;
        }

        const text = makeText(this.scene, 0, -2, message.toUpperCase(), 68, {
            bold: true,
            color: YELLOW,
            stroke: INK,
            strokeThickness: 12,
            drop: 5,
        }).setOrigin(0.5);
        // Long messages shrink to fit rather than run off the page
        const limit = SCREEN_WIDTH - 200;
        if (text.width > limit) {
            text.setScale(limit / text.width);
        }
        const half = text.displayWidth / 2 + 56;
        const slant = 26;
        const ribbon = (dx: number, dy: number) => [
            new Phaser.Math.Vector2(-half + slant + dx, -58 + dy),
            new Phaser.Math.Vector2(half + slant + dx, -58 + dy),
            new Phaser.Math.Vector2(half - slant + dx, 58 + dy),
            new Phaser.Math.Vector2(-half - slant + dx, 58 + dy),
        ];
        const g = this.scene.add.graphics();
        g.fillStyle(INK, 1).fillPoints(ribbon(9, 10), true);
        g.fillStyle(RED, 1).fillPoints(ribbon(0, 0), true);
        g.lineStyle(6, INK, 1).strokePoints(ribbon(0, 0), true, true);
        g.lineStyle(3, WHITE, 0.9);
        g.lineBetween(-half + slant + 14, -44, half + slant - 30, -44);

        this.banner = this.scene.add
            .container(SCREEN_WIDTH / 2, BANNER_Y, [g, text])
            .setDepth(Depth.banner)
            .setAngle(-3)
            .setScale(0.5);
        this.scene.tweens.add({ targets: this.banner, scale: 1, duration: 160, ease: 'Back.easeOut' });
    }

    /** A Field Guide page was written: says which, with the monster's face */
    guideToast(id: MonsterId, style: ArtStyle) {
        const entry = GUIDE[id];
        if (!entry) {
            return;
        }
        const g = this.scene.add.graphics();
        panel(g, 0, 0, TOAST_WIDTH, TOAST_HEIGHT, PAPER, 4, 5);
        g.fillStyle(YELLOW, 1).fillRect(4, 4, 60, TOAST_HEIGHT - 8);
        g.fillStyle(INK, 1).fillRect(64, 4, 3, TOAST_HEIGHT - 8);
        const parts: Phaser.GameObjects.GameObject[] = [g];

        const key = `${id}-${style}`;
        if (this.scene.textures.exists(key)) {
            const frame = this.scene.textures.getFrame(key, 0);
            const scale = Math.max(1, Math.round(52 / Math.max(frame.width, frame.height)));
            parts.push(this.scene.add.image(34, TOAST_HEIGHT / 2, key, 0).setScale(scale));
        }
        parts.push(makeText(this.scene, 78, 9, LABELS.guideUpdated, 16, { bold: true, color: RED }));
        const title = makeText(this.scene, 78, 28, entry.title, 26, { bold: true });
        const room = TOAST_WIDTH - 78 - 12;
        if (title.width > room) {
            title.setScale(room / title.width);
        }
        parts.push(title);
        this.slideIn(this.scene.add.container(0, 0, parts), 2600);
    }

    /** A secret wall broke: a quick starburst under the HUD, clear of the banner's place */
    secretFlourish() {
        this.secretAt = this.scene.time.now;
        const text = makeText(this.scene, 0, 0, BANNERS.secret.toUpperCase(), 34, {
            bold: true,
            color: INK,
        }).setOrigin(0.5);
        const stretch = (text.width / 2 + 60) / 60;
        const g = this.scene.add.graphics();
        burst(g, burstPoints(6, 7, 60, 40, 14, 0.25, 7, stretch), INK, INK, 0);
        burst(g, burstPoints(0, 0, 60, 40, 14, 0.25, 7, stretch), YELLOW, INK, 5);
        const container = this.scene.add
            .container(SCREEN_WIDTH / 2, HUD_STRIP + 86, [g, text])
            .setDepth(Depth.banner + 1)
            .setScale(0.2)
            .setAngle(-8);
        this.scene.tweens.chain({
            targets: container,
            tweens: [
                { scale: 1.15, angle: 3, duration: 140, ease: 'Quad.easeOut' },
                { scale: 1, angle: 0, duration: 90 },
                { scale: 1.03, duration: 1500 },
                { alpha: 0, scale: 1.3, duration: 160 },
            ],
            onComplete: () => container.destroy(),
        });
    }

    /** The final surge of a timed era: slammed across the square and gone */
    surge() {
        const word = (BANNERS as Record<string, string>).surge ?? LABELS.surge;
        const text = makeText(this.scene, 0, 0, word.toUpperCase(), 92, {
            bold: true,
            color: YELLOW,
            stroke: INK,
            strokeThickness: 14,
            drop: 6,
        }).setOrigin(0.5);
        const limit = SCREEN_WIDTH - 320;
        if (text.width > limit) {
            text.setScale(limit / text.width);
        }
        const stretch = (text.displayWidth / 2 + 90) / 100;
        const g = this.scene.add.graphics();
        burst(g, burstPoints(9, 10, 100, 66, 16, 0.3, 11, stretch), INK, INK, 0);
        burst(g, burstPoints(0, 0, 100, 66, 16, 0.3, 11, stretch), RED, INK, 6);
        const container = this.scene.add
            .container(SCREEN_WIDTH / 2, 250, [g, text])
            .setDepth(Depth.banner + 2)
            .setScale(2.2)
            .setAngle(-5)
            .setAlpha(0);
        this.scene.tweens.chain({
            targets: container,
            tweens: [
                { scale: 1, alpha: 1, duration: 110, ease: 'Quad.easeIn' },
                { scale: 1.06, duration: 80, yoyo: true },
                { scale: 1.02, duration: 750 },
                { alpha: 0, scale: 1.3, duration: 150 },
            ],
            onComplete: () => container.destroy(),
        });
    }

    /** A checkpoint was reached: a small tag hung from the clock, never in the way */
    checkpoint() {
        const text = makeText(this.scene, 10, 0, LABELS.checkpoint, 18, { bold: true, color: PAPER }).setOrigin(0.5);
        const width = Math.ceil(text.width) + 50;
        const g = this.scene.add.graphics();
        plate(g, -width / 2, -16, width, 32, INK);
        // A little flag
        g.fillStyle(PAPER, 1).fillRect(-width / 2 + 12, -10, 3, 20);
        g.fillStyle(YELLOW, 1).fillTriangle(-width / 2 + 15, -10, -width / 2 + 15, 2, -width / 2 + 28, -4);
        const tag = this.scene.add.container(SCREEN_WIDTH / 2, HUD_STRIP - 20, [g, text]).setDepth(Depth.hud - 1).setAlpha(0);
        this.scene.tweens.chain({
            targets: tag,
            tweens: [
                { y: HUD_STRIP + 22, alpha: 1, duration: 150, ease: 'Back.easeOut' },
                { y: HUD_STRIP + 22, duration: 1500 },
                { y: HUD_STRIP - 20, alpha: 0, duration: 140, ease: 'Quad.easeIn' },
            ],
            onComplete: () => tag.destroy(),
        });
    }

    /** BOSS_TELEGRAPH: the era about to arrive, named, with its icon, counting down */
    eraShift(style: StyleId, inMs: number) {
        this.clearTelegraph();
        const theme = STYLE_THEME[style] ?? STYLE_THEME.goldenAge;
        const label = makeText(this.scene, 0, -17, LABELS.eraShift, 17, { bold: true, color: RED }).setOrigin(0, 0.5);
        const name = makeText(this.scene, 0, 9, eraName(style).toUpperCase(), 30, { bold: true }).setOrigin(0, 0.5);
        if (name.width > 300) {
            name.setScale(300 / name.width);
        }
        const textWidth = Math.max(label.width, name.displayWidth);
        const width = Math.ceil(textWidth) + 76 + 66 + 24;
        const left = -width / 2;
        const g = this.scene.add.graphics();
        panel(g, left, -34, width, 68, PAPER, 4, 6);
        g.fillStyle(theme.band, 1).fillRect(left + 4, -30, 66, 60);
        g.fillStyle(INK, 1).fillRect(left + 70, -30, 3, 60);
        g.fillStyle(RED, 1).fillRect(left + width - 66, -30, 62, 60);
        g.fillStyle(INK, 1).fillRect(left + width - 69, -30, 3, 60);
        const parts: Phaser.GameObjects.GameObject[] = [g, label, name];
        label.setX(left + 84);
        name.setX(left + 84);
        const frame = ERA_ICON[style];
        if (frame !== undefined && this.scene.textures.exists('era-icons')) {
            parts.push(this.scene.add.image(left + 37, 0, 'era-icons', frame).setScale(2));
        }
        const digits = this.scene.add.graphics().setPosition(left + width - 35, 0);
        parts.push(digits);
        const box = this.scene.add.container(SCREEN_WIDTH / 2, HUD_STRIP + 52, parts).setDepth(Depth.banner + 1).setScale(0.5);
        this.scene.tweens.add({ targets: box, scale: 1, duration: 140, ease: 'Back.easeOut' });
        this.telegraph = { box, digits, left: Math.max(0, inMs || 0), shown: -1 };
        this.update(0, false);
    }

    /** ERA_SWAPPED: the page tears over to another era */
    eraSwapped(style: StyleId) {
        this.clearTelegraph();
        const theme = STYLE_THEME[style] ?? STYLE_THEME.goldenAge;
        const flash = this.scene.add.graphics().setDepth(Depth.banner);
        flash.fillStyle(style === 'retro' || style === 'cyberpunk' ? theme.band : WHITE, 1).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        flash.setAlpha(0.85);
        this.scene.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });

        const g = this.scene.add.graphics();
        const height = 150;
        g.fillStyle(theme.titleStroke === 0xffffff ? 0x000000 : INK, 1).fillRect(-SCREEN_WIDTH, -height / 2 - 6, SCREEN_WIDTH * 2, height + 12);
        g.fillStyle(theme.band, 1).fillRect(-SCREEN_WIDTH, -height / 2, SCREEN_WIDTH * 2, height);
        halftoneFade(g, 80, -height / 2 + 6, 560, height - 12, theme.accent, 14, 6, 'right', 0.6);
        halftoneFade(g, -640, -height / 2 + 6, 560, height - 12, theme.accent, 14, 6, 'left', 0.6);
        const title = makeText(this.scene, 0, 0, eraName(style).toUpperCase(), 92, {
            bold: true,
            color: theme.title,
            stroke: theme.titleStroke,
            strokeThickness: 14,
            drop: 6,
            dropColor: theme.titleStroke,
        }).setOrigin(0.5);
        if (title.width > 900) {
            title.setScale(900 / title.width);
        }
        const parts: Phaser.GameObjects.GameObject[] = [g, title];
        const frame = ERA_ICON[style];
        if (frame !== undefined && this.scene.textures.exists('era-icons')) {
            const offset = title.displayWidth / 2 + 70;
            parts.push(this.scene.add.image(-offset, 0, 'era-icons', frame).setScale(4), this.scene.add.image(offset, 0, 'era-icons', frame).setScale(4));
        }
        const band = this.scene.add
            .container(SCREEN_WIDTH / 2, 330, parts)
            .setDepth(Depth.banner + 1)
            .setAngle(-4)
            .setScale(1, 0.1);
        this.scene.tweens.chain({
            targets: band,
            tweens: [
                { scaleY: 1, duration: 90, ease: 'Quad.easeOut' },
                { scaleY: 1, duration: 520 },
                { scaleY: 0, alpha: 0.6, duration: 110, ease: 'Quad.easeIn' },
            ],
            onComplete: () => band.destroy(),
        });
    }

    /** HAZARD: a tag under the health blocks for as long as he stands in it */
    hazard(kind: string, on: boolean) {
        this.hazards[kind]?.destroy();
        this.hazards[kind] = undefined;
        if (on) {
            const acid = kind === 'acid';
            const text = makeText(this.scene, 0, 0, acid ? LABELS.acid : LABELS.ice, 17, { bold: true, color: INK }).setOrigin(0.5);
            const width = Math.ceil(text.width) + 20;
            const g = this.scene.add.graphics();
            plate(g, -width / 2, -15, width, 30, acid ? 0x9fe84a : 0xa6e4ff);
            const tag = this.scene.add.container(0, HUD_STRIP + 22, [g, text]).setDepth(Depth.hud + 1);
            tag.setData('width', width);
            this.hazards[kind] = tag;
        }
        let x = 24;
        for (const tag of Object.values(this.hazards)) {
            if (tag) {
                const width = tag.getData('width') as number;
                tag.setX(x + width / 2);
                x += width + 10;
            }
        }
    }

    /** A new era, a new life or the ending: nothing of the last fight may linger */
    clear() {
        this.clearTelegraph();
        for (const kind of Object.keys(this.hazards)) {
            this.hazards[kind]?.destroy();
            this.hazards[kind] = undefined;
        }
    }

    update(delta: number, frozen: boolean) {
        const telegraph = this.telegraph;
        if (!telegraph) {
            return;
        }
        if (!frozen) {
            telegraph.left -= delta;
        }
        if (telegraph.left < -1500) {
            // The swap never came (the boss died first): do not leave the warning up
            this.clearTelegraph();
            return;
        }
        const seconds = Math.max(1, Math.ceil(telegraph.left / 1000));
        if (seconds !== telegraph.shown) {
            telegraph.shown = seconds;
            telegraph.digits.clear();
            pixelNumber(telegraph.digits, String(Math.min(9, seconds)), 0, 0, 6, PAPER, INK);
            telegraph.digits.setScale(1.5);
            this.scene.tweens.add({ targets: telegraph.digits, scale: 1, duration: 160, ease: 'Quad.easeOut' });
        }
    }

    private clearTelegraph() {
        if (this.telegraph) {
            this.scene.tweens.killTweensOf([this.telegraph.box, this.telegraph.digits]);
            this.telegraph.box.destroy();
            this.telegraph = undefined;
        }
    }

    private slideIn(toast: Phaser.GameObjects.Container, hold: number) {
        const x = SCREEN_WIDTH - TOAST_WIDTH - 22;
        const y = HUD_STRIP + 14 + this.toasts.length * (TOAST_HEIGHT + 12);
        toast.setDepth(Depth.toast).setPosition(SCREEN_WIDTH + 10, y);
        this.toasts.push(toast);
        this.scene.tweens.chain({
            targets: toast,
            tweens: [
                { x, duration: 180, ease: 'Back.easeOut' },
                { x, duration: hold },
                { x: SCREEN_WIDTH + 10, duration: 160, ease: 'Quad.easeIn' },
            ],
            onComplete: () => {
                this.toasts = this.toasts.filter((other) => other !== toast);
                toast.destroy();
            },
        });
    }
}
