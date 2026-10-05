import Phaser from 'phaser';
import { DEPTH, UNDERLAY, puff } from '../entities/effects';
import { getSettings } from '../settings';

// What the five rays look like. Nothing here decides what is hit: the EMW Machine works that
// out and hands over the shapes. Every bright stroke sits on a dark one, so the rays read on
// the pale paving of the Golden era and the manga page as well as on the dark ones.

/** On the paving, under everything that walks */
const GROUND_DEPTH = 1.6;

export interface FxPoint {
    x: number;
    y: number;
}

/** Shake the camera, unless the player has turned screen shake off */
export function shake(scene: Phaser.Scene, duration: number, intensity: number) {
    if (getSettings().screenShake) {
        scene.cameras.main.shake(duration, intensity);
    }
}

/** Run `draw` with a value going 0 to 1 over `duration` on a throwaway Graphics */
function animate(
    scene: Phaser.Scene,
    duration: number,
    draw: (graphics: Phaser.GameObjects.Graphics, t: number) => void,
    depth = DEPTH.effect,
) {
    const graphics = scene.add.graphics().setDepth(depth);
    draw(graphics, 0);
    scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        onUpdate: (tween) => {
            graphics.clear();
            draw(graphics, tween.getValue() ?? 1);
        },
        onComplete: () => graphics.destroy(),
    });
    return graphics;
}

/** The fan's outline, pulled in towards its origin: scale 1 is the fan itself */
function scaled(origin: FxPoint, rim: FxPoint[], scale: number) {
    return rim.map(
        (point) =>
            new Phaser.Math.Vector2(origin.x + (point.x - origin.x) * scale, origin.y + (point.y - origin.y) * scale),
    );
}

/**
 * Blue: a solid flash that snaps out to fill the cone and is gone. `rim` is the far edge of the
 * cone, already cut short where walls and ray-blockers stop it.
 */
export function blueCone(scene: Phaser.Scene, origin: FxPoint, rim: FxPoint[], color: number, duration: number) {
    const apex = new Phaser.Math.Vector2(origin.x, origin.y);
    animate(scene, duration, (graphics, t) => {
        // Out fast, then fade
        const reach = 0.45 + 0.55 * Phaser.Math.Easing.Cubic.Out(Math.min(1, t * 2.4));
        const fade = 1 - Phaser.Math.Easing.Quadratic.In(t);
        const edge = scaled(origin, rim, reach);
        const shape = [apex, ...edge];

        graphics.lineStyle(3, UNDERLAY.color, UNDERLAY.alpha * fade);
        graphics.strokePoints(shape, true);
        graphics.fillStyle(color, 0.6 * fade);
        graphics.fillPoints(shape, true);
        // A hot core down the middle and a bright leading edge
        graphics.fillStyle(0xffffff, 0.5 * fade);
        graphics.fillPoints([apex, ...scaled(origin, rim.slice(Math.floor(rim.length / 3), Math.ceil((rim.length * 2) / 3) + 1), reach * 0.8)], true);
        graphics.lineStyle(1.5, 0xffffff, 0.95 * fade);
        graphics.strokePoints(edge, false);
    });
}

/**
 * UV: no solid flash, only pale violet ripples running out through the cone, so it looks like
 * a lamp being swept over the ground and not like a weapon.
 */
