import Phaser from 'phaser';
import { LEVELS } from '../config/levels';
import { GUIDE } from '../config/text';
import { getSettings } from '../settings';
import { Progress } from '../state';
import type { ArtStyle, LevelDef, MonsterId } from '../types';
import { BookSettings, type SettingsSlot } from './BookSettings';
import {
    BOOK,
    CYAN,
    DESK,
    KEY,
    MAGENTA,
    NEWSPRINT,
    NEWSPRINT_DARK,
    NEWSPRINT_LIGHT,
    PAPER_LEFT,
    PAPER_RIGHT,
    PENCIL_BLUE,
    PROCESS_YELLOW,
    bakeBookTextures,
    captionBox,
    comicKeys,
    comicText,
    dots,
    fitWidth,
    headline,
    stamp,
    sticker,
} from './comic';
import { dashedRect } from './draw';
import { GUIDE_ORDER, guideSprite } from './GuideCard';
import { CONTROLS, LABELS } from './labels';
import { PageTurn } from './PageTurn';
import { Depth, SCREEN_HEIGHT, SCREEN_WIDTH, STYLE_THEME } from './theme';
import { RAY_ORDER, buildEnergyPanel, buildRayPanel, rayNames, weakTo } from './WeaponGuide';

const LEFT_X = BOOK.spine - BOOK.pageWidth;
const PAGE_WIDTH = BOOK.pageWidth;
const PAGE_HEIGHT = BOOK.pageHeight;

/** The printed area of a page, in the page's own coordinates */
const CONTENT_Y = 86;
const CONTENT_WIDTH = 530;
const CONTENT_HEIGHT = 494;
const GUTTER = 13;
/** The margin by the spine is the wider one, as in a bound book */
const contentX = (side: Side) => (side === 'left' ? 28 : 32);

const CITY_WIDTH = 640;
const CITY_HEIGHT = 320;
const BOSS_SLICES: ArtStyle[] = ['goldenAge', 'cyberpunk', 'retro', 'manga'];
const GUIDE_COLUMNS = 3;
const CORNER = 46;

type Side = 'left' | 'right';
type Page = Phaser.GameObjects.Container;

export interface PauseContext {
    /** Index into LEVELS of the era being played, or -1 (the sandbox is not on the page) */
    levelIndex: number;
    /** The palette the square is drawn in right now */
    style: ArtStyle;
    /** A setting was changed or a page turned: sound a blip */
    select: () => void;
    /** Demo mode: an era's panel was clicked */
    jump: (level: number) => void;
    /** The player chose to leave for the cover, and said so twice */
    exit: () => void;
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

/** Two facing pages and what can be done on them */
interface Spread {
    left: Page;
    right: Page;
    areas: Area[];
    tweens: Phaser.Tweens.Tween[];
    settings?: BookSettings;
}

/**
 * The pause screen is the comic itself, lying open: four spreads the player leafs through. The
 * eras as panels facing the controls and the tally, then the Field Guide, the machine, and the
 * settings with the way back to the cover.
 */
export class PausePage {
    private readonly root: Phaser.GameObjects.Container;
    private readonly pages: Phaser.GameObjects.Container;
    private readonly tabs: Phaser.GameObjects.Container;
    private readonly turner: PageTurn;
    private spread!: Spread;
    /** The spread being turned away from, until the leaf lands */
    private leaving?: Spread;
    private chrome: Area[] = [];
    private tabAreas: Area[] = [];
    private tab: Tab = 'map';
    private guideIndex = 0;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly context: PauseContext,
    ) {
        bakeBookTextures(scene);
        const right = BOOK.spine + PAGE_WIDTH;
        const bottom = BOOK.top + PAGE_HEIGHT;

        const g = scene.add.graphics();
        g.fillStyle(DESK, 0.9).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        // The book's shadow on the desk, its cover showing round the pages, and the block of
        // pages under the open ones
        g.fillStyle(0x000000, 0.45).fillRect(LEFT_X - 4, BOOK.top + 4, PAGE_WIDTH * 2 + 26, PAGE_HEIGHT + 18);
        g.fillStyle(KEY, 1).fillRect(LEFT_X - 14, BOOK.top - 8, PAGE_WIDTH * 2 + 28, PAGE_HEIGHT + 16);
        g.fillStyle(MAGENTA, 1).fillRect(LEFT_X - 11, BOOK.top - 5, PAGE_WIDTH * 2 + 22, PAGE_HEIGHT + 10);
        for (let leaf = 0; leaf < 4; leaf++) {
            const color = leaf % 2 === 0 ? NEWSPRINT_DARK : NEWSPRINT;
            g.fillStyle(color, 1).fillRect(LEFT_X - 8 + leaf * 2, BOOK.top + 2 - leaf, 2, PAGE_HEIGHT);
            g.fillStyle(color, 1).fillRect(right + 6 - leaf * 2, BOOK.top + 2 - leaf, 2, PAGE_HEIGHT);
        }
        g.fillStyle(NEWSPRINT_DARK, 1).fillRect(LEFT_X, bottom, PAGE_WIDTH * 2, 3);

        const backdrop = dots(scene, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, CYAN, 0.07, 2);
        const paused = comicText(scene, right + 6, 20, LABELS.paused, 46, { display: true, color: PROCESS_YELLOW, stroke: KEY, strokeThickness: 8, drop: 3, dropColor: MAGENTA })
            .setOrigin(1, 0.5)
            .setAngle(-3);
        const hint = comicText(scene, SCREEN_WIDTH / 2, 704, `${LABELS.resume}        ${LABELS.switchTabs}        ${LABELS.cornerHint}`, 17, {
            bold: true,
            color: NEWSPRINT,
        }).setOrigin(0.5);

        this.tabs = scene.add.container(0, 0);
        this.pages = scene.add.container(0, 0);
        const leaf = scene.add.container(0, 0);
        this.turner = new PageTurn(scene, leaf);
        this.root = scene.add.container(0, 0, [backdrop, g, this.tabs, this.pages, leaf, paused, hint]);
        this.root.setDepth(Depth.pause).setAlpha(0);
        scene.tweens.add({ targets: this.root, alpha: 1, duration: 90 });

        // The corners and the outer edges of the pages turn them, as on paper
        const turn = (step: 1 | -1) => () => {
            this.turn(step);
            this.context.select();
        };
        this.chrome = [
            { x: LEFT_X, y: bottom - 76, width: 76, height: 76, act: turn(-1) },
            { x: right - 76, y: bottom - 76, width: 76, height: 76, act: turn(1) },
            { x: LEFT_X - 14, y: BOOK.top, width: 36, height: PAGE_HEIGHT, act: turn(-1) },
            { x: right - 22, y: BOOK.top, width: 36, height: PAGE_HEIGHT, act: turn(1) },
        ];

        // Open the guide on a page that has something on it
        const unlocked = Progress.guide(scene.registry);
        this.guideIndex = Math.max(0, GUIDE_ORDER.findIndex((id) => unlocked.includes(id)));
        this.spread = this.buildSpread();
        this.buildTabs();
    }

