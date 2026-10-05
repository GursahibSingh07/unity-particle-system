import Phaser from 'phaser';
import { LEVELS } from '../config/levels';
import { TITLE } from '../config/text';
import { Events } from '../events';
import { getSettings } from '../settings';
import { Progress } from '../state';
import type { ArtStyle } from '../types';
import { burst, burstPoints, controlsRow, halftoneFade, keyCap, panel, pixelNumber, rays } from '../ui/draw';
import { LABELS } from '../ui/labels';
import { SettingsPanel } from '../ui/SettingsPanel';
import { BLUE, INK, ORANGE, PAPER, RED, SCREEN_HEIGHT, SCREEN_WIDTH, STYLE_THEME, WHITE, YELLOW, makeText } from '../ui/theme';

const STYLE = 'goldenAge';
const HERO = { x: 262, y: 452, scale: 8 };
/** Right-facing, standing: frames run idle, walk A, walk B, dash for each of down, up, left, right */
const HERO_FRAME = 12;
/** The town's north side, cut from the picture of the square: 640x64 texture pixels */
const TOWN = { top: 440, scale: 3, rows: 64, offsetX: -420 };
/** A press this soon after the cover appears is the one that closed the credits */
const INPUT_DELAY = 350;
const BOSS_SLICES: ArtStyle[] = ['goldenAge', 'cyberpunk', 'retro', 'manga'];

interface Area {
    x: number;
    y: number;
    width: number;
    height: number;
    act: () => void;
}

/** The title screen: the cover of issue one */
export class Title extends Phaser.Scene {
    private started = false;
    private openedAt = 0;
    private areas: Area[] = [];
    private startArea?: Phaser.GameObjects.Container;
    private startAreas: Area[] = [];
    private settings?: { root: Phaser.GameObjects.Container; panel: SettingsPanel; sheet: Phaser.Geom.Rectangle };

    constructor() {
        super('Title');
    }

