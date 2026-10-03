import Phaser from 'phaser';
import { TITLE } from '../config/text';
import { Events } from '../events';
import { Progress } from '../state';
import { burst, burstPoints, controlsRow, halftoneFade, panel, rays } from '../ui/draw';
import { LABELS } from '../ui/labels';
import { BLUE, INK, ORANGE, PAPER, RED, SCREEN_HEIGHT, SCREEN_WIDTH, WHITE, YELLOW, makeText } from '../ui/theme';

const STYLE = 'goldenAge';
const HERO = { x: 318, y: 468, scale: 18 };
/** A press this soon after the cover appears is the one that closed the credits */
const INPUT_DELAY = 350;

/** The title screen: the cover of issue one */
export class Title extends Phaser.Scene {
    private started = false;

    constructor() {
        super('Title');
    }

    create() {
        this.started = false;
        // The ending comes back here: nothing of the last run may be left on screen
        for (const key of ['Game', 'Ending', 'UI']) {
            if (this.scene.isActive(key) || this.scene.isPaused(key) || this.scene.isSleeping(key)) {
                this.scene.stop(key);
            }
        }

        this.drawBackground();
        this.drawMonsters();
        this.drawHero();
        this.drawMasthead();
        this.drawFurniture();

        this.game.events.emit(Events.TITLE_SHOWN);

        const openedAt = this.time.now;
        const begin = () => {
            if (this.started || this.time.now - openedAt < INPUT_DELAY) {
                return;
            }
            this.started = true;
            this.game.events.emit(Events.UI_SELECT);
            Progress.reset(this.registry);
            // The UI starts first so it is listening when the Game scene reports its state
            this.scene.launch('UI');
            this.scene.start('Game', { level: 0, room: 0 });
        };
        this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
            // Not the keys people press to reach the game: fullscreen, switching windows, modifiers
            const passing = /^(Shift|Control|Alt|Meta|Tab|CapsLock|OS|F\d+)$/.test(event.key);
            if (!event.repeat && !passing) {
                begin();
            }
        });
        this.input.on('pointerdown', begin);
    }

    private drawBackground() {
        const g = this.add.graphics();
        g.fillStyle(YELLOW, 1).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        rays(g, HERO.x + 60, HERO.y - 10, 1500, 36, ORANGE, 0.55);
        halftoneFade(g, 0, 400, SCREEN_WIDTH, 330, RED, 18, 9, 'down', 0.5);
        halftoneFade(g, 640, 0, 660, 420, BLUE, 18, 8, 'right', 0.28);
    }

    private drawMonsters() {
        const loom = (key: string, x: number, y: number, scale: number, frame = 0, alpha = 1) => {
            // A hard ink shadow behind each one lifts it off the sunburst
            this.add
                .image(x + scale, y + scale, `${key}-${STYLE}`, frame)
                .setScale(scale)
                .setTint(INK)
                .setTintMode(Phaser.TintModes.FILL)
                .setAlpha(alpha);
            const sprite = this.add.sprite(x, y, `${key}-${STYLE}`, frame).setScale(scale).setAlpha(alpha);
            return sprite;
        };

        loom('prism', 1052, 300, 9).play(`prism-${STYLE}-move`);
        loom('shade', 780, 262, 8);
        loom('ironclad', 1150, 520, 9, 2);
        loom('frostling', 904, 506, 10).play(`frostling-${STYLE}-move`);
        for (const [x, y, frame] of [
            [600, 286, 0],
            [668, 312, 1],
            [520, 262, 1],
            [716, 392, 0],
        ]) {
            loom('swarmlet', x, y, 6, frame);
        }
    }

    private drawHero() {
        const { x, y, scale } = HERO;
        const angle = -9;
        const length = 12 * scale;
        const tip = new Phaser.Math.Vector2(length, 0).rotate(Phaser.Math.DegToRad(angle)).add({ x: x + 20, y: y + 28 });

        // The beam: a cone of light thrown from the machine across the page
        const beam = this.add.graphics();
        const reach = 330;
        const spread = 0.2;
        const direction = Phaser.Math.DegToRad(angle);
        const edge = (side: number, distance: number) =>
            new Phaser.Math.Vector2(distance, 0).rotate(direction + side * spread).add(tip);
        const cone = [tip.clone(), edge(-1, reach), edge(1, reach)];
        beam.fillStyle(WHITE, 0.92).fillPoints(cone, true);
        beam.lineStyle(5, INK, 1).strokePoints(cone, true, true);
        const impact = edge(0, reach);
        burst(beam, burstPoints(impact.x + 6, impact.y + 7, 74, 44, 12, 0.3, 5), INK, INK, 0);
        burst(beam, burstPoints(impact.x, impact.y, 74, 44, 12, 0.3, 5), WHITE, INK, 5);
        burst(beam, burstPoints(impact.x, impact.y, 44, 26, 12, 0.3, 5), YELLOW, INK, 0);

        this.add
            .image(x + scale, y + scale, `player-${STYLE}`, 6)
            .setScale(scale)
            .setTint(INK)
            .setTintMode(Phaser.TintModes.FILL);
        this.add.image(x, y, `player-${STYLE}`, 6).setScale(scale);
        this.add
            .image(x + 20, y + 28, `machine-${STYLE}`, 0)
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
        this.add.container(480, 212, [ribbon, tagline]).setAngle(-2);

        // The seal every cover used to carry
        const seal = this.add.graphics();
        burst(seal, burstPoints(5, 6, 78, 62, 18), INK, INK, 0);
        burst(seal, burstPoints(0, 0, 78, 62, 18), WHITE, INK, 4);
        const sealText = makeText(this, 0, 0, LABELS.coverSeal.join('\n'), 17, { bold: true, color: BLUE, align: 'center' }).setOrigin(0.5);
        this.add.container(112, 268, [seal, sealText]).setAngle(-10);

        // The outer frame of the cover
        g.lineStyle(10, PAPER, 1).strokeRect(5, 5, SCREEN_WIDTH - 10, SCREEN_HEIGHT - 10);
        g.lineStyle(4, INK, 1).strokeRect(12, 12, SCREEN_WIDTH - 24, SCREEN_HEIGHT - 24);

        const prompt = makeText(this, 0, 0, TITLE.prompt.toUpperCase(), 36, { bold: true }).setOrigin(0.5);
        const width = Math.ceil(prompt.width) + 64;
        const box = this.add.graphics();
        panel(box, -width / 2, -32, width, 64, PAPER, 5, 7);
        const promptBox = this.add.container(SCREEN_WIDTH / 2, 612, [box, prompt]);
        // A hard blink, on for longer than it is off, like a cursor
        this.time.addEvent({ delay: 300, loop: true, callback: () => prompt.setVisible(this.time.now % 900 < 600) });
        this.tweens.add({ targets: promptBox, scale: 1.04, duration: 420, yoyo: true, repeat: -1 });

        const strip = this.add.graphics();
        strip.fillStyle(INK, 0.88).fillRect(14, 660, SCREEN_WIDTH - 28, 46);
        controlsRow(this, SCREEN_WIDTH / 2, 669, 15, PAPER);
    }
}
