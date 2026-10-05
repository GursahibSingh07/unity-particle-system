import Phaser from 'phaser';
import { SLIME } from '../config/monsters';
import type { MonsterDef } from '../types';
import { Monster, type MonsterWorld } from './Monster';

type SlimeState = 'rest' | 'crouch' | 'hop';

const CROUCH_FRAME = 1;

/** Comes on in hops: a squat, a short quick jump, a sit. The sits are when to step aside. */
export class Slime extends Monster {
    private mode: SlimeState = 'rest';
    private modeUntil: number;
    private hopX = 0;
    private hopY = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.personalSpace = SLIME.separation;
        // Out of step with each other from the start, so a group does not land as one
        this.modeUntil = scene.time.now + Math.random() * SLIME.rest[1];
        this.showFrame(0);
    }

    protected behave(now: number, delta: number) {
        switch (this.mode) {
            case 'rest':
                this.steer(0, 0, delta);
                if (now >= this.modeUntil) {
                    this.mode = 'crouch';
                    this.modeUntil = now + SLIME.crouch;
                    this.showFrame(CROUCH_FRAME);
                }
                break;
            case 'crouch':
                this.steer(0, 0, delta);
                if (now >= this.modeUntil) {
                    this.startHop(now);
                }
                break;
            case 'hop':
                // Set every frame: a wall or a shove may have taken the speed off
                this.body.setVelocity(this.hopX, this.hopY);
                if (now >= this.modeUntil) {
                    this.mode = 'rest';
                    this.modeUntil = now + Phaser.Math.Between(SLIME.rest[0], SLIME.rest[1]);
                    this.showFrame(0);
                }
                break;
        }
    }

    private startHop(now: number) {
        // The direction is fixed as it leaves the ground
        const target = this.routeToPlayer(now);
        const distance = Math.hypot(target.x - this.x, target.y - this.y) || 1;
        this.hopX = ((target.x - this.x) / distance) * SLIME.hopSpeed;
        this.hopY = ((target.y - this.y) / distance) * SLIME.hopSpeed;
        this.mode = 'hop';
        // A short hop when it is nearly there, so it lands on the spot rather than sailing past
        this.modeUntil = now + Math.min(SLIME.hopTime, (distance / SLIME.hopSpeed) * 1000 + 50);
        this.playMove();
    }
}
