import Phaser from 'phaser';
import { GUIDE } from '../config/text';
import type { ArtStyle, MonsterId } from '../types';
import { dashedRect, halftoneFade, panel } from './draw';
import { LABELS } from './labels';
import { INK, PAPER, PAPER_SHADE, PENCIL, RED, STYLE_THEME, makeText } from './theme';

const PICTURE_HEIGHT = 106;
const MARGIN = 12;
const SPRITE_TARGET = 80;
const TRUTH_HEIGHT = 144;

export interface GuideCardOptions {
    width: number;
    height: number;
    /** The palette the monster is drawn in before the truth is shown */
    style: ArtStyle;
    unlocked: boolean;
    /** Leave room at the bottom of the page for what it really was */
    truthSlot: boolean;
}

/** One Field Guide page: the monster, the Handler's note, and (after the ending) the truth */
export class GuideCard {
    readonly container: Phaser.GameObjects.Container;
    private readonly picture: Phaser.GameObjects.Graphics;
    private sprite?: Phaser.GameObjects.Image;
    private revealed = false;

    constructor(
        private readonly scene: Phaser.Scene,
        x: number,
        y: number,
        private readonly id: MonsterId,
        private readonly options: GuideCardOptions,
    ) {
        const { width, height, unlocked } = options;
        const entry = GUIDE[id];
        const inner = width - MARGIN * 2;

        const g = scene.add.graphics();
        panel(g, 0, 0, width, height, PAPER, 4, 6);
        this.picture = scene.add.graphics();
        const parts: Phaser.GameObjects.GameObject[] = [g, this.picture];

        this.drawPicture(unlocked ? options.style : undefined);
        this.sprite = this.makeSprite(options.style);
        if (this.sprite) {
            if (!unlocked) {
                // A shape and nothing else: it has been seen, but not yet understood
                this.sprite.setTint(INK).setTintMode(Phaser.TintModes.FILL).setAlpha(0.8);
            }
            parts.push(this.sprite);
        }

        const titleY = MARGIN + PICTURE_HEIGHT + 10;
        const title = makeText(scene, MARGIN, titleY, unlocked ? entry.title : LABELS.locked, 26, {
            bold: true,
            color: unlocked ? INK : PENCIL,
        });
        if (title.width > inner) {
            title.setScale(inner / title.width);
        }
        g.fillStyle(unlocked ? RED : PENCIL, 1).fillRect(MARGIN, titleY + 34, inner, 3);
        parts.push(title);

        const noteY = titleY + 46;
        const room = height - noteY - MARGIN - (options.truthSlot ? TRUTH_HEIGHT + 8 : 0);
        const noteText = unlocked ? entry.note : LABELS.lockedNote;
        // Long notes step down a size rather than spill off the page
        // (and start smaller on a page that also has to hold the truth, so the pages match)
        const sizes = options.truthSlot ? [17, 15, 13] : [19, 17, 15, 13];
        let note = makeText(scene, MARGIN, noteY, noteText, sizes[0], { wrap: inner, color: unlocked ? INK : PENCIL, lineSpacing: 2 });
        for (const size of sizes.slice(1)) {
            if (note.height <= room) {
                break;
            }
            note.destroy();
            note = makeText(scene, MARGIN, noteY, noteText, size, { wrap: inner, color: unlocked ? INK : PENCIL, lineSpacing: 1 });
        }
        parts.push(note);

        this.container = scene.add.container(x, y, parts);
    }

    /** Swap the drawing for what was really there and stamp the truth underneath */
    revealTruth(animate: boolean) {
        if (this.revealed) {
            return;
        }
        this.revealed = true;
        const { width, height } = this.options;
        const entry = GUIDE[this.id];
        const inner = width - MARGIN * 2;

        this.sprite?.destroy();
        this.drawPicture('plain');
        this.sprite = this.makeSprite('plain');
        if (this.sprite) {
            this.container.add(this.sprite);
        }

        const top = height - MARGIN - TRUTH_HEIGHT;
        const g = this.scene.add.graphics();
        g.fillStyle(RED, 1).fillRect(0, 0, inner, TRUTH_HEIGHT);
        g.fillStyle(0xfffaf0, 1).fillRect(3, 3, inner - 6, TRUTH_HEIGHT - 6);
        g.fillStyle(RED, 1).fillRect(3, 3, inner - 6, 20);
        const label = makeText(this.scene, 9, 4, LABELS.truthLabel, 15, { bold: true, color: 0xfffaf0 });
        let truth = makeText(this.scene, 9, 28, entry.truth, 16, { bold: true, color: RED, wrap: inner - 18 });
        for (const size of [14, 13, 12]) {
            if (truth.height <= TRUTH_HEIGHT - 32) {
                break;
            }
            truth.destroy();
            truth = makeText(this.scene, 9, 28, entry.truth, size, { bold: true, color: RED, wrap: inner - 18 });
        }
        const stamp = this.scene.add.container(MARGIN, top, [g, label, truth]);
        this.container.add(stamp);

        if (animate) {
            // Slammed down like a rubber stamp
            stamp.setPosition(MARGIN - inner * 0.2, top - TRUTH_HEIGHT * 0.2).setScale(1.4).setAlpha(0);
            this.scene.tweens.add({ targets: stamp, x: MARGIN, y: top, scale: 1, alpha: 1, duration: 110, ease: 'Quad.easeIn' });
            if (this.sprite) {
                const scale = this.sprite.scale;
                this.sprite.setScale(scale * 1.25);
                this.scene.tweens.add({ targets: this.sprite, scale, duration: 140, ease: 'Quad.easeOut' });
            }
        }
    }

    private drawPicture(style: ArtStyle | undefined) {
        const g = this.picture;
        const width = this.options.width - MARGIN * 2;
        g.clear();
        if (!style) {
            g.fillStyle(PAPER_SHADE, 1).fillRect(MARGIN, MARGIN, width, PICTURE_HEIGHT);
            dashedRect(g, MARGIN, MARGIN, width, PICTURE_HEIGHT, PENCIL, 8, 3);
            return;
        }
        const theme = STYLE_THEME[style];
        g.fillStyle(INK, 1).fillRect(MARGIN, MARGIN, width, PICTURE_HEIGHT);
        g.fillStyle(theme.floor, 1).fillRect(MARGIN + 3, MARGIN + 3, width - 6, PICTURE_HEIGHT - 6);
        halftoneFade(g, MARGIN + 10, MARGIN + 62, width - 30, PICTURE_HEIGHT - 74, theme.wall, 10, 3.5, 'down', 0.55);
    }

    private makeSprite(style: ArtStyle) {
        let key = `${this.id}-${style}`;
        if (!this.scene.textures.exists(key)) {
            key = `${this.id}-goldenAge`;
        }
        if (!this.scene.textures.exists(key)) {
            return undefined;
        }
        const frame = this.scene.textures.getFrame(key, 0);
        const scale = Math.max(1, Math.floor(SPRITE_TARGET / Math.max(frame.width, frame.height)));
        return this.scene.add.image(this.options.width / 2, MARGIN + PICTURE_HEIGHT / 2, key, 0).setScale(scale);
    }
}

export const GUIDE_ORDER = Object.keys(GUIDE) as MonsterId[];