    /** True while the page of eras is the one showing */
    get showingMap() {
        return this.tab === 'map';
    }

    /** Q and E (and Tab) turn the page */
    turn(step: 1 | -1) {
        this.open(TABS[(TABS.indexOf(this.tab) + step + TABS.length) % TABS.length], step);
    }

    /** Any other key: the open spread may have a use for it. Returns true if it did. */
    key(code: string): boolean {
        if (this.spread.settings) {
            return this.spread.settings.key(code);
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
            if (next >= 0 && next < count) {
                this.chooseGuide(next);
            }
            return true;
        }
        return false;
    }

    /** Esc: true if the book had something of its own to put away first */
    back(): boolean {
        return this.spread.settings?.back() ?? false;
    }

    click(x: number, y: number) {
        const inside = (one: Area) => x >= one.x && x < one.x + one.width && y >= one.y && y < one.y + one.height;
        const area = this.spread.areas.find(inside) ?? this.tabAreas.find(inside);
        if (area) {
            area.act();
        } else if (!this.spread.settings?.click(x, y)) {
            this.chrome.find(inside)?.act();
        }
    }

    destroy() {
        this.turner.destroy();
        this.stopTweens(this.spread);
        if (this.leaving) {
            this.stopTweens(this.leaving);
        }
        this.scene.tweens.killTweensOf(this.root);
        this.root.destroy();
    }

    private stopTweens(spread: Spread) {
        for (const tween of spread.tweens) {
            tween.stop();
        }
        spread.tweens = [];
    }

    private discard(spread: Spread) {
        this.stopTweens(spread);
        spread.left.destroy();
        spread.right.destroy();
    }

    /** Turns to another spread: forwards lifts the right-hand page over, backwards the left */
    private open(tab: Tab, direction: 1 | -1) {
        if (tab === this.tab) {
            return;
        }
        // A turn still in the air lands at once, so fast presses each turn a page
        this.turner.finish();
        const old = this.spread;
        this.tab = tab;
        const next = this.buildSpread();
        this.spread = next;
        this.leaving = old;
        this.buildTabs();
        const lifting = direction === 1 ? old.right : old.left;
        const landing = direction === 1 ? next.left : next.right;
        this.turner.start(lifting, landing, direction, () => {
            landing.setVisible(true);
            this.discard(old);
            if (this.leaving === old) {
                this.leaving = undefined;
            }
        });
    }

    /** The same spread again with something on it changed: no page is turned */
    private redraw() {
        this.turner.finish();
        const old = this.spread;
        this.spread = this.buildSpread();
        this.discard(old);
    }

