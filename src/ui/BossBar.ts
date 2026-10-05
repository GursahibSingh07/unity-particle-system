import Phaser from 'phaser';
import { GUIDE } from '../config/text';
import { Depth, INK, PAPER, RED, RED_DARK, SCREEN_WIDTH, YELLOW, makeText } from './theme';

const WIDTH = 420;
const HEIGHT = 18;
const TOP = 34;
const BORDER = 4;

/** The boss's health, in the middle of the top strip where a timed era shows its clock */
export class BossBar {
    private readonly container: Phaser.GameObjects.Container;
    private readonly fill: Phaser.GameObjects.Rectangle;
    private readonly chip: Phaser.GameObjects.Rectangle;
    private shown = 1;

    constructor(private readonly scene: Phaser.Scene) {
        const left = -WIDTH / 2;
        const back = scene.add.rectangle(0, TOP, WIDTH + BORDER * 2, HEIGHT + BORDER * 2, INK).setOrigin(0.5, 0);
        const trough = scene.add.rectangle(left, TOP + BORDER, WIDTH, HEIGHT, RED_DARK).setOrigin(0, 0);
        // The pale bar lags behind the red one, so a big hit is seen as a chunk coming off
        this.chip = scene.add.rectangle(left, TOP + BORDER, WIDTH, HEIGHT, PAPER).setOrigin(0, 0);
        this.fill = scene.add.rectangle(left, TOP + BORDER, WIDTH, HEIGHT, RED).setOrigin(0, 0);
        const name = makeText(scene, 0, TOP - 4, GUIDE.prism.title.toUpperCase(), 20, {
            bold: true,
            color: YELLOW,
            stroke: INK,
            strokeThickness: 5,
        }).setOrigin(0.5, 1);

        this.container = scene.add
            .container(SCREEN_WIDTH / 2, 0, [back, trough, this.chip, this.fill, name])
            .setDepth(Depth.hud)
            .setVisible(false);
    }

    set(health: number, maxHealth: number) {
        const fraction = Phaser.Math.Clamp(maxHealth > 0 ? health / maxHealth : 0, 0, 1);
        if (fraction <= 0) {
            this.hide();
            return;
        }
        if (!this.container.visible) {
            this.container.setVisible(true);
            this.chip.width = WIDTH * fraction;
        }
        this.fill.width = WIDTH * fraction;
        this.scene.tweens.killTweensOf(this.chip);
        this.scene.tweens.add({ targets: this.chip, width: WIDTH * fraction, duration: 350, delay: 180, ease: 'Quad.easeOut' });
        if (fraction < this.shown) {
            this.container.y = 2;
            this.scene.tweens.add({ targets: this.container, y: 0, duration: 120 });
        }
        this.shown = fraction;
    }

    hide() {
        this.scene.tweens.killTweensOf(this.chip);
        this.container.setVisible(false);
        this.shown = 1;
    }
}
