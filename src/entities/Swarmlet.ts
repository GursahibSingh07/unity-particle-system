import Phaser from 'phaser';
import { SWARMLET } from '../config/monsters';
import type { MonsterDef } from '../types';
import { Monster, type MonsterWorld } from './Monster';

/** Small and weak alone; arrives as a loose, weaving flock that closes in from all sides. */
export class Swarmlet extends Monster {
    private phase = Math.random() * Math.PI * 2;
    private speed: number;
    /** This one's own spot on a circle around the player */
    private slot = Math.random() * Math.PI * 2;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.speed = def.speed * (1 + Phaser.Math.FloatBetween(-SWARMLET.speedSpread, SWARMLET.speedSpread));
        this.personalSpace = SWARMLET.separation;
    }

    protected behave(now: number, delta: number) {
        const target = this.routeToPlayer(now);
        let { x, y } = target;
        if (target.direct && this.distanceToPlayer() > SWARMLET.commitDistance) {
            x += Math.cos(this.slot) * SWARMLET.encircleRadius;
            y += Math.sin(this.slot) * SWARMLET.encircleRadius;
        }

        const distance = Math.hypot(x - this.x, y - this.y);
        if (distance < 0.5) {
            this.steer(0, 0, delta);
            return;
        }
        const forwardX = (x - this.x) / distance;
        const forwardY = (y - this.y) / distance;
        // Weave from side to side, less so through gaps where it would only scrape walls
        const weave = Math.sin(now * SWARMLET.wobbleRate + this.phase) * SWARMLET.wobble * (target.direct ? 1 : 0.35);
        this.steer(
            (forwardX - forwardY * weave) * this.speed,
            (forwardY + forwardX * weave) * this.speed,
            delta,
        );
    }
}