export function uvCone(scene: Phaser.Scene, origin: FxPoint, rim: FxPoint[], color: number, duration: number) {
    const apex = new Phaser.Math.Vector2(origin.x, origin.y);
    const ripples = 4;
    animate(scene, duration, (graphics, t) => {
        const fade = 1 - Phaser.Math.Easing.Quadratic.In(t);
        const shape = [apex, ...scaled(origin, rim, 1)];
        graphics.lineStyle(2.5, UNDERLAY.color, UNDERLAY.alpha * 0.7 * fade);
        graphics.strokePoints(shape, true);
        graphics.fillStyle(color, 0.22 * fade);
        graphics.fillPoints(shape, true);
        graphics.lineStyle(1, color, 0.8 * fade);
        graphics.strokePoints(shape, true);

        for (let i = 0; i < ripples; i++) {
            // Each ripple starts further out and they all drift outwards together
            const at = (i + 0.4 + t * 1.6) / ripples;
            if (at > 1) {
                continue;
            }
            const arc = scaled(origin, rim, at);
            graphics.lineStyle(2.5, UNDERLAY.color, UNDERLAY.alpha * 0.6 * fade);
            graphics.strokePoints(arc, false);
            graphics.lineStyle(1.2, i % 2 === 0 ? 0xffffff : color, 0.9 * fade);
            graphics.strokePoints(arc, false);
        }
    });
}

/** UV fell on something that is not hiding: a small grey shrug, so the player sees it did nothing */
export function fizz(scene: Phaser.Scene, x: number, y: number) {
    animate(scene, 260, (graphics, t) => {
        const fade = 1 - t;
        const radius = 5 - 3 * t;
        graphics.lineStyle(2.5, UNDERLAY.color, UNDERLAY.alpha * fade);
        graphics.strokeCircle(x, y, radius);
        graphics.lineStyle(1, 0xb9b4c6, 0.9 * fade);
        graphics.strokeCircle(x, y, radius);
        // Three dull motes that sink instead of flying outwards
        for (let i = -1; i <= 1; i++) {
            const moteX = x + i * 3.5;
            const moteY = y + 2 + t * 5 + Math.abs(i);
            graphics.fillStyle(UNDERLAY.color, UNDERLAY.alpha * fade);
            graphics.fillRect(moteX - 1, moteY - 1, 2, 2);
            graphics.fillStyle(0x8f8a9c, fade);
            graphics.fillRect(moteX - 0.5, moteY - 0.5, 1, 1);
        }
    });
}

/**
 * Red: drawn afresh every frame into the machine's own Graphics. A bright core in a red sheath
 * that narrows from `nearWidth` to `endWidth`, so the player can see it weaken with distance.
 */
export function redBeam(
    graphics: Phaser.GameObjects.Graphics,
    from: FxPoint,
    to: FxPoint,
    color: number,
    nearWidth: number,
    endWidth: number,
    now: number,
) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    // A quick flutter keeps it alive without changing what it touches
    const flutter = 0.88 + 0.12 * Math.sin(now / 22);

    const taper = (near: number, far: number) => [
        new Phaser.Math.Vector2(from.x + nx * near, from.y + ny * near),
        new Phaser.Math.Vector2(to.x + nx * far, to.y + ny * far),
        new Phaser.Math.Vector2(to.x - nx * far, to.y - ny * far),
        new Phaser.Math.Vector2(from.x - nx * near, from.y - ny * near),
    ];
    const near = (nearWidth / 2) * flutter;
    const far = (endWidth / 2) * flutter;

    graphics.fillStyle(UNDERLAY.color, UNDERLAY.alpha);
    graphics.fillPoints(taper(near + 1.2, far + 1), true);
    graphics.fillStyle(color, 0.95);
    graphics.fillPoints(taper(near, far), true);
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillPoints(taper(near * 0.4, far * 0.35), true);

    // Where it lands: a hot spot whose size also tells how much is left of it
    const spot = 1.2 + far * 1.4 + Math.sin(now / 35) * 0.5;
    graphics.fillStyle(UNDERLAY.color, UNDERLAY.alpha);
    graphics.fillCircle(to.x, to.y, spot + 1);
    graphics.fillStyle(color, 0.95);
    graphics.fillCircle(to.x, to.y, spot);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(to.x, to.y, spot * 0.5);
    // And where it leaves the machine
    graphics.fillStyle(color, 0.9);
    graphics.fillCircle(from.x, from.y, near + 0.8);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(from.x, from.y, near * 0.6);
}

/**
 * Green being charged, drawn every frame at the machine's tip: a ball that swells inside a ring
 * that closes on it, and flickers white once it is full.
 */