    private chooseGuide(index: number) {
        if (index !== this.guideIndex) {
            this.guideIndex = index;
            this.redraw();
            this.context.select();
        }
    }

    private buildSpread(): Spread {
        switch (this.tab) {
            case 'map':
                return this.buildEras();
            case 'guide':
                return this.buildGuide();
            case 'weapons':
                return this.buildMachine();
            case 'settings':
                return this.buildSettings();
        }
    }

    /** Index tabs standing up from the top edge of the book */
    private buildTabs() {
        this.tabs.removeAll(true);
        this.tabAreas = [];
        const g = this.scene.add.graphics();
        this.tabs.add(g);
        let x = LEFT_X + 16;
        for (const tab of TABS) {
            const active = tab === this.tab;
            const text = comicText(this.scene, 0, 0, TAB_LABELS[tab], 24, { display: true, color: active ? NEWSPRINT_LIGHT : KEY }).setOrigin(0.5);
            const width = Math.ceil(text.width) + 30;
            // The open one stands taller
            const top = active ? 4 : 12;
            g.fillStyle(KEY, 1).fillRect(x, top, width, BOOK.top - top);
            g.fillStyle(active ? MAGENTA : NEWSPRINT_DARK, 1).fillRect(x + 3, top + 3, width - 6, BOOK.top - top - 3);
            text.setPosition(x + width / 2, top + (BOOK.top - top) / 2 + 1);
            this.tabs.add(text);
            if (!active) {
                this.tabAreas.push({
                    x,
                    y: 0,
                    width,
                    height: BOOK.top,
                    act: () => {
                        this.open(tab, TABS.indexOf(tab) > TABS.indexOf(this.tab) ? 1 : -1);
                        this.context.select();
                    },
                });
            }
            x += width + 6;
        }
    }

    /** A blank page: paper, a heading out of register over a double rule, a folio and a turned corner */
    private newPage(side: Side, title: string, folio: number, note?: string): Page {
        const scene = this.scene;
        const page = scene.add.container(side === 'left' ? LEFT_X : BOOK.spine, BOOK.top);
        const x = contentX(side);
        const g = scene.add.graphics();
        page.add([scene.add.image(0, 0, side === 'left' ? PAPER_LEFT : PAPER_RIGHT).setOrigin(0), g]);

        let room = CONTENT_WIDTH;
        if (note) {
            const aside = comicText(scene, x + CONTENT_WIDTH, 60, note, 26, { display: true, color: MAGENTA }).setOrigin(1, 1);
            page.add(aside);
            room -= aside.width + 16;
        }
        page.add(headline(scene, x - 3, 14, title, 46, 0, 0, room));
        g.fillStyle(KEY, 1).fillRect(x, 68, CONTENT_WIDTH, 4);
        g.fillStyle(KEY, 1).fillRect(x, 75, CONTENT_WIDTH, 1.5);

        // The outer bottom corner is turned up: click it, or press the key, to turn the page
        const outer = side === 'left' ? 0 : PAGE_WIDTH;
        const inward = side === 'left' ? 1 : -1;
        const tip = new Phaser.Math.Vector2(outer + inward * CORNER, PAGE_HEIGHT - CORNER);
        const onEdge = new Phaser.Math.Vector2(outer, PAGE_HEIGHT - CORNER);
        const onFoot = new Phaser.Math.Vector2(outer + inward * CORNER, PAGE_HEIGHT);
        g.fillStyle(DESK, 1).fillTriangle(outer, PAGE_HEIGHT, onEdge.x, onEdge.y, onFoot.x, onFoot.y);
        g.fillStyle(NEWSPRINT_LIGHT, 1).fillTriangle(tip.x, tip.y, onEdge.x, onEdge.y, onFoot.x, onFoot.y);
        g.fillStyle(KEY, 0.14).fillTriangle(tip.x, tip.y, onEdge.x, onEdge.y, onFoot.x, onFoot.y);
        g.lineStyle(2, KEY, 0.8).strokeTriangle(tip.x, tip.y, onEdge.x, onEdge.y, onFoot.x, onFoot.y);
        // A one-letter cap is as wide as it is tall
        const capWidth = 28;
        const capX = side === 'left' ? CORNER + 14 : PAGE_WIDTH - CORNER - 14 - capWidth;
        page.add(comicKeys(scene, g, [side === 'left' ? 'Q' : 'E'], capX, PAGE_HEIGHT - 26, 16).texts);
        page.add(
            comicText(scene, side === 'left' ? capX + capWidth + 14 : capX - 14, PAGE_HEIGHT - 26, String(folio), 24, { display: true })
                .setOrigin(side === 'left' ? 0 : 1, 0.5)
                .setAlpha(0.75),
        );
        return page;
    }

