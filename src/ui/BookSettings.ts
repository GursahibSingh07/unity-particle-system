import Phaser from 'phaser';
import { getSettings, updateSettings, type Settings } from '../settings';
import { CYAN, KEY, MAGENTA, MAGENTA_INK, NEWSPRINT_DARK, NEWSPRINT_LIGHT, PROCESS_YELLOW, captionBox, comicText } from './comic';
import { LABELS } from './labels';

type Item =
    | { kind: 'volume'; key: 'musicVolume' | 'sfxVolume'; label: string; color: number }
    | { kind: 'toggle'; key: 'screenShake' | 'demoMode' | 'godMode'; label: string; note?: string }
    | { kind: 'exit' };

const ITEMS: Item[] = [
    { kind: 'volume', key: 'musicVolume', label: LABELS.music, color: MAGENTA },
    { kind: 'volume', key: 'sfxVolume', label: LABELS.sound, color: CYAN },
    { kind: 'toggle', key: 'screenShake', label: LABELS.shake },
    { kind: 'toggle', key: 'demoMode', label: LABELS.demo, note: LABELS.demoNoteBook },
    { kind: 'toggle', key: 'godMode', label: LABELS.god, note: LABELS.godNote },
    { kind: 'exit' },
];

const STEPS = 10;
const BAR_WIDTH = 40;
const BAR_GAP = 8;
const BUTTON_WIDTH = 100;
const BUTTON_HEIGHT = 56;

export interface SettingsSlot {
    /** The page the panel is drawn on, and where that page is on the screen */
    page: Phaser.GameObjects.Container;
    originX: number;
    originY: number;
    /** The panel's place on its page */
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Hit {
    x: number;
    y: number;
    width: number;
    height: number;
    act: () => void;
}

/**
 * The settings as panels of the book, one to a slot: the two volumes, the two switches, and
 * the way out to the cover. Leaving asks first, and the answer it offers is to stay.
 */
export class BookSettings {
    static readonly count = ITEMS.length;
    private readonly panels: Phaser.GameObjects.Container[];
    private hits: Hit[] = [];
    private selected = 0;
    private asking = false;
    private leave = false;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly slots: SettingsSlot[],
        private readonly changed: () => void,
        private readonly exit: () => void,
    ) {
        this.panels = slots.map((slot) => {
            const panel = scene.add.container(slot.x, slot.y);
            slot.page.add(panel);
            return panel;
        });
        this.draw();
    }

    /** Returns true if the key was one of the settings' */
    key(code: string): boolean {
        const up = code === 'ArrowUp' || code === 'KeyW';
        const down = code === 'ArrowDown' || code === 'KeyS';
        if (up || down) {
            this.asking = false;
            this.selected = (this.selected + ITEMS.length + (down ? 1 : -1)) % ITEMS.length;
            this.draw();
            this.changed();
            return true;
        }
        const left = code === 'ArrowLeft' || code === 'KeyA';
        const right = code === 'ArrowRight' || code === 'KeyD';
        const press = code === 'Enter' || code === 'NumpadEnter' || code === 'Space';
        if (!left && !right && !press) {
            return false;
        }
        const item = ITEMS[this.selected];
        if (item.kind === 'volume') {
            if (!press) {
                this.setVolume(item.key, this.step(item.key) + (right ? 1 : -1));
            }
        } else if (item.kind === 'toggle') {
            this.apply({ [item.key]: press ? !getSettings()[item.key] : left });
        } else if (!this.asking) {
            if (press) {
                this.ask();
            }
        } else if (press) {
            this.answer(this.leave);
        } else {
            this.leave = right;
            this.draw();
            this.changed();
        }
        return true;
    }

    /** Esc while the book is asking: the question is put away, not the book. True if it was. */
    back(): boolean {
        if (!this.asking) {
            return false;
        }
        this.answer(false);
        return true;
    }

    /** A click at a point of the screen; returns true if it landed on a control */
    click(x: number, y: number): boolean {
        const hit = this.hits.find((area) => x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height);
        hit?.act();
        return !!hit;
    }

    private step(key: 'musicVolume' | 'sfxVolume') {
        return Math.round(Phaser.Math.Clamp(getSettings()[key], 0, 1) * STEPS);
    }

    private setVolume(key: 'musicVolume' | 'sfxVolume', step: number) {
        this.apply({ [key]: Phaser.Math.Clamp(step, 0, STEPS) / STEPS });
    }

