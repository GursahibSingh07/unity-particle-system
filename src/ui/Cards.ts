import Phaser from 'phaser';
import { RAYS } from '../config/rays';
import { ENDING, UPGRADES } from '../config/text';
import type { UpgradeId } from '../types';
import type { Modal, ModalHooks } from './Captions';
import { burst, burstPoints, halftoneFade, panel, rays } from './draw';
import { DASH_ICON, RAY_ICON, isRay } from './eras';
import { GUIDE_ORDER, GuideCard } from './GuideCard';
import { LABELS } from './labels';
import { Depth, GREY, INK, ORANGE, PAPER, RED, SCREEN_HEIGHT, SCREEN_WIDTH, WHITE, YELLOW, makeText } from './theme';

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

const DASH_COLOR = ORANGE;

/** Everything an era hands over, held up together: one burst, one name and one line for each */
export class UpgradeModal extends Card {
    constructor(scene: Phaser.Scene, ids: UpgradeId[], hooks: ModalHooks) {
        super(scene, hooks);
        const words = UPGRADES as Partial<Record<string, { title: string; line: string }>>;
        const colorOf = (id: UpgradeId) => (isRay(id) ? (RAYS[id]?.color ?? YELLOW) : DASH_COLOR);
        const count = ids.length;
        const cx = SCREEN_WIDTH / 2;
        this.dim(0.8);

        const spin = scene.add.graphics();
        rays(spin, 0, 0, 900, 24, count === 1 ? colorOf(ids[0]) : YELLOW, 0.35);
        const spinner = scene.add.container(cx, 250, [spin]);
        this.tween({ targets: spinner, angle: 360, duration: 14000, repeat: -1 });
        this.root.add(spinner);

        // One column each; a single gift gets the whole card
        const columnWidth = count === 1 ? 760 : Math.floor((SCREEN_WIDTH - 80 - (count - 1) * 24) / count);
        const total = count * columnWidth + (count - 1) * 24;
        const left = cx - total / 2;
        const big = count === 1;
        const starY = big ? 236 : 226;
        const outer = big ? 176 : count === 2 ? 150 : 132;
        const iconScale = big ? 9 : count === 2 ? 7 : 6;
        const plateTop = big ? 452 : 410;
        const plateHeight = big ? 180 : 214;

        ids.forEach((id, index) => {
            const color = colorOf(id);
            const x = left + index * (columnWidth + 24) + columnWidth / 2;
            const entry = words[id];

            const star = scene.add.graphics();
            burst(star, burstPoints(8, 9, outer, outer * 0.7, 16, 0.18, 3 + index), INK, INK, 0);
            burst(star, burstPoints(0, 0, outer, outer * 0.7, 16, 0.18, 3 + index), color, INK, 6);
            burst(star, burstPoints(0, 0, outer * 0.78, outer * 0.56, 16, 0.18, 3 + index), WHITE, INK, 0);
            const starBox = scene.add.container(x, starY, [star]).setScale(0.2);
            this.tween({ targets: starBox, scale: 1, duration: 200, ease: 'Back.easeOut', delay: index * 90 });
            this.root.add(starBox);

            // The double dash is the dash icon, twice
            const frame = isRay(id) ? RAY_ICON[id] : DASH_ICON;
            const offsets = id === 'doubleDash' ? [-iconScale * 5, iconScale * 5] : [0];
            for (const offset of offsets) {
                const icon = scene.add.image(x + offset, starY + (offset ? offset * 0.35 : 0), 'icons', frame).setScale(1);
                this.tween({ targets: icon, scale: iconScale, duration: 240, ease: 'Back.easeOut', delay: 60 + index * 90 });
                this.root.add(icon);
            }

            const plate = scene.add.graphics();
            panel(plate, x - columnWidth / 2, plateTop, columnWidth, plateHeight, PAPER, 5, 8);
            plate.fillStyle(color, 1).fillRect(x - columnWidth / 2 + 5, plateTop + 5, columnWidth - 10, 12);
            plate.fillStyle(INK, 1).fillRect(x - columnWidth / 2 + 5, plateTop + 17, columnWidth - 10, 3);
            const title = makeText(scene, x, plateTop + (big ? 68 : 62), entry?.title ?? String(id).toUpperCase(), big ? 68 : 46, {
                bold: true,
                color,
                stroke: INK,
                strokeThickness: big ? 12 : 9,
                drop: big ? 4 : 3,
            }).setOrigin(0.5);
            if (title.width > columnWidth - 36) {
                title.setScale((columnWidth - 36) / title.width);
            }
            const lineTop = plateTop + (big ? 112 : 104);
            const room = plateTop + plateHeight - 14 - lineTop;
            let line = makeText(scene, x, lineTop, entry?.line ?? '', big ? 26 : 23, { wrap: columnWidth - 44, align: 'center' }).setOrigin(0.5, 0);
            for (const size of [21, 19, 17, 15]) {
                if (line.height <= room) {
                    break;
                }
                line.destroy();
                line = makeText(scene, x, lineTop, entry?.line ?? '', size, { wrap: columnWidth - 44, align: 'center' }).setOrigin(0.5, 0);
            }
            this.root.add([plate, title, line]);
        });

        // A corner flash, as on a cover: something new in this issue
        const flashText = makeText(scene, 0, 0, LABELS.newGear, 40, { bold: true, color: RED, stroke: INK, strokeThickness: 8 }).setOrigin(0.5);
        const flash = scene.add.graphics();
        burst(flash, burstPoints(5, 6, 76, 52, 12, 0.25, 21), INK, INK, 0);
        burst(flash, burstPoints(0, 0, 76, 52, 12, 0.25, 21), YELLOW, INK, 5);
        const flashBox = scene.add.container(Math.max(110, left + 40), 92, [flash, flashText]).setAngle(-12).setScale(0.3);
        this.tween({ targets: flashBox, scale: 1, duration: 180, ease: 'Back.easeOut', delay: 120 });
        this.root.add(flashBox);

        this.later(1200, () => this.unlock());
    }
}

