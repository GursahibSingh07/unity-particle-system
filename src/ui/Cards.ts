import Phaser from 'phaser';
import { RADIATIONS } from '../config/radiation';
import { ENDING, ITEM_GET } from '../config/text';
import type { RadiationId } from '../types';
import type { Modal, ModalHooks } from './Captions';
import { burst, burstPoints, halftoneFade, panel, pixelNumber, rays } from './draw';
import { GUIDE_ORDER, GuideCard } from './GuideCard';
import { LABELS } from './labels';
import { Depth, GREY, INK, PAPER, RED, SCREEN_HEIGHT, SCREEN_WIDTH, WHITE, YELLOW, makeText } from './theme';

const ICON_FRAMES: Record<RadiationId, number> = { radio: 0, infrared: 1, ultraviolet: 2, gamma: 3 };

/** Shared by every full-screen card: it cannot be dismissed until `unlock` has been called */
abstract class Card implements Modal {
    protected readonly root: Phaser.GameObjects.Container;
    private cue?: Phaser.GameObjects.Container;
    private unlocked = false;
    private finished = false;
    private timers: Phaser.Time.TimerEvent[] = [];
    private tweens: Phaser.Tweens.Tween[] = [];

    constructor(
        protected readonly scene: Phaser.Scene,
        protected readonly hooks: ModalHooks,
    ) {
        this.root = scene.add.container(0, 0).setDepth(Depth.card);
    }

    advance() {
        if (this.finished) {
            return;
        }
        if (!this.unlocked) {
            this.hurry();
            return;
        }
        this.hooks.select();
        this.destroy();
        this.hooks.done();
    }

    destroy() {
        this.finished = true;
        for (const timer of this.timers) {
            timer.remove();
        }
        // Looping tweens would otherwise outlive the objects they move
        for (const tween of this.tweens) {
            tween.stop();
        }
        this.root.destroy();
    }

    protected tween(config: Phaser.Types.Tweens.TweenBuilderConfig) {
        const tween = this.scene.tweens.add(config);
        this.tweens.push(tween);
        return tween;
    }

    /** A press before the card can be dismissed; cards that reveal things step by step speed up */
    protected hurry() {}

    protected later(delay: number, callback: () => void) {
        this.timers.push(
            this.scene.time.delayedCall(delay, () => {
                if (!this.finished) {
                    callback();
                }
            }),
        );
    }

    /** From now on a press dismisses the card; shows the cue that says so */
    protected unlock(cueColor = PAPER) {
        if (this.unlocked || this.finished) {
            return;
        }
        this.unlocked = true;
        const label = makeText(this.scene, -22, 0, LABELS.continue, 18, { bold: true, color: cueColor }).setOrigin(1, 0.5);
        const arrow = this.scene.add.graphics();
        arrow.fillStyle(cueColor, 1).fillTriangle(-14, -8, 2, -8, -6, 6);
        this.cue = this.scene.add.container(SCREEN_WIDTH - 28, SCREEN_HEIGHT - 26, [label, arrow]);
        this.root.add(this.cue);
        this.tween({ targets: arrow, y: 5, duration: 320, yoyo: true, repeat: -1 });
    }

    protected dim(alpha: number, color = INK) {
        const g = this.scene.add.graphics();
        g.fillStyle(color, alpha).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        this.root.add(g);
        return g;
    }
}

