import Phaser from 'phaser';
import type { ArtStyle } from '../types';
import { ART_STYLES, SHARED_SHEETS, STYLED_SHEETS, bakeArt } from './index';
import type { SheetDef } from './sprites/grid';

// Dev-only contact sheet: open the game with ?gallery in the URL. One column per style.
// The top of a column shows every sheet with its key; the bottom is a mock room at the
// game's own zoom, because a sprite can only be judged against the floor it stands on.

const COLUMN_WIDTH = 320;
const MARGIN = 8;
const SHEET_SCALE = 2;
const ROOM_SCALE = 4;
const ROOM_TOP = 296;
const TILE = 16;
const LABEL_HEIGHT = 12;
const GAP = 5;
/** Room for the longest sheet name */
const MIN_CELL_WIDTH = 52;

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: '"Pixelify Sans", monospace',
    fontSize: '11px',
    color: '#f0f0f0',
};

/** The mock room's background, as frames of the tiles sheet */
const ROOM_TILES = [
    [2, 4, 2, 2],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
    [1, 0, 0, 0],
    [0, 0, 0, 0],
];

export class Gallery extends Phaser.Scene {
    constructor() {
        super('Gallery');
    }

    create() {
        bakeArt(this);
        this.cameras.main.setBackgroundColor('#5c5c60');

        ART_STYLES.forEach((style, column) => {
            const left = column * COLUMN_WIDTH + MARGIN;
            this.add.text(left, 4, `{key}-${style}`, { ...LABEL_STYLE, fontSize: '16px' });
            this.drawSheets(style, left, 26);
            this.drawRoom(style, column * COLUMN_WIDTH + (COLUMN_WIDTH - 4 * TILE * ROOM_SCALE) / 2);
        });

        // Textures that are the same in every style
        let x = MARGIN;
        for (const sheet of SHARED_SHEETS) {
            this.drawSheet(sheet, sheet.key, sheet.key, x, ROOM_TOP + 6 * TILE * ROOM_SCALE + 2, 2);
            x += Math.max(MIN_CELL_WIDTH, sheet.width * sheet.frames.length * 2) + GAP * 2;
        }
    }

    private drawSheets(style: ArtStyle, left: number, top: number) {
        const right = left + COLUMN_WIDTH - MARGIN * 2;
        let x = left;
        let y = top;
        let rowHeight = 0;
        for (const sheet of STYLED_SHEETS) {
            const frames = sheet.styles?.[style] ?? sheet.frames;
            const width = Math.max(MIN_CELL_WIDTH, sheet.width * frames.length * SHEET_SCALE);
            // Flow like text: wrap to the next line when a sheet would leave the column
            if (x > left && x + width > right) {
                x = left;
                y += LABEL_HEIGHT + rowHeight + GAP;
                rowHeight = 0;
            }
            this.drawSheet(sheet, `${sheet.key}-${style}`, sheet.key, x, y, SHEET_SCALE);
            x += width + GAP * 2;
            rowHeight = Math.max(rowHeight, sheet.height * SHEET_SCALE);
        }
    }

    /** Draws a whole sheet with its name above it */
    private drawSheet(sheet: SheetDef, key: string, name: string, x: number, y: number, scale: number) {
        this.add.text(x, y, name, LABEL_STYLE);
        this.add
            .image(x, y + LABEL_HEIGHT, key, '__BASE')
            .setOrigin(0, 0)
            .setScale(scale);
    }

    private drawRoom(style: ArtStyle, left: number) {
        const at = (column: number, row: number) => ({
            x: left + (column + 0.5) * TILE * ROOM_SCALE,
            y: ROOM_TOP + (row + 0.5) * TILE * ROOM_SCALE,
        });

        ROOM_TILES.forEach((frames, row) => {
            frames.forEach((frame, column) => {
                const { x, y } = at(column, row);
                this.add.image(x, y, `tiles-${style}`, frame).setScale(ROOM_SCALE);
            });
        });

        const still = (key: string, frame: number, column: number, row: number) => {
            const { x, y } = at(column, row);
            return this.add.sprite(x, y, `${key}-${style}`, frame).setScale(ROOM_SCALE);
        };
        const moving = (key: string, animation: string, column: number, row: number) =>
            still(key, 0, column, row).play(`${key}-${style}-${animation}`);

        still('tiles', 3, 2, 1);
        still('tiles', 5, 3, 1);
        still('tiles', 6, 3, 2);

        // The machine is held the way Player.ts holds it: origin at its left end, on the body centre
        const machine = (column: number, row: number, angle: number) => {
            const { x, y } = at(column, row);
            return this.add
                .image(x, y, `machine-${style}`, 0)
                .setOrigin(0, 0.5)
                .setScale(ROOM_SCALE)
                .setAngle(angle);
        };
        moving('player', 'walk-down', 0, 1);
        machine(0, 1, 90);
        moving('player', 'walk-right', 0, 2);
        machine(0, 2, 0);
        machine(3, 4, -90);
        moving('player', 'walk-up', 3, 4);
        moving('player', 'walk-left', 3, 5);
        machine(3, 5, 180);

        moving('rat', 'move', 1, 1);
        still('rat', 1, 1.5, 1.4);
        still('projectile', 0, 2, 2);
        moving('slime', 'move', 1, 2);
        moving('ghost', 'move', 0, 3);
        moving('ironclad', 'move', 1, 3);
        still('ironclad', 2, 2, 3);
        still('ironclad', 1, 3, 3);
        still('ghost', 1, 0, 4.5);
        moving('prism', 'move', 1.5, 4.5);
    }
}
