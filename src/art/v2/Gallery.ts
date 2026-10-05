import Phaser from 'phaser';
import type { ArtStyle } from '../../types';
import { ART_STYLES_V2, bakeArtV2 } from './index';
import { SHARED_SHEETS_V2, STYLED_SHEETS_V2 } from './sheets';

// Dev-only contact sheet for the v2 art: open the game with ?gallery2 (or ?gallery2=retro to
// start on an era, and &sheets to start scrolled down to the sheets).
//
// One era at a time. The top of the page is the city square with every character standing
// on it at the game's own size, moving, because a sprite can only be judged on the ground it
// will stand on. Below that are the raw sheets with their keys. Anything not baked yet (the
// city, or another artist's sheets) is skipped.
//
// Left/right or 1-5 change era. Up/down or the wheel scroll.

/** Screen pixels per texture pixel, the same as in the game once v2 is switched on */
const SCALE = 2;
const TILE = 32 * SCALE;
const CITY_WIDTH = 640 * SCALE;
const CITY_HEIGHT = 320 * SCALE;
const MARGIN = 12;
const LABEL_HEIGHT = 14;
const GAP = 14;
const SCROLL_STEP = 80;

/** Stand-in ground when the city is not baked: the light and dark paving the eras use */
const GROUND: Record<ArtStyle, number> = {
    goldenAge: 0xdcc47c,
    cyberpunk: 0x353060,
    retro: 0x2b2d37,
    manga: 0xc8c8c8,
    plain: 0xcec8b6,
};

const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: '"Pixelify Sans", monospace',
    fontSize: '12px',
    color: '#f0f0f0',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    padding: { x: 2, y: 0 },
};

const FACING_ANGLE = { down: 90, up: -90, left: 180, right: 0 } as const;

export class GalleryV2 extends Phaser.Scene {
    private style: ArtStyle = 'goldenAge';
    private pageHeight = CITY_HEIGHT;

    constructor() {
        super('GalleryV2');
    }

    init(data: { style?: ArtStyle }) {
        const asked = data.style ?? new URLSearchParams(window.location.search).get('gallery2');
        this.style = ART_STYLES_V2.includes(asked as ArtStyle) ? (asked as ArtStyle) : 'goldenAge';
    }

    create(data: { scrollY?: number }) {
        bakeArtV2(this);
        this.cameras.main.setBackgroundColor('#3a3a40');

        this.drawSquare();
        this.pageHeight = this.drawSheets(CITY_HEIGHT + 40);

        const startAtSheets = new URLSearchParams(window.location.search).has('sheets');
        const camera = this.cameras.main;
        camera.setBounds(0, 0, CITY_WIDTH, Math.max(this.pageHeight, this.scale.height));
        camera.scrollY = data.scrollY ?? (startAtSheets ? CITY_HEIGHT + 20 : 0);

        this.add
            .text(MARGIN, this.scale.height - 24, `${this.style}   (left/right or 1-5: era   up/down or wheel: scroll)`, {
                ...LABEL_STYLE,
                fontSize: '16px',
            })
            .setScrollFactor(0)
            .setDepth(100);

        const keyboard = this.input.keyboard;
        if (keyboard) {
            keyboard.on('keydown-LEFT', () => this.show(-1));
            keyboard.on('keydown-RIGHT', () => this.show(1));
            keyboard.on('keydown-UP', () => (camera.scrollY -= SCROLL_STEP));
            keyboard.on('keydown-DOWN', () => (camera.scrollY += SCROLL_STEP));
            ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((name, i) => {
                keyboard.on(`keydown-${name}`, () => this.scene.restart({ style: ART_STYLES_V2[i], scrollY: camera.scrollY }));
            });
        }
        this.input.on('wheel', (_pointer: unknown, _over: unknown, _dx: number, dy: number) => {
            camera.scrollY += dy;
        });
    }

    private show(step: number) {
        const count = ART_STYLES_V2.length;
        const next = ART_STYLES_V2[(ART_STYLES_V2.indexOf(this.style) + step + count) % count];
        this.scene.restart({ style: next, scrollY: this.cameras.main.scrollY });
    }

    private has(key: string): boolean {
        return this.textures.exists(key);
    }