    /** An area of a page that can be clicked, given in the page's own coordinates */
    private area(spread: Spread, side: Side, x: number, y: number, width: number, height: number, act: () => void) {
        spread.areas.push({ x: (side === 'left' ? LEFT_X : BOOK.spine) + x, y: BOOK.top + y, width, height, act });
    }

    // ---------------------------------------------------------------- the eras and the controls

    private buildEras(): Spread {
        const spread: Spread = {
            left: this.newPage('left', LABELS.mapTab, 2),
            right: this.newPage('right', LABELS.controlsTitle, 3),
            areas: [],
            tweens: [],
        };
        this.pages.add([spread.left, spread.right]);
        const demo = getSettings().demoMode;

        // A comic page, not a grid: rows of a wide panel and a narrow one, swapping sides, and
        // the last era alone across the foot of the page
        const x = contentX('left');
        const count = LEVELS.length;
        const rows = Math.ceil(count / 2);
        // Room above the first row for the caption boxes that stand proud of their panels
        const top = CONTENT_Y + 12;
        const rowHeight = Math.floor((CONTENT_HEIGHT - 12 - (rows - 1) * GUTTER) / rows);
        const wide = Math.round((CONTENT_WIDTH - GUTTER) * 0.62);
        const narrow = CONTENT_WIDTH - GUTTER - wide;
        LEVELS.forEach((level, index) => {
            const row = Math.floor(index / 2);
            const first = index % 2 === 0;
            const wideFirst = row % 2 === 0;
            const alone = first && index === count - 1;
            const width = alone ? CONTENT_WIDTH : first === wideFirst ? wide : narrow;
            const panelX = x + (first ? 0 : (wideFirst ? wide : narrow) + GUTTER);
            const panelY = top + row * (rowHeight + GUTTER);
            this.buildEraPanel(spread, level, index, panelX, panelY, width, rowHeight);
            if (demo) {
                this.area(spread, 'left', panelX, panelY, width, rowHeight, () => this.context.jump(index));
            }
        });
        if (demo) {
            const g = this.scene.add.graphics();
            const hint = comicText(this.scene, 0, 0, `${LABELS.demo}:  ${LABELS.demoJump}, or click one`, 17, { bold: true }).setOrigin(0, 0.5);
            const hintX = x + CONTENT_WIDTH - Math.ceil(hint.width) - 22;
            captionBox(g, hintX, PAGE_HEIGHT - 44, Math.ceil(hint.width) + 22, 32, CYAN, 3, 3);
            hint.setPosition(hintX + 11, PAGE_HEIGHT - 28);
            spread.left.add([g, hint]);
        }

        this.buildControls(spread.right);
        this.buildTally(spread.right);
        return spread;
    }

