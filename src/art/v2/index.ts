import type Phaser from 'phaser';
import type { ArtStyle } from '../../types';
import type { Grid, SheetDef } from '../sprites/grid';
import { bakeCity } from './city';
import { PALETTES_V2, SHARED_PALETTE_V2, toneAt, type Palette } from './palettes';
import { MOVE_LOOPS_V2, SHARED_SHEETS_V2, STYLED_SHEETS_V2 } from './sheets';
import { PLAYER_FACINGS, PLAYER_FRAMES_PER_FACING } from './sprites/hero';

// The v2 art: twice the resolution of v1 (2 texture pixels per world unit), drawn at boot
// from the grids in ./sprites and the palettes in ./palettes.ts. Texture keys, frame sizes
// and frame orders are listed in docs/DESIGN.md section 9.
//
// v2 uses the same key names as v1, so only one of bakeArt and bakeArtV2 should run in a game.

export const ART_STYLES_V2: ArtStyle[] = ['goldenAge', 'cyberpunk', 'retro', 'manga', 'plain'];

const FRAME_RATE = 8;
const TRANSPARENT = '.';

/** What this module has made, per game, so a second call does nothing and a v1 leftover is replaced */
const baked = new WeakMap<Phaser.Game, Set<string>>();

function drawGrid(context: CanvasRenderingContext2D, grid: Grid, palette: Palette, left: number, sheet: SheetDef, name: string) {
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

function bakeSheet(scene: Phaser.Scene, done: Set<string>, key: string, sheet: SheetDef, frames: Grid[], palette: Palette) {
    const name = `texture:${key}`;
    if (done.has(name) && scene.textures.exists(key)) {
        return;
    }
    // Anything else under this key is the old art
    if (scene.textures.exists(key)) {
        scene.textures.remove(key);
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
    done.add(name);
}

function addLoop(scene: Phaser.Scene, done: Set<string>, key: string, texture: string, frames: number[]) {
    const name = `animation:${key}`;
    if (done.has(name) && scene.anims.exists(key)) {
        return;
    }
    if (scene.anims.exists(key)) {
        scene.anims.remove(key);
    }
    scene.anims.create({
        key,
        frames: frames.map((frame) => ({ key: texture, frame })),
        frameRate: FRAME_RATE,
        repeat: -1,
    });
    done.add(name);
}

/** Creates every v2 texture and animation listed in docs/DESIGN.md section 9. Safe to call again. */
export function bakeArtV2(scene: Phaser.Scene): void {
    let done = baked.get(scene.game);
    if (!done) {
        done = new Set();
        baked.set(scene.game, done);
    }

    bakeCity(scene);

    for (const style of ART_STYLES_V2) {
        for (const sheet of STYLED_SHEETS_V2) {
            const frames = sheet.styles?.[style] ?? sheet.frames;
            bakeSheet(scene, done, `${sheet.key}-${style}`, sheet, frames, PALETTES_V2[style]);
        }

        PLAYER_FACINGS.forEach((facing, i) => {
            // Idle, walk A, idle, walk B; the fourth frame of each facing is the dash
            const idle = i * PLAYER_FRAMES_PER_FACING;
            addLoop(scene, done, `player-${style}-walk-${facing}`, `player-${style}`, [idle, idle + 1, idle, idle + 2]);
        });
        for (const [key, start, end] of MOVE_LOOPS_V2) {
            const frames = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            addLoop(scene, done, `${key}-${style}-move`, `${key}-${style}`, frames);
        }
    }

    for (const sheet of SHARED_SHEETS_V2) {
        bakeSheet(scene, done, sheet.key, sheet, sheet.frames, SHARED_PALETTE_V2);
    }
}
