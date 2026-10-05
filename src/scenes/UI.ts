import Phaser from 'phaser';
import { LEVELS } from '../config/levels';
import { Events } from '../events';
import type { ArtStyle, MonsterId, RayMode, StyleId, UpgradeId, WeaponRule } from '../types';
import { DialogModal, LevelIntroModal, type Modal, type ModalHooks } from '../ui/Captions';
import { CreditsModal, GuideTruthModal, ReportModal, UpgradeModal } from '../ui/Cards';
import { HitWords } from '../ui/HitWords';
import { Hud } from '../ui/Hud';
import { Overlays } from '../ui/Overlays';
import { PausePage } from '../ui/PausePage';
import { STYLE_THEME, artStyleOf } from '../ui/theme';
import { Wheel, type WeaponStatus } from '../ui/Wheel';

export { FONT } from '../ui/theme';

/** Something the Game or Ending scene is waiting on. Each is answered exactly once. */
type Task =
    | { kind: 'intro'; level: number; name: string; style: StyleId; lines: string[] }
    | { kind: 'dialog'; lines: string[] }
    | { kind: 'itemGet'; ids: UpgradeId[] }
    | { kind: 'screen'; name: string };

const toLines = (lines: unknown): string[] =>
    Array.isArray(lines) ? lines.map((line) => String(line)) : typeof lines === 'string' ? [lines] : [];

/**
 * Everything the player reads. Runs on top of the Game and Ending scenes, unzoomed, hears what
 * happens through game.events, and answers the scenes that wait on a caption or a card.
 */
export class UI extends Phaser.Scene {
    private hud!: Hud;
    private wheel!: Wheel;
    private words!: HitWords;
    private overlays!: Overlays;
    private queue: Task[] = [];
    private modal?: Modal;
    private page?: PausePage;
    private ending = false;
    private levelIndex = -1;
    /** The era's own style, and the one the square is drawn in right now (the boss changes it) */
    private style: StyleId = 'goldenAge';
    private artStyle: ArtStyle = 'goldenAge';

    constructor() {
        super('UI');
    }