    /** One era as one panel of the comic: its square, as it is drawn in that era */
    private buildEraPanel(spread: Spread, level: LevelDef, index: number, x: number, y: number, width: number, height: number) {
        const scene = this.scene;
        const page = spread.left;
        const registry = scene.registry;
        const cleared = Progress.isRoomCleared(registry, index, 0);
        const current = index === this.context.levelIndex;
        const reached = cleared || current;
        const secretFound = Progress.secrets(registry).some((key) => key.startsWith(`${index}:`));
        const g = scene.add.graphics();
        page.add(g);

        if (reached) {
            g.fillStyle(KEY, 1).fillRect(x - 4, y - 4, width + 8, height + 8);
            g.fillStyle(NEWSPRINT_LIGHT, 1).fillRect(x, y, width, height);
            // The boss page is every era at once
            const styles = level.style === 'finalPage' ? BOSS_SLICES : [level.style];
            // The picture fills the panel and is trimmed evenly to its shape
            const scale = Math.max(width / CITY_WIDTH, height / CITY_HEIGHT);
            const seenWidth = width / scale;
            const seenHeight = height / scale;
            const offX = (CITY_WIDTH - seenWidth) / 2;
            const offY = (CITY_HEIGHT - seenHeight) / 2;
            const slice = seenWidth / styles.length;
            styles.forEach((style, i) => {
                const key = `city-${style}`;
                if (!scene.textures.exists(key)) {
                    g.fillStyle((STYLE_THEME[style] ?? STYLE_THEME.goldenAge).floor, 1).fillRect(x + i * slice * scale, y, slice * scale, height);
                    return;
                }
                const image = scene.add
                    .image(x - offX * scale, y - offY * scale, key)
                    .setOrigin(0)
                    .setScale(scale)
                    .setCrop(offX + i * slice, offY, slice, seenHeight);
                // Pencilled in, not yet inked: the era is still being fought over
                image.setAlpha(cleared ? 1 : 0.82);
                page.add(image);
            });
            if (styles.length > 1) {
                const cuts = scene.add.graphics();
                cuts.fillStyle(KEY, 1);
                for (let i = 1; i < styles.length; i++) {
                    cuts.fillRect(Math.round(x + i * slice * scale) - 2, y, 4, height);
                }
                page.add(cuts);
            }
        } else {
            // Laid out in blue pencil, waiting for ink
            g.fillStyle(NEWSPRINT_LIGHT, 0.6).fillRect(x, y, width, height);
            g.lineStyle(1.5, PENCIL_BLUE, 0.5).lineBetween(x, y, x + width, y + height).lineBetween(x + width, y, x, y + height);
            dashedRect(g, x - 3, y - 3, width + 6, height + 6, PENCIL_BLUE, 10, 3);
            page.add(comicText(scene, x + width / 2, y + height / 2 + 4, String(index + 1), 92, { display: true, color: PENCIL_BLUE }).setOrigin(0.5));
            page.add(
                comicText(scene, x + width - 10, y + height - 8, LABELS.notInked, 17, { display: true, color: KEY }).setOrigin(1, 1).setAlpha(0.6),
            );
        }

        // The caption box across the panel's top corner: the number to press, and the era's name
        const over = scene.add.graphics();
        const name = comicText(scene, 0, 0, level.name.toUpperCase(), 23, { display: true, color: KEY }).setOrigin(0, 0.5);
        fitWidth(name, width - 46);
        const boxX = x - 9;
        const boxY = y - 11;
        const nameWidth = Math.ceil(name.displayWidth) + 14;
        captionBox(over, boxX, boxY, 30 + nameWidth, 32, reached ? PROCESS_YELLOW : NEWSPRINT_LIGHT, 3, 3);
        over.fillStyle(KEY, 1).fillRect(boxX, boxY, 30, 32);
        const number = comicText(scene, boxX + 15, boxY + 16, String(index + 1), 24, { display: true, color: reached ? PROCESS_YELLOW : NEWSPRINT_LIGHT }).setOrigin(0.5);
        name.setPosition(boxX + 34, boxY + 16);
        page.add([over, number, name]);

        if (current) {
            const key = `player-${this.context.style}`;
            if (scene.textures.exists(key)) {
                page.add(scene.add.image(x + width / 2, y + height / 2 + 14, key, 0).setScale(2));
            }
            const frame = scene.add.graphics();
            frame.lineStyle(5, MAGENTA, 1).strokeRect(x - 8, y - 8, width + 16, height + 16);
            page.addAt(frame, page.getIndex(g));
            spread.tweens.push(scene.tweens.add({ targets: frame, alpha: 0.25, duration: 380, yoyo: true, repeat: -1 }));
            page.add(sticker(scene, x + width - 84, y + height - 22, LABELS.here, 19, 24, { stretch: 3.3, spikes: 16, angle: -5 }));
        } else if (cleared) {
            page.add(stamp(scene, x + width - 56, y + height - 26, LABELS.inked, 24));
        }
        if (secretFound) {
            // Bottom left: the other corners are taken by the caption and the stamp
            page.add(sticker(scene, x + 50, y + height - 20, LABELS.secret, 18, 20, { fill: CYAN, stretch: 2.3, spikes: 12, angle: 7 }));
        }
    }

    /** The keys, per docs/DESIGN.md section 4 */
    private buildControls(page: Page) {
        const scene = this.scene;
        const x = contentX('right');
        const g = scene.add.graphics();
        page.add(g);
        const rowHeight = 34;
        const top = CONTENT_Y + 2;
        // Where the widest row of caps ends, so the actions line up
        let actionX = x + 150;
        const rows = CONTROLS.map((control, index) => {
            const cy = top + index * rowHeight + rowHeight / 2;
            if (index % 2 === 0) {
                g.fillStyle(NEWSPRINT_DARK, 0.4).fillRect(x, cy - rowHeight / 2, CONTENT_WIDTH, rowHeight);
            }
            const keys = comicKeys(scene, g, control.keys, x + 10, cy - 1, 16);
            page.add(keys.texts);
            actionX = Math.max(actionX, keys.end + 18);
            return { control, cy };
        });
        for (const { control, cy } of rows) {
            page.add(fitWidth(comicText(scene, actionX, cy, control.detail, 20, { bold: true }).setOrigin(0, 0.5), x + CONTENT_WIDTH - actionX - 8));
        }
    }

