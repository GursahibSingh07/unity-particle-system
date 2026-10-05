import Phaser from 'phaser';
import { HAZARD } from '../config/monsters';
import { Events } from '../events';
import type { ArtStyle } from '../types';
import type { Player } from './Player';

export type HazardKind = 'ice' | 'acid';

/** Frame of `hazards-{style}` for each kind (src/art/v2/sheets.ts) */
const FRAMES: Record<HazardKind, number> = { ice: 0, acid: 1 };
/** Above the floor, below everything that stands on it */
const HAZARD_DEPTH = 1;
const APPEAR_MS = 160;
/** His feet are below the centre of his sprite */
const FOOT_DROP = 3;

/** Fill and outline of the drawn stand-in, until `hazards-{style}` exists */
function standInColors(kind: HazardKind, style: ArtStyle): [number, number] {
    if (style === 'manga') {
        // Black and white only: ice is a pale sheet, acid a dark stain
        return kind === 'ice' ? [0xffffff, 0x111111] : [0x3a3a3a, 0xffffff];
    }
    return kind === 'ice' ? [0xa8e0ff, 0x4a9fd0] : [0x8fd43a, 0x2f5a12];
}

interface Patch {
    kind: HazardKind;
    x: number;
    y: number;
    radius: number;
    view: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
    /** Scale at which `view` covers `radius` */
    fullScale: number;
    bornAt: number;
    diesAt: number;
}

/**
 * The ice patches and acid pools of one room. Ice slows the player and makes him slide; acid
 * burns him while he stands in it. A dash carries him over both.
 *
 * The Game scene makes one per room, calls update() every frame, setStyle() on an era swap and
 * clear() when the room ends. Enemies reach it through Hazards.of(scene).
 */
export class Hazards {
    private static rooms = new WeakMap<Phaser.Scene, Hazards>();

    /** The current room's hazards, if the scene has any */
    static of(scene: Phaser.Scene) {
        return Hazards.rooms.get(scene);
    }

    private patches: Patch[] = [];
    private on: Record<HazardKind, boolean> = { ice: false, acid: false };
    /** Set by clear(): the room is over and nothing more may be left on its floor */
    private closed = false;

    // Ice: what speedScale was before the slow, and what it was set to
    private speedBefore = 1;
    private speedApplied = 1;
    private slowed = false;
    private slideX = 0;
    private slideY = 0;

    private nextBurnAt = 0;