    private apply(change: Partial<Settings>) {
        updateSettings(change);
        this.draw();
        this.changed();
    }

    private ask() {
        this.asking = true;
        // One more careless press must not throw the run away
        this.leave = false;
        this.draw();
        this.changed();
    }

    private answer(leave: boolean) {
        this.asking = false;
        if (leave) {
            this.exit();
            return;
        }
        this.draw();
        this.changed();
    }

    private select(index: number) {
        if (this.selected !== index) {
            this.selected = index;
            this.asking = false;
        }
    }

    private draw() {
        this.hits = [];
        ITEMS.forEach((item, index) => {
            const slot = this.slots[index];
            const panel = this.panels[index];
            if (!slot || !panel) {
                return;
            }
            panel.removeAll(true);
            const selected = index === this.selected;
            const { width, height } = slot;
            const g = this.scene.add.graphics();
            panel.add(g);
            captionBox(g, 0, 0, width, height, selected ? PROCESS_YELLOW : NEWSPRINT_LIGHT, selected ? 7 : 0, 4);
            if (selected) {
                g.fillStyle(KEY, 1).fillTriangle(-20, height / 2 - 20, -20, height / 2 + 20, 10, height / 2);
                g.fillStyle(MAGENTA, 1).fillTriangle(-16, height / 2 - 13, -16, height / 2 + 13, 4, height / 2);
            }
            // Screen position of this panel, for the mouse
            const left = slot.originX + slot.x;
            const top = slot.originY + slot.y;
            const hit = (x: number, y: number, w: number, h: number, act: () => void) =>
                this.hits.unshift({ x: left + x, y: top + y, width: w, height: h, act });
            // Clicking anywhere on a panel chooses it
            hit(0, 0, width, height, () => {
                if (this.selected !== index) {
                    this.select(index);
                    this.draw();
                    this.changed();
                }
            });

            if (item.kind === 'volume') {
                this.drawVolume(panel, g, item, index, selected, width, height, hit);
            } else if (item.kind === 'toggle') {
                this.drawToggle(panel, g, item, index, selected, width, height, hit);
            } else if (this.asking) {
                this.drawQuestion(panel, g, width, height, hit);
            } else {
                this.drawExit(panel, g, index, width, height, hit);
            }
        });
    }

    private drawVolume(
        panel: Phaser.GameObjects.Container,
        g: Phaser.GameObjects.Graphics,
        item: Extract<Item, { kind: 'volume' }>,
        index: number,
        selected: boolean,
        width: number,
        height: number,
        hit: (x: number, y: number, w: number, h: number, act: () => void) => void,
    ) {
        const step = this.step(item.key);
        panel.add(comicText(this.scene, 18, 10, item.label, 38, { display: true }));
        panel.add(comicText(this.scene, width - 20, 8, String(step), 44, { display: true, color: step > 0 ? KEY : MAGENTA_INK }).setOrigin(1, 0));
        const start = Math.round((width - STEPS * BAR_WIDTH - (STEPS - 1) * BAR_GAP) / 2);
        const base = height - 14;
        for (let i = 0; i < STEPS; i++) {
            const x = start + i * (BAR_WIDTH + BAR_GAP);
            // The bars rise like a volume wedge
            const barHeight = 24 + i * 5;
            g.fillStyle(KEY, 1).fillRect(x, base - barHeight, BAR_WIDTH, barHeight);
            g.fillStyle(i < step ? item.color : selected ? NEWSPRINT_LIGHT : NEWSPRINT_DARK, 1).fillRect(x + 3, base - barHeight + 3, BAR_WIDTH - 6, barHeight - 6);
            hit(x - BAR_GAP / 2, 56, BAR_WIDTH + BAR_GAP, height - 56, () => {
                this.select(index);
                // Clicking the first bar when only it is lit turns the sound off
                this.setVolume(item.key, step === 1 && i === 0 ? 0 : i + 1);
            });
        }
    }