/** A new radiation, held up in a burst of its own colour */
export class ItemGetModal extends Card {
    constructor(scene: Phaser.Scene, id: RadiationId, hooks: ModalHooks) {
        super(scene, hooks);
        const def = RADIATIONS[id];
        const words = ITEM_GET[id];
        const cx = SCREEN_WIDTH / 2;
        const cy = 270;
        this.dim(0.78);

        const spin = scene.add.graphics();
        rays(spin, 0, 0, 900, 24, def?.color ?? YELLOW, 0.4);
        const spinner = scene.add.container(cx, cy, [spin]);
        this.tween({ targets: spinner, angle: 360, duration: 14000, repeat: -1 });

        const star = scene.add.graphics();
        burst(star, burstPoints(8, 9, 190, 132, 16, 0.18, 3), INK, INK, 0);
        burst(star, burstPoints(0, 0, 190, 132, 16, 0.18, 3), YELLOW, INK, 6);
        burst(star, burstPoints(0, 0, 150, 108, 16, 0.18, 3), WHITE, INK, 0);
        const starBox = scene.add.container(cx, cy, [star]).setScale(0.2);
        this.tween({ targets: starBox, scale: 1, duration: 200, ease: 'Back.easeOut' });

        const icon = scene.add.image(cx, cy, 'icons', ICON_FRAMES[id] ?? 0).setScale(2);
        this.tween({ targets: icon, scale: 12, duration: 240, ease: 'Back.easeOut', delay: 60 });

        const plateWidth = 880;
        const plateTop = 476;
        const plate = scene.add.graphics();
        panel(plate, cx - plateWidth / 2, plateTop, plateWidth, 164, PAPER, 5, 9);
        plate.fillStyle(def?.color ?? YELLOW, 1).fillRect(cx - plateWidth / 2 + 5, plateTop + 5, plateWidth - 10, 12);
        plate.fillStyle(INK, 1).fillRect(cx - plateWidth / 2 + 5, plateTop + 17, plateWidth - 10, 3);

        const title = makeText(scene, cx, plateTop + 66, words?.title ?? id.toUpperCase(), 68, {
            bold: true,
            color: def?.color ?? YELLOW,
            stroke: INK,
            strokeThickness: 12,
            drop: 4,
        }).setOrigin(0.5);
        if (title.width > plateWidth - 40) {
            title.setScale((plateWidth - 40) / title.width);
        }
        const line = makeText(scene, cx, plateTop + 128, words?.line ?? '', 25, {
            wrap: plateWidth - 60,
            align: 'center',
        }).setOrigin(0.5);
        if (line.height > 40) {
            line.setFontSize(20);
        }

        // Which key it is on, as a key cap: the one thing on this card that must not be misread
        const keyCap = scene.add.graphics();
        if (def) {
            const cap = 64;
            const capX = cx + plateWidth / 2 - 62;
            const capY = plateTop + 66;
            keyCap.fillStyle(INK, 1).fillRect(capX - cap / 2 + 5, capY - cap / 2 + 6, cap, cap);
            keyCap.fillStyle(INK, 1).fillRect(capX - cap / 2, capY - cap / 2, cap, cap);
            keyCap.fillStyle(PAPER, 1).fillRect(capX - cap / 2 + 5, capY - cap / 2 + 5, cap - 10, cap - 10);
            pixelNumber(keyCap, String(def.key), capX, capY, 5, INK);
        }

        this.root.add([spinner, starBox, icon, plate, keyCap, title, line]);
        this.later(1200, () => this.unlock());
    }
}

const SHEET_WIDTH = 920;
const LABEL_WIDTH = 150;
const SHEET_TOP = 24;
const SHEET_HEIGHT = SCREEN_HEIGHT - 48;
const SHEET_COLOR = 0xf6f3e8;
const FORM_INK = 0x2c2a35;
const LINE_INTERVAL = 430;

/**
 * The arrest report: the whole game's punchline, as flat as a real form. Rows are typed in
 * one at a time, the stamp lands, and only after a beat can it be put away.
 */
export class ReportModal extends Card {
    private rows: Phaser.GameObjects.Container[] = [];
    private shownRows = 0;
    private stamp?: Phaser.GameObjects.Container;
    private stamped = false;

    constructor(scene: Phaser.Scene, hooks: ModalHooks) {
        super(scene, hooks);
        this.dim(1, 0x2b2733);
        const left = (SCREEN_WIDTH - SHEET_WIDTH) / 2;

        const desk = scene.add.graphics();
        halftoneFade(desk, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x3a3546, 16, 5, 'down');
        // A second sheet underneath, slightly out of square, so the form sits on a pile
        const under = scene.add.graphics().setPosition(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2).setAngle(1.6);
        under.fillStyle(0x1b1820, 1).fillRect(-SHEET_WIDTH / 2 + 8, -SHEET_HEIGHT / 2 + 8, SHEET_WIDTH, SHEET_HEIGHT);
        under.fillStyle(0xdedacb, 1).fillRect(-SHEET_WIDTH / 2, -SHEET_HEIGHT / 2, SHEET_WIDTH, SHEET_HEIGHT);
        const sheet = scene.add.graphics();
        sheet.fillStyle(0x1b1820, 0.6).fillRect(left + 6, SHEET_TOP + 6, SHEET_WIDTH, SHEET_HEIGHT);
        sheet.fillStyle(SHEET_COLOR, 1).fillRect(left, SHEET_TOP, SHEET_WIDTH, SHEET_HEIGHT);
        // Punch holes and a margin rule
        sheet.fillStyle(0xd9a0a0, 1).fillRect(left + 70, SHEET_TOP, 2, SHEET_HEIGHT);
        sheet.fillStyle(0x2b2733, 1);
        for (const y of [150, 360, 570]) {
            sheet.fillCircle(left + 34, y, 11);
        }
        this.root.add([desk, under, sheet]);

        this.layout(left + 96, SHEET_WIDTH - 96 - 44);
        this.buildStamp(left + SHEET_WIDTH - 150, SHEET_TOP + 78);

        this.later(500, () => this.typeNext());
    }

