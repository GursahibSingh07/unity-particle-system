import type Phaser from 'phaser';
import { fitCircleBody, worldScale } from '../systems/artScale';
import type { ArtStyle, MonsterDef, MonsterId } from '../types';
import { Monster, type MonsterWorld } from './Monster';

/** Whose sheet an enemy wears, and how much bigger, until its own art has been drawn */
const BORROWS: Partial<Record<MonsterId, { from: MonsterId; scale: number }>> = {
    wraith: { from: 'ghost', scale: 1 },
    snowman: { from: 'ironclad', scale: 1 },
    acidSlime: { from: 'slime', scale: 1.4 },
};

/**
 * A monster that can borrow another's sheet, tinted its own colour, while `{id}-{style}` does
 * not exist yet. Once the real art is baked this class does nothing at all.
 */
export class StandInMonster extends Monster {
    /** The texture key in use when it is not this monster's own */
    private borrowed: string | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, world: MonsterWorld) {
        super(scene, x, y, def, world);
        this.borrow(0);
    }

    setStyle(style: ArtStyle) {
        if (this.scene.textures.exists(`${this.def.id}-${style}`)) {
            this.borrowed = null;
            super.setStyle(style);
            this.applyTint();
            return;
        }
        if (style === this.style) {
            return;
        }
        const frame = Number(this.frame.name);
        const moving = this.anims.isPlaying;
        this.style = style;
        this.borrow(Number.isFinite(frame) ? frame : 0, moving);
    }

    protected playMove() {
        // Called by the base constructor too, before `borrowed` exists
        if (!this.borrowed) {
            super.playMove();
            return;
        }
        const key = `${this.borrowed}-move`;
        if (this.scene.anims.exists(key)) {
            this.play(key, true);
        }
    }

    protected baseTint(): number | null {
        return this.borrowed ? this.def.color : null;
    }

    private borrow(frame: number, moving = true) {
        const loan = BORROWS[this.def.id];
        const own = `${this.def.id}-${this.style}`;
        if (!loan || this.scene.textures.exists(own)) {
            this.borrowed = null;
            return;
        }
        const key = `${loan.from}-${this.style}`;
        if (!this.scene.textures.exists(key)) {
            return;
        }
        this.borrowed = key;
        this.anims.stop();
        this.setTexture(key);
        this.showFrame(frame);
        worldScale(this, loan.scale);
        fitCircleBody(this, this.def.radius);
        this.applyTint();
        if (moving) {
            this.playMove();
        }
    }
}
