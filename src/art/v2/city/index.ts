import type Phaser from 'phaser';
import type { ArtStyle } from '../../../types';
import { CITY_HEIGHT, CITY_WIDTH, TILE } from './plan';
import { paintCity, paintCrack } from './scene';

// The city square, drawn in code once per era. See looks.ts for what each era keeps and
// scene.ts for how the picture is put together.

const STYLES: ArtStyle[] = ['goldenAge', 'cyberpunk', 'retro', 'manga', 'plain'];

export { paintCity, paintCrack };

/** Bakes `city-{style}`, `city-{style}-over` and `crack-{style}` for every style */
export function bakeCity(scene: Phaser.Scene): void {
    for (const style of STYLES) {
        const baseKey = `city-${style}`;
        const overKey = `city-${style}-over`;
        const crackKey = `crack-${style}`;

        // Scenes can restart, and the gallery bakes too
        if (!scene.textures.exists(baseKey) || !scene.textures.exists(overKey)) {
            const { base, over } = paintCity(style);
            for (const [key, picture] of [[baseKey, base], [overKey, over]] as const) {
                if (scene.textures.exists(key)) {
                    continue;
                }
                const texture = scene.textures.createCanvas(key, CITY_WIDTH, CITY_HEIGHT);
                if (texture) {
                    picture.blit(texture.getContext());
                    texture.refresh();
                }
            }
        }

        if (!scene.textures.exists(crackKey)) {
            const texture = scene.textures.createCanvas(crackKey, TILE * 2, TILE);
            if (texture) {
                paintCrack(style).blit(texture.getContext());
                // Numeric frame names, so setFrame(n) works
                texture.add(0, 0, 0, 0, TILE, TILE);
                texture.add(1, 0, TILE, 0, TILE, TILE);
                texture.refresh();
            }
        }
    }
}
