import Phaser from 'phaser';

// Small, cheap, throwaway visuals. Everything here cleans itself up.

/** Draw order within the room */
export const DEPTH = {
    /** The shadow a flyer casts on the ground */
    shadow: 1.5,
    pickup: 2,
    monster: 4,
    player: 3,
    /** Bats pass over everything that walks */
    flyer: 4.5,
    projectile: 5,
    effect: 6,
};

/**
 * Drawn under every thin bright effect, so it reads on the pale floors of the Golden Age,
 * manga and plain styles as well as on the dark ones.
 */
export const UNDERLAY = { color: 0x16131f, alpha: 0.55 };

/** A burst of `spark` particles flying outwards */
export function puff(scene: Phaser.Scene, x: number, y: number, color: number, count = 6, reach = 12) {
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
        const angle = offset + (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
        const distance = reach * Phaser.Math.FloatBetween(0.6, 1);
        const spark = scene.add.image(x, y, 'spark').setTint(color).setDepth(DEPTH.effect);
        scene.tweens.add({
            targets: spark,
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance,
            alpha: 0,
            duration: Phaser.Math.Between(220, 340),
            ease: 'Quad.easeOut',
            onComplete: () => spark.destroy(),
        });
    }
}

/** A ring that closes in on a point, used to announce spawns and attacks */
export function closingRing(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    color: number,
    duration: number,
) {
    const shadow = scene.add
        .circle(x, y, radius)
        .setStrokeStyle(3, UNDERLAY.color, UNDERLAY.alpha)
        .setDepth(DEPTH.effect);
    const ring = scene.add.circle(x, y, radius).setStrokeStyle(1, color).setDepth(DEPTH.effect);
    ring.setScale(1.7);
    shadow.setScale(1.7);
    // Whoever takes the ring away early (a spawn that is called off) takes its shadow too
    ring.once(Phaser.GameObjects.Events.DESTROY, () => shadow.destroy());
    scene.tweens.add({
        targets: [ring, shadow],
        scale: 0.5,
        duration,
        ease: 'Quad.easeIn',
        onComplete: () => {
            ring.destroy();
            shadow.destroy();
        },
    });
    return ring;
}

/** A ring that opens out from a point and fades: something appeared, or was found */
export function openingRing(scene: Phaser.Scene, x: number, y: number, radius: number, color: number, duration = 420) {
    for (const [width, tint, alpha] of [
        [3, UNDERLAY.color, UNDERLAY.alpha],
        [1, color, 1],
    ]) {
        const ring = scene.add
            .circle(x, y, radius)
            .setStrokeStyle(width, tint, alpha)
            .setScale(0.2)
            .setDepth(DEPTH.effect);
        scene.tweens.add({
            targets: ring,
            scale: 1,
            alpha: 0,
            duration,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy(),
        });
    }
}
