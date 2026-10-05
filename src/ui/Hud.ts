import Phaser from 'phaser';
import type { StyleId } from '../types';
import { halftoneFade, pixelNumber, pixelNumberWidth } from './draw';
import { Depth, HUD_STRIP, INK, ORANGE, PAPER, RED, SCREEN_WIDTH, STRIP_THEME, WHITE, YELLOW, makeText, type StripTheme } from './theme';

/** Health points shown by one block */
const BLOCK_HEALTH = 5;
const ROWS = 2;
const BLOCK_WIDTH = 22;
const BLOCK_HEIGHT = 16;
const BLOCK_GAP = 4;
const BLOCKS_X = 52;
const BLOCKS_Y = 20;
const BASE_COLUMNS = 10;
const LOW_HEALTH = 0.3;

const CLOCK_X = SCREEN_WIDTH / 2;
const CLOCK_Y = 37;
const CLOCK_DOT = 5;
/** The clock turns red and beats for this many last seconds */
const LAST_SECONDS = 20;

/** The strip above the square: health blocks, the era's clock, and which era this is */
export class Hud {
    private readonly strip: Phaser.GameObjects.Graphics;
    private readonly blocks: Phaser.GameObjects.Graphics;
    private readonly pips: Phaser.GameObjects.Graphics;
    private readonly heart: Phaser.GameObjects.Image;
    private readonly levelName: Phaser.GameObjects.Text;
    private readonly eraText: Phaser.GameObjects.Text;
    private readonly clock: Phaser.GameObjects.Container;
    private readonly clockG: Phaser.GameObjects.Graphics;
    private lowPulse?: Phaser.Tweens.Tween;

    private theme: StripTheme = STRIP_THEME.goldenAge;
    private health = 100;
    private maxHealth = 100;
    private era = { number: 0, total: 0 };
    private seconds = -1;

    constructor(private readonly scene: Phaser.Scene) {
        this.strip = scene.add.graphics().setDepth(Depth.hud);
        this.heart = scene.add.image(28, BLOCKS_Y + 18, 'heart', 0).setScale(2).setDepth(Depth.hud);
        this.blocks = scene.add.graphics().setDepth(Depth.hud);

        this.levelName = makeText(scene, SCREEN_WIDTH - 24, 8, '', 28, { bold: true })
            .setOrigin(1, 0)
            .setDepth(Depth.hud);
        this.eraText = makeText(scene, SCREEN_WIDTH - 24, 44, '', 22, { bold: true })
            .setOrigin(1, 0)
            .setDepth(Depth.hud);
        // The font's 5 reads as an S at this size: the text is kept for the smoke test, which
        // looks for it, and the number the player reads is drawn in pixel digits over it
        this.eraText.setAlpha(0);
        this.pips = scene.add.graphics().setDepth(Depth.hud);

        this.clockG = scene.add.graphics();
        this.clock = scene.add.container(CLOCK_X, CLOCK_Y, [this.clockG]).setDepth(Depth.hud).setVisible(false);

        this.drawStrip();
        this.drawBlocks();
    }

    /** The strip drains with the era it is laid over */
    setStyle(style: StyleId) {
        const theme = STRIP_THEME[style] ?? STRIP_THEME.goldenAge;
        if (theme === this.theme) {
            return;
        }
        this.theme = theme;
        this.drawStrip();
        this.drawBlocks();
        this.drawPips();
        this.drawClock();
    }

    setHealth(health: number, maxHealth: number) {
        const hurt = health < this.health;
        this.health = health;
        this.maxHealth = maxHealth;
        this.drawBlocks();

        if (hurt) {
            // A quick knock, so damage registers even when the eye is on the square
            this.scene.tweens.add({ targets: this.blocks, y: 3, duration: 50, yoyo: true, repeat: 1 });
        }

        const low = health > 0 && health / maxHealth < LOW_HEALTH;
        if (low && !this.lowPulse) {
            this.lowPulse = this.scene.tweens.add({
                targets: [this.blocks, this.heart],
                alpha: 0.35,
                duration: 260,
                yoyo: true,
                repeat: -1,
            });
        } else if (!low && this.lowPulse) {
            this.lowPulse.stop();
            this.lowPulse = undefined;
            this.blocks.setAlpha(1);
            this.heart.setAlpha(1);
        }
    }

    /** The ending: there was never any health or any clock. The strip goes blank. */
    goPlain() {
        const cover = this.scene.add.graphics().setDepth(Depth.hud + 3).setAlpha(0);
        cover.fillStyle(STRIP_THEME.plain.paper, 1).fillRect(0, 0, SCREEN_WIDTH, HUD_STRIP - 5);
        this.scene.tweens.add({ targets: cover, alpha: 1, duration: 500 });
    }

