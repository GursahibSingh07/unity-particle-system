import Phaser from 'phaser';
import { BAT, FLIGHT, ZIGBAT } from '../config/monsters';
import type { MonsterDef } from '../types';
import { Monster, type MonsterWorld } from './Monster';

/** Flies straight at the player, over the fountain and the lamp posts. Only walls turn it. */
export class Bat extends Monster {
    protected phase = Math.random() * Math.PI * 2;
    private speed: number;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.speed = def.speed * (1 + Phaser.Math.FloatBetween(-BAT.speedSpread, BAT.speedSpread));
        this.personalSpace = BAT.separation;
    }

    get flying() {
        return true;
    }

    protected behave(now: number, delta: number) {
        const target = this.routeToPlayer(now);
        const distance = Math.hypot(target.x - this.x, target.y - this.y);
        if (distance < 0.5) {
            this.steer(0, this.flutter(now), delta);
            return;
        }
        this.steer(
            ((target.x - this.x) / distance) * this.speed,
            ((target.y - this.y) / distance) * this.speed + this.flutter(now),
            delta,
        );
    }

    /** The up-and-down speed that makes it bob, so it reads as being in the air */
    protected flutter(now: number) {
        return Math.cos(now * FLIGHT.bobRate + this.phase) * FLIGHT.bob * FLIGHT.bobRate * 1000;
    }
}

/**
 * A fast flyer that comes in tacking hard from side to side: a thin beam keeps missing it,
 * a cone or a blob does not.
 */
export class ZigBat extends Bat {
    private legOffset = Math.random() * ZIGBAT.period;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.personalSpace = ZIGBAT.separation;
    }

    protected behave(now: number, delta: number) {
        const target = this.routeToPlayer(now);
        const distance = Math.hypot(target.x - this.x, target.y - this.y);
        if (distance < 0.5) {
            this.steer(0, this.flutter(now), delta);
            return;
        }
        const forwardX = (target.x - this.x) / distance;
        const forwardY = (target.y - this.y) / distance;
        const speed = this.def.speed;
        // Full tilt one way, then full tilt the other: the corners are what make it a zig-zag
        const leg = ((now + this.legOffset) % ZIGBAT.period) * 2 < ZIGBAT.period ? 1 : -1;
        const swing = distance > ZIGBAT.straightenWithin ? leg * ZIGBAT.swing : 0;
        this.steer(
            (forwardX - forwardY * swing) * speed,
            (forwardY + forwardX * swing) * speed + this.flutter(now),
            delta,
        );
    }
}
