import Phaser from 'phaser';
import { RADIATIONS } from '../config/radiation';
import type { RadiationId } from '../types';
import { halftoneFade, pixelNumber } from './draw';
import { Depth, HUD_STRIP, INK, ORANGE, PAPER, PAPER_SHADE, RED, RED_DARK, SCREEN_WIDTH, WHITE, YELLOW, makeText } from './theme';

/** Health points shown by one block */
const BLOCK_HEALTH = 5;
const ROWS = 2;
const BLOCK_WIDTH = 22;
const BLOCK_HEIGHT = 16;
const BLOCK_GAP = 4;
const BLOCKS_X = 52;
const BLOCKS_Y = 9;
const BASE_COLUMNS = 10;
const ENERGY_Y = 53;
const ENERGY_HEIGHT = 14;
const ENERGY_WIDTH = BASE_COLUMNS * (BLOCK_WIDTH + BLOCK_GAP) - BLOCK_GAP;
const WELL = 0x3d3852;
const WELL_SHADE = 0x2a2540;
const LOW_HEALTH = 0.3;

const SLOTS_X = 448;
const SLOT_Y = 13;
const SLOT_SIZE = 50;
const SLOT_GAP = 10;
const ICON_FRAMES: Record<RadiationId, number> = { radio: 0, infrared: 1, ultraviolet: 2, gamma: 3 };

/** The strip above the room: health blocks, energy, radiation slots, and where you are */
export class Hud {
    private readonly blocks: Phaser.GameObjects.Graphics;
    private readonly energy: Phaser.GameObjects.Graphics;
    private readonly slots: Phaser.GameObjects.Graphics;
    private readonly pips: Phaser.GameObjects.Graphics;
    private readonly heart: Phaser.GameObjects.Image;
    private readonly levelName: Phaser.GameObjects.Text;
    private readonly roomText: Phaser.GameObjects.Text;
    private readonly radiationName: Phaser.GameObjects.Text;
    private slotParts: Phaser.GameObjects.GameObject[] = [];
    private lowPulse?: Phaser.Tweens.Tween;

    private health = 100;
    private maxHealth = 100;
    private energyNow = 1;
    private energyMax = 1;
    private selected: RadiationId = 'radio';
    private owned: RadiationId[] = ['radio'];

    constructor(private readonly scene: Phaser.Scene) {
        const strip = scene.add.graphics().setDepth(Depth.hud);
        strip.fillStyle(PAPER, 1).fillRect(0, 0, SCREEN_WIDTH, HUD_STRIP);
        halftoneFade(strip, 820, 4, 460, HUD_STRIP - 12, PAPER_SHADE, 9, 3.2, 'right');
        strip.fillStyle(INK, 1).fillRect(0, HUD_STRIP - 5, SCREEN_WIDTH, 5);

        this.heart = scene.add.image(28, BLOCKS_Y + 18, 'heart', 0).setScale(3).setDepth(Depth.hud);
        this.blocks = scene.add.graphics().setDepth(Depth.hud);

        // A small bolt beside the energy bar, so the two bars are told apart without a word
        const bolt = scene.add.graphics().setDepth(Depth.hud);
        const boltPoints = [
            [10, 0], [2, 9], [8, 9], [5, 16], [14, 6], [8, 6],
        ].map(([x, y]) => new Phaser.Math.Vector2(20 + x, ENERGY_Y - 1 + y));
        bolt.fillStyle(YELLOW, 1).fillPoints(boltPoints, true);
        bolt.lineStyle(2, INK, 1).strokePoints(boltPoints, true, true);
        this.energy = scene.add.graphics().setDepth(Depth.hud);

        this.slots = scene.add.graphics().setDepth(Depth.hud);
        this.radiationName = makeText(scene, 0, SLOT_Y + SLOT_SIZE / 2, '', 24, { bold: true })
            .setOrigin(0, 0.5)
            .setDepth(Depth.hud);

        this.levelName = makeText(scene, SCREEN_WIDTH - 24, 8, '', 28, { bold: true })
            .setOrigin(1, 0)
            .setDepth(Depth.hud);
        this.roomText = makeText(scene, SCREEN_WIDTH - 24, 44, '', 22, { bold: true })
            .setOrigin(1, 0)
            .setDepth(Depth.hud);
        this.pips = scene.add.graphics().setDepth(Depth.hud);

        this.drawBlocks();
        this.drawEnergy();
        this.drawSlots();
    }

