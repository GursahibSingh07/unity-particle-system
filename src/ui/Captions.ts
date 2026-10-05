import Phaser from 'phaser';
import type { StyleId } from '../types';
import { halftoneFade, panel, pixelNumber, pixelNumberWidth } from './draw';
import { LABELS } from './labels';
import { Depth, INK, PAPER, RED, SCREEN_HEIGHT, SCREEN_WIDTH, STYLE_THEME, YELLOW, BLUE, makeText } from './theme';

/** Anything that holds the screen until the player (or a timer) lets it go */
export interface Modal {
    /** The player pressed Space, Enter or the left mouse button */
    advance(): void;
    destroy(): void;
}

export interface ModalHooks {
    /** The player moved something on: the audio bridge plays a blip */
    select(): void;
    /** Called exactly once, when the modal is finished and already destroyed */
    done(): void;
}

const BOX_WIDTH = 1040;
const BOX_BOTTOM = SCREEN_HEIGHT - 18;
const TEXT_SIZE = 28;
const PADDING_X = 30;
const PADDING_Y = 20;
/** Input is ignored at the start of each line, so a held or repeated key cannot skip it */
const INPUT_LOCK = 250;
const TYPE_INTERVAL = 16;
const TYPE_STEP = 2;

/** A comic caption box along the bottom of the screen, typed out a few letters at a time */
class CaptionBox {
    private readonly container: Phaser.GameObjects.Container;
    private readonly cue: Phaser.GameObjects.Container;
    private readonly text: Phaser.GameObjects.Text;
    private readonly timer: Phaser.Time.TimerEvent;
    private readonly bob: Phaser.Tweens.Tween;
    private readonly full: string;
    private shown = 0;

    constructor(
        private readonly scene: Phaser.Scene,
        line: string,
        showCue: boolean,
    ) {
        const wrapWidth = BOX_WIDTH - PADDING_X * 2;
        this.text = makeText(scene, PADDING_X, PADDING_Y - 2, line, TEXT_SIZE, { wrap: wrapWidth, lineSpacing: 4 });
        // Wrapped once up front, so words do not jump to the next line while they are typed
        this.full = this.text.getWrappedText(line).join('\n');
        const height = Math.max(84, Math.ceil(this.text.height) + PADDING_Y * 2);
        this.text.setWordWrapWidth(null).setText('');

        const g = scene.add.graphics();
        panel(g, 0, 0, BOX_WIDTH, height, PAPER, 4, 7);
        // A folded corner of colour, as on a narrator's caption
        g.fillStyle(YELLOW, 1).fillRect(4, 4, 10, height - 8);

        const label = makeText(scene, -20, 0, LABELS.continue, 14, { bold: true, color: RED }).setOrigin(1, 0.5);
        const arrow = scene.add.graphics();
        arrow.fillStyle(RED, 1).fillTriangle(-12, -7, 2, -7, -5, 5);
        this.cue = scene.add.container(BOX_WIDTH - 18, height - 16, [label, arrow]).setVisible(false);
        this.bob = scene.tweens.add({ targets: arrow, y: 4, duration: 320, yoyo: true, repeat: -1 });

        const x = (SCREEN_WIDTH - BOX_WIDTH) / 2;
        const y = BOX_BOTTOM - height;
        this.container = scene.add.container(x, y + 24, [g, this.text, this.cue]).setDepth(Depth.caption).setAlpha(0);
        scene.tweens.add({ targets: this.container, y, alpha: 1, duration: 110, ease: 'Quad.easeOut' });

        this.timer = scene.time.addEvent({
            delay: TYPE_INTERVAL,
            loop: true,
            callback: () => {
                this.shown = Math.min(this.full.length, this.shown + TYPE_STEP);
                this.text.setText(this.full.slice(0, this.shown));
                if (this.typed) {
                    this.timer.remove();
                    this.cue.setVisible(showCue);
                }
            },
        });
    }