const SHEET_WIDTH = 920;
const LABEL_WIDTH = 200;
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
        for (const scale of [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.56]) {
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
        return bottom + size(7);
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

const TRUTH_COLUMNS = 6;
const TRUTH_GAP = 12;
const TRUTH_TOP = 104;
/** Pages are corrected a few at a time, or twelve of them would take a minute */
const TRUTH_GROUP = 3;
const TRUTH_INTERVAL = 950;

/** Every Field Guide page, group by group turned into what it really was */
export class GuideTruthModal extends Card {
    private cards: GuideCard[] = [];
    private revealed = 0;

    constructor(scene: Phaser.Scene, hooks: ModalHooks) {
        super(scene, hooks);
        this.dim(1, 0x2b2733);
        const back = scene.add.graphics();
        halftoneFade(back, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0x3a3546, 16, 5, 'up');
        this.root.add(back);

        const heading = makeText(scene, SCREEN_WIDTH / 2, 54, ENDING.guideHeading, 32, {
            bold: true,
            color: PAPER,
            wrap: SCREEN_WIDTH - 120,
            align: 'center',
        }).setOrigin(0.5);
        if (heading.height > 70) {
            heading.setFontSize(22);
        }
        this.root.add(heading);

        const columns = Math.min(TRUTH_COLUMNS, GUIDE_ORDER.length);
        const rows = Math.ceil(GUIDE_ORDER.length / columns);
        const width = Math.floor((SCREEN_WIDTH - 60 - (columns - 1) * TRUTH_GAP) / columns);
        const height = Math.floor((SCREEN_HEIGHT - TRUTH_TOP - 56 - (rows - 1) * TRUTH_GAP) / rows);
        const left = Math.round((SCREEN_WIDTH - columns * width - (columns - 1) * TRUTH_GAP) / 2);
        GUIDE_ORDER.forEach((id, index) => {
            const x = left + (index % columns) * (width + TRUTH_GAP);
            const y = TRUTH_TOP + Math.floor(index / columns) * (height + TRUTH_GAP);
            const card = new GuideCard(scene, x, y, id, {
                width,
                height,
                style: 'goldenAge',
                unlocked: true,
                truthSlot: true,
                pictureHeight: 86,
                titleSize: 20,
                noteSizes: [15, 14, 13, 12],
                truthOverNote: true,
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
        if (this.revealed >= this.cards.length) {
            return;
        }
        const group = this.cards.slice(this.revealed, this.revealed + TRUTH_GROUP);
        this.revealed += group.length;
        group.forEach((card, index) => this.later(index * 90, () => card.revealTruth(true)));
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