    /** The run so far: how much of the comic has been inked */
    private buildTally(page: Page) {
        const scene = this.scene;
        const registry = scene.registry;
        const x = contentX('right');
        const cleared = LEVELS.filter((_, index) => Progress.isRoomCleared(registry, index, 0)).length;
        const guide = Progress.guide(registry).filter((id) => GUIDE_ORDER.includes(id)).length;
        const stats: [string, string, number][] = [
            [LABELS.statPanels, `${cleared}/${LEVELS.length}`, CYAN],
            [LABELS.statGuide, `${guide}/${GUIDE_ORDER.length}`, MAGENTA],
            // How many there are to find stays a secret too
            [LABELS.statSecrets, String(Progress.secrets(registry).length), PROCESS_YELLOW],
        ];
        const top = CONTENT_Y + 264;
        const g = scene.add.graphics();
        const title = comicText(scene, x + 14, top + 17, LABELS.tallyTitle, 26, { display: true }).setOrigin(0, 0.5);
        captionBox(g, x, top, Math.ceil(title.width) + 28, 34, PROCESS_YELLOW, 4, 3);
        g.fillStyle(KEY, 1).fillRect(x + Math.ceil(title.width) + 36, top + 16, CONTENT_WIDTH - Math.ceil(title.width) - 36, 3);
        page.add([g, title]);

        const width = Math.floor((CONTENT_WIDTH - 2 * GUTTER) / 3);
        const height = CONTENT_Y + CONTENT_HEIGHT - top - 56;
        const tilts = [-2, 1.5, -1];
        stats.forEach(([label, value, color], index) => {
            const box = scene.add.graphics();
            captionBox(box, -width / 2, -height / 2, width, height, color, 6, 4);
            box.fillStyle(KEY, 1).fillRect(-width / 2, height / 2 - 52, width, 4);
            box.fillStyle(NEWSPRINT_LIGHT, 1).fillRect(-width / 2 + 4, height / 2 - 48, width - 8, 44);
            const screen = dots(scene, -width / 2 + 4, -height / 2 + 4, width - 8, height - 56, NEWSPRINT_LIGHT, 0.3);
            const number = comicText(scene, 0, -26, value, 84, { display: true, color: NEWSPRINT_LIGHT, stroke: KEY, strokeThickness: 9 }).setOrigin(0.5);
            fitWidth(number, width - 20);
            const caption = fitWidth(comicText(scene, 0, height / 2 - 26, label, 23, { display: true }).setOrigin(0.5), width - 18);
            const card = scene.add.container(x + width / 2 + index * (width + GUTTER), top + 50 + height / 2, [box, screen, number, caption]);
            page.add(card.setAngle(tilts[index % tilts.length]));
        });
    }

    // ------------------------------------------------------------------------- the Field Guide

    private buildGuide(): Spread {
        const scene = this.scene;
        const registry = scene.registry;
        const unlocked = Progress.guide(registry);
        const ended = Progress.ended(registry);
        const id = GUIDE_ORDER[this.guideIndex];
        const open = !!id && unlocked.includes(id);
        const spread: Spread = {
            left: this.newPage('left', LABELS.guideTab, 4),
            right: this.newPage('right', open ? (GUIDE[id]?.title ?? id).toUpperCase() : LABELS.locked, 5, `${this.guideIndex + 1} / ${GUIDE_ORDER.length}`),
            areas: [],
            tweens: [],
        };
        this.pages.add([spread.left, spread.right]);

        // The index: every page of the guide, a silhouette until it has been met
        const x = contentX('left');
        const rows = Math.ceil(GUIDE_ORDER.length / GUIDE_COLUMNS);
        const cellWidth = Math.floor((CONTENT_WIDTH - (GUIDE_COLUMNS - 1) * GUTTER) / GUIDE_COLUMNS);
        const cellHeight = Math.floor((CONTENT_HEIGHT - (rows - 1) * GUTTER) / rows);
        const g = scene.add.graphics();
        spread.left.add(g);
        GUIDE_ORDER.forEach((one, index) => {
            const cellX = x + (index % GUIDE_COLUMNS) * (cellWidth + GUTTER);
            const cellY = CONTENT_Y + Math.floor(index / GUIDE_COLUMNS) * (cellHeight + GUTTER);
            this.buildCell(spread.left, g, one, cellX, cellY, cellWidth, cellHeight, unlocked.includes(one), ended, index === this.guideIndex);
            this.area(spread, 'left', cellX, cellY, cellWidth, cellHeight, () => this.chooseGuide(index));
        });
        const hint = comicText(scene, x + CONTENT_WIDTH, PAGE_HEIGHT - 26, `${LABELS.guideHint}, or click`, 17, { bold: true }).setOrigin(1, 0.5);
        spread.left.add(hint);

        if (id) {
            this.buildEntry(spread.right, id, open, ended);
        }
        return spread;
    }