    get typed() {
        return this.shown >= this.full.length;
    }

    /** Show the whole line at once */
    finishTyping() {
        this.shown = this.full.length;
        this.text.setText(this.full);
    }

    destroy() {
        this.timer.remove();
        this.bob.stop();
        this.scene.tweens.killTweensOf(this.container);
        this.container.destroy();
    }
}

/** Caption lines one at a time. With `auto`, each line also moves on by itself after a read. */
export class DialogModal implements Modal {
    private box?: CaptionBox;
    private index = -1;
    private lineStarted = 0;
    private autoTimer?: Phaser.Time.TimerEvent;
    private finished = false;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly lines: string[],
        private readonly auto: boolean,
        private readonly hooks: ModalHooks,
    ) {
        this.next();
    }

    advance() {
        if (this.finished || this.scene.time.now - this.lineStarted < INPUT_LOCK) {
            return;
        }
        this.hooks.select();
        if (this.box && !this.box.typed) {
            // The first press completes the line; the next one moves on
            this.box.finishTyping();
            return;
        }
        this.next();
    }

    destroy() {
        this.finished = true;
        this.autoTimer?.remove();
        this.box?.destroy();
        this.box = undefined;
    }

    private next() {
        this.autoTimer?.remove();
        this.box?.destroy();
        this.box = undefined;
        this.index++;
        if (this.index >= this.lines.length) {
            this.destroy();
            this.hooks.done();
            return;
        }
        const line = String(this.lines[this.index] ?? '');
        this.lineStarted = this.scene.time.now;
        this.box = new CaptionBox(this.scene, line, true);
        if (this.auto) {
            // Long enough to read at a walking pace; the player is busy with the room
            this.autoTimer = this.scene.time.delayedCall(1300 + line.length * 38, () => this.next());
        }
    }
}

const CARD_TIME = 1500;
const CARD_Y = 300;
const BAND_HEIGHT = 168;

/** The chapter splash for a new level, then its intro captions */
export class LevelIntroModal implements Modal {
    private card?: Phaser.GameObjects.Container;
    private dialog?: DialogModal;
    private timer?: Phaser.Time.TimerEvent;
    private readonly started: number;
    private finished = false;

    constructor(
        private readonly scene: Phaser.Scene,
        levelNumber: number,
        name: string,
        style: StyleId,
        private readonly lines: string[],
        private readonly hooks: ModalHooks,
    ) {
        this.started = scene.time.now;
        this.card = this.buildCard(levelNumber, name, style);
        this.card.setX(-SCREEN_WIDTH);
        scene.tweens.add({ targets: this.card, x: 0, duration: 170, ease: 'Cubic.easeOut' });
        this.timer = scene.time.delayedCall(CARD_TIME, () => this.dismissCard());
    }

    advance() {
        if (this.dialog) {
            this.dialog.advance();
        } else if (this.scene.time.now - this.started > 400) {
            this.hooks.select();
            this.dismissCard();
        }
    }

    destroy() {
        this.finished = true;
        this.timer?.remove();
        if (this.card) {
            this.scene.tweens.killTweensOf(this.card);
            this.card.destroy();
            this.card = undefined;
        }
        this.dialog?.destroy();
    }

    private dismissCard() {
        if (this.finished || !this.card) {
            return;
        }
        this.timer?.remove();
        const card = this.card;
        this.card = undefined;
        this.scene.tweens.killTweensOf(card);
        this.scene.tweens.add({
            targets: card,
            x: SCREEN_WIDTH,
            duration: 150,
            ease: 'Cubic.easeIn',
            onComplete: () => card.destroy(),
        });

        if (this.lines.length === 0) {
            this.finished = true;
            this.hooks.done();
            return;
        }
        this.dialog = new DialogModal(this.scene, this.lines, true, this.hooks);
    }

