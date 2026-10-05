import Phaser from 'phaser';
import { BOSS_ENTRY } from '../config/flow';
import { MONSTERS, SPAWN } from '../config/monsters';
import { TILE } from '../config/world';
import { createMonster } from '../entities/createMonster';
import { closingRing } from '../entities/effects';
import type { MonsterWorld } from '../entities/Monster';
import { Events } from '../events';
import type { MonsterDef, MonsterId, RoomDef, WaveDef } from '../types';
import type { Point } from './Navigation';
import { parseRoom } from './roomLayout';

const DEFAULT_WAVE_DELAY = 1000;
/** Small monsters arrive in clusters of up to this many, so they read as a flock */
const CLUSTER_SIZE = 6;
const CLUSTER_RADIUS = TILE * 2.2;
/** Monsters this small are scattered within their tile rather than centred on it */
const JITTER_BELOW_RADIUS = 5;
/** Monsters coming up a street arrive this many milliseconds apart, so they file in */
const ENTRY_GAP = 140;
const ENTRY_FADE = 220;
/** A wave's group comes up the streets in parties of this many: small things, middling things, big things */
const PARTY = { small: 6, medium: 2, large: 1 };
const MEDIUM_RADIUS = 5;
const LARGE_RADIUS = 7;

/** Something announced that has not appeared yet */
interface Arrival {
    timer: Phaser.Time.TimerEvent;
    marker: Phaser.GameObjects.GameObject | null;
}

/** One way into the square: the e tiles that touch each other, and which way is out */
interface Street {
    /** Centre of the opening */
    x: number;
    y: number;
    /** Centres of its tiles */
    tiles: Point[];
    /** Unit vector pointing out of the square, up the street */
    outX: number;
    outY: number;
}