    /** The square, with one of everything standing on it */
    private drawSquare() {
        const style = this.style;
        if (this.has(`city-${style}`)) {
            this.add.image(0, 0, `city-${style}`).setOrigin(0, 0).setScale(SCALE);
        } else {
            this.add.rectangle(0, 0, CITY_WIDTH, CITY_HEIGHT, GROUND[style]).setOrigin(0, 0);
        }

        const at = (column: number, row: number) => ({ x: (column + 0.5) * TILE, y: (row + 0.5) * TILE });

        /** One sprite, by sheet key, on a tile; `frame` is a still frame or the name of an animation */
        const put = (key: string, column: number, row: number, frame: number | string = 'move') => {
            const texture = `${key}-${style}`;
            if (!this.has(texture)) {
                return undefined;
            }
            const { x, y } = at(column, row);
            const sprite = this.add.sprite(x, y, texture, 0).setScale(SCALE);
            if (typeof frame === 'number') {
                // A frame another artist has not drawn yet falls back to the first
                sprite.setFrame(this.textures.get(texture).has(String(frame)) ? frame : 0);
            } else if (this.anims.exists(`${texture}-${frame}`)) {
                sprite.play(`${texture}-${frame}`);
            }
            return sprite;
        };

        // The Handler, walking each way with the machine held the way Player.ts holds it:
        // origin at its left end, on the body centre, turned to the aim
        (['down', 'right', 'up', 'left'] as const).forEach((facing, i) => {
            const column = 4.3 + i * 1.3;
            const behind = facing === 'up';
            const machine = () => {
                const { x, y } = at(column, 2.5);
                if (this.has(`machine-${style}`)) {
                    this.add.image(x, y + 6 * SCALE, `machine-${style}`, 0).setOrigin(0, 0.5).setScale(SCALE).setAngle(FACING_ANGLE[facing]);
                }
            };
            if (behind) {
                machine();
            }
            put('player', column, 2.5, `walk-${facing}`);
            if (!behind) {
                machine();
            }
            // Idle and dash stills underneath
            const first = ['down', 'up', 'left', 'right'].indexOf(facing) * 4;
            put('player', column, 3.7, first);
            put('player', 10.4 + i * 1.3, 2.5, first + 3);
        });

        put('rat', 1.4, 5.1);
        put('rat', 1.9, 5.5, 1);
        put('rat', 2.3, 5);
        put('slime', 3.3, 5.2);
        put('bat', 4.5, 4.9);
        put('ironclad', 5.7, 5.2);
        put('ironclad', 6.9, 5.2, 2);
        put('golem', 4.8, 6.9);
        put('golem', 6.6, 6.9, 1);

        put('zigbat', 11.6, 3.9);
        put('skitter', 12.8, 4);
        put('ghost', 14, 4);
        put('ghost', 15.2, 4, 2);
        put('wraith', 16.4, 4);
        put('snowman', 12, 5.4);
        put('snowman', 13.2, 5.4, 2);
        put('acidSlime', 14.6, 5.4);
        put('acidSlime', 15.8, 5.4, 2);
        put('prism', 12.8, 7);
        put('prism', 14.8, 7, 2);
        [0, 1, 2, 3].forEach((frame) => put('projectiles', 11 + frame * 0.5, 6.4, frame));
        put('hazards', 11.2, 7.3, 0);
        put('hazards', 17.4, 5.6, 1);
        put('crack', 8, 1, 0);
        put('crack', 11, 1, 1);

        // Pickups and the boss's warning, which are the same in every era
        const shared = (key: string, column: number, row: number, frame = 0) => {
            if (this.has(key)) {
                const { x, y } = at(column, row);
                this.add.image(x, y, key, frame).setScale(SCALE);
            }
        };
        shared('heart', 7.6, 6.4);
        shared('upgrade', 8.2, 6.4);
        shared('era-icons', 12.8, 6.1, Math.max(0, ART_STYLES_V2.indexOf(style)) % 4);

        if (this.has(`city-${style}-over`)) {
            this.add.image(0, 0, `city-${style}-over`).setOrigin(0, 0).setScale(SCALE);
        }
    }

    /** Every sheet in full with its key, flowing like text. Returns where the page ends. */
    private drawSheets(top: number): number {
        const right = CITY_WIDTH - MARGIN;
        let x = MARGIN;
        let y = top;
        let rowHeight = 0;

        const place = (key: string) => {
            if (!this.has(key)) {
                return;
            }
            const source = this.textures.get(key).getSourceImage();
            const width = Math.max(source.width * SCALE, key.length * 7);
            // Wrap to the next line when a sheet would leave the page
            if (x > MARGIN && x + width > right) {
                x = MARGIN;
                y += LABEL_HEIGHT + rowHeight + GAP;
                rowHeight = 0;
            }
            // A panel of the era's ground behind each sheet, so outlines are judged fairly
            this.add
                .rectangle(x - 2, y + LABEL_HEIGHT - 2, source.width * SCALE + 4, source.height * SCALE + 4, GROUND[this.style])
                .setOrigin(0, 0);
            this.add.text(x, y - 2, key, LABEL_STYLE);
            this.add.image(x, y + LABEL_HEIGHT, key, '__BASE').setOrigin(0, 0).setScale(SCALE);
            x += width + GAP;
            rowHeight = Math.max(rowHeight, source.height * SCALE);
        };

        for (const sheet of STYLED_SHEETS_V2) {
            place(`${sheet.key}-${this.style}`);
        }
        place(`crack-${this.style}`);
        for (const sheet of SHARED_SHEETS_V2) {
            place(sheet.key);
        }
        return y + LABEL_HEIGHT + rowHeight + 48;
    }
}
