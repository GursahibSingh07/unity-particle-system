import type Phaser from 'phaser';
import { ART_SCALE } from '../config/world';

type Sized = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

/** Show a sprite at world size. Every world sprite must go through this (or setScale(ART_SCALE)). */
export function worldScale<T extends Sized>(sprite: T, factor = 1): T {
    sprite.setScale(ART_SCALE * factor);
    return sprite;
}

/**
 * Give a scaled sprite a circular physics body of `radius` world units, centred on it.
 * Arcade bodies are sized in texture pixels and then multiplied by the sprite's scale, so the
 * numbers passed to setCircle have to be divided by the scale first.
 */
export function fitCircleBody(sprite: Sized & { body: Phaser.Physics.Arcade.Body }, radius: number) {
    const scale = sprite.scaleX || 1;
    const texels = radius / scale;
    sprite.body.setCircle(texels, sprite.width / 2 - texels, sprite.height / 2 - texels);
}