    protected hurry() {
        // An impatient press brings the next row at once, but the stamp still gets its beat
        if (this.shownRows < this.rows.length) {
            this.showRow();
        }
    }

    private layout(x: number, width: number) {
        const lines = ENDING.report.map((line) => String(line));
        const available = SHEET_HEIGHT - 70;
        // Try the comfortable size first, and step down until the form fits its sheet
        for (const scale of [1, 0.92, 0.84, 0.76, 0.66, 0.56]) {
            for (const row of this.rows) {
                row.destroy();
            }
            this.rows = [];
            let y = SHEET_TOP + 34;
            lines.forEach((line, index) => {
                const row = this.scene.add.container(x, y);
                const kind = index === 0 ? 'heading' : index === lines.length - 1 ? 'last' : 'field';
                y += this.buildRow(row, line, kind, width, scale);
                row.setVisible(false);
                this.rows.push(row);
            });
            if (y - SHEET_TOP <= available + 34) {
                break;
            }
        }
        this.root.add(this.rows);
    }

    /** Returns the height the row takes up */
    private buildRow(row: Phaser.GameObjects.Container, line: string, kind: 'heading' | 'field' | 'last', width: number, scale: number) {
        const g = this.scene.add.graphics();
        row.add(g);
        const size = (n: number) => Math.max(12, Math.round(n * scale));

        if (kind === 'heading') {
            const title = makeText(this.scene, 0, 0, line, size(46), { bold: true, color: FORM_INK, wrap: width - 200 });
            row.add(title);
            const bottom = Math.ceil(title.height) + size(6);
            g.fillStyle(FORM_INK, 1).fillRect(0, bottom, width, 4);
            g.fillStyle(FORM_INK, 1).fillRect(0, bottom + 7, width, 1);
            return bottom + size(24);
        }
        if (line.trim() === '') {
            return size(18);
        }

        // "Label: value" is a field of the form: a small printed label, then the typed value on a rule
        const field = /^([^:]{1,24}):\s*(.+)$/.exec(line);
        const labelWidth = Math.round(LABEL_WIDTH * scale);
        const last = kind === 'last';
        const top = last ? size(16) : 0;
        if (last) {
            // The last entry is what it all comes to, so it gets the heavy box
            g.fillStyle(FORM_INK, 1).fillRect(0, size(4), width, 3);
        }
        const valueText = field ? field[2] : line;
        const valueX = field ? labelWidth : 0;
        const value = makeText(this.scene, valueX, top, valueText, size(last ? 27 : 23), {
            bold: last,
            color: FORM_INK,
            wrap: width - valueX,
            lineSpacing: 2,
        });
        row.add(value);
        if (field) {
            const label = makeText(this.scene, 0, top + size(last ? 8 : 6), field[1].toUpperCase(), size(15), { bold: true, color: 0x8a8794 });
            if (label.width > labelWidth - 10) {
                label.setScale((labelWidth - 10) / label.width);
            }
            row.add(label);
        }
        const bottom = top + Math.ceil(value.height) + size(3);
        g.fillStyle(last ? FORM_INK : 0xb9b5c4, 1).fillRect(0, bottom, width, last ? 3 : 2);
        return bottom + size(11);
    }

    private buildStamp(x: number, y: number) {
        const text = makeText(this.scene, 0, 0, LABELS.reportStamp, 52, { bold: true, color: RED }).setOrigin(0.5);
        const width = Math.ceil(text.width) + 44;
        const g = this.scene.add.graphics();
        g.lineStyle(6, RED, 1).strokeRect(-width / 2, -40, width, 80);
        g.lineStyle(2, RED, 1).strokeRect(-width / 2 + 9, -31, width - 18, 62);
        this.stamp = this.scene.add.container(x, y, [g, text]).setAngle(-11).setAlpha(0);
        this.root.add(this.stamp);
    }

    private typeNext() {
        if (this.shownRows < this.rows.length) {
            this.showRow();
            this.later(LINE_INTERVAL, () => this.typeNext());
        }
    }

    private showRow() {
        const row = this.rows[this.shownRows++];
        if (!row) {
            return;
        }
        row.setVisible(true);
        this.hooks.select();
        if (this.shownRows >= this.rows.length && !this.stamped) {
            this.stamped = true;
            this.later(900, () => this.slam());
        }
    }