    /** A thumbnail in the guide's index */
    private buildCell(page: Page, g: Phaser.GameObjects.Graphics, id: MonsterId, x: number, y: number, width: number, height: number, open: boolean, ended: boolean, selected: boolean) {
        const scene = this.scene;
        const style: ArtStyle = ended && open ? 'plain' : this.context.style;
        const theme = STYLE_THEME[style] ?? STYLE_THEME.goldenAge;
        const strip = 30;
        const pictureHeight = height - strip;
        if (selected) {
            g.fillStyle(KEY, 1).fillRect(x - 3, y - 3, width + 12, height + 12);
            g.fillStyle(MAGENTA, 1).fillRect(x - 7, y - 7, width + 14, height + 14);
        }
        g.fillStyle(KEY, 1).fillRect(x, y, width, height);
        g.fillStyle(open ? theme.floor : NEWSPRINT_DARK, 1).fillRect(x + 3, y + 3, width - 6, pictureHeight - 3);
        g.fillStyle(selected ? PROCESS_YELLOW : NEWSPRINT_LIGHT, 1).fillRect(x + 3, y + pictureHeight + 3, width - 6, strip - 6);
        if (open) {
            page.add(dots(scene, x + 3, y + 3 + Math.round(pictureHeight / 2), width - 6, pictureHeight - 3 - Math.round(pictureHeight / 2), theme.wall, 0.4));
        }
        const sprite = guideSprite(scene, id, style, pictureHeight - 14, 4);
        if (sprite) {
            sprite.setPosition(x + width / 2, y + 2 + pictureHeight / 2);
            if (!open) {
                // A shape and nothing else: it has been seen, but not yet understood
                sprite.setTint(KEY).setTintMode(Phaser.TintModes.FILL).setAlpha(0.7);
            }
            page.add(sprite);
        }
        const title = comicText(scene, x + width / 2, y + height - strip / 2, open ? (GUIDE[id]?.title ?? id).toUpperCase() : LABELS.locked, 20, { display: true })
            .setOrigin(0.5)
            .setAlpha(open ? 1 : 0.55);
        page.add(fitWidth(title, width - 14));
    }

    /** The chosen page of the guide, large: the picture, the Handler's note, and what it really was */
    private buildEntry(page: Page, id: MonsterId, open: boolean, ended: boolean) {
        const scene = this.scene;
        const entry = GUIDE[id];
        const x = contentX('right');
        const truth = ended && open;
        const style: ArtStyle = truth ? 'plain' : this.context.style;
        const theme = STYLE_THEME[style] ?? STYLE_THEME.goldenAge;
        const g = scene.add.graphics();
        page.add(g);
        const bottom = CONTENT_Y + CONTENT_HEIGHT;

        const pictureHeight = truth ? 156 : 236;
        captionBox(g, x, CONTENT_Y, CONTENT_WIDTH, pictureHeight, open ? theme.floor : NEWSPRINT_DARK, 6, 4);
        if (open) {
            const half = Math.round(pictureHeight * 0.45);
            page.add(dots(scene, x + 4, CONTENT_Y + pictureHeight - 4 - half, CONTENT_WIDTH - 8, half, theme.wall, 0.45));
        }
        const sprite = guideSprite(scene, id, style, pictureHeight - 36, 8);
        if (sprite) {
            sprite.setPosition(x + CONTENT_WIDTH / 2, CONTENT_Y + pictureHeight / 2);
            if (!open) {
                sprite.setTint(KEY).setTintMode(Phaser.TintModes.FILL).setAlpha(0.75);
            }
            page.add(sprite);
        }

        // Laid out from the foot of the page upwards, so the note gets whatever room is left
        let foot = bottom;
        if (truth) {
            const wrap = CONTENT_WIDTH - 32;
            let words = comicText(scene, 0, 0, entry?.truth ?? '', 20, { bold: true, wrap });
            for (const size of [19, 18, 17, 16]) {
                if (words.height <= 78) {
                    break;
                }
                words.destroy();
                words = comicText(scene, 0, 0, entry?.truth ?? '', size, { bold: true, wrap });
            }
            const height = 34 + Math.ceil(words.height) + 22;
            const top = foot - height;
            // What the attending officer wrote down, stamped under the Handler's own words
            g.fillStyle(KEY, 1).fillRect(x + 6, top + 6, CONTENT_WIDTH, height);
            g.fillStyle(MAGENTA, 1).fillRect(x, top, CONTENT_WIDTH, height);
            g.fillStyle(NEWSPRINT_LIGHT, 1).fillRect(x + 4, top + 34, CONTENT_WIDTH - 8, height - 38);
            page.add(comicText(scene, x + 12, top + 18, LABELS.truthLabel, 26, { display: true, color: NEWSPRINT_LIGHT }).setOrigin(0, 0.5));
            page.add(words.setPosition(x + 16, top + 44));
            foot = top - 16;
        }
        if (getSettings().demoMode) {
            // Demo mode gives away what the game otherwise leaves the player to find out
            const rays = weakTo(id);
            const line = `${LABELS.weakTo} ${rays.length > 0 ? rayNames(rays) : LABELS.noWeakness.toUpperCase()}`;
            captionBox(g, x, foot - 38, CONTENT_WIDTH, 38, CYAN, 4, 3);
            page.add(fitWidth(comicText(scene, x + 14, foot - 19, line, 24, { display: true }).setOrigin(0, 0.5), CONTENT_WIDTH - 28));
            foot -= 38 + 16;
        }

        const noteTop = CONTENT_Y + pictureHeight + 32;
        const room = foot - noteTop - 44;
        const words = open ? (entry?.note ?? '') : LABELS.lockedNote;
        const wrap = CONTENT_WIDTH - 36;
        // Long notes step down a size rather than spill off the page
        let note = comicText(scene, 0, 0, words, 23, { wrap, lineSpacing: 3 });
        for (const size of [22, 21, 20, 19, 18, 17, 16]) {
            if (note.height <= room) {
                break;
            }
            note.destroy();
            note = comicText(scene, 0, 0, words, size, { wrap, lineSpacing: 2 });
        }
        const boxHeight = Math.min(foot - noteTop, Math.ceil(note.height) + 44);
        captionBox(g, x, noteTop, CONTENT_WIDTH, boxHeight, NEWSPRINT_LIGHT, 0, 3);
        const label = comicText(scene, x + 26, noteTop, LABELS.noteLabel, 21, { display: true }).setOrigin(0, 0.5);
        captionBox(g, x + 14, noteTop - 15, Math.ceil(label.width) + 22, 30, PROCESS_YELLOW, 3, 3);
        page.add([label, note.setPosition(x + 18, noteTop + 24).setAlpha(open ? 1 : 0.6)]);
    }

