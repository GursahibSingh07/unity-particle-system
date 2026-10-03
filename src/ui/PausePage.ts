import Phaser from 'phaser';
import { LEVELS } from '../config/levels';
import { Progress } from '../state';
import type { ArtStyle, LevelDef } from '../types';
import { burst, burstPoints, controlsRow, dashedRect, panel, pixelNumber } from './draw';
import { GUIDE_ORDER, GuideCard } from './GuideCard';
import { LABELS } from './labels';
import {
    Depth,
    GREY,
    INK,
    PAPER,
    PAPER_SHADE,
    PENCIL,
    RED,
    SCREEN_HEIGHT,
    SCREEN_WIDTH,
    STYLE_THEME,
    YELLOW,
    artStyleOf,
    makeText,
} from './theme';

const SHEET = { x: 50, y: 26, width: 1180, height: 668 };
const CONTENT = { x: 78, y: 112, width: 1124, height: 456 };
const LABEL_COLUMN = 236;
const GUTTER = 14;
/** Kept clear at the right of the page for the tally */
const TALLY_COLUMN = 260;
const ROOM_COLS = 20;
const ROOM_ROWS = 10;

export interface PauseContext {
    /** Index into LEVELS of the level being played, or -1 (the sandbox is not on the page) */
    levelIndex: number;
    /** Zero-based room being played */
    roomIndex: number;
    /** The palette the current level's sprites are baked in */
    style: ArtStyle;
}

type Tab = 'map' | 'guide';

/**
 * The pause screen is the comic itself: one strip per level, one panel per room, inked once
 * the room is cleared. The second tab is the Handler's Field Guide.
 */