    private drawToggle(
        panel: Phaser.GameObjects.Container,
        g: Phaser.GameObjects.Graphics,
        item: Extract<Item, { kind: 'toggle' }>,
        index: number,
        selected: boolean,
        width: number,
        height: number,
        hit: (x: number, y: number, w: number, h: number, act: () => void) => void,
    ) {
        const on = getSettings()[item.key];
        const buttonsX = width - 22 - BUTTON_WIDTH * 2 - 12;
        const buttonsY = Math.round((height - BUTTON_HEIGHT) / 2);
        const label = comicText(this.scene, 18, item.note ? 12 : height / 2 - 26, item.label, 38, { display: true });
        panel.add(label);
        if (item.note) {
            panel.add(comicText(this.scene, 20, 62, item.note, 17, { bold: true, wrap: buttonsX - 36, lineSpacing: 1 }));
        }
        [true, false].forEach((value, i) => {
            const x = buttonsX + i * (BUTTON_WIDTH + 12);
            const active = on === value;
            // The one that is set is pressed in; the other stands proud of the page
            const sink = active ? 4 : 0;
            if (!active) {
                g.fillStyle(KEY, 1).fillRect(x + 5, buttonsY + 5, BUTTON_WIDTH, BUTTON_HEIGHT);
            }
            g.fillStyle(KEY, 1).fillRect(x + sink, buttonsY + sink, BUTTON_WIDTH, BUTTON_HEIGHT);
            g.fillStyle(active ? CYAN : selected ? NEWSPRINT_LIGHT : NEWSPRINT_DARK, 1).fillRect(x + sink + 3, buttonsY + sink + 3, BUTTON_WIDTH - 6, BUTTON_HEIGHT - 6);
            const word = comicText(this.scene, x + sink + BUTTON_WIDTH / 2, buttonsY + sink + BUTTON_HEIGHT / 2, value ? LABELS.on : LABELS.off, 32, { display: true })
                .setOrigin(0.5)
                .setAlpha(active ? 1 : 0.45);
            panel.add(word);
            hit(x - 6, buttonsY - 10, BUTTON_WIDTH + 12, BUTTON_HEIGHT + 20, () => {
                this.select(index);
                this.apply({ [item.key]: value });
            });
        });
    }

    private drawExit(
        panel: Phaser.GameObjects.Container,
        g: Phaser.GameObjects.Graphics,
        index: number,
        width: number,
        height: number,
        hit: (x: number, y: number, w: number, h: number, act: () => void) => void,
    ) {
        const button = { x: 22, y: 18, width: width - 44, height: 72 };
        captionBox(g, button.x, button.y, button.width, button.height, MAGENTA, 6, 4);
        panel.add(
            comicText(this.scene, width / 2, button.y + button.height / 2, LABELS.exit, 40, { display: true, color: NEWSPRINT_LIGHT, stroke: KEY, strokeThickness: 6 }).setOrigin(0.5),
        );
        panel.add(comicText(this.scene, width / 2, height - 28, LABELS.exitNote, 17, { bold: true }).setOrigin(0.5));
        hit(button.x, button.y, button.width, button.height, () => {
            this.select(index);
            this.ask();
        });
    }

    private drawQuestion(
        panel: Phaser.GameObjects.Container,
        g: Phaser.GameObjects.Graphics,
        width: number,
        height: number,
        hit: (x: number, y: number, w: number, h: number, act: () => void) => void,
    ) {
        panel.add(comicText(this.scene, 18, 8, LABELS.exitAsk, 36, { display: true, color: MAGENTA_INK }));
        panel.add(comicText(this.scene, width - 20, 30, LABELS.exitAskNote, 16, { bold: true }).setOrigin(1, 0.5));
        const gap = 16;
        const buttonWidth = (width - 44 - gap) / 2;
        const y = height - 86;
        [false, true].forEach((leave, i) => {
            const x = 22 + i * (buttonWidth + gap);
            const chosen = this.leave === leave;
            captionBox(g, x, y, buttonWidth, 64, leave ? MAGENTA : CYAN, chosen ? 6 : 0, chosen ? 5 : 3);
            if (!chosen) {
                // Set back, so the one Enter would press is plain
                g.fillStyle(NEWSPRINT_LIGHT, 0.45).fillRect(x, y, buttonWidth, 64);
            }
            const word = comicText(this.scene, x + buttonWidth / 2, y + 32, leave ? LABELS.exitLeave : LABELS.exitStay, 36, {
                display: true,
                color: leave ? NEWSPRINT_LIGHT : KEY,
                stroke: leave ? KEY : undefined,
                strokeThickness: 5,
            })
                .setOrigin(0.5)
                .setAlpha(chosen ? 1 : 0.6);
            panel.add(word);
            hit(x, y, buttonWidth, 64, () => this.answer(leave));
        });
    }
}
