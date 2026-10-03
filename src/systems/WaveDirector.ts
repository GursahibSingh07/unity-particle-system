import Phaser from 'phaser';
import { MONSTERS, SPAWN } from '../config/monsters';
import { TILE } from '../config/world';
import { createMonster } from '../entities/createMonster';
import { closingRing } from '../entities/effects';
import type { MonsterWorld } from '../entities/Monster';
import { Events } from '../events';
import type { MonsterDef, MonsterId, RoomDef, WaveDef } from '../types';
import type { Point } from './Navigation';

const DEFAULT_WAVE_DELAY = 1000;
/** Small monsters arrive in clusters of up to this many, so they read as a flock */
const CLUSTER_SIZE = 6;
const CLUSTER_RADIUS = TILE * 2.2;
/** Monsters this small are scattered within their tile rather than centred on it */
const JITTER_BELOW_RADIUS = 5;

/**
 * Spawns a room's waves one after another; the next wave starts when the last one is dead.
 * Every spawn is announced with a marker first.
 */
export class WaveDirector {
    /** True once every wave has been spawned and killed */
    cleared = false;

    private waveIndex = -1;
    private waiting = false;
    /** Announced but not yet appeared */
    private pending = 0;
    private halted = false;
    /** While true no wave starts: the room is waiting for the level's opening captions */
    private held = false;

    constructor(
        private scene: Phaser.Scene,
        private room: RoomDef,
        private world: MonsterWorld,
    ) {}

    get waveNumber() {
        return Math.min(this.waveIndex + 1, this.room.waves.length);
    }

    get totalWaves() {
        return this.room.waves.length;
    }

    update() {
        if (this.cleared || this.halted || this.held || this.waiting || this.pending > 0) {
            return;
        }
        if (this.world.monsters.countActive(true) > 0) {
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
            this.waiting = false;
            if (!this.halted) {
                this.spawn(wave);
            }
        });
    }

    /** Keep the first wave back until release() is called */
    hold() {
        this.held = true;
    }

    release() {
        this.held = false;
    }

    /** Stop announcing and spawning, for when the room ends */
    halt() {
        this.halted = true;
    }

    /** Announce, then spawn, one monster on open floor as near as possible to a point */
    summon(id: MonsterId, x: number, y: number) {
        const def = MONSTERS[id];
        const { player, nav } = this.world;
        const clear = SPAWN.crowdedDistance + def.radius + 8;

        let best: Point | null = null;
        let bestDistance = Infinity;
        for (const cell of nav.reachableCells(def.radius)) {
            if (Math.hypot(cell.x - player.x, cell.y - player.y) < clear) {
                continue;
            }
            const distance = Math.hypot(cell.x - x, cell.y - y);
            if (distance < bestDistance) {
                best = cell;
                bestDistance = distance;
            }
        }
        this.announce(def, best ? this.jitter(best, def) : this.farthestCell(def), SPAWN.retries);
    }

    private spawn(wave: WaveDef) {
        this.scene.game.events.emit(Events.WAVE_STARTED, this.waveNumber, this.totalWaves);

        for (const group of wave.spawns) {
            const def = MONSTERS[group.monster];
            if (!def) {
                console.warn(`No monster definition for "${group.monster}"`);
                continue;
            }

            let anchor: Point | null = null;
            for (let i = 0; i < group.count; i++) {
                const clustered = def.radius < JITTER_BELOW_RADIUS;
                if (!clustered || i % CLUSTER_SIZE === 0) {
                    anchor = null;
                }
                const point = this.pickSpawnPoint(def, anchor);
                anchor ??= point;
                this.announce(def, point, SPAWN.retries);
            }
        }
    }

    /** Show the marker, wait, then put the monster there (or move it if the player is in the way) */
    private announce(def: MonsterDef, point: Point, retries: number) {
        this.pending++;
        this.scene.game.events.emit(Events.MONSTER_SPAWNING, point.x, point.y);
        const marker = closingRing(this.scene, point.x, point.y, def.radius + 3, 0xffffff, SPAWN.telegraph);
        marker.setFillStyle(def.color, 0.25);

        this.scene.time.delayedCall(SPAWN.telegraph, () => {
            this.pending--;
            if (this.halted) {
                return;
            }

            const { player } = this.world;
            const crowded =
                Math.hypot(point.x - player.x, point.y - player.y) < SPAWN.crowdedDistance + def.radius;
            if (crowded && retries > 0) {
                this.announce(def, this.pickSpawnPoint(def, null), retries - 1);
                return;
            }
            const spot = crowded ? this.farthestCell(def) : point;
            createMonster(this.scene, def.id, spot.x, spot.y, this.world);
        });
    }

    /**
     * A point on open floor the monster can reach the player from, away from the player.
     * With an `anchor`, the point is also kept near it.
     */
    private pickSpawnPoint(def: MonsterDef, anchor: Point | null): Point {
        const { player, nav } = this.world;
        const far = nav
            .reachableCells(def.radius)
            .filter((cell) => Math.hypot(cell.x - player.x, cell.y - player.y) >= SPAWN.minDistance);
        if (far.length === 0) {
            return this.farthestCell(def);
        }

        let choices = far;
        if (anchor) {
            const near = far.filter(
                (cell) => Math.hypot(cell.x - anchor.x, cell.y - anchor.y) <= CLUSTER_RADIUS,
            );
            if (near.length > 0) {
                choices = near;
            }
        }
        return this.jitter(Phaser.Utils.Array.GetRandom(choices), def);
    }

    /** The open tile furthest from the player: the fallback when nowhere better is free */
    private farthestCell(def: MonsterDef): Point {
        const { player, nav } = this.world;
        let best: Point = { x: player.x, y: player.y };
        let bestDistance = -1;
        for (const cell of nav.reachableCells(def.radius)) {
            const distance = Math.hypot(cell.x - player.x, cell.y - player.y);
            if (distance > bestDistance) {
                best = cell;
                bestDistance = distance;
            }
        }
        return best;
    }

    /** Small monsters get a random spot within the tile so a cluster is not a neat grid */
    private jitter(cell: Point, def: MonsterDef): Point {
        if (def.radius >= JITTER_BELOW_RADIUS) {
            return cell;
        }
        const slack = TILE / 2 - def.radius - 1;
        return {
            x: cell.x + Phaser.Math.FloatBetween(-slack, slack),
            y: cell.y + Phaser.Math.FloatBetween(-slack, slack),
        };
    }
}
