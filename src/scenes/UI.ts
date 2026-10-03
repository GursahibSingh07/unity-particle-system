import Phaser from 'phaser';
import { LEVELS, SANDBOX } from '../config/levels';
import { RADIATIONS } from '../config/radiation';
import { Events } from '../events';
import { Progress } from '../state';
import type { MonsterId, RadiationId, StyleId } from '../types';
import { DialogModal, LevelIntroModal, type Modal, type ModalHooks } from '../ui/Captions';
import { CreditsModal, GuideTruthModal, ItemGetModal, ReportModal } from '../ui/Cards';
import { HitWords } from '../ui/HitWords';
import { Hud } from '../ui/Hud';
import { Overlays } from '../ui/Overlays';
import { PausePage } from '../ui/PausePage';
import { artStyleOf } from '../ui/theme';

export { FONT } from '../ui/theme';

/** Something the Game or Ending scene is waiting on. Each is answered exactly once. */
type Task =
    | { kind: 'intro'; level: number; name: string; style: StyleId; lines: string[] }
    | { kind: 'dialog'; lines: string[] }
    | { kind: 'itemGet'; id: RadiationId }
    | { kind: 'screen'; name: string };

const toLines = (lines: unknown): string[] =>
    Array.isArray(lines) ? lines.map((line) => String(line)) : typeof lines === 'string' ? [lines] : [];

/**
 * Everything the player reads. Runs on top of the Game and Ending scenes, unzoomed, hears what
 * happens through game.events, and answers the scenes that wait on a caption or a card.
 */
export class UI extends Phaser.Scene {
    private hud!: Hud;
    private words!: HitWords;
    private overlays!: Overlays;
    private queue: Task[] = [];
    private modal?: Modal;
    private page?: PausePage;
    private ending = false;
    private levelIndex = -1;
    private roomIndex = 0;
    private style: StyleId = 'goldenAge';
    /** Radiations seen in use that the saved progress does not list (dev jumps, the sandbox) */
    private seen = new Set<RadiationId>();

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
        this.roomIndex = 0;
        this.style = 'goldenAge';
        this.seen = new Set();

        this.hud = new Hud(this);
        this.words = new HitWords(this);
        this.overlays = new Overlays(this);
        this.refreshOwned();

        this.listen();
        const keyboard = this.input.keyboard!;
        // Stops Tab leaving the canvas and Space scrolling the page the game is embedded in
        keyboard.addCapture(['TAB', 'SPACE']);
        keyboard.on('keydown', this.onKey, this);
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.leftButtonDown()) {
                this.modal?.advance();
            }
        });
    }

    private listen() {
        const bus = this.game.events;
        const handlers: [string, (...args: never[]) => void][] = [
            [Events.PLAYER_HEALTH_CHANGED, (health: number, max: number) => this.hud.setHealth(health, max)],
            [Events.ENERGY_CHANGED, (energy: number, max: number) => this.hud.setEnergy(energy, max)],
            [Events.RADIATION_CHANGED, this.onRadiation],
            [Events.ROOM_STARTED, this.onRoom],
            [Events.HEALTH_UPGRADE, () => this.hud.celebrate()],
            [Events.HIT, (x: number, y: number, multiplier: number) => this.words.show(x, y, multiplier)],
            [Events.BANNER, (text: string) => this.overlays.setBanner(typeof text === 'string' ? text : '')],
            [Events.SECRET_FOUND, () => this.overlays.secretFlourish()],
            [Events.GUIDE_UNLOCKED, (id: MonsterId) => this.overlays.guideToast(id, artStyleOf(this.style))],
            [
                Events.ENDING_STARTED,
                () => {
                    this.ending = true;
                    this.hud.goPlain();
                },
            ],
            [Events.LEVEL_STARTED, this.onLevel],
            [Events.DIALOG, (lines: string[]) => this.enqueue({ kind: 'dialog', lines: toLines(lines) })],
            [Events.ITEM_GET, this.onItemGet],
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

    private onRadiation(id: RadiationId) {
        if (!RADIATIONS[id]) {
            return;
        }
        this.seen.add(id);
        this.refreshOwned();
        this.hud.setRadiation(id);
    }

    private onRoom(levelName: string, roomNumber: number, totalRooms: number) {
        this.levelIndex = LEVELS.findIndex((level) => level.name === levelName);
        this.roomIndex = roomNumber - 1;
        const level = LEVELS[this.levelIndex] ?? (SANDBOX.name === levelName ? SANDBOX : undefined);
        if (level) {
            this.style = level.style;
        }
        this.hud.setRoom(levelName, roomNumber, totalRooms);
        this.refreshOwned();
    }

    private onLevel(levelNumber: number, name: string, style: StyleId, introText: string[]) {
        this.style = style ?? this.style;
        this.enqueue({ kind: 'intro', level: levelNumber, name: String(name ?? ''), style: this.style, lines: toLines(introText) });
    }

    private onItemGet(id: RadiationId) {
        this.seen.add(id);
        this.refreshOwned();
        this.enqueue({ kind: 'itemGet', id });
    }

    private refreshOwned() {
        this.hud.setOwned([...new Set([...Progress.radiations(this.registry), ...this.seen])]);
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
                return new ItemGetModal(this, task.id, hooks);
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
            } else if (['Tab', 'KeyQ', 'KeyE', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) {
                this.page.turn();
                this.game.events.emit(Events.UI_SELECT);
            }
            return;
        }
        if (this.modal) {
            if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
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
            roomIndex: this.roomIndex,
            style: artStyleOf(this.style),
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
