import Phaser from 'phaser';
import { getSettings, updateSettings, type Settings } from '../settings';
import { pixelNumber } from './draw';
import { LABELS } from './labels';
import { GREY, INK, PAPER, PAPER_SHADE, RED, WHITE, YELLOW, makeText } from './theme';

type Row =
    | { kind: 'volume'; key: 'musicVolume' | 'sfxVolume'; label: string }
    | { kind: 'toggle'; key: 'screenShake' | 'demoMode'; label: string; note?: string };

const ROWS: Row[] = [
    { kind: 'volume', key: 'musicVolume', label: LABELS.music },
    { kind: 'volume', key: 'sfxVolume', label: LABELS.sound },
    { kind: 'toggle', key: 'screenShake', label: LABELS.shake },
    { kind: 'toggle', key: 'demoMode', label: LABELS.demo, note: LABELS.demoNote },
];

const ROW_HEIGHT = 84;
const STEPS = 10;
const STEP_WIDTH = 34;
const STEP_GAP = 6;
const CONTROL_X = 360;
const TOGGLE_WIDTH = 96;

interface Hit {
    x: number;
    y: number;
    width: number;
    height: number;
    act: () => void;
}

/**
 * The settings, as one block that both the pause page and the cover show. Every change goes
 * straight through updateSettings (which saves it and applies the volumes); `changed` is called
 * afterwards so the caller can sound a blip at the new volume.
 */
export class SettingsPanel {
    readonly container: Phaser.GameObjects.Container;
    readonly height = ROWS.length * ROW_HEIGHT + 36;
    private readonly g: Phaser.GameObjects.Graphics;
    private readonly toggleTexts: Phaser.GameObjects.Text[] = [];
    private hits: Hit[] = [];
    private selected = 0;

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly x: number,
        private readonly y: number,
        readonly width: number,
        private readonly changed: () => void,
    ) {
        this.g = scene.add.graphics();
        const parts: Phaser.GameObjects.GameObject[] = [this.g];
        ROWS.forEach((row, index) => {
            const top = index * ROW_HEIGHT;
            parts.push(makeText(scene, 64, top + (row.kind === 'toggle' && row.note ? 24 : 34), row.label, 30, { bold: true }).setOrigin(0, 0.5));
            if (row.kind === 'toggle') {
                if (row.note) {
                    parts.push(makeText(scene, 64, top + 52, row.note, 17, { color: GREY }).setOrigin(0, 0.5));
                }
                for (const [i, word] of [LABELS.on, LABELS.off].entries()) {
                    const text = makeText(scene, CONTROL_X + i * (TOGGLE_WIDTH + 10) + TOGGLE_WIDTH / 2, top + 35, word, 24, { bold: true }).setOrigin(0.5);
                    this.toggleTexts.push(text);
                    parts.push(text);
                }
            }
        });
        parts.push(
            makeText(scene, width / 2, ROWS.length * ROW_HEIGHT + 18, LABELS.settingsHint, 17, { bold: true, color: GREY }).setOrigin(0.5),
        );
        this.container = scene.add.container(x, y, parts);
        this.draw();
    }

    /** Returns true if the key was one of this panel's */
    key(code: string): boolean {
        if (code === 'ArrowUp' || code === 'KeyW') {
            this.selected = (this.selected + ROWS.length - 1) % ROWS.length;
            this.draw();
            this.changed();
            return true;
        }
        if (code === 'ArrowDown' || code === 'KeyS') {
            this.selected = (this.selected + 1) % ROWS.length;
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
        const row = ROWS[this.selected];
        if (row.kind === 'volume') {
            if (!press) {
                this.setVolume(row.key, this.step(row.key) + (right ? 1 : -1));
            }
        } else {
            this.apply({ [row.key]: press ? !getSettings()[row.key] : left });
        }
        return true;
    }

    /** A click at a point of the screen; returns true if it landed on a control */
    click(px: number, py: number): boolean {
        const x = px - this.x;
        const y = py - this.y;
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

    private draw() {
        const g = this.g;
        const settings = getSettings();
        g.clear();
        this.hits = [];

        ROWS.forEach((row, index) => {
            const top = index * ROW_HEIGHT;
            const selected = index === this.selected;
            if (selected) {
                g.fillStyle(INK, 1).fillRect(4, top + 6, this.width, ROW_HEIGHT - 12);
                g.fillStyle(INK, 1).fillRect(0, top + 2, this.width, ROW_HEIGHT - 12);
                g.fillStyle(YELLOW, 1).fillRect(4, top + 6, this.width - 8, ROW_HEIGHT - 20);
                g.fillStyle(RED, 1).fillTriangle(22, top + 20, 22, top + 48, 44, top + 34);
                g.lineStyle(3, INK, 1).strokeTriangle(22, top + 20, 22, top + 48, 44, top + 34);
            }
            // Clicking anywhere on a row selects it
            this.hits.push({
                x: 0,
                y: top,
                width: this.width,
                height: ROW_HEIGHT,
                act: () => {
                    if (this.selected !== index) {
                        this.selected = index;
                        this.draw();
                    }
                },
            });

            if (row.kind === 'volume') {
                const step = this.step(row.key);
                for (let i = 0; i < STEPS; i++) {
                    const x = CONTROL_X + i * (STEP_WIDTH + STEP_GAP);
                    // The bars rise like a volume wedge
                    const height = 16 + i * 3;
                    const y = top + 56 - height;
                    g.fillStyle(INK, 1).fillRect(x, y, STEP_WIDTH, height);
                    g.fillStyle(i < step ? RED : selected ? PAPER : PAPER_SHADE, 1).fillRect(x + 3, y + 3, STEP_WIDTH - 6, height - 6);
                    if (i < step) {
                        g.fillStyle(WHITE, 0.45).fillRect(x + 3, y + 3, STEP_WIDTH - 6, 3);
                    }
                    this.hits.unshift({
                        x: x - STEP_GAP / 2,
                        y: top + 4,
                        width: STEP_WIDTH + STEP_GAP,
                        height: ROW_HEIGHT - 8,
                        act: () => {
                            this.selected = index;
                            // Clicking the first bar when only it is lit turns the sound off
                            this.setVolume(row.key, step === 1 && i === 0 ? 0 : i + 1);
                        },
                    });
                }
                pixelNumber(g, String(step), CONTROL_X + STEPS * (STEP_WIDTH + STEP_GAP) + 34, top + 36, 4, INK);
            } else {
                const on = settings[row.key];
                [true, false].forEach((value, i) => {
                    const x = CONTROL_X + i * (TOGGLE_WIDTH + 10);
                    const active = on === value;
                    g.fillStyle(INK, 1).fillRect(x + (active ? 4 : 0), top + 14 + (active ? 5 : 0), TOGGLE_WIDTH, 42);
                    g.fillStyle(INK, 1).fillRect(x, top + 14, TOGGLE_WIDTH, 42);
                    g.fillStyle(active ? RED : selected ? PAPER : PAPER_SHADE, 1).fillRect(x + 3, top + 17, TOGGLE_WIDTH - 6, 36);
                    const text = this.toggleTexts[(index - ROWS.findIndex((other) => other.kind === 'toggle')) * 2 + i];
                    text?.setColor(active ? '#fbf3dc' : '#8c8798');
                    this.hits.unshift({
                        x,
                        y: top + 8,
                        width: TOGGLE_WIDTH + 10,
                        height: ROW_HEIGHT - 16,
                        act: () => {
                            this.selected = index;
                            this.apply({ [row.key]: value });
                        },
                    });
                });
            }
        });
    }
}
