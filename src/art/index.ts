import Phaser from 'phaser';
import type { ArtStyle } from '../types';
import { PALETTES, SHARED_PALETTE, toneAt, type Palette } from './palettes';
import type { Grid, SheetDef } from './sprites/grid';
import { HEART_SHEET, ICONS, MACHINE, SPARK_SHEET } from './sprites/items';
import { MONSTER_SHEETS, PROJECTILE } from './sprites/monsters';
import { PLAYER } from './sprites/player';
import { TILES } from './sprites/tiles';

// All of the game's art is drawn here at boot, from the character grids in ./sprites and
// the palettes in ./palettes.ts. Texture keys and frame orders are listed in docs/DESIGN.md.

export const ART_STYLES: ArtStyle[] = ['goldenAge', 'noir', 'manga', 'plain'];

/** Baked once per style, as `{key}-{style}` */
export const STYLED_SHEETS: SheetDef[] = [TILES, PLAYER, MACHINE, ...MONSTER_SHEETS, PROJECTILE];

/** Baked once, under their own key */
export const SHARED_SHEETS: SheetDef[] = [HEART_SHEET, SPARK_SHEET, ICONS];

const PLAYER_DIRECTIONS = ['down', 'up', 'left', 'right'] as const;
const TRANSPARENT = '.';

function drawGrid(
    context: CanvasRenderingContext2D,
    grid: Grid,
    palette: Palette,
    left: number,
    sheet: SheetDef,
    name: string,
) {
    if (grid.length !== sheet.height) {
        throw new Error(`${name}: ${grid.length} rows, expected ${sheet.height}`);
    }

    grid.forEach((row, y) => {
        if (row.length !== sheet.width) {
            throw new Error(`${name} row ${y}: ${row.length} wide, expected ${sheet.width}`);
        }
        for (let x = 0; x < row.length; x++) {
            const slot = row[x];
            if (slot === TRANSPARENT) {
                continue;
            }
            const tone = palette[slot];
            if (tone === undefined) {
                throw new Error(`${name} row ${y}: no palette slot '${slot}'`);
            }
            context.fillStyle = toneAt(tone, x, y);
            context.fillRect(left + x, y, 1, 1);
        }
    });
}

function bakeSheet(scene: Phaser.Scene, key: string, sheet: SheetDef, frames: Grid[], palette: Palette) {
    // Scenes can restart, and the gallery bakes too
    if (scene.textures.exists(key)) {
        return;
    }
    const texture = scene.textures.createCanvas(key, sheet.width * frames.length, sheet.height);
    if (!texture) {
        return;
    }

    const context = texture.getContext();
    frames.forEach((grid, frame) => {
        const x = frame * sheet.width;
        const under = sheet.underlay?.[frame];
        if (under !== undefined) {
            drawGrid(context, frames[under], palette, x, sheet, `${key} frame ${under}`);
        }
        drawGrid(context, grid, palette, x, sheet, `${key} frame ${frame}`);
        // Numeric frame names, so setFrame(n) and generateFrameNumbers work
        texture.add(frame, 0, x, 0, sheet.width, sheet.height);
    });
    texture.refresh();
}

function addLoop(scene: Phaser.Scene, key: string, texture: string, start: number, end: number) {
    if (scene.anims.exists(key)) {
        return;
    }
    scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(texture, { start, end }),
        frameRate: 6,
        repeat: -1,
    });
}

/** Creates every texture and animation the game uses. Call once, from the Boot scene. */
export function bakeArt(scene: Phaser.Scene): void {
    for (const style of ART_STYLES) {
        for (const sheet of STYLED_SHEETS) {
            const frames = sheet.styles?.[style] ?? sheet.frames;
            bakeSheet(scene, `${sheet.key}-${style}`, sheet, frames, PALETTES[style]);
        }

        PLAYER_DIRECTIONS.forEach((direction, i) => {
            addLoop(scene, `player-${style}-walk-${direction}`, `player-${style}`, i * 2, i * 2 + 1);
        });
        for (const sheet of MONSTER_SHEETS) {
            // Frames after the first two are poses the game picks by hand (the Ironclad's wind-up)
            addLoop(scene, `${sheet.key}-${style}-move`, `${sheet.key}-${style}`, 0, 1);
        }
    }

    for (const sheet of SHARED_SHEETS) {
        bakeSheet(scene, sheet.key, sheet, sheet.frames, SHARED_PALETTE);
    }
}