    /** Maximum health went up: the new blocks are already drawn, this just draws the eye to them */
    celebrate() {
        this.scene.tweens.add({ targets: this.heart, scale: 4, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    }

    /** Which era this is, out of how many */
    setEra(name: string, number: number, total: number) {
        this.levelName.setText(name);
        const limit = 330;
        this.levelName.setScale(this.levelName.width > limit ? limit / this.levelName.width : 1);
        // The smoke test reads the era from this text as "n/total"
        this.eraText.setText(`${number}/${total}`);
        this.era = { number, total };
        this.drawPips();
    }

    /** ERA_TIMER: once a second in a timed era */
    setTimer(secondsLeft: number) {
        const seconds = Math.max(0, Math.ceil(secondsLeft));
        if (seconds === this.seconds && this.clock.visible) {
            return;
        }
        this.seconds = seconds;
        this.clock.setVisible(true);
        this.drawClock();
        if (seconds <= LAST_SECONDS) {
            this.scene.tweens.killTweensOf(this.clock);
            this.clock.setScale(1.22);
            this.scene.tweens.add({ targets: this.clock, scale: 1, duration: 260, ease: 'Quad.easeOut' });
        }
    }

    /** Wave eras and the boss have no clock */
    hideTimer() {
        this.seconds = -1;
        this.scene.tweens.killTweensOf(this.clock);
        this.clock.setScale(1).setVisible(false);
    }

    private drawStrip() {
        const g = this.strip;
        g.clear();
        g.fillStyle(this.theme.paper, 1).fillRect(0, 0, SCREEN_WIDTH, HUD_STRIP);
        halftoneFade(g, 820, 4, 460, HUD_STRIP - 12, this.theme.dots, 9, 3.2, 'right');
        g.fillStyle(INK, 1).fillRect(0, HUD_STRIP - 5, SCREEN_WIDTH, 5);
    }

    private drawPips() {
        const { number, total } = this.era;
        const size = 14;
        const gap = 6;
        const label = `${number}/${total}`;
        const labelWidth = pixelNumberWidth(label, 3);
        const right = SCREEN_WIDTH - 24 - labelWidth - 14;
        const top = 51;
        this.pips.clear();
        if (total > 0) {
            pixelNumber(this.pips, label, SCREEN_WIDTH - 24 - labelWidth / 2, top + 7, 3, INK);
        }
        // More than a strip's worth (the sandbox) and the number alone has to do
        if (total > 12) {
            return;
        }
        for (let i = 0; i < total; i++) {
            const x = right - (total - i) * (size + gap) + gap;
            this.pips.fillStyle(INK, 1).fillRect(x, top, size, size);
            const fill = i + 1 < number ? INK : i + 1 === number ? RED : this.theme.paper;
            this.pips.fillStyle(fill, 1).fillRect(x + 3, top + 3, size - 6, size - 6);
        }
    }

    private drawClock() {
        const g = this.clockG;
        g.clear();
        if (this.seconds < 0) {
            return;
        }
        const last = this.seconds <= LAST_SECONDS;
        const text = `${Math.floor(this.seconds / 60)}:${String(this.seconds % 60).padStart(2, '0')}`;
        const width = pixelNumberWidth(text, CLOCK_DOT) + 76;
        const height = 54;
        const left = -width / 2;
        g.fillStyle(INK, 1).fillRect(left + 4, -height / 2 + 5, width, height);
        g.fillStyle(INK, 1).fillRect(left, -height / 2, width, height);
        g.fillStyle(last ? RED : this.theme.accent, 1).fillRect(left + 4, -height / 2 + 4, width - 8, height - 8);

        // A clock face, so the number is read as time left
        const faceX = left + 30;
        g.fillStyle(INK, 1).fillCircle(faceX, 0, 15);
        g.fillStyle(last ? YELLOW : PAPER, 1).fillCircle(faceX, 0, 11);
        g.fillStyle(INK, 1).fillRect(faceX - 1, -9, 3, 10);
        g.fillStyle(INK, 1).fillRect(faceX - 1, -1, 8, 3);

        pixelNumber(g, text, left + 52 + pixelNumberWidth(text, CLOCK_DOT) / 2, 0, CLOCK_DOT, last ? WHITE : INK, last ? INK : undefined);
    }

    private drawBlocks() {
        const g = this.blocks;
        const theme = this.theme;
        g.clear();
        const total = Math.max(1, Math.round(this.maxHealth / BLOCK_HEALTH));
        const filled = Math.ceil(Math.max(0, this.health) / BLOCK_HEALTH);

        for (let i = 0; i < total; i++) {
            // Blocks past the first twenty came from secrets and are rimmed in gold.
            // Filled column by column, so the blocks drain from the right like a bar
            const x = BLOCKS_X + Math.floor(i / ROWS) * (BLOCK_WIDTH + BLOCK_GAP);
            const y = BLOCKS_Y + (i % ROWS) * (BLOCK_HEIGHT + BLOCK_GAP);
            const bonus = i >= BASE_COLUMNS * ROWS;

            g.fillStyle(bonus ? ORANGE : INK, 1).fillRect(x, y, BLOCK_WIDTH, BLOCK_HEIGHT);
            const innerWidth = BLOCK_WIDTH - 4;
            const innerHeight = BLOCK_HEIGHT - 4;
            if (i < filled) {
                g.fillStyle(theme.health, 1).fillRect(x + 2, y + 2, innerWidth, innerHeight);
                g.fillStyle(theme.healthDark, 1).fillRect(x + 2, y + BLOCK_HEIGHT - 5, innerWidth, 3);
                g.fillStyle(bonus ? YELLOW : theme.healthLight, 1).fillRect(x + 2, y + 2, innerWidth, 2);
                g.fillStyle(WHITE, 1).fillRect(x + 4, y + 5, 4, 2);
            } else {
                g.fillStyle(theme.well, 1).fillRect(x + 2, y + 2, innerWidth, innerHeight);
                g.fillStyle(theme.wellShade, 1).fillRect(x + 2, y + 2, innerWidth, 3);
            }
        }
    }
}