export class PausePage {
    private readonly root: Phaser.GameObjects.Container;
    private content?: Phaser.GameObjects.Container;
    private header?: Phaser.GameObjects.Container;
    private blink?: Phaser.Tweens.Tween;
    private tab: Tab = 'map';

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly context: PauseContext,
    ) {
        const g = scene.add.graphics();
        g.fillStyle(INK, 0.8).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        panel(g, SHEET.x, SHEET.y, SHEET.width, SHEET.height, PAPER, 5, 10);
        g.fillStyle(INK, 1).fillRect(CONTENT.x, 98, CONTENT.width, 4);
        g.fillStyle(INK, 1).fillRect(CONTENT.x, 580, CONTENT.width, 4);

        const paused = makeText(scene, CONTENT.x + CONTENT.width, 36, LABELS.paused, 50, {
            bold: true,
            color: RED,
            stroke: INK,
            strokeThickness: 8,
            drop: 3,
        }).setOrigin(1, 0);
        const resume = makeText(scene, SCREEN_WIDTH / 2, 660, LABELS.resume, 17, { bold: true, color: RED }).setOrigin(0.5);

        this.root = scene.add.container(0, 0, [g, paused, resume, ...controlsRow(scene, SCREEN_WIDTH / 2, 600, 17)]);
        this.root.setDepth(Depth.pause).setAlpha(0);
        scene.tweens.add({ targets: this.root, alpha: 1, duration: 90 });
        this.build();
    }

    /** Any direction flips between the two tabs */
    turn() {
        this.tab = this.tab === 'map' ? 'guide' : 'map';
        this.build();
    }

    destroy() {
        this.blink?.stop();
        this.scene.tweens.killTweensOf(this.root);
        this.root.destroy();
    }

    private build() {
        this.blink?.stop();
        this.blink = undefined;
        this.header?.destroy();
        this.content?.destroy();
        this.header = this.buildTabs();
        this.content = this.tab === 'map' ? this.buildMap() : this.buildGuide();
        this.root.add([this.header, this.content]);
    }

    private buildTabs() {
        const g = this.scene.add.graphics();
        const parts: Phaser.GameObjects.GameObject[] = [g];
        let x = CONTENT.x;
        for (const [tab, label] of [
            ['map', LABELS.mapTab],
            ['guide', LABELS.guideTab],
        ] as [Tab, string][]) {
            const active = tab === this.tab;
            const text = makeText(this.scene, 0, 0, label, 24, { bold: true, color: active ? PAPER : INK }).setOrigin(0.5);
            const width = Math.ceil(text.width) + 40;
            // The open tab stands taller and joins the rule beneath it
            const top = active ? 46 : 54;
            g.fillStyle(INK, 1).fillRect(x, top, width, 98 - top);
            g.fillStyle(active ? RED : PAPER_SHADE, 1).fillRect(x + 4, top + 4, width - 8, 98 - top - 4);
            text.setPosition(x + width / 2, top + (98 - top) / 2 + 1);
            parts.push(text);
            x += width + 8;
        }
        parts.push(makeText(this.scene, x + 14, 74, LABELS.switchTabs, 16, { color: GREY }).setOrigin(0, 0.5));
        return this.scene.add.container(0, 0, parts);
    }

    private buildMap() {
        const container = this.scene.add.container(0, 0);
        const count = Math.max(1, LEVELS.length);
        const stripHeight = Math.min(152, Math.floor(CONTENT.height / count));
        const top = CONTENT.y + Math.round((CONTENT.height - stripHeight * count) / 2);

        LEVELS.forEach((level, index) => {
            this.buildStrip(container, level, index, top + index * stripHeight, stripHeight);
        });
        this.buildTally(container);
        return container;
    }

    private buildStrip(container: Phaser.GameObjects.Container, level: LevelDef, levelIndex: number, top: number, height: number) {
        const registry = this.scene.registry;
        const theme = STYLE_THEME[level.style] ?? STYLE_THEME.goldenAge;
        const rooms = level.rooms.length;
        const panelsWidth = CONTENT.width - LABEL_COLUMN - TALLY_COLUMN;
        const tile = Phaser.Math.Clamp(
            Math.min(Math.floor((height - 22) / ROOM_ROWS), Math.floor((panelsWidth - GUTTER * (rooms - 1)) / rooms / ROOM_COLS)),
            3,
            13,
        );
        const width = tile * ROOM_COLS;
        const panelHeight = tile * ROOM_ROWS;
        const y = top + Math.round((height - panelHeight) / 2);

        const g = this.scene.add.graphics();
        container.add(g);

        const pageTag = makeText(this.scene, CONTENT.x, y + 2, LABELS.page, 17, { bold: true, color: RED });
        pixelNumber(g, String(levelIndex + 1), CONTENT.x + Math.ceil(pageTag.width) + 14, y + 12, 2, RED);
        const name = makeText(this.scene, CONTENT.x, y + 22, level.name, 28, { bold: true });
        if (name.width > LABEL_COLUMN - 20) {
            name.setScale((LABEL_COLUMN - 20) / name.width);
        }
        container.add([pageTag, name]);

        level.rooms.forEach((room, roomIndex) => {
            const x = CONTENT.x + LABEL_COLUMN + roomIndex * (width + GUTTER);
            const cleared = Progress.isRoomCleared(registry, levelIndex, roomIndex);
            const current = levelIndex === this.context.levelIndex && roomIndex === this.context.roomIndex;
            const secretFound = Progress.secrets(registry).includes(`${levelIndex}:${roomIndex}`);

            if (cleared) {
                g.fillStyle(INK, 1).fillRect(x + 4, y + 4, width, panelHeight);
                g.fillStyle(theme.floor, 1).fillRect(x, y, width, panelHeight);
                room.layout.forEach((row, rowIndex) => {
                    for (let column = 0; column < row.length; column++) {
                        const char = row[column];
                        // An unbroken secret wall is drawn as plain wall: the page keeps the secret too
                        const wall = char === '#' || (char === 'S' && !secretFound);
                        if (wall) {
                            g.fillStyle(theme.wall, 1).fillRect(x + column * tile, y + rowIndex * tile, tile, tile);
                        } else if (char === 'o') {
                            g.fillStyle(theme.accent, 1).fillRect(x + column * tile + 2, y + rowIndex * tile + 2, tile - 4, tile - 4);
                        } else if (char === 'S' || char === 'H') {
                            g.fillStyle(YELLOW, 1).fillRect(x + column * tile, y + rowIndex * tile, tile, tile);
                        }
                    }
                });
                g.lineStyle(3, INK, 1).strokeRect(x, y, width, panelHeight);

                g.fillStyle(INK, 1).fillRect(x, y + panelHeight - 24, 24, 24);
                pixelNumber(g, String(roomIndex + 1), x + 12, y + panelHeight - 12, 2, PAPER);
            } else {
                g.fillStyle(PAPER_SHADE, 0.45).fillRect(x, y, width, panelHeight);
                dashedRect(g, x, y, width, panelHeight, PENCIL, 9, 3);
                const dot = Math.max(2, Math.min(5, Math.floor(panelHeight / 18)));
                pixelNumber(g, String(roomIndex + 1), x + width / 2, y + panelHeight / 2, dot, PENCIL);
            }

            if (secretFound) {
                const star = this.scene.add.graphics();
                burst(star, burstPoints(0, 0, 17, 9, 8), YELLOW, INK, 3);
                star.setPosition(x + width - 6, y + 6);
                container.add(star);
            }

            if (current) {
                const frame = this.scene.add.graphics();
                frame.lineStyle(5, RED, 1).strokeRect(x - 5, y - 5, width + 10, panelHeight + 10);
                const tag = makeText(this.scene, 0, 0, LABELS.here, 13, { bold: true, color: PAPER });
                const tagWidth = Math.ceil(tag.width) + 12;
                frame.fillStyle(RED, 1).fillRect(x - 7, y - 20, tagWidth, 18);
                tag.setPosition(x - 1, y - 20);
                container.add([frame, tag]);

                const key = `player-${this.context.style}`;
                if (this.scene.textures.exists(key)) {
                    const scale = Math.max(1, Math.floor((panelHeight * 0.5) / 16));
                    const hero = this.scene.add.image(x + width / 2, y + panelHeight / 2, key, 0).setScale(scale);
                    container.add(hero);
                }
                this.blink = this.scene.tweens.add({ targets: frame, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
            }
        });
    }

    /** The run so far, in the margin: how much of the comic has been inked */
    private buildTally(container: Phaser.GameObjects.Container) {
        const registry = this.scene.registry;
        const rooms = LEVELS.reduce((sum, level) => sum + level.rooms.length, 0);
        const cleared = Progress.clearedRooms(registry).filter((key) => !key.startsWith('sandbox')).length;
        const guide = Progress.guide(registry).filter((id) => GUIDE_ORDER.includes(id)).length;
        const rows: [string, string][] = [
            [`${Math.min(cleared, rooms)}/${rooms}`, LABELS.statPanels],
            [`${guide}/${GUIDE_ORDER.length}`, LABELS.statGuide],
            // How many there are to find stays a secret too
            [String(Progress.secrets(registry).length), LABELS.statSecrets],
        ];
        const x = CONTENT.x + CONTENT.width - 232;
        const height = 118;
        const top = CONTENT.y + Math.round((CONTENT.height - rows.length * height - (rows.length - 1) * 16) / 2);
        const g = this.scene.add.graphics();
        container.add(g);
        rows.forEach(([value, label], index) => {
            const y = top + index * (height + 16);
            panel(g, x, y, 226, height, PAPER, 4, 5);
            g.fillStyle(YELLOW, 1).fillRect(x + 4, y + 4, 218, 30);
            g.fillStyle(INK, 1).fillRect(x + 4, y + 34, 218, 3);
            container.add(makeText(this.scene, x + 113, y + 19, label, 17, { bold: true }).setOrigin(0.5));
            pixelNumber(g, value, x + 113, y + 77, 6, RED);
        });
    }

    private buildGuide() {
        const container = this.scene.add.container(0, 0);
        const unlocked = Progress.guide(this.scene.registry);
        const ended = Progress.ended(this.scene.registry);
        const gap = 14;
        const width = Math.floor((CONTENT.width - gap * (GUIDE_ORDER.length - 1)) / GUIDE_ORDER.length);

        GUIDE_ORDER.forEach((id, index) => {
            const card = new GuideCard(this.scene, CONTENT.x + index * (width + gap), CONTENT.y + 6, id, {
                width,
                height: CONTENT.height - 14,
                style: artStyleOf(this.context.style),
                unlocked: unlocked.includes(id),
                truthSlot: ended,
            });
            if (ended && unlocked.includes(id)) {
                card.revealTruth(false);
            }
            container.add(card.container);
        });
        return container;
    }
}