export function greenCharge(
    graphics: Phaser.GameObjects.Graphics,
    tip: FxPoint,
    progress: number,
    ready: boolean,
    color: number,
    now: number,
) {
    const full = progress >= 1;
    const flicker = full && Math.floor(now / 70) % 2 === 0;
    const radius = 1.5 + progress * 3 + (full ? Math.sin(now / 60) * 0.5 : 0);

    // The ring closes in as the charge builds; it goes solid once the blob is big enough to fire
    const ring = radius + 2 + (1 - progress) * 7;
    graphics.lineStyle(2.5, UNDERLAY.color, UNDERLAY.alpha * (0.4 + progress * 0.6));
    graphics.strokeCircle(tip.x, tip.y, ring);
    graphics.lineStyle(1, ready ? color : 0xb9b4c6, 0.4 + progress * 0.6);
    graphics.strokeCircle(tip.x, tip.y, ring);

    graphics.fillStyle(UNDERLAY.color, UNDERLAY.alpha);
    graphics.fillCircle(tip.x, tip.y, radius + 1.2);
    graphics.fillStyle(flicker ? 0xffffff : color, 0.95);
    graphics.fillCircle(tip.x, tip.y, radius);
    graphics.fillStyle(0xffffff, 0.85);
    graphics.fillCircle(tip.x - radius * 0.3, tip.y - radius * 0.3, radius * 0.35);
}

/** Green in flight: a wobbling blob that drips behind itself */
export class BlobSprite {
    private graphics: Phaser.GameObjects.Graphics;
    private nextDripAt = 0;

    constructor(
        private scene: Phaser.Scene,
        private color: number,
        private radius: number,
        private angle: number,
    ) {
        this.graphics = scene.add.graphics().setDepth(DEPTH.effect);
    }

    draw(x: number, y: number, now: number) {
        const graphics = this.graphics;
        // Squash and stretch along the way it is going
        const wobble = Math.sin(now / 45);
        const long = this.radius * (1.25 + wobble * 0.22);
        const wide = this.radius * (0.95 - wobble * 0.18);

        graphics.clear();
        graphics.setPosition(x, y).setRotation(this.angle);
        graphics.fillStyle(UNDERLAY.color, UNDERLAY.alpha + 0.2);
        graphics.fillEllipse(0, 0, (long + 1.3) * 2, (wide + 1.3) * 2);
        graphics.fillStyle(this.color, 1);
        graphics.fillEllipse(0, 0, long * 2, wide * 2);
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillEllipse(long * 0.25, -wide * 0.3, long * 0.7, wide * 0.5);

        if (now >= this.nextDripAt) {
            this.nextDripAt = now + 38;
            this.drip(x, y);
        }
    }

    destroy() {
        this.graphics.destroy();
    }

    private drip(x: number, y: number) {
        const size = this.radius * Phaser.Math.FloatBetween(0.35, 0.6);
        const offset = Phaser.Math.FloatBetween(-1.5, 1.5);
        const drop = this.scene.add
            .circle(x - Math.sin(this.angle) * offset, y + Math.cos(this.angle) * offset, size, this.color, 0.85)
            .setStrokeStyle(1, UNDERLAY.color, UNDERLAY.alpha)
            .setDepth(DEPTH.effect);
        this.scene.tweens.add({
            targets: drop,
            scale: 0.2,
            alpha: 0,
            duration: 240,
            onComplete: () => drop.destroy(),
        });
    }
}

