import Phaser from 'phaser';
import { BANNERS, GUIDE } from '../config/text';
import type { ArtStyle, MonsterId } from '../types';
import { burst, burstPoints, panel } from './draw';
import { LABELS } from './labels';
import { Depth, HUD_STRIP, INK, PAPER, RED, SCREEN_WIDTH, WHITE, YELLOW, makeText } from './theme';

const BANNER_Y = 290;
const TOAST_WIDTH = 330;
const TOAST_HEIGHT = 68;

/** The big banner over the room, and the small notices that slide in at the edge */
export class Overlays {
    private banner?: Phaser.GameObjects.Container;
    private toasts: Phaser.GameObjects.Container[] = [];
    private secretAt = -99999;

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
            const scale = Math.max(1, Math.floor(48 / frame.width));
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