    // ----------------------------------------------------------------------------- the machine

    private buildMachine(): Spread {
        const spread: Spread = {
            left: this.newPage('left', LABELS.weaponsTab, 6),
            right: this.newPage('right', LABELS.modesTitle, 7),
            areas: [],
            tweens: [],
        };
        this.pages.add([spread.left, spread.right]);
        // Three panels to a page: the wheel's three rays, then the two other modes and the
        // pool they all draw on
        const perPage = 3;
        const height = Math.floor((CONTENT_HEIGHT - (perPage - 1) * GUTTER) / perPage);
        const place = (slot: number) => ({
            page: slot < perPage ? spread.left : spread.right,
            x: contentX(slot < perPage ? 'left' : 'right'),
            y: CONTENT_Y + (slot % perPage) * (height + GUTTER),
        });
        RAY_ORDER.slice(0, perPage * 2 - 1).forEach((ray, slot) => {
            const { page, x, y } = place(slot);
            page.add(buildRayPanel(this.scene, ray, x, y, CONTENT_WIDTH, height));
        });
        const last = place(perPage * 2 - 1);
        last.page.add(buildEnergyPanel(this.scene, last.x, last.y, CONTENT_WIDTH, height));
        return spread;
    }

    // ---------------------------------------------------------------------------- the settings

    private buildSettings(): Spread {
        const scene = this.scene;
        const spread: Spread = {
            left: this.newPage('left', LABELS.settingsTab, 8),
            right: this.newPage('right', LABELS.optionsTitle, 9),
            areas: [],
            tweens: [],
        };
        this.pages.add([spread.left, spread.right]);
        const perPage = 3;
        const height = Math.floor((CONTENT_HEIGHT - (perPage - 1) * GUTTER) / perPage);
        const slots: SettingsSlot[] = [];
        for (let slot = 0; slot < BookSettings.count; slot++) {
            const side: Side = slot < perPage ? 'left' : 'right';
            slots.push({
                page: side === 'left' ? spread.left : spread.right,
                originX: side === 'left' ? LEFT_X : BOOK.spine,
                originY: BOOK.top,
                x: contentX(side),
                y: CONTENT_Y + (slot % perPage) * (height + GUTTER),
                width: CONTENT_WIDTH,
                height,
            });
        }
        spread.settings = new BookSettings(scene, slots, this.context.select, this.context.exit);

        if (BookSettings.count > perPage + 2) {
            // Three panels fill the right-hand page: no room left for the key legend
            return spread;
        }
        // How to work the page, in what is left of the right-hand one
        const x = contentX('right');
        const top = CONTENT_Y + 2 * (height + GUTTER) + 6;
        const g = scene.add.graphics();
        spread.right.add(g);
        const rowHeight = 36;
        const rows = [...LABELS.settingsKeys, { keys: ['P'], action: LABELS.resume.replace(/^P\s+/, '') }];
        let actionX = x + 110;
        const placed = rows.map((row, index) => {
            const cy = top + index * rowHeight + rowHeight / 2;
            if (index % 2 === 0) {
                g.fillStyle(NEWSPRINT_DARK, 0.4).fillRect(x, cy - rowHeight / 2, CONTENT_WIDTH, rowHeight);
            }
            const keys = comicKeys(scene, g, row.keys, x + 10, cy - 1, 16);
            spread.right.add(keys.texts);
            actionX = Math.max(actionX, keys.end + 18);
            return { row, cy };
        });
        for (const { row, cy } of placed) {
            const action = row.action.charAt(0).toUpperCase() + row.action.slice(1);
            spread.right.add(comicText(scene, actionX, cy, action, 20, { bold: true }).setOrigin(0, 0.5));
        }
        return spread;
    }
}
