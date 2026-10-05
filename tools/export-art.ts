// Renders every procedural v2 sprite sheet and city picture to PNG files under art-image/,
// with the same drawing rules as bakeSheet/bakeCity in src/art/v2. No browser needed.
//
//   npm run art:export
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { ArtStyle } from '../src/types';
import type { Grid, SheetDef } from '../src/art/sprites/grid';
import { PALETTES_V2, SHARED_PALETTE_V2, toneAt, type Palette } from '../src/art/v2/palettes';
import { SHARED_SHEETS_V2, STYLED_SHEETS_V2 } from '../src/art/v2/sheets';
import { CITY_HEIGHT, CITY_WIDTH, TILE } from '../src/art/v2/city/plan';
import { paintCity, paintCrack } from '../src/art/v2/city/scene';

// npm runs scripts from the project root
const OUT = path.resolve(process.cwd(), 'art-image');
const STYLES: ArtStyle[] = ['goldenAge', 'cyberpunk', 'retro', 'manga', 'plain'];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
});

function crc32(buffer: Buffer): number {
    let c = 0xffffffff;
    for (const byte of buffer) {
        c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
}

/** 8-bit RGBA PNG from a width*height*4 buffer */
function encodePng(width: number, height: number, rgba: Uint8ClampedArray | Uint8Array): Buffer {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0;
        Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function parseColour(colour: string): [number, number, number, number] {
    if (colour.startsWith('#')) {
        const hex = colour.length === 4 ? Array.from(colour.slice(1), (c) => c + c).join('') : colour.slice(1);
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
    }
    const match = /rgba?\(([^)]+)\)/.exec(colour);
    if (!match) {
        throw new Error(`Unsupported colour: ${colour}`);
    }
    const [r, g, b, a = '1'] = match[1].split(',').map((part) => part.trim());
    return [Number(r), Number(g), Number(b), Math.round(Number(a) * 255)];
}

class Raster {
    readonly data: Uint8Array;
    constructor(
        readonly width: number,
        readonly height: number,
    ) {
        this.data = new Uint8Array(width * height * 4);
    }

    set(x: number, y: number, colour: string) {
        this.data.set(parseColour(colour), (y * this.width + x) * 4);
    }

    crop(left: number, width: number): Raster {
        const out = new Raster(width, this.height);
        for (let y = 0; y < this.height; y++) {
            const from = (y * this.width + left) * 4;
            out.data.set(this.data.subarray(from, from + width * 4), y * width * 4);
        }
        return out;
    }
}

function drawGrid(raster: Raster, grid: Grid, palette: Palette, left: number, sheet: SheetDef, name: string) {
    if (grid.length !== sheet.height) {
        throw new Error(`${name}: ${grid.length} rows, expected ${sheet.height}`);
    }
    grid.forEach((row, y) => {
        if (row.length !== sheet.width) {
            throw new Error(`${name} row ${y}: ${row.length} wide, expected ${sheet.width}`);
        }
        for (let x = 0; x < row.length; x++) {
            const slot = row[x];
            if (slot === '.') {
                continue;
            }
            const tone = palette[slot];
            if (tone === undefined) {
                throw new Error(`${name} row ${y}: no palette slot '${slot}'`);
            }
            raster.set(left + x, y, toneAt(tone, x, y));
        }
    });
}

function renderSheet(sheet: SheetDef, frames: Grid[], palette: Palette): Raster {
    const raster = new Raster(sheet.width * frames.length, sheet.height);
    frames.forEach((grid, frame) => {
        const left = frame * sheet.width;
        const under = sheet.underlay?.[frame];
        if (under !== undefined) {
            drawGrid(raster, frames[under], palette, left, sheet, `${sheet.key} frame ${under}`);
        }
        drawGrid(raster, grid, palette, left, sheet, `${sheet.key} frame ${frame}`);
    });
    return raster;
}

function write(file: string, raster: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }) {
    const target = path.join(OUT, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, encodePng(raster.width, raster.height, raster.data));
}

interface ManifestEntry {
    file: string;
    frameWidth: number;
    frameHeight: number;
    frames: number;
    framesDir: string;
}

const manifest: Record<string, ManifestEntry> = {};

function exportSheet(group: string, texture: string, sheet: SheetDef, frames: Grid[], palette: Palette) {
    const raster = renderSheet(sheet, frames, palette);
    const file = `${group}/${sheet.key}.png`;
    write(file, raster);
    // One file per frame, so a single frame can be swapped out
    frames.forEach((_, i) => write(`${group}/frames/${sheet.key}/${String(i).padStart(2, '0')}.png`, raster.crop(i * sheet.width, sheet.width)));
    manifest[texture] = {
        file,
        frameWidth: sheet.width,
        frameHeight: sheet.height,
        frames: frames.length,
        framesDir: `${group}/frames/${sheet.key}`,
    };
}

rmSync(OUT, { recursive: true, force: true });

for (const style of STYLES) {
    for (const sheet of STYLED_SHEETS_V2) {
        exportSheet(`sprites/${style}`, `${sheet.key}-${style}`, sheet, sheet.styles?.[style] ?? sheet.frames, PALETTES_V2[style]);
    }
}

for (const sheet of SHARED_SHEETS_V2) {
    exportSheet('shared', sheet.key, sheet, sheet.frames, SHARED_PALETTE_V2);
}

for (const style of STYLES) {
    const { base, over } = paintCity(style);
    write(`city/${style}/city.png`, base);
    write(`city/${style}/city-over.png`, over);
    const crack = paintCrack(style);
    write(`city/${style}/crack.png`, crack);
    manifest[`city-${style}`] = { file: `city/${style}/city.png`, frameWidth: CITY_WIDTH, frameHeight: CITY_HEIGHT, frames: 1, framesDir: '' };
    manifest[`city-${style}-over`] = { file: `city/${style}/city-over.png`, frameWidth: CITY_WIDTH, frameHeight: CITY_HEIGHT, frames: 1, framesDir: '' };
    manifest[`crack-${style}`] = { file: `city/${style}/crack.png`, frameWidth: TILE, frameHeight: TILE, frames: 2, framesDir: '' };
}

writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${Object.keys(manifest).length} textures to ${OUT}`);
