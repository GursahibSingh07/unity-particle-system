import Phaser from 'phaser';
import { LEVELS } from '../config/levels';
import { GUIDE } from '../config/text';
import { Progress } from '../state';
import type { ArtStyle, LevelDef, MonsterId } from '../types';
import { getSettings } from '../settings';
import { burst, burstPoints, controlsRow, dashedRect, panel, pixelNumber, pixelNumberWidth } from './draw';
import { GUIDE_ORDER, GuideCard, guideSprite } from './GuideCard';
import { LABELS } from './labels';
import { SettingsPanel } from './SettingsPanel';
import { buildWeaponGuide } from './WeaponGuide';
import { Depth, GREY, INK, PAPER, PAPER_SHADE, PENCIL, RED, SCREEN_HEIGHT, SCREEN_WIDTH, STYLE_THEME, YELLOW, makeText } from './theme';

const SHEET = { x: 50, y: 26, width: 1180, height: 668 };
const CONTENT = { x: 78, y: 112, width: 1124, height: 456 };

/** The city pictures are 640x320: half size is a panel */
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 160;
const PANEL_CAPTION = 36;
const PANEL_GAP_X = 40;
const PANEL_GAP_Y = 30;
const PANEL_COLUMNS = 3;
const BOSS_SLICES: ArtStyle[] = ['goldenAge', 'cyberpunk', 'retro', 'manga'];

const GUIDE_COLUMNS = 4;
const CELL_WIDTH = 112;
const CELL_GAP = 10;

export interface PauseContext {
    /** Index into LEVELS of the era being played, or -1 (the sandbox is not on the page) */
    levelIndex: number;
    /** The palette the square is drawn in right now */
    style: ArtStyle;
    /** A setting was changed or a page turned: sound a blip */
    select: () => void;
}

const TABS = ['map', 'guide', 'weapons', 'settings'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
    map: LABELS.mapTab,
    guide: LABELS.guideTab,
    weapons: LABELS.weaponsTab,
    settings: LABELS.settingsTab,
};

interface Area {
    x: number;
    y: number;
    width: number;
    height: number;
    act: () => void;
}

/**
 * The pause screen is the comic itself: one panel per era, inked once the era is cleared. The
 * second tab is the Handler's Field Guide, the third the settings.
 */
export class PausePage {
    private readonly root: Phaser.GameObjects.Container;
    private content?: Phaser.GameObjects.Container;
    private header?: Phaser.GameObjects.Container;
    private settings?: SettingsPanel;
    private blink?: Phaser.Tweens.Tween;
    private areas: Area[] = [];
    private tab: Tab = 'map';
    private guideIndex = 0;

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
        const resume = makeText(scene, SCREEN_WIDTH / 2, 662, LABELS.resume, 17, { bold: true, color: RED }).setOrigin(0.5);

        this.root = scene.add.container(0, 0, [g, paused, resume, ...controlsRow(scene, SCREEN_WIDTH / 2, 602, 16, INK, PAPER, CONTENT.width)]);
        this.root.setDepth(Depth.pause).setAlpha(0);
        scene.tweens.add({ targets: this.root, alpha: 1, duration: 90 });

