import Phaser from 'phaser';
import { GUIDE } from '../config/text';
import type { ArtStyle, MonsterId } from '../types';
import { dashedRect, halftoneFade, panel } from './draw';
import { getSettings } from '../settings';
import { LABELS } from './labels';
import { rayNames, weakTo } from './WeaponGuide';
import { INK, PAPER, PAPER_SHADE, PENCIL, RED, STYLE_THEME, makeText } from './theme';

const MARGIN = 12;

export interface GuideCardOptions {
    width: number;
    height: number;
    /** The palette the monster is drawn in before the truth is shown */
    style: ArtStyle;
    unlocked: boolean;
    /** Leave room at the bottom of the page for what it really was */
    truthSlot: boolean;
    /** Height of the picture at the top of the page (default 106) */
    pictureHeight?: number;
    /** Lettering sizes: the title, and the note's sizes to step down through */
    titleSize?: number;
    noteSizes?: number[];
    /** Height of the truth stamp (default 144) */
    truthHeight?: number;
    /** Small pages have no room for both: the truth is stamped over the note */
    truthOverNote?: boolean;
}

// The order they are met in, era by era (docs/DESIGN.md section 6)
const MET_ORDER: MonsterId[] = ['rat', 'slime', 'bat', 'ironclad', 'golem', 'zigbat', 'skitter', 'ghost', 'wraith', 'snowman', 'acidSlime', 'prism'];

/** Every Field Guide page there are words for */
export const GUIDE_ORDER: MonsterId[] = [
    ...MET_ORDER.filter((id) => GUIDE[id]),
    ...(Object.keys(GUIDE) as MonsterId[]).filter((id) => !MET_ORDER.includes(id)),
];

/** The enemy sheets come in five frame sizes: the largest whole scale that fits a box */
export function guideSprite(scene: Phaser.Scene, id: MonsterId, style: ArtStyle, box: number, maxScale = 6) {
    let key = `${id}-${style}`;
    if (!scene.textures.exists(key)) {
        key = `${id}-goldenAge`;
    }
    if (!scene.textures.exists(key)) {
        return undefined;
    }
    const frame = scene.textures.getFrame(key, 0);
    const scale = Phaser.Math.Clamp(Math.floor(box / Math.max(frame.width, frame.height)), 1, maxScale);
    return scene.add.image(0, 0, key, 0).setScale(scale);
}

/** One Field Guide page: the monster, the Handler's note, and (after the ending) the truth */
export class GuideCard {
    readonly container: Phaser.GameObjects.Container;
    private readonly picture: Phaser.GameObjects.Graphics;
    private readonly pictureHeight: number;
    private readonly noteY: number;
    private note: Phaser.GameObjects.Text;
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
        this.pictureHeight = options.pictureHeight ?? 106;
        const titleSize = options.titleSize ?? 26;
        const truthHeight = options.truthHeight ?? 144;

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

        const titleY = MARGIN + this.pictureHeight + Math.round(titleSize * 0.35);
        const title = makeText(scene, MARGIN, titleY, unlocked ? (entry?.title ?? id) : LABELS.locked, titleSize, {
            bold: true,
            color: unlocked ? INK : PENCIL,
        });
        if (title.width > inner) {
            title.setScale(inner / title.width);
        }
        const ruleY = titleY + Math.round(titleSize * 1.3);
        g.fillStyle(unlocked ? RED : PENCIL, 1).fillRect(MARGIN, ruleY, inner, 3);
        parts.push(title);

        this.noteY = ruleY + Math.round(titleSize * 0.4) + 2;
        const stacked = options.truthSlot && !options.truthOverNote;
        const room = height - this.noteY - MARGIN - (stacked ? truthHeight + 8 : 0);
        let noteText = unlocked ? (entry?.note ?? '') : LABELS.lockedNote;
        if (getSettings().demoMode) {
            // Demo mode gives away what the game otherwise leaves the player to find out
            const rays = weakTo(id);
            noteText += `
${LABELS.weakTo} ${rays.length > 0 ? rayNames(rays) : LABELS.noWeakness}`;
        }
        // Long notes step down a size rather than spill off the page
        const sizes = options.noteSizes ?? (options.truthSlot ? [17, 15, 13] : [19, 17, 15, 13]);
        const make = (size: number) =>
            makeText(scene, MARGIN, this.noteY, noteText, size, { wrap: inner, color: unlocked ? INK : PENCIL, lineSpacing: 2 });
        this.note = make(sizes[0]);
        for (const size of sizes.slice(1)) {
            if (this.note.height <= room) {
                break;
            }
            this.note.destroy();
            this.note = make(size);
        }
        parts.push(this.note);

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

        const over = !!this.options.truthOverNote;
        const stampHeight = over ? height - MARGIN - this.noteY : (this.options.truthHeight ?? 144);
        const top = height - MARGIN - stampHeight;
        if (over) {
            // The officer's correction goes where the Handler's note was
            this.note.setVisible(false);
        }
        const labelSize = over ? 13 : 15;
        const band = labelSize + 6;
        const g = this.scene.add.graphics();
        g.fillStyle(RED, 1).fillRect(0, 0, inner, stampHeight);
        g.fillStyle(0xfffaf0, 1).fillRect(3, 3, inner - 6, stampHeight - 6);
        g.fillStyle(RED, 1).fillRect(3, 3, inner - 6, band);
        const label = makeText(this.scene, 8, 4, LABELS.truthLabel, labelSize, { bold: true, color: 0xfffaf0 });
        const sizes = over ? [15, 14, 13, 12, 11] : [20, 18, 16, 14, 13, 12];
        const truthText = entry?.truth ?? '';
        const make = (size: number) => makeText(this.scene, 8, band + 7, truthText, size, { bold: true, color: RED, wrap: inner - 16 });
        let truth = make(sizes[0]);
        for (const size of sizes.slice(1)) {
            if (truth.height <= stampHeight - band - 12) {
                break;
            }
            truth.destroy();
            truth = make(size);
        }
        const stamp = this.scene.add.container(MARGIN, top, [g, label, truth]);
        this.container.add(stamp);

        if (animate) {
            // Slammed down like a rubber stamp
            stamp.setPosition(MARGIN - inner * 0.2, top - stampHeight * 0.2).setScale(1.4).setAlpha(0);
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
        const height = this.pictureHeight;
        g.clear();
        if (!style) {
            g.fillStyle(PAPER_SHADE, 1).fillRect(MARGIN, MARGIN, width, height);
            dashedRect(g, MARGIN, MARGIN, width, height, PENCIL, 8, 3);
            return;
        }
        const theme = STYLE_THEME[style];
        g.fillStyle(INK, 1).fillRect(MARGIN, MARGIN, width, height);
        g.fillStyle(theme.floor, 1).fillRect(MARGIN + 3, MARGIN + 3, width - 6, height - 6);
        halftoneFade(g, MARGIN + 10, MARGIN + Math.round(height * 0.58), width - 30, Math.round(height * 0.3), theme.wall, 10, 3.5, 'down', 0.55);
    }

    private makeSprite(style: ArtStyle) {
        const box = Math.min(this.pictureHeight - 14, this.options.width - MARGIN * 2 - 14);
        return guideSprite(this.scene, this.id, style, box)?.setPosition(this.options.width / 2, MARGIN + this.pictureHeight / 2);
    }
}