    private buildCard(levelNumber: number, name: string, style: StyleId) {
        const theme = STYLE_THEME[style] ?? STYLE_THEME.goldenAge;
        const top = -BAND_HEIGHT / 2;
        const g = this.scene.add.graphics();

        g.fillStyle(INK, 0.55).fillRect(0, top + 12, SCREEN_WIDTH, BAND_HEIGHT);
        // On the dark page the band is edged in white, or it would sink into the room
        g.fillStyle(style === 'retro' ? 0xf5f5f7 : style === 'manga' ? 0x000000 : INK, 1).fillRect(0, top, SCREEN_WIDTH, BAND_HEIGHT);
        g.fillStyle(theme.band, 1).fillRect(0, top + 6, SCREEN_WIDTH, BAND_HEIGHT - 12);

        if (style === 'manga') {
            // Speed lines racing in from both edges
            const random = new Phaser.Math.RandomDataGenerator(['manga']);
            g.fillStyle(0x000000, 1);
            for (let i = 0; i < 46; i++) {
                const y = top + 10 + random.between(0, BAND_HEIGHT - 24);
                const length = random.between(60, 330);
                const thickness = random.between(1, 4);
                g.fillRect(i % 2 === 0 ? 0 : SCREEN_WIDTH - length, y, length, thickness);
            }
        } else if (style === 'finalPage') {
            // Every style at once: the page is coming apart
            const stripes = [RED, YELLOW, BLUE, 0xf5f5f7, 0x000000];
            stripes.forEach((color, i) => {
                g.fillStyle(color, 1).fillRect(0, top + BAND_HEIGHT - 6 - (stripes.length - i) * 8, SCREEN_WIDTH, 8);
            });
            halftoneFade(g, 760, top + 10, 520, BAND_HEIGHT - 64, theme.accent, 14, 6, 'right', 0.8);
        } else {
            halftoneFade(g, 700, top + 10, 580, BAND_HEIGHT - 20, theme.accent, 14, 6, 'right', style === 'retro' ? 0.45 : 0.7);
            halftoneFade(g, 0, top + 10, 380, BAND_HEIGHT - 20, theme.accent, 14, 5, 'left', style === 'retro' ? 0.3 : 0.45);
        }

        const title = makeText(this.scene, SCREEN_WIDTH / 2, 6, name.toUpperCase(), 96, {
            bold: true,
            color: theme.title,
            stroke: theme.titleStroke,
            strokeThickness: 14,
            drop: style === 'plain' ? 0 : 6,
            dropColor: theme.titleStroke,
        }).setOrigin(0.5);
        const limit = SCREEN_WIDTH - 160;
        if (title.width > limit) {
            title.setScale(limit / title.width);
        }

        // The page number rides on the band's top edge like a corner box
        const number = String(levelNumber);
        const numberWidth = pixelNumberWidth(number, 3);
        const tabText = makeText(this.scene, 0, 0, LABELS.page, 30, { bold: true, color: PAPER }).setOrigin(0, 0.5);
        const tabWidth = Math.ceil(tabText.width) + 12 + numberWidth + 36;
        tabText.setX(-tabWidth / 2 + 18);
        const tabG = this.scene.add.graphics();
        tabG.fillStyle(INK, 1).fillRect(-tabWidth / 2 + 5, -19, tabWidth, 48);
        tabG.fillStyle(PAPER, 1).fillRect(-tabWidth / 2, -24, tabWidth, 48);
        tabG.fillStyle(RED, 1).fillRect(-tabWidth / 2 + 4, -20, tabWidth - 8, 40);
        pixelNumber(tabG, number, tabWidth / 2 - 18 - numberWidth / 2, 1, 3, PAPER);
        const tab = this.scene.add.container(150, top - 2, [tabG, tabText]).setAngle(-4);

        return this.scene.add.container(0, CARD_Y, [g, title, tab]).setDepth(Depth.caption);
    }
}