        // Open the guide on a page that has something on it
        const unlocked = Progress.guide(scene.registry);
        this.guideIndex = Math.max(0, GUIDE_ORDER.findIndex((id) => unlocked.includes(id)));
        this.build();
    }

    /** Q and E (and Tab) turn the page */
    /** True while the page of eras is the one showing */
    get showingMap() {
        return this.tab === 'map';
    }

    turn(step: 1 | -1) {
        this.tab = TABS[(TABS.indexOf(this.tab) + step + TABS.length) % TABS.length];
        this.build();
    }

    /** Any other key: the open tab may have a use for it. Returns true if it did. */
    key(code: string): boolean {
        if (this.tab === 'settings') {
            return this.settings?.key(code) ?? false;
        }
        if (this.tab === 'guide') {
            const moves: Record<string, number> = {
                ArrowLeft: -1,
                KeyA: -1,
                ArrowRight: 1,
                KeyD: 1,
                ArrowUp: -GUIDE_COLUMNS,
                KeyW: -GUIDE_COLUMNS,
                ArrowDown: GUIDE_COLUMNS,
                KeyS: GUIDE_COLUMNS,
            };
            const move = moves[code];
            if (move === undefined) {
                return false;
            }
            const count = GUIDE_ORDER.length;
            const next = Math.abs(move) === 1 ? (this.guideIndex + move + count) % count : this.guideIndex + move;
            if (next >= 0 && next < count && next !== this.guideIndex) {
                this.guideIndex = next;
                this.build();
                this.context.select();
            }
            return true;
        }
        return false;
    }

    click(x: number, y: number) {
        const area = this.areas.find((one) => x >= one.x && x < one.x + one.width && y >= one.y && y < one.y + one.height);
        if (area) {
            area.act();
        } else if (this.tab === 'settings') {
            this.settings?.click(x, y);
        }
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
        this.settings = undefined;
        this.areas = [];
        this.header = this.buildTabs();
        this.content =
            this.tab === 'map'
                ? this.buildMap()
                : this.tab === 'guide'
                  ? this.buildGuide()
                  : this.tab === 'weapons'
                    ? buildWeaponGuide(this.scene, CONTENT.x, CONTENT.y, CONTENT.width, CONTENT.height)
                    : this.buildSettings();
        this.root.add([this.header, this.content]);
    }

    private buildTabs() {
        const g = this.scene.add.graphics();
        const parts: Phaser.GameObjects.GameObject[] = [g];
        let x = CONTENT.x;
        for (const tab of TABS) {
            const active = tab === this.tab;
            const text = makeText(this.scene, 0, 0, TAB_LABELS[tab], 24, { bold: true, color: active ? PAPER : INK }).setOrigin(0.5);
            const width = Math.ceil(text.width) + 40;
            // The open tab stands taller and joins the rule beneath it
            const top = active ? 46 : 54;
            g.fillStyle(INK, 1).fillRect(x, top, width, 98 - top);
            g.fillStyle(active ? RED : PAPER_SHADE, 1).fillRect(x + 4, top + 4, width - 8, 98 - top - 4);
            text.setPosition(x + width / 2, top + (98 - top) / 2 + 1);
            parts.push(text);
            if (!active) {
                this.areas.push({
                    x,
                    y: 44,
                    width,
                    height: 56,
                    act: () => {
                        this.tab = tab;
                        this.build();
                        this.context.select();
                    },
                });
            }
            x += width + 8;
        }
        let hint = this.tab === 'guide' ? `${LABELS.switchTabs}     ${LABELS.guideHint}` : LABELS.switchTabs;
        if (this.tab === 'map' && getSettings().demoMode) {
            hint += `     ${LABELS.demoJump}`;
        }
        const hintText = makeText(this.scene, x + 14, 74, hint, 16, { color: GREY }).setOrigin(0, 0.5);
        // The hint gives way to the PAUSED stamp
        const room = CONTENT.x + CONTENT.width - 210 - (x + 14);
        if (hintText.width > room) {
            hintText.setScale(room / hintText.width);
        }
        parts.push(hintText);
        return this.scene.add.container(0, 0, parts);
    }

    private buildMap() {
        const container = this.scene.add.container(0, 0);
        // One more cell than there are eras: the last holds the tally
        const cells = LEVELS.length + 1;
        const rows = Math.ceil(cells / PANEL_COLUMNS);
        const cellHeight = PANEL_HEIGHT + PANEL_CAPTION;
        const left = CONTENT.x + Math.round((CONTENT.width - PANEL_COLUMNS * PANEL_WIDTH - (PANEL_COLUMNS - 1) * PANEL_GAP_X) / 2);
        const gapY = Math.min(PANEL_GAP_Y, Math.floor((CONTENT.height - 14 - rows * cellHeight) / Math.max(1, rows - 1)));
        const top = CONTENT.y + 22 + Math.max(0, Math.round((CONTENT.height - 22 - rows * cellHeight - (rows - 1) * gapY) / 2));
        const place = (index: number) => ({
            x: left + (index % PANEL_COLUMNS) * (PANEL_WIDTH + PANEL_GAP_X),
            y: top + Math.floor(index / PANEL_COLUMNS) * (cellHeight + gapY),
        });

        LEVELS.forEach((level, index) => {
            const { x, y } = place(index);
            this.buildPanel(container, level, index, x, y);
        });
        const { x, y } = place(LEVELS.length);
        this.buildTally(container, x, y);
        return container;
    }

    /** One era as one panel of the comic: its square, as it is drawn in that era */
    private buildPanel(container: Phaser.GameObjects.Container, level: LevelDef, index: number, x: number, y: number) {
        const registry = this.scene.registry;
        const cleared = Progress.isRoomCleared(registry, index, 0);
        const current = index === this.context.levelIndex;
        const secretFound = Progress.secrets(registry).some((key) => key.startsWith(`${index}:`));
        const g = this.scene.add.graphics();
        container.add(g);

        if (cleared || current) {
            g.fillStyle(INK, 1).fillRect(x + 5, y + 6, PANEL_WIDTH, PANEL_HEIGHT);
            g.fillStyle(INK, 1).fillRect(x - 3, y - 3, PANEL_WIDTH + 6, PANEL_HEIGHT + 6);
            // The boss page is every era at once
            const styles = level.style === 'finalPage' ? BOSS_SLICES : [level.style];
            const slice = 640 / styles.length;
            styles.forEach((style, i) => {
                const key = `city-${style}`;
                if (!this.scene.textures.exists(key)) {
                    g.fillStyle((STYLE_THEME[style] ?? STYLE_THEME.goldenAge).floor, 1).fillRect(x + (i * slice) / 2, y, slice / 2, PANEL_HEIGHT);
                    return;
                }
                const image = this.scene.add.image(x, y, key).setOrigin(0).setScale(0.5).setCrop(i * slice, 0, slice, 320);
                container.add(image);
                if (current && !cleared) {
                    // Pencilled in, not yet inked: the era is still being fought over
                    image.setAlpha(0.8);
                }
            });
            if (styles.length > 1) {
                const cuts = this.scene.add.graphics();
                cuts.fillStyle(INK, 1);
                for (let i = 1; i < styles.length; i++) {
                    cuts.fillRect(x + (i * slice) / 2 - 1, y, 3, PANEL_HEIGHT);
                }
                container.add(cuts);
            }
        } else {
            g.fillStyle(PAPER_SHADE, 0.45).fillRect(x, y, PANEL_WIDTH, PANEL_HEIGHT);
            dashedRect(g, x, y, PANEL_WIDTH, PANEL_HEIGHT, PENCIL, 9, 3);
            pixelNumber(g, String(index + 1), x + PANEL_WIDTH / 2, y + PANEL_HEIGHT / 2, 8, PENCIL);
        }

        // The caption under the panel: PAGE n and the era's name
        const captionY = y + PANEL_HEIGHT + 20;
        const reached = cleared || current;
        const tag = makeText(this.scene, x, captionY, LABELS.page, 17, { bold: true, color: reached ? RED : PENCIL }).setOrigin(0, 0.5);
        const numberX = x + Math.ceil(tag.width) + 8;
        const number = String(index + 1);
        const over = this.scene.add.graphics();
        pixelNumber(over, number, numberX + pixelNumberWidth(number, 2) / 2, captionY, 2, reached ? RED : PENCIL);
        const nameX = numberX + pixelNumberWidth(number, 2) + 12;
        const name = makeText(this.scene, nameX, captionY, level.name, 24, { bold: true, color: reached ? INK : PENCIL }).setOrigin(0, 0.5);
        const room = x + PANEL_WIDTH - nameX;
        if (name.width > room) {
            name.setScale(room / name.width);
        }
        container.add([tag, over, name]);

        if (secretFound) {
            const star = this.scene.add.graphics();
            burst(star, burstPoints(2, 3, 20, 11, 8), INK, INK, 0);
            burst(star, burstPoints(0, 0, 20, 11, 8), YELLOW, INK, 3);
            star.setPosition(x + PANEL_WIDTH - 8, y + 8);
            container.add(star);
        }

        if (current) {
            const key = `player-${this.context.style}`;
            if (this.scene.textures.exists(key)) {
                container.add(this.scene.add.image(x + PANEL_WIDTH / 2, y + PANEL_HEIGHT / 2 + 14, key, 0).setScale(2));
            }
            const frame = this.scene.add.graphics();
            frame.lineStyle(5, RED, 1).strokeRect(x - 6, y - 6, PANEL_WIDTH + 12, PANEL_HEIGHT + 12);
            const here = makeText(this.scene, 0, 0, LABELS.here, 14, { bold: true, color: PAPER });
            const hereWidth = Math.ceil(here.width) + 12;
            frame.fillStyle(RED, 1).fillRect(x - 8, y - 24, hereWidth, 20);
            here.setPosition(x - 2, y - 23);
            container.add([frame, here]);
            this.blink = this.scene.tweens.add({ targets: frame, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
        }
    }

    /** The run so far, in the last cell: how much of the comic has been inked */
    private buildTally(container: Phaser.GameObjects.Container, x: number, y: number) {
        const registry = this.scene.registry;
        const cleared = LEVELS.filter((_, index) => Progress.isRoomCleared(registry, index, 0)).length;
        const guide = Progress.guide(registry).filter((id) => GUIDE_ORDER.includes(id)).length;
        const rows: [string, string][] = [
            [LABELS.statPanels, `${cleared}/${LEVELS.length}`],
            [LABELS.statGuide, `${guide}/${GUIDE_ORDER.length}`],
            // How many there are to find stays a secret too
            [LABELS.statSecrets, String(Progress.secrets(registry).length)],
        ];
        const g = this.scene.add.graphics();
        container.add(g);
        const height = PANEL_HEIGHT + PANEL_CAPTION - 4;
        panel(g, x, y, PANEL_WIDTH, height, PAPER, 4, 6);
        const rowHeight = (height - 8) / rows.length;
        rows.forEach(([label, value], index) => {
            const top = y + 4 + index * rowHeight;
            if (index > 0) {
                g.fillStyle(INK, 1).fillRect(x + 4, top - 1, PANEL_WIDTH - 8, 3);
            }
            g.fillStyle(YELLOW, 1).fillRect(x + 4, top + (index > 0 ? 2 : 0), 10, rowHeight - (index > 0 ? 2 : 0));
            container.add(makeText(this.scene, x + 26, top + rowHeight / 2 + 1, label, 19, { bold: true }).setOrigin(0, 0.5));
            pixelNumber(g, value, x + PANEL_WIDTH - 22 - pixelNumberWidth(value, 4) / 2, top + rowHeight / 2 + 1, 4, RED);
        });
    }

    private buildGuide() {
        const container = this.scene.add.container(0, 0);
        const registry = this.scene.registry;
        const unlocked = Progress.guide(registry);
        const ended = Progress.ended(registry);
        const rows = Math.ceil(GUIDE_ORDER.length / GUIDE_COLUMNS);
        const cellHeight = Math.floor((CONTENT.height - 8 - (rows - 1) * CELL_GAP) / rows);
        const g = this.scene.add.graphics();
        container.add(g);

        GUIDE_ORDER.forEach((id, index) => {
            const x = CONTENT.x + (index % GUIDE_COLUMNS) * (CELL_WIDTH + CELL_GAP);
            const y = CONTENT.y + 8 + Math.floor(index / GUIDE_COLUMNS) * (cellHeight + CELL_GAP);
            this.buildCell(container, g, id, x, y, cellHeight, unlocked.includes(id), ended, index === this.guideIndex);
            this.areas.push({
                x,
                y,
                width: CELL_WIDTH,
                height: cellHeight,
                act: () => {
                    if (this.guideIndex !== index) {
                        this.guideIndex = index;
                        this.build();
                        this.context.select();
                    }
                },
            });
        });

        const id = GUIDE_ORDER[this.guideIndex];
        if (id) {
            const x = CONTENT.x + GUIDE_COLUMNS * (CELL_WIDTH + CELL_GAP) + 16;
            const open = unlocked.includes(id);
            const card = new GuideCard(this.scene, x, CONTENT.y + 8, id, {
                width: CONTENT.x + CONTENT.width - x - 6,
                height: CONTENT.height - 16,
                style: this.context.style,
                unlocked: open,
                truthSlot: ended,
                pictureHeight: ended ? 150 : 190,
                titleSize: 36,
                noteSizes: [24, 22, 20, 18, 16],
                truthHeight: 108,
            });
            if (ended && open) {
                card.revealTruth(false);
            }
            container.add(card.container);
        }
        return container;
    }

    /** A thumbnail in the guide's index */
    private buildCell(
        container: Phaser.GameObjects.Container,
        g: Phaser.GameObjects.Graphics,
        id: MonsterId,
        x: number,
        y: number,
        height: number,
        open: boolean,
        ended: boolean,
        selected: boolean,
    ) {
        const theme = STYLE_THEME[ended ? 'plain' : this.context.style] ?? STYLE_THEME.goldenAge;
        const pictureHeight = height - 30;
        if (selected) {
            g.fillStyle(RED, 1).fillRect(x - 5, y - 5, CELL_WIDTH + 10, height + 10);
        }
        g.fillStyle(INK, 1).fillRect(x, y, CELL_WIDTH, height);
        g.fillStyle(open ? theme.floor : PAPER_SHADE, 1).fillRect(x + 3, y + 3, CELL_WIDTH - 6, pictureHeight - 3);
        g.fillStyle(selected ? YELLOW : PAPER, 1).fillRect(x + 3, y + pictureHeight + 3, CELL_WIDTH - 6, height - pictureHeight - 6);

        const sprite = guideSprite(this.scene, id, ended && open ? 'plain' : this.context.style, pictureHeight - 16, 4);
        if (sprite) {
            sprite.setPosition(x + CELL_WIDTH / 2, y + 2 + pictureHeight / 2);
            if (!open) {
                sprite.setTint(INK).setTintMode(Phaser.TintModes.FILL).setAlpha(0.75);
            }
            container.add(sprite);
        }
        const title = makeText(this.scene, x + CELL_WIDTH / 2, y + height - 15, open ? (GUIDE[id]?.title ?? id) : LABELS.locked, 15, {
            bold: true,
            color: open ? INK : PENCIL,
        }).setOrigin(0.5);
        if (title.width > CELL_WIDTH - 12) {
            title.setScale((CELL_WIDTH - 12) / title.width);
        }
        container.add(title);
    }

    private buildSettings() {
        const width = 860;
        this.settings = new SettingsPanel(this.scene, CONTENT.x + (CONTENT.width - width) / 2, CONTENT.y + 44, width, this.context.select);
        return this.settings.container;
    }
}
