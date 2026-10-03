import Phaser from 'phaser';
import { MONSTERS } from '../config/monsters';
import { Monster } from '../entities/Monster';
import type { Player } from '../entities/Player';
import { Events } from '../events';
import type { RoomDef, WaveDef } from '../types';

const DEFAULT_WAVE_DELAY = 1000;
const MIN_SPAWN_DISTANCE = 260;
const SPAWN_ATTEMPTS = 20;

/** Spawns a room's waves one after another; the next wave starts when the last one is dead. */
export class WaveDirector {
    /** True once every wave has been spawned and killed */
    cleared = false;

    private waveIndex = -1;
    private waiting = false;

    constructor(
        private scene: Phaser.Scene,
        private room: RoomDef,
        private bounds: Phaser.Geom.Rectangle,
        private walls: Phaser.Geom.Rectangle[],
        private monsters: Phaser.Physics.Arcade.Group,
        private player: Player,
    ) {}

    get waveNumber() {
        return Math.min(this.waveIndex + 1, this.room.waves.length);
    }

    get totalWaves() {
        return this.room.waves.length;
    }

    update() {
        if (this.cleared || this.waiting || this.monsters.countActive(true) > 0) {
            return;
        }

        this.waveIndex++;
        const wave = this.room.waves[this.waveIndex];
        if (!wave) {
            this.cleared = true;
            this.scene.game.events.emit(Events.ROOM_CLEARED);
            return;
        }

        this.waiting = true;
        this.scene.time.delayedCall(wave.delay ?? DEFAULT_WAVE_DELAY, () => {
            this.spawn(wave);
            this.waiting = false;
        });
    }

    private spawn(wave: WaveDef) {
        this.scene.game.events.emit(Events.WAVE_STARTED, this.waveNumber, this.totalWaves);

        for (const group of wave.spawns) {
            const def = MONSTERS[group.monster];
            if (!def) {
                console.warn(`No monster definition for "${group.monster}"`);
                continue;
            }

            for (let i = 0; i < group.count; i++) {
                const point = this.pickSpawnPoint(def.radius);
                this.monsters.add(new Monster(this.scene, point.x, point.y, def, this.player));
            }
        }
    }

    /** A point inside the room, away from the player and outside every wall */
    private pickSpawnPoint(radius: number) {
        const area = Phaser.Geom.Rectangle.Clone(this.bounds);
        Phaser.Geom.Rectangle.Inflate(area, -radius * 2, -radius * 2);

        const point = new Phaser.Math.Vector2();
        for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
            point.set(
                Phaser.Math.Between(area.left, area.right),
                Phaser.Math.Between(area.top, area.bottom),
            );

            const farFromPlayer =
                Phaser.Math.Distance.Between(point.x, point.y, this.player.x, this.player.y) >=
                MIN_SPAWN_DISTANCE;
            const insideWall = this.walls.some((wall) => wall.contains(point.x, point.y));
            if (farFromPlayer && !insideWall) {
                break;
            }
        }
        return point;
    }
}