/**
 * Spawns a room's waves one after another; the next wave starts when the last one is dead.
 * Timed eras call spawnFromEntry() instead, and the waves stay out of it.
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
    private streets: Street[];
    private arrivals = new Set<Arrival>();

    constructor(
        private scene: Phaser.Scene,
        private room: RoomDef,
        private world: MonsterWorld,
    ) {
        this.streets = findStreets(room);
    }

    get waveNumber() {
        return Math.min(this.waveIndex + 1, this.room.waves.length);
    }

    get totalWaves() {
        return this.room.waves.length;
    }

    /** Announced but not yet appeared: count these with the living when capping a crowd */
    get incoming() {
        return this.pending;
    }

    /** How many streets lead into this room (0 for a room without e tiles) */
    get streetCount() {
        return this.streets.length;
    }

    update() {
        // A timed era has no waves to run through: whoever owns the clock does the spawning
        if (this.room.continuous) {
            return;
        }
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
        this.dropPending();
    }

    /** Forget everything announced but not yet arrived, markers included (the boss fell) */
    dropPending() {
        for (const arrival of this.arrivals) {
            arrival.timer.remove();
            arrival.marker?.destroy();
        }
        this.arrivals.clear();
        this.pending = 0;
    }

    /** Begin with this wave (counted from 0) instead of the first: a retry picks up where he fell */
    startAtWave(index: number) {
        if (this.waveIndex < 0) {
            this.waveIndex = Phaser.Math.Clamp(index, 0, Math.max(0, this.room.waves.length - 1)) - 1;
        }
    }

    /** Run `action` after `delay` unless the room is halted or the arrival is dropped first */
    private later(delay: number, marker: Phaser.GameObjects.GameObject | null, action: () => void) {
        this.pending++;
        const arrival: Arrival = {
            marker,
            timer: this.scene.time.delayedCall(delay, () => {
                this.arrivals.delete(arrival);
                this.pending--;
                if (!this.halted) {
                    action();
                }
            }),
        };
        this.arrivals.add(arrival);
    }

    /** Announce, then spawn, one monster on open floor as near as possible to a point */
    summon(id: MonsterId, x: number, y: number) {
        const def = MONSTERS[id];
        if (!def || this.halted) {
            return;
        }
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

    /** Announce, then spawn, one monster at exactly this point (it moves if the player stands there) */
    spawnAt(id: MonsterId, x: number, y: number) {
        const def = MONSTERS[id];
        if (!def || this.halted) {
            return;
        }
        this.announce(def, { x, y }, SPAWN.retries);
    }

    /**
     * Announce a group at a street entry, then walk them in from the edge of the square one
     * after another. The street is picked away from the player unless `street` names one
     * (0 to streetCount - 1). Returns how many are on their way.
     */
    spawnFromEntry(id: MonsterId, count = 1, street?: number) {
        const def = MONSTERS[id];
        if (!def || this.halted || count <= 0) {
            return 0;
        }
        if (this.streets.length === 0) {
            // No streets in this room: they appear on open floor like a wave
            for (let i = 0; i < count; i++) {
                this.announce(def, this.pickSpawnPoint(def, null), SPAWN.retries);
            }
            return count;
        }

        const chosen = street === undefined ? this.pickStreet() : this.streets[street % this.streets.length];
        this.scene.game.events.emit(Events.MONSTER_SPAWNING, chosen.x, chosen.y);
        const marker = closingRing(this.scene, chosen.x, chosen.y, TILE * 0.55, 0xffffff, SPAWN.telegraph);
        marker.setFillStyle(def.color, 0.25);

        for (let i = 0; i < count; i++) {
            this.later(SPAWN.telegraph + i * ENTRY_GAP, i === 0 ? marker : null, () => this.enter(def, chosen));
        }
        return count;
    }

    /** Put one monster just inside a street's mouth */
    private enter(def: MonsterDef, street: Street) {
        const { player } = this.world;
        const crowded = SPAWN.crowdedDistance + def.radius + TILE;
        if (Math.hypot(street.x - player.x, street.y - player.y) < crowded) {
            // The player has walked into the doorway since the ring: come in by another street
            street = this.pickStreet();
        }

        const tile = Phaser.Utils.Array.GetRandom(street.tiles);
        // Hard against the edge it came through, anywhere across the width of the opening
        const depth = Math.max(0, TILE / 2 - def.radius - 1);
        const across = Phaser.Math.FloatBetween(-depth, depth);
        const x = tile.x + street.outX * depth - street.outY * across;
        const y = tile.y + street.outY * depth + street.outX * across;

        const monster = createMonster(this.scene, def.id, x, y, this.world);
        // Stealth enemies run their own alpha
        if (def.class !== 'stealth') {
            monster.setAlpha(0);
            this.scene.tweens.add({ targets: monster, alpha: 1, duration: ENTRY_FADE });
        }
    }

    /** A street well away from the player; the furthest one if he is near them all */
    private pickStreet(): Street {
        return this.streets[Phaser.Utils.Array.GetRandom(this.farStreets())];
    }

    /** The streets (by number) well away from the player; only the furthest if he is near them all */
    private farStreets(): number[] {
        const { player } = this.world;
        const far: number[] = [];
        let furthest = 0;
        let furthestDistance = -1;
        this.streets.forEach((street, i) => {
            const distance = Math.hypot(street.x - player.x, street.y - player.y);
            if (distance >= SPAWN.minDistance) {
                far.push(i);
            }
            if (distance > furthestDistance) {
                furthest = i;
                furthestDistance = distance;
            }
        });
        return far.length > 0 ? far : [furthest];
    }

    /**
     * The boss is far too big for the search for open floor (next to a wall there is none its
     * size), so it is put down by hand: in the mouth of the street furthest from the player.
     */
    private placeBoss(def: MonsterDef) {
        const { player } = this.world;
        const clear = SPAWN.minDistance * BOSS_ENTRY.clearance;
        let spot: Point | null = null;
        let grand = false;
        let spotDistance = -1;
        for (const street of this.streets) {
            // Just far enough into the square for its body to clear the buildings
            const inward = Math.max(0, def.radius - TILE / 2 + 2);
            const point = { x: street.x - street.outX * inward, y: street.y - street.outY * inward };
            const distance = Math.hypot(point.x - player.x, point.y - player.y);
            // The street at the top of the square (under the town hall) is its grand entrance,
            // as long as the player is not standing near it; failing that, the furthest street
            const top = street.outY < 0 && distance >= clear;
            if (grand ? top && distance > spotDistance : top || distance > spotDistance) {
                spot = point;
                spotDistance = distance;
                grand = top;
            }
        }
        const point = spot ?? this.farthestCell(def);

        const telegraph = SPAWN.telegraph * BOSS_ENTRY.telegraphScale;
        this.scene.game.events.emit(Events.MONSTER_SPAWNING, point.x, point.y);
        const marker = closingRing(this.scene, point.x, point.y, def.radius + 6, 0xffffff, telegraph);
        marker.setFillStyle(def.color, 0.25);
        this.later(telegraph, marker, () => {
            // If he has walked right up to the marker, it comes in by the far side instead
            const crowded = Math.hypot(point.x - player.x, point.y - player.y) < SPAWN.crowdedDistance + def.radius;
            if (crowded && this.streets.length > 1) {
                this.placeBoss(def);
                return;
            }
            createMonster(this.scene, def.id, point.x, point.y, this.world);
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

            if (def.class === 'boss') {
                this.placeBoss(def);
                continue;
            }
            if (this.streets.length > 0) {
                this.sendUpStreets(def, group.count);
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

    /** A wave's group arrives by the streets in parties, each party by a different street while there are enough */
    private sendUpStreets(def: MonsterDef, count: number) {
        const party =
            def.radius < MEDIUM_RADIUS ? PARTY.small : def.radius < LARGE_RADIUS ? PARTY.medium : PARTY.large;
        const streets = Phaser.Utils.Array.Shuffle(this.farStreets());
        // Not always the same street first for every group of the wave
        let next = Phaser.Math.Between(0, streets.length - 1);
        for (let left = count; left > 0; left -= party) {
            this.spawnFromEntry(def.id, Math.min(party, left), streets[next++ % streets.length]);
        }
    }

    /** Show the marker, wait, then put the monster there (or move it if the player is in the way) */
    private announce(def: MonsterDef, point: Point, retries: number) {
        this.scene.game.events.emit(Events.MONSTER_SPAWNING, point.x, point.y);
        const marker = closingRing(this.scene, point.x, point.y, def.radius + 3, 0xffffff, SPAWN.telegraph);
        marker.setFillStyle(def.color, 0.25);

        this.later(SPAWN.telegraph, marker, () => {
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
        // A body wider than a tile may have no cell of its own size (the player is standing by a
        // wall); any open tile is better than landing on top of him
        let cells = nav.reachableCells(def.radius);
        if (cells.length === 0) {
            cells = nav.reachableCells(0);
        }
        for (const cell of cells) {
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

/** Group a room's e tiles into streets: tiles that touch are one opening */
function findStreets(room: RoomDef): Street[] {
    const { entries } = parseRoom(room.layout);
    const isWall = (col: number, row: number) => {
        const char = room.layout[row]?.[col];
        return char === undefined || char === '#' || char === 'S';
    };

    const streets: Street[] = [];
    const used = new Set<(typeof entries)[number]>();
    for (const first of entries) {
        if (used.has(first)) {
            continue;
        }
        const group = [first];
        used.add(first);
        for (let i = 0; i < group.length; i++) {
            for (const other of entries) {
                const touching = Math.abs(other.col - group[i].col) + Math.abs(other.row - group[i].row) === 1;
                if (touching && !used.has(other)) {
                    used.add(other);
                    group.push(other);
                }
            }
        }

        // Out is towards whichever side of the opening is wall for every tile in it
        let outX = 0;
        let outY = 0;
        for (const [dc, dr] of [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
        ]) {
            if (group.every((tile) => isWall(tile.col + dc, tile.row + dr))) {
                outX = dc;
                outY = dr;
                break;
            }
        }

        const tiles = group.map((tile) => ({ x: tile.x + TILE / 2, y: tile.y + TILE / 2 }));
        streets.push({
            x: tiles.reduce((sum, tile) => sum + tile.x, 0) / tiles.length,
            y: tiles.reduce((sum, tile) => sum + tile.y, 0) / tiles.length,
            tiles,
            outX,
            outY,
        });
    }
    return streets;
}