    setHealth(health: number, maxHealth: number) {
        const hurt = health < this.health;
        this.health = health;
        this.maxHealth = maxHealth;
        this.drawBlocks();

        if (hurt) {
            // A quick knock, so damage registers even when the eye is on the room
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

    /** The ending: there was never any health, energy or radiation. The strip goes blank. */
    goPlain() {
        const cover = this.scene.add.graphics().setDepth(Depth.hud + 3).setAlpha(0);
        cover.fillStyle(PAPER, 1).fillRect(0, 0, SCREEN_WIDTH, HUD_STRIP - 5);
        this.scene.tweens.add({ targets: cover, alpha: 1, duration: 500 });
    }

    /** Maximum health went up: the new blocks are already drawn, this just draws the eye to them */
    celebrate() {
        this.scene.tweens.add({ targets: this.heart, scale: 5, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    }

    setEnergy(energy: number, maxEnergy: number) {
        this.energyNow = energy;
        this.energyMax = maxEnergy;
        this.drawEnergy();
    }

    setRadiation(id: RadiationId) {
        if (!RADIATIONS[id]) {
            return;
        }
        this.selected = id;
        this.drawEnergy();
        this.drawSlots();
    }

    setOwned(ids: RadiationId[]) {
        this.owned = ids.filter((id) => RADIATIONS[id]);
        this.drawSlots();
    }

    setRoom(levelName: string, roomNumber: number, totalRooms: number) {
        this.levelName.setText(levelName);
        // The smoke test reads the room from this text as "n/total"
        this.roomText.setText(`${roomNumber}/${totalRooms}`);

        const size = 14;
        const gap = 6;
        const right = SCREEN_WIDTH - 24 - Math.ceil(this.roomText.width) - 14;
        const top = 51;
        this.pips.clear();
        for (let i = 0; i < totalRooms; i++) {
            const x = right - (totalRooms - i) * (size + gap) + gap;
            this.pips.fillStyle(INK, 1).fillRect(x, top, size, size);
            const fill = i + 1 < roomNumber ? INK : i + 1 === roomNumber ? RED : PAPER;
            this.pips.fillStyle(fill, 1).fillRect(x + 3, top + 3, size - 6, size - 6);
        }
    }

    private drawBlocks() {
        const g = this.blocks;
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
                g.fillStyle(RED, 1).fillRect(x + 2, y + 2, innerWidth, innerHeight);
                g.fillStyle(RED_DARK, 1).fillRect(x + 2, y + BLOCK_HEIGHT - 5, innerWidth, 3);
                g.fillStyle(bonus ? YELLOW : 0xff8a78, 1).fillRect(x + 2, y + 2, innerWidth, 2);
                g.fillStyle(WHITE, 1).fillRect(x + 4, y + 5, 4, 2);
            } else {
                g.fillStyle(WELL, 1).fillRect(x + 2, y + 2, innerWidth, innerHeight);
                g.fillStyle(WELL_SHADE, 1).fillRect(x + 2, y + 2, innerWidth, 3);
            }
        }
    }

    private drawEnergy() {
        const g = this.energy;
        const color = RADIATIONS[this.selected].color;
        const fraction = Phaser.Math.Clamp(this.energyNow / this.energyMax, 0, 1);
        const inner = ENERGY_WIDTH - 4;
        g.clear();
        g.fillStyle(INK, 1).fillRect(BLOCKS_X, ENERGY_Y, ENERGY_WIDTH, ENERGY_HEIGHT);
        g.fillStyle(WELL, 1).fillRect(BLOCKS_X + 2, ENERGY_Y + 2, inner, ENERGY_HEIGHT - 4);
        g.fillStyle(WELL_SHADE, 1).fillRect(BLOCKS_X + 2, ENERGY_Y + 2, inner, 3);
        const width = Math.round(inner * fraction);
        if (width > 0) {
            g.fillStyle(color, 1).fillRect(BLOCKS_X + 2, ENERGY_Y + 2, width, ENERGY_HEIGHT - 4);
            g.fillStyle(WHITE, 0.45).fillRect(BLOCKS_X + 2, ENERGY_Y + 2, width, 3);
        }
        // Quarter marks, to judge whether there is enough for one more shot
        g.fillStyle(INK, 0.55);
        for (let i = 1; i < 4; i++) {
            g.fillRect(BLOCKS_X + 2 + Math.round((inner * i) / 4) - 1, ENERGY_Y + 2, 2, ENERGY_HEIGHT - 4);
        }
    }

    private drawSlots() {
        for (const part of this.slotParts) {
            part.destroy();
        }
        this.slotParts = [];
        const g = this.slots;
        g.clear();
        // Key numbers are drawn over the icons
        const badges = this.scene.add.graphics().setDepth(Depth.hud + 1);
        this.slotParts.push(badges);

        const owned = [...new Set([...this.owned, this.selected])].sort((a, b) => RADIATIONS[a].key - RADIATIONS[b].key);
        owned.forEach((id, index) => {
            const def = RADIATIONS[id];
            const selected = id === this.selected;
            const x = SLOTS_X + index * (SLOT_SIZE + SLOT_GAP);
            const y = selected ? SLOT_Y - 3 : SLOT_Y;

            // The selected slot is lifted off the paper and filled with its colour
            g.fillStyle(INK, 1).fillRect(x + (selected ? 5 : 2), y + (selected ? 6 : 2), SLOT_SIZE, SLOT_SIZE);
            g.fillStyle(INK, 1).fillRect(x, y, SLOT_SIZE, SLOT_SIZE);
            const border = selected ? 4 : 3;
            g.fillStyle(selected ? def.color : PAPER_SHADE, 1).fillRect(
                x + border,
                y + border,
                SLOT_SIZE - border * 2,
                SLOT_SIZE - border * 2,
            );
            if (selected) {
                g.fillStyle(WHITE, 0.4).fillRect(x + border, y + border, SLOT_SIZE - border * 2, 4);
            }

            const icon = this.scene.add
                .image(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2 - 1, 'icons', ICON_FRAMES[id])
                .setScale(3)
                .setAlpha(selected ? 1 : 0.55)
                .setDepth(Depth.hud);
            // The key number sits on the corner like a price sticker
            const badgeX = x + SLOT_SIZE - 9;
            const badgeY = y + SLOT_SIZE - 7;
            badges.fillStyle(INK, 1).fillRect(badgeX - 9, badgeY - 9, 20, 20);
            badges.fillStyle(selected ? YELLOW : PAPER, 1).fillRect(badgeX - 7, badgeY - 7, 16, 16);
            pixelNumber(badges, String(def.key), badgeX + 1, badgeY + 1, 2, INK);
            this.slotParts.push(icon);
        });

        this.radiationName
            .setText(RADIATIONS[this.selected].name.toUpperCase())
            .setX(SLOTS_X + owned.length * (SLOT_SIZE + SLOT_GAP) + 14);
    }
}