    create() {
        // The scene object is reused when the scene is started again, so nothing may carry over
        this.queue = [];
        this.modal = undefined;
        this.page = undefined;
        this.ending = false;
        this.levelIndex = -1;
        this.style = 'goldenAge';
        this.artStyle = 'goldenAge';

        this.hud = new Hud(this);
        this.wheel = new Wheel(this);
        this.words = new HitWords(this);
        this.overlays = new Overlays(this);

        this.listen();
        const keyboard = this.input.keyboard!;
        // Stops Tab leaving the canvas and Space scrolling the page the game is embedded in
        keyboard.addCapture(['TAB', 'SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
        keyboard.on('keydown', this.onKey, this);
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.leftButtonDown()) {
                return;
            }
            if (this.page) {
                this.page.click(pointer.x, pointer.y);
            } else {
                this.modal?.advance();
            }
        });
    }

    update(_time: number, delta: number) {
        // The game's clocks stop under the pause page, so the ones mirrored here stop too
        const frozen = !!this.page;
        this.wheel.update(delta, frozen);
        this.overlays.update(delta, frozen);
    }

    private listen() {
        const bus = this.game.events;
        const handlers: [string, (...args: never[]) => void][] = [
            [Events.PLAYER_HEALTH_CHANGED, (health: number, max: number) => this.hud.setHealth(health, max)],
            [Events.ENERGY_CHANGED, (energy: number, max: number) => this.wheel.setEnergy(energy, max)],
            [
                Events.WEAPON_STATE,
                (rule: WeaponRule, mode: RayMode, index: number, status: WeaponStatus) => this.wheel.setState(rule, mode, index, status),
            ],
            [Events.DASH_STATE, (left: number, max: number, wait: number) => this.wheel.setDash(left, max, wait)],
            [Events.DASHED, () => this.wheel.dashed()],
            [Events.ROOM_STARTED, this.onRoom],
            [Events.HEALTH_UPGRADE, () => this.hud.celebrate()],
            [Events.HIT, (x: number, y: number, multiplier: number) => this.words.show(x, y, multiplier)],
            [Events.BANNER, (text: string) => this.overlays.setBanner(typeof text === 'string' ? text : '')],
            [Events.SECRET_FOUND, () => this.overlays.secretFlourish()],
            [Events.GUIDE_UNLOCKED, (id: MonsterId) => this.overlays.guideToast(id, this.artStyle)],
            [Events.ERA_TIMER, (secondsLeft: number) => this.hud.setTimer(secondsLeft)],
            [Events.CHECKPOINT, () => this.overlays.checkpoint()],
            [Events.SURGE, () => this.overlays.surge()],
            [Events.BOSS_TELEGRAPH, (style: StyleId, inMs: number) => this.overlays.eraShift(style, inMs)],
            [Events.ERA_SWAPPED, this.onEraSwapped],
            [Events.HAZARD, (kind: string, on: boolean) => this.overlays.hazard(kind, !!on)],
            [
                Events.ENDING_STARTED,
                () => {
                    this.ending = true;
                    this.artStyle = 'plain';
                    this.hud.goPlain();
                    this.wheel.goPlain();
                    this.overlays.clear();
                },
            ],
            [Events.LEVEL_STARTED, this.onLevel],
            [Events.DIALOG, (lines: string[]) => this.enqueue({ kind: 'dialog', lines: toLines(lines) })],
            [Events.UPGRADE_GET, (ids: UpgradeId[]) => this.onUpgrade(ids)],
            // Nothing in v2 sends this, but anything that still does gets the same card
            [Events.ITEM_GET, (id: UpgradeId) => this.onUpgrade([id])],
            [Events.SHOW_SCREEN, (name: string) => this.enqueue({ kind: 'screen', name })],
        ];
        for (const [name, handler] of handlers) {
            bus.on(name, handler, this);
        }
        // The bus outlives this scene: without this a second start would hear everything twice
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            for (const [name, handler] of handlers) {
                bus.off(name, handler, this);
            }
            this.input.keyboard?.off('keydown', this.onKey, this);
            this.modal?.destroy();
            this.modal = undefined;
            this.queue = [];
            if (this.page) {
                // Leave nothing paused behind, but make no sound about it
                this.page.destroy();
                this.page = undefined;
                if (this.scene.isPaused('Game')) {
                    this.scene.resume('Game');
                }
                bus.emit(Events.PAUSED, false);
            }
        });
    }

    private setStyle(style: StyleId) {
        this.artStyle = artStyleOf(style);
        this.hud.setStyle(style);
    }

    private onRoom(levelName: string, roomNumber: number, totalRooms: number) {
        const index = LEVELS.findIndex((level) => level.name === levelName);
        const level = LEVELS[index];
        // A different era (or the same one begun again): the clock and the warnings start clean
        this.hud.hideTimer();
        this.overlays.clear();
        this.levelIndex = index;
        if (level) {
            this.style = level.style;
            this.setStyle(level.style);
            this.hud.setEra(levelName, index + 1, LEVELS.length);
        } else {
            // The sandbox: its rooms are what is counted
            this.hud.setEra(String(levelName ?? ''), roomNumber, totalRooms);
        }
    }

    private onLevel(levelNumber: number, name: string, style: StyleId, introText: string[]) {
        if (style && STYLE_THEME[style]) {
            this.style = style;
            this.setStyle(style);
        }
        this.enqueue({ kind: 'intro', level: levelNumber, name: String(name ?? ''), style: this.style, lines: toLines(introText) });
    }

    private onEraSwapped(style: StyleId) {
        if (!style || !STYLE_THEME[style]) {
            return;
        }
        this.setStyle(style);
        this.overlays.eraSwapped(style);
    }

    private onUpgrade(ids: unknown) {
        const list = (Array.isArray(ids) ? ids : [ids]).filter((id): id is UpgradeId => typeof id === 'string');
        this.enqueue({ kind: 'itemGet', ids: list });
    }

    private enqueue(task: Task) {
        this.queue.push(task);
        this.pump();
    }

    /** Starts the next waiting caption or card, unless one is up or the game is paused */
    private pump() {
        if (this.modal || this.page) {
            return;
        }
        const task = this.queue.shift();
        if (!task) {
            return;
        }

        const bus = this.game.events;
        let answered = false;
        const hooks: ModalHooks = {
            select: () => bus.emit(Events.UI_SELECT),
            done: () => {
                // A scene is waiting on this: answer once, and only once
                if (answered) {
                    return;
                }
                answered = true;
                this.modal = undefined;
                if (task.kind === 'intro' || task.kind === 'dialog') {
                    bus.emit(Events.DIALOG_DONE);
                } else {
                    bus.emit(Events.SCREEN_DONE, task.kind === 'itemGet' ? 'itemGet' : task.name);
                }
                this.pump();
            },
        };

        let modal: Modal | undefined;
        try {
            modal = this.open(task, hooks);
        } catch (error) {
            // A card that fails to draw must not leave the game waiting for ever
            console.error(error);
        }
        if (!modal) {
            hooks.done();
        } else if (answered) {
            modal.destroy();
        } else {
            this.modal = modal;
        }
    }

    private open(task: Task, hooks: ModalHooks): Modal | undefined {
        switch (task.kind) {
            case 'intro':
                return new LevelIntroModal(this, task.level, task.name, task.style, task.lines, hooks);
            case 'dialog':
                return task.lines.length > 0 ? new DialogModal(this, task.lines, false, hooks) : undefined;
            case 'itemGet':
                return task.ids.length > 0 ? new UpgradeModal(this, task.ids.slice(0, 4), hooks) : undefined;
            case 'screen':
                if (task.name === 'report') {
                    return new ReportModal(this, hooks);
                }
                if (task.name === 'guideTruth') {
                    return new GuideTruthModal(this, hooks);
                }
                if (task.name === 'credits') {
                    return new CreditsModal(this, hooks);
                }
                return undefined;
        }
    }

    private onKey(event: KeyboardEvent) {
        if (event.repeat) {
            return;
        }
        const code = event.code;
        const pauseKey = code === 'Escape' || code === 'KeyP';

        if (this.page) {
            if (pauseKey) {
                this.closePause();
            } else if (code === 'Tab' || code === 'KeyQ' || code === 'KeyE') {
                this.page.turn(code === 'KeyQ' || (code === 'Tab' && event.shiftKey) ? -1 : 1);
                this.game.events.emit(Events.UI_SELECT);
            } else {
                this.page.key(code);
            }
            return;
        }
        if (this.modal) {
            if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
                // Space is also the dash: this press belongs to the caption, not to the game
                event.stopPropagation();
                this.modal.advance();
            }
            return;
        }
        if (pauseKey && this.canPause()) {
            this.openPause();
        }
    }

    /** Only in the middle of play: not under a caption or card, not in the ending */
    private canPause() {
        return !this.ending && this.queue.length === 0 && this.scene.isActive('Game');
    }

    private openPause() {
        this.scene.pause('Game');
        this.page = new PausePage(this, {
            levelIndex: this.levelIndex,
            style: this.artStyle,
            select: () => this.game.events.emit(Events.UI_SELECT),
        });
        this.game.events.emit(Events.PAUSED, true);
        this.game.events.emit(Events.UI_SELECT);
    }

    private closePause() {
        this.page?.destroy();
        this.page = undefined;
        if (this.scene.isPaused('Game')) {
            this.scene.resume('Game');
        }
        this.game.events.emit(Events.PAUSED, false);
        this.game.events.emit(Events.UI_SELECT);
        this.pump();
    }
}