    constructor(
        private scene: Phaser.Scene,
        private player: Player,
        private style: ArtStyle,
    ) {
        Hazards.rooms.set(scene, this);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.clear();
            if (Hazards.rooms.get(scene) === this) {
                Hazards.rooms.delete(scene);
            }
        });
    }

    get count() {
        return this.patches.length;
    }

    /** True while the player is standing on a hazard of this kind */
    isOn(kind: HazardKind) {
        return this.on[kind];
    }

    /** Leave a patch on the floor. One landing on another of its kind renews it instead. */
    add(kind: HazardKind, x: number, y: number) {
        if (this.closed) {
            return;
        }
        const now = this.scene.time.now;
        const tuning = HAZARD[kind];
        for (const patch of this.patches) {
            if (patch.kind === kind && Math.hypot(patch.x - x, patch.y - y) <= HAZARD.merge) {
                patch.diesAt = now + tuning.lifetime;
                return;
            }
        }
        if (this.patches.length >= HAZARD.cap) {
            this.remove(this.patches[0]);
        }

        const patch: Patch = {
            kind,
            x,
            y,
            radius: tuning.radius,
            view: null as unknown as Patch['view'],
            fullScale: 1,
            bornAt: now,
            diesAt: now + tuning.lifetime,
        };
        this.draw(patch);
        this.patches.push(patch);
    }

    update(delta: number) {
        const now = this.scene.time.now;
        const { player } = this;
        // A dash carries him clean over whatever is on the floor
        const grounded = !player.isDead && !this.playerIsDashing();
        const footY = player.y + FOOT_DROP;

        let onIce = false;
        let onAcid = false;
        for (let i = this.patches.length - 1; i >= 0; i--) {
            const patch = this.patches[i];
            if (now >= patch.diesAt) {
                this.remove(patch);
                continue;
            }
            const age = now - patch.bornAt;
            const left = patch.diesAt - now;
            patch.view.setScale(patch.fullScale * (age < APPEAR_MS ? 0.3 + (0.7 * age) / APPEAR_MS : 1));
            patch.view.setAlpha(left < HAZARD.fade ? left / HAZARD.fade : 1);

            if (grounded && (!onIce || !onAcid)) {
                const dx = player.x - patch.x;
                const dy = footY - patch.y;
                if (dx * dx + dy * dy <= patch.radius * patch.radius) {
                    if (patch.kind === 'ice') {
                        onIce = true;
                    } else {
                        onAcid = true;
                    }
                }
            }
        }

        this.setOn('ice', onIce);
        this.setOn('acid', onAcid);
        this.updateIce(onIce, delta);
        if (onAcid && now >= this.nextBurnAt && player.hurt(HAZARD.acid.damage)) {
            this.nextBurnAt = now + HAZARD.acid.tick;
        }
    }

    /** Redraw every patch in another art style (the boss changes the era mid-fight) */
    setStyle(style: ArtStyle) {
        if (style === this.style) {
            return;
        }
        this.style = style;
        for (const patch of this.patches) {
            patch.view.destroy();
            this.draw(patch);
        }
    }

    /** The room is over: take everything off the floor and give the player his speed back */
    clear() {
        this.closed = true;
        for (const patch of this.patches) {
            patch.view.destroy();
        }
        this.patches.length = 0;
        this.setOn('ice', false);
        this.setOn('acid', false);
        this.releaseSpeed();
    }

    private draw(patch: Patch) {
        const key = `hazards-${this.style}`;
        if (this.scene.textures.exists(key)) {
            const image = this.scene.add.image(patch.x, patch.y, key, FRAMES[patch.kind]);
            // The frame is drawn to fill its square; show it as wide as the patch really is
            patch.fullScale = (patch.radius * 2) / image.width;
            patch.view = image;
        } else {
            const [fill, edge] = standInColors(patch.kind, this.style);
            patch.fullScale = 1;
            patch.view = this.scene.add
                .circle(patch.x, patch.y, patch.radius, fill, patch.kind === 'ice' ? 0.6 : 0.65)
                .setStrokeStyle(1, edge, 0.85);
        }
        patch.view.setDepth(HAZARD_DEPTH).setScale(patch.fullScale);
    }

    private remove(patch: Patch) {
        patch.view.destroy();
        Phaser.Utils.Array.Remove(this.patches, patch);
    }

    private setOn(kind: HazardKind, on: boolean) {
        if (this.on[kind] === on) {
            return;
        }
        this.on[kind] = on;
        if (on && kind === 'acid') {
            this.nextBurnAt = this.scene.time.now + HAZARD.acid.grace;
        }
        this.scene.game.events.emit(Events.HAZARD, kind, on);
    }

    /**
     * Ice multiplies into player.speedScale and takes itself out again exactly. Others set that
     * value too (the machine while charging), so whenever it is not what was left here, it is
     * taken as the new starting point rather than divided.
     */
    private updateIce(onIce: boolean, delta: number) {
        const { player } = this;
        const velocity = player.body.velocity;
        if (!onIce) {
            this.releaseSpeed();
            this.slideX = velocity.x;
            this.slideY = velocity.y;
            return;
        }

        if (!this.slowed || player.speedScale !== this.speedApplied) {
            this.speedBefore = player.speedScale;
            this.speedApplied = this.speedBefore * HAZARD.ice.slow;
            player.speedScale = this.speedApplied;
            this.slowed = true;
        }
        if (player.frozen) {
            return;
        }
        // Slippery: his velocity trails behind what the keys ask for
        const blend = 1 - Math.exp(-delta / HAZARD.ice.grip);
        this.slideX += (velocity.x - this.slideX) * blend;
        this.slideY += (velocity.y - this.slideY) * blend;
        player.body.setVelocity(this.slideX, this.slideY);
    }

    private releaseSpeed() {
        if (!this.slowed) {
            return;
        }
        this.slowed = false;
        if (this.player.speedScale === this.speedApplied) {
            this.player.speedScale = this.speedBefore;
        }
    }

    private playerIsDashing() {
        // The dash is being built alongside this; a player without one is simply never dashing
        return (this.player as unknown as { isDashing?: boolean }).isDashing === true;
    }
}