/** Green bursting: a splash out to the burst radius, and a puddle that lingers for `puddleMs` */
export function greenSplash(scene: Phaser.Scene, x: number, y: number, radius: number, color: number, puddleMs: number) {
    animate(scene, 240, (graphics, t) => {
        const out = Phaser.Math.Easing.Cubic.Out(t);
        const fade = 1 - Phaser.Math.Easing.Quadratic.In(t);
        const reach = radius * (0.25 + 0.75 * out);
        graphics.fillStyle(color, 0.5 * fade);
        graphics.fillCircle(x, y, reach);
        graphics.lineStyle(4, UNDERLAY.color, UNDERLAY.alpha * fade);
        graphics.strokeCircle(x, y, reach);
        graphics.lineStyle(2, color, fade);
        graphics.strokeCircle(x, y, reach);
        graphics.fillStyle(0xffffff, 0.8 * fade);
        graphics.fillCircle(x, y, reach * 0.3 * (1 - t));
    });
    puff(scene, x, y, color, 9, radius);

    if (puddleMs <= 0) {
        return;
    }
    // Under everything that walks. A handful of fixed blots, so it looks spilt and not stamped.
    const blots: { x: number; y: number; size: number }[] = [{ x: 0, y: 0, size: radius * 0.62 }];
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.4, 0.4);
        const distance = radius * Phaser.Math.FloatBetween(0.45, 0.72);
        blots.push({
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            size: radius * Phaser.Math.FloatBetween(0.2, 0.34),
        });
    }
    animate(
        scene,
        puddleMs,
        (graphics, t) => {
            const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
            for (const [grow, tint, alpha] of [
                [1.2, UNDERLAY.color, UNDERLAY.alpha * 0.8],
                [0, color, 0.45],
            ]) {
                graphics.fillStyle(tint, alpha * fade);
                for (const blot of blots) {
                    graphics.fillCircle(x + blot.x, y + blot.y, blot.size + grow);
                }
            }
        },
        GROUND_DEPTH,
    );
}

/** A charge let go too early: a few drops fall off the machine */
export function greenFizzle(scene: Phaser.Scene, x: number, y: number, color: number) {
    puff(scene, x, y, color, 3, 5);
}

/**
 * White: a thick ring that bursts out from the Handler to the edge of the push, with a second,
 * thinner one chasing it.
 */
export function whiteRing(scene: Phaser.Scene, x: number, y: number, radius: number, color: number, duration: number) {
    animate(scene, duration, (graphics, t) => {
        const out = Phaser.Math.Easing.Cubic.Out(t);
        const fade = 1 - Phaser.Math.Easing.Quadratic.In(t);
        const reach = radius * (0.2 + 0.8 * out);
        const width = 6 - 4 * t;

        graphics.fillStyle(color, 0.28 * (1 - out));
        graphics.fillCircle(x, y, reach);
        graphics.lineStyle(width + 2.5, UNDERLAY.color, (UNDERLAY.alpha + 0.15) * fade);
        graphics.strokeCircle(x, y, reach);
        graphics.lineStyle(width, color, fade);
        graphics.strokeCircle(x, y, reach);
        graphics.lineStyle(Math.max(1, width * 0.35), 0xffffff, fade);
        graphics.strokeCircle(x, y, reach);

        const chase = radius * 0.8 * Phaser.Math.Easing.Quadratic.Out(Math.max(0, t * 1.4 - 0.4));
        if (chase > 2) {
            graphics.lineStyle(2.5, UNDERLAY.color, UNDERLAY.alpha * fade);
            graphics.strokeCircle(x, y, chase);
            graphics.lineStyle(1, color, 0.9 * fade);
            graphics.strokeCircle(x, y, chase);
        }
    });
}

/** A beam or a blob met a wall */
export function wallSpark(scene: Phaser.Scene, x: number, y: number, color: number) {
    puff(scene, x, y, color, 3, 6);
}

/** A short flash at the machine's tip as a shot leaves it */
export function muzzleFlash(scene: Phaser.Scene, x: number, y: number, color: number) {
    animate(scene, 90, (graphics, t) => {
        const radius = 2 + 3 * t;
        graphics.fillStyle(UNDERLAY.color, UNDERLAY.alpha * (1 - t));
        graphics.fillCircle(x, y, radius + 1);
        graphics.fillStyle(color, 1 - t);
        graphics.fillCircle(x, y, radius);
        graphics.fillStyle(0xffffff, 1 - t);
        graphics.fillCircle(x, y, radius * 0.5);
    });
}