    create() {
        this.started = false;
        this.areas = [];
        this.startAreas = [];
        this.startArea = undefined;
        this.settings = undefined;
        // The ending comes back here: nothing of the last run may be left on screen
        for (const key of ['Game', 'Ending', 'UI']) {
            if (this.scene.isActive(key) || this.scene.isPaused(key) || this.scene.isSleeping(key)) {
                this.scene.stop(key);
            }
        }

        this.drawBackground();
        this.drawMonsters();
        this.drawTown();
        this.drawHero();
        this.drawMasthead();
        this.drawFurniture();
        this.buildStartArea();

        this.game.events.emit(Events.TITLE_SHOWN);

        this.openedAt = this.time.now;
        const keyboard = this.input.keyboard!;
        keyboard.on('keydown', this.onKey, this);
        this.input.on('pointerdown', this.onPointer, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard.off('keydown', this.onKey, this);
            this.input.off('pointerdown', this.onPointer, this);
        });
    }

    private get ready() {
        return !this.started && this.time.now - this.openedAt >= INPUT_DELAY;
    }

    private onKey(event: KeyboardEvent) {
        if (event.repeat || !this.ready) {
            return;
        }
        if (this.settings) {
            if (event.code === 'Escape') {
                this.closeSettings();
            } else {
                this.settings.panel.key(event.code);
            }
            return;
        }
        // Not the keys people press to reach the game: fullscreen, switching windows, modifiers
        if (/^(Shift|Control|Alt|Meta|Tab|CapsLock|OS|F\d+)$/.test(event.key)) {
            return;
        }
        if (event.code === 'KeyS') {
            this.openSettings();
        } else if (getSettings().demoMode) {
            const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
            if (digit && Number(digit[1]) <= LEVELS.length) {
                this.begin(Number(digit[1]) - 1, true);
            }
        } else {
            this.begin(0, false);
        }
    }

    private onPointer(pointer: Phaser.Input.Pointer) {
        if (!this.ready) {
            return;
        }
        const { x, y } = pointer;
        if (this.settings) {
            // A click off the sheet puts it away
            if (!this.settings.panel.click(x, y) && !this.settings.sheet.contains(x, y)) {
                this.closeSettings();
            }
            return;
        }
        const area = [...this.areas, ...this.startAreas].find((one) => x >= one.x && x < one.x + one.width && y >= one.y && y < one.y + one.height);
        if (area) {
            area.act();
        } else if (!getSettings().demoMode) {
            this.begin(0, false);
        }
    }

    private begin(level: number, demo: boolean) {
        if (this.started) {
            return;
        }
        this.started = true;
        this.game.events.emit(Events.UI_SELECT);
        Progress.reset(this.registry);
        // The UI starts first so it is listening when the Game scene reports its state
        this.scene.launch('UI');
        this.scene.start('Game', demo ? { level, demo: true } : { level: 0, room: 0 });
    }

    private drawBackground() {
        const g = this.add.graphics();
        g.fillStyle(YELLOW, 1).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        rays(g, HERO.x + 120, HERO.y - 40, 1500, 36, ORANGE, 0.55);
        halftoneFade(g, 640, 0, 660, 440, BLUE, 18, 8, 'right', 0.28);
        halftoneFade(g, 0, 250, SCREEN_WIDTH, 200, RED, 18, 8, 'down', 0.4);
    }

    /** Looming over the rooftops, behind the town */
    private drawMonsters() {
        const loom = (key: string, x: number, y: number, scale: number, frame = 0) => {
            const texture = `${key}-${STYLE}`;
            if (!this.textures.exists(texture)) {
                return undefined;
            }
            // A hard ink shadow behind each one lifts it off the sunburst
            this.add
                .image(x + scale, y + scale, texture, frame)
                .setScale(scale)
                .setTint(INK)
                .setTintMode(Phaser.TintModes.FILL);
            return this.add.sprite(x, y, texture, frame).setScale(scale);
        };
        const animate = (sprite: Phaser.GameObjects.Sprite | undefined, key: string) => {
            if (sprite && this.anims.exists(`${key}-${STYLE}-move`)) {
                sprite.play(`${key}-${STYLE}-move`);
            }
        };

        loom('ghost', 596, 356, 5);
        loom('ironclad', 1186, 372, 5, 2);
        animate(loom('prism', 990, 336, 5), 'prism');
        animate(loom('bat', 664, 268, 4), 'bat');
        animate(loom('zigbat', 1196, 246, 4), 'zigbat');
    }

    private drawTown() {
        const key = `city-${STYLE}`;
        const { top, scale, rows, offsetX } = TOWN;
        const bottom = top + rows * scale;
        if (this.textures.exists(key)) {
            this.add.image(offsetX, top, key).setOrigin(0).setScale(scale).setCrop(0, 0, 640, rows);
            // The paving in front, from the same picture
            this.add
                .image(offsetX, bottom - (rows + 16) * scale, key)
                .setOrigin(0)
                .setScale(scale)
                .setCrop(0, rows + 16, 640, 32);
        } else {
            this.add.graphics().fillStyle(STYLE_THEME.goldenAge.wall, 1).fillRect(0, top, SCREEN_WIDTH, rows * scale);
        }
        const g = this.add.graphics();
        g.fillStyle(INK, 1).fillRect(0, top - 5, SCREEN_WIDTH, 5);

        // A few of the swarm, already in the street
        for (const [x, y, frame] of [
            [500, 640, 0],
            [566, 628, 1],
            [1120, 636, 1],
        ]) {
            if (this.textures.exists(`rat-${STYLE}`)) {
                this.add.image(x + 3, y + 3, `rat-${STYLE}`, frame).setScale(4).setTint(INK).setTintMode(Phaser.TintModes.FILL).setAlpha(0.5);
                this.add.image(x, y, `rat-${STYLE}`, frame).setScale(4);
            }
        }
    }

    private drawHero() {
        const { x, y, scale } = HERO;
        const angle = -16;
        // Where his hands are, in texture pixels from the middle of the frame
        const hand = { x: x + 4 * scale, y: y + 5 * scale };
        const direction = Phaser.Math.DegToRad(angle);
        const tip = new Phaser.Math.Vector2(22 * scale, 0).rotate(direction).add(hand);

        // The beam: a cone of light thrown from the machine across the page
        const beam = this.add.graphics();
        const reach = 360;
        const spread = 0.19;
        const edge = (side: number, distance: number) => new Phaser.Math.Vector2(distance, 0).rotate(direction + side * spread).add(tip);
        const cone = [tip.clone(), edge(-1, reach), edge(1, reach)];
        beam.fillStyle(WHITE, 0.92).fillPoints(cone, true);
        beam.lineStyle(5, INK, 1).strokePoints(cone, true, true);
        const impact = edge(0, reach);
        burst(beam, burstPoints(impact.x + 6, impact.y + 7, 74, 44, 12, 0.3, 5), INK, INK, 0);
        burst(beam, burstPoints(impact.x, impact.y, 74, 44, 12, 0.3, 5), WHITE, INK, 5);
        burst(beam, burstPoints(impact.x, impact.y, 44, 26, 12, 0.3, 5), YELLOW, INK, 0);

        this.add
            .image(x + scale, y + scale, `player-${STYLE}`, HERO_FRAME)
            .setScale(scale)
            .setTint(INK)
            .setTintMode(Phaser.TintModes.FILL);
        this.add.image(x, y, `player-${STYLE}`, HERO_FRAME).setScale(scale);
        this.add
            .image(hand.x, hand.y, `machine-${STYLE}`, 0)
            .setOrigin(0, 0.5)
            .setScale(scale)
            .setAngle(angle);
    }

    private drawMasthead() {
        const name = makeText(this, 0, 0, TITLE.name, 136, {
            bold: true,
            color: RED,
            stroke: INK,
            strokeThickness: 18,
            drop: 9,
        }).setOrigin(0.5);
        const limit = 1010;
        if (name.width > limit) {
            name.setScale(limit / name.width);
        }
        // A white keyline under the ink, the way a logo is trapped on a busy cover
        const under = makeText(this, 0, 0, TITLE.name, 136, {
            bold: true,
            color: WHITE,
            stroke: WHITE,
            strokeThickness: 30,
        })
            .setOrigin(0.5)
            .setScale(name.scale);
        this.add.container(704, 104, [under, name]).setAngle(-2);
    }

    private drawFurniture() {
        const g = this.add.graphics();

        // Corner box: the price and the issue number
        panel(g, 34, 30, 150, 132, PAPER, 5, 7);
        g.fillStyle(INK, 1).fillRect(39, 104, 140, 4);
        makeText(this, 109, 68, LABELS.coverPrice, 60, { bold: true, color: RED, stroke: INK, strokeThickness: 8 }).setOrigin(0.5);
        makeText(this, 109, 133, LABELS.coverIssue, 30, { bold: true }).setOrigin(0.5);

        // The tagline rides a ribbon under the masthead
        const tagline = makeText(this, 0, 0, TITLE.tagline, 30, { bold: true, color: YELLOW }).setOrigin(0.5);
        if (tagline.width > 700) {
            tagline.setScale(700 / tagline.width);
        }
        const half = tagline.displayWidth / 2 + 30;
        const ribbon = this.add.graphics();
        const shape = (dx: number, dy: number) => [
            new Phaser.Math.Vector2(-half + 12 + dx, -24 + dy),
            new Phaser.Math.Vector2(half + 12 + dx, -24 + dy),
            new Phaser.Math.Vector2(half - 12 + dx, 24 + dy),
            new Phaser.Math.Vector2(-half - 12 + dx, 24 + dy),
        ];
        ribbon.fillStyle(INK, 1).fillPoints(shape(6, 7), true);
        ribbon.fillStyle(BLUE, 1).fillPoints(shape(0, 0), true);
        ribbon.lineStyle(4, INK, 1).strokePoints(shape(0, 0), true, true);
        this.add.container(560, 212, [ribbon, tagline]).setAngle(-2);

        // The seal every cover used to carry
        const seal = this.add.graphics();
        burst(seal, burstPoints(5, 6, 70, 56, 18), INK, INK, 0);
        burst(seal, burstPoints(0, 0, 70, 56, 18), WHITE, INK, 4);
        const sealText = makeText(this, 0, 0, LABELS.coverSeal.join('\n'), 15, { bold: true, color: BLUE, align: 'center' }).setOrigin(0.5);
        this.add.container(102, 250, [seal, sealText]).setAngle(-10);

        // The outer frame of the cover
        g.lineStyle(10, PAPER, 1).strokeRect(5, 5, SCREEN_WIDTH - 10, SCREEN_HEIGHT - 10);
        g.lineStyle(4, INK, 1).strokeRect(12, 12, SCREEN_WIDTH - 24, SCREEN_HEIGHT - 24);

        // The small print: the controls, and the way into the settings at the end of the row
        const strip = this.add.graphics();
        strip.fillStyle(INK, 0.92).fillRect(14, 660, SCREEN_WIDTH - 28, 46);
        controlsRow(this, 530, 669, 15, PAPER, PAPER, 1010);
        const settings = this.add.graphics();
        const action = makeText(this, 0, 683, LABELS.settingsAction, 17, { bold: true, color: YELLOW }).setOrigin(0, 0.5);
        const right = SCREEN_WIDTH - 34;
        action.setX(right - Math.ceil(action.width));
        keyCap(this, settings, 'S', action.x - 24, 682, 15, YELLOW);
        settings.fillStyle(PAPER, 0.5).fillRect(action.x - 52, 666, 2, 34);
        this.areas.push({ x: action.x - 50, y: 660, width: right - action.x + 66, height: 46, act: () => this.openSettings() });
    }

    /** What starts the game: any key, or with demo mode on, a choice of era */
    private buildStartArea() {
        this.tweens.killTweensOf(this.startArea ?? []);
        this.startArea?.destroy();
        this.startAreas = [];
        this.startArea = getSettings().demoMode ? this.buildEraSelect() : this.buildPrompt();
    }

    private buildPrompt() {
        const prompt = makeText(this, 0, 0, TITLE.prompt.toUpperCase(), 36, { bold: true }).setOrigin(0.5);
        const width = Math.ceil(prompt.width) + 64;
        const box = this.add.graphics();
        panel(box, -width / 2, -32, width, 64, PAPER, 5, 7);
        const promptBox = this.add.container(760, 596, [box, prompt]);
        // A hard blink, on for longer than it is off, like a cursor
        const blink = this.time.addEvent({ delay: 300, loop: true, callback: () => prompt.setVisible(this.time.now % 900 < 600) });
        promptBox.once(Phaser.GameObjects.Events.DESTROY, () => blink.remove());
        this.tweens.add({ targets: promptBox, scale: 1.04, duration: 420, yoyo: true, repeat: -1 });
        return promptBox;
    }

    /** Demo mode: every era as a small panel, started with its number or a click */
    private buildEraSelect() {
        const levels = LEVELS.slice(0, 9);
        const width = 160;
        const height = 80;
        const gap = 10;
        const total = levels.length * width + (levels.length - 1) * gap;
        const left = SCREEN_WIDTH - 30 - total;
        const top = 546;
        const g = this.add.graphics();
        const over = this.add.graphics();
        const parts: Phaser.GameObjects.GameObject[] = [g];

        const heading = makeText(this, 0, 0, LABELS.eraSelect, 18, { bold: true, color: PAPER }).setOrigin(0, 0.5);
        const headingWidth = Math.ceil(heading.width) + 20;
        g.fillStyle(INK, 1).fillRect(left - 4, top - 34, headingWidth, 30);
        g.fillStyle(RED, 1).fillRect(left - 1, top - 31, headingWidth - 6, 24);
        heading.setPosition(left + 7, top - 19);
        parts.push(heading);

        levels.forEach((level, index) => {
            const x = left + index * (width + gap);
            g.fillStyle(INK, 1).fillRect(x + 4, top + 5, width, height + 26);
            g.fillStyle(INK, 1).fillRect(x - 4, top - 4, width + 8, height + 34);
            g.fillStyle(PAPER, 1).fillRect(x, top + height, width, 26);
            const styles = level.style === 'finalPage' ? BOSS_SLICES : [level.style];
            const slice = 640 / styles.length;
            styles.forEach((style, i) => {
                const key = `city-${style}`;
                if (this.textures.exists(key)) {
                    parts.push(this.add.image(x, top, key).setOrigin(0).setScale(0.25).setCrop(i * slice, 0, slice, 320));
                } else {
                    g.fillStyle((STYLE_THEME[style] ?? STYLE_THEME.goldenAge).floor, 1).fillRect(x + (i * slice) / 4, top, slice / 4, height);
                }
            });
            // The number to press, as a key cap on the panel's corner
            over.fillStyle(INK, 1).fillRect(x - 4, top - 4, 34, 34);
            over.fillStyle(YELLOW, 1).fillRect(x - 1, top - 1, 28, 28);
            pixelNumber(over, String(index + 1), x + 13, top + 13, 3, INK);
            const name = makeText(this, x + width / 2, top + height + 13, level.name, 17, { bold: true }).setOrigin(0.5);
            if (name.width > width - 10) {
                name.setScale((width - 10) / name.width);
            }
            parts.push(name);
            this.startAreas.push({ x: x - 4, y: top - 4, width: width + 8, height: height + 34, act: () => this.begin(index, true) });
        });
        parts.push(over);
        return this.add.container(0, 0, parts);
    }

    private openSettings() {
        if (this.settings) {
            return;
        }
        this.game.events.emit(Events.UI_SELECT);
        // Tall enough for five rows (God mode was the fifth)
        const sheet = new Phaser.Geom.Rectangle(170, 52, 940, 610);
        const g = this.add.graphics();
        g.fillStyle(INK, 0.78).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        panel(g, sheet.x, sheet.y, sheet.width, sheet.height, PAPER, 5, 10);
        g.fillStyle(INK, 1).fillRect(sheet.x + 30, sheet.y + 92, sheet.width - 60, 4);
        const heading = makeText(this, sheet.x + 36, sheet.y + 24, LABELS.settingsTab, 50, {
            bold: true,
            color: RED,
            stroke: INK,
            strokeThickness: 8,
            drop: 3,
        });
        const back = makeText(this, sheet.right - 36, sheet.y + 60, LABELS.settingsBack, 17, { bold: true, color: RED }).setOrigin(1, 0.5);
        const settingsPanel = new SettingsPanel(this, sheet.x + 40, sheet.y + 120, sheet.width - 80, () => this.game.events.emit(Events.UI_SELECT));
        const root = this.add.container(0, 0, [g, heading, back, settingsPanel.container]).setDepth(10).setAlpha(0);
        this.tweens.add({ targets: root, alpha: 1, duration: 90 });
        this.settings = { root, panel: settingsPanel, sheet };
    }

    private closeSettings() {
        if (!this.settings) {
            return;
        }
        this.tweens.killTweensOf(this.settings.root);
        this.settings.root.destroy();
        this.settings = undefined;
        this.game.events.emit(Events.UI_SELECT);
        // Demo mode may have been switched: the cover offers what the setting says
        this.buildStartArea();
    }
}
