import Phaser from 'phaser';
import { LEVELS } from '../config/levels';
import { Monster } from '../entities/Monster';
import { Player } from '../entities/Player';
import { Events } from '../events';
import { EMWMachine } from '../systems/EMWMachine';
import { WaveDirector } from '../systems/WaveDirector';
import type { LevelDef, RoomDef } from '../types';

// The room the action happens in, inset from the 1280x720 canvas
const ROOM = new Phaser.Geom.Rectangle(40, 60, 1200, 620);
const ROOM_BORDER = 6;
const WALL_COLOR = 0x3a3a52;
const RESTART_DELAY = 1500;
const NEXT_ROOM_DELAY = 1200;

const HEALTH_BLOCKS = 20;
const HEALTH_ROWS = 2;
const HEALTH_BLOCK_WIDTH = 14;
const HEALTH_BLOCK_HEIGHT = 10;
const HEALTH_BLOCK_GAP = 3;
const HEALTH_FULL_COLOR = 0xff4d5a;
const HEALTH_EMPTY_COLOR = 0x33333f;
const ENERGY_BAR_HEIGHT = 6;

interface GameData {
    level?: number;
    room?: number;
}

export class Game extends Phaser.Scene {
    private levelIndex = 0;
    private roomIndex = 0;
    private player!: Player;
    private monsters!: Phaser.Physics.Arcade.Group;
    private waves!: WaveDirector;
    private machine!: EMWMachine;
    private status!: Phaser.GameObjects.Text;
    private healthBlocks: Phaser.GameObjects.Rectangle[] = [];
    private energyBar!: Phaser.GameObjects.Rectangle;
    private banner!: Phaser.GameObjects.Text;
    private finished = false;

    constructor() {
        super('Game');
    }

    init(data: GameData) {
        this.levelIndex = data.level ?? 0;
        this.roomIndex = data.room ?? 0;
        this.finished = false;
    }

    create() {
        const room = this.roomDef;

        this.physics.world.setBounds(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
        this.add
            .rectangle(ROOM.centerX, ROOM.centerY, ROOM.width, ROOM.height)
            .setStrokeStyle(ROOM_BORDER, 0xffffff);

        const walls = this.physics.add.staticGroup();
        const wallRects = (room.walls ?? []).map(
            (wall) => new Phaser.Geom.Rectangle(ROOM.x + wall.x, ROOM.y + wall.y, wall.width, wall.height),
        );
        for (const rect of wallRects) {
            walls.add(this.add.rectangle(rect.centerX, rect.centerY, rect.width, rect.height, WALL_COLOR));
        }

        this.player = new Player(this, ROOM.centerX, ROOM.centerY);
        this.monsters = this.physics.add.group({ runChildUpdate: true });
        this.waves = new WaveDirector(this, room, ROOM, wallRects, this.monsters, this.player);
        this.machine = new EMWMachine(this, this.player, this.monsters, wallRects, this.level.radiations);

        this.physics.add.collider(this.player, walls);
        this.physics.add.collider(this.monsters, walls);
        this.physics.add.collider(this.monsters, this.monsters);
        this.physics.add.overlap(this.player, this.monsters, (_player, monster) => {
            this.player.hurt((monster as Monster).def.contactDamage);
        });

        this.createReadout();
        this.banner = this.add
            .text(ROOM.centerX, ROOM.centerY - 120, '', {
                fontFamily: 'monospace',
                fontSize: '40px',
                color: '#ffffff',
            })
            .setOrigin(0.5)
            .setDepth(10);

        if (import.meta.env.DEV) {
            // K clears the current wave for testing
            this.input.keyboard!.on('keydown-K', () => {
                for (const monster of this.monsters.getChildren().slice()) {
                    (monster as Monster).kill();
                }
            });
        }

        this.game.events.emit(Events.ROOM_STARTED, this.roomIndex + 1, this.level.rooms.length);
    }

    update(_time: number, delta: number) {
        this.player.update();
        this.updateReadout();

        if (this.finished) {
            return;
        }

        if (this.player.isDead) {
            this.finish('Room failed', RESTART_DELAY, this.roomIndex);
            return;
        }

        this.machine.update(delta);
        this.waves.update();
        if (this.waves.cleared) {
            this.onRoomCleared();
        }
    }

    private get level(): LevelDef {
        return LEVELS[this.levelIndex];
    }

    private get roomDef(): RoomDef {
        return this.level.rooms[this.roomIndex];
    }

    private get healthBarWidth() {
        const columns = HEALTH_BLOCKS / HEALTH_ROWS;
        return columns * (HEALTH_BLOCK_WIDTH + HEALTH_BLOCK_GAP) - HEALTH_BLOCK_GAP;
    }

    // Temporary readout until the HUD scene exists
    private createReadout() {
        const columns = HEALTH_BLOCKS / HEALTH_ROWS;
        this.healthBlocks = [];
        for (let i = 0; i < HEALTH_BLOCKS; i++) {
            const x = ROOM.x + (i % columns) * (HEALTH_BLOCK_WIDTH + HEALTH_BLOCK_GAP);
            const y = 10 + Math.floor(i / columns) * (HEALTH_BLOCK_HEIGHT + HEALTH_BLOCK_GAP);
            this.healthBlocks.push(
                this.add
                    .rectangle(x, y, HEALTH_BLOCK_WIDTH, HEALTH_BLOCK_HEIGHT, HEALTH_FULL_COLOR)
                    .setOrigin(0, 0),
            );
        }

        const energyY = 10 + HEALTH_ROWS * (HEALTH_BLOCK_HEIGHT + HEALTH_BLOCK_GAP) + 2;
        this.add
            .rectangle(ROOM.x, energyY, this.healthBarWidth, ENERGY_BAR_HEIGHT, HEALTH_EMPTY_COLOR)
            .setOrigin(0, 0);
        this.energyBar = this.add
            .rectangle(ROOM.x, energyY, this.healthBarWidth, ENERGY_BAR_HEIGHT, 0xffffff)
            .setOrigin(0, 0);

        this.status = this.add.text(ROOM.x + this.healthBarWidth + 20, 18, '', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
        });
    }

    private updateReadout() {
        const { selected, energy, maxEnergy } = this.machine;
        this.status.setText(
            `${this.level.name}  |  Room ${this.roomIndex + 1}/${this.level.rooms.length}` +
                `  |  ${selected.key} ${selected.name}`,
        );

        const filled = Math.ceil((this.player.health / this.player.maxHealth) * HEALTH_BLOCKS);
        this.healthBlocks.forEach((block, i) => {
            block.setFillStyle(i < filled ? HEALTH_FULL_COLOR : HEALTH_EMPTY_COLOR);
        });

        this.energyBar.setFillStyle(selected.color);
        this.energyBar.width = this.healthBarWidth * (energy / maxEnergy);
    }

    private onRoomCleared() {
        if (this.roomIndex + 1 < this.level.rooms.length) {
            this.finish('Room cleared', NEXT_ROOM_DELAY, this.roomIndex + 1);
            return;
        }

        // Moving on to the next level comes with the level flow work
        this.finished = true;
        this.machine.stop();
        this.banner.setText('Level cleared');
        this.game.events.emit(Events.LEVEL_CLEARED, this.levelIndex + 1);
    }

    /** Freeze the room, show a message, then load the given room of this level */
    private finish(message: string, delay: number, nextRoom: number) {
        this.finished = true;
        this.machine.stop();
        this.physics.pause();
        this.banner.setText(message);
        this.time.delayedCall(delay, () => {
            this.scene.restart({ level: this.levelIndex, room: nextRoom } satisfies GameData);
        });
    }
}