    private slam() {
        if (!this.stamp) {
            return;
        }
        this.stamp.setScale(2.6).setAlpha(0);
        this.tween({
            targets: this.stamp,
            scale: 1,
            alpha: 0.88,
            duration: 110,
            ease: 'Quad.easeIn',
            onComplete: () => this.scene.cameras.main.shake(120, 0.004),
        });
        // Let it sit: this is the joke
        this.later(1700, () => this.unlock(GREY));
    }
}

const TRUTH_CARD_WIDTH = 228;
const TRUTH_CARD_HEIGHT = 470;
const TRUTH_GAP = 14;
const TRUTH_INTERVAL = 1100;

/** Every Field Guide page, one by one turned into what it really was */
export class GuideTruthModal extends Card {
    private cards: GuideCard[] = [];
    private revealed = 0;

    constructor(scene: Phaser.Scene, hooks: ModalHooks) {
        super(scene, hooks);
        this.dim(1, 0x2b2733);
        const back = scene.add.graphics();
        halftoneFade(back, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x3a3546, 16, 5, 'up');
        this.root.add(back);

        const heading = makeText(scene, SCREEN_WIDTH / 2, 62, ENDING.guideHeading, 32, {
            bold: true,
            color: PAPER,
            wrap: SCREEN_WIDTH - 120,
            align: 'center',
        }).setOrigin(0.5);
        if (heading.height > 84) {
            heading.setFontSize(24);
        }
        this.root.add(heading);

        const total = GUIDE_ORDER.length * TRUTH_CARD_WIDTH + (GUIDE_ORDER.length - 1) * TRUTH_GAP;
        const left = Math.round((SCREEN_WIDTH - total) / 2);
        GUIDE_ORDER.forEach((id, index) => {
            const card = new GuideCard(scene, left + index * (TRUTH_CARD_WIDTH + TRUTH_GAP), 130, id, {
                width: TRUTH_CARD_WIDTH,
                height: TRUTH_CARD_HEIGHT,
                style: 'goldenAge',
                unlocked: true,
                truthSlot: true,
            });
            this.cards.push(card);
            this.root.add(card.container);
        });

        this.later(1300, () => this.revealNext());
    }

    protected hurry() {
        this.reveal();
    }

    private revealNext() {
        this.reveal();
        if (this.revealed < this.cards.length) {
            this.later(TRUTH_INTERVAL, () => this.revealNext());
        }
    }

    private reveal() {
        const card = this.cards[this.revealed];
        if (!card) {
            return;
        }
        this.revealed++;
        card.revealTruth(true);
        this.hooks.select();
        if (this.revealed >= this.cards.length) {
            this.later(1400, () => this.unlock());
        }
    }
}

const CREDITS_TOP = 110;
const CREDITS_BOTTOM = SCREEN_HEIGHT - 90;

export class CreditsModal extends Card {
    constructor(scene: Phaser.Scene, hooks: ModalHooks) {
        super(scene, hooks);
        this.dim(1, INK);
        const back = scene.add.graphics();
        halftoneFade(back, 0, SCREEN_HEIGHT - 260, SCREEN_WIDTH, 270, 0x3a2f55, 18, 8, 'down');
        halftoneFade(back, 0, 0, SCREEN_WIDTH, 160, 0x3a2f55, 18, 6, 'up');
        this.root.add(back);

        const list = scene.add.container(0, 0);
        this.root.add(list);
        let y = 0;
        ENDING.credits.forEach((raw, index) => {
            const line = String(raw);
            if (line.trim() === '') {
                y += 26;
                return;
            }
            const first = index === 0;
            // A long line is small print
            const text = makeText(scene, SCREEN_WIDTH / 2, y, line, first ? 72 : line.length > 56 ? 20 : 28, {
                bold: first,
                color: first ? YELLOW : PAPER,
                stroke: first ? RED : undefined,
                strokeThickness: first ? 10 : undefined,
                drop: first ? 5 : 0,
                dropColor: 0x000000,
                wrap: SCREEN_WIDTH - 200,
                align: 'center',
            }).setOrigin(0.5, 0);
            text.setAlpha(0);
            this.tween({ targets: text, alpha: 1, duration: 160, delay: 250 + index * 220 });
            list.add(text);
            y += Math.ceil(text.height) + (first ? 34 : 14);
        });

        const room = CREDITS_BOTTOM - CREDITS_TOP;
        if (y <= room) {
            list.setY(CREDITS_TOP + (room - y) / 2);
        } else {
            // Too many to fit: roll them, as credits do
            list.setY(CREDITS_TOP);
            this.tween({
                targets: list,
                y: CREDITS_BOTTOM - y,
                duration: ((y - room) / 55) * 1000,
                delay: 1800,
            });
        }
        this.later(2500, () => this.unlock());
    }
}
