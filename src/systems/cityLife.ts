import Phaser from 'phaser';
import { chimneySpots, signSpots } from '../art/v2/city/buildings';
import { LOOKS as CITY_LOOKS } from '../art/v2/city/looks';
import { eachTile, FOUNTAIN_X, FOUNTAIN_Y, TILE } from '../art/v2/city/plan';
import { GRATES } from '../art/v2/city/weather';
import { LIFE } from '../config/look';
import { ART_SCALE, ROOM } from '../config/world';
import { getSettings, watchSettings } from '../settings';
import type { ArtStyle } from '../types';

// What moves in the square (src/config/look.ts LIFE): smoke from the chimneys, steam from the
// grates, spray from the fountain, neon that stutters, lamps that breathe. All of it is
// decoration: nothing here can be hit, and none of it moves like an enemy. Off with the
// hand-made look setting, like the rest of that layer.

/** Over the roofs and the over-layer, under the motes and the hit effects */
const DEPTH = 4.9;
/** Glows on the shop fronts sit just over the picture, under everyone walking past */
const SIGN_DEPTH = 0.6;

/** A texture-pixel point of the city picture, in world units */
function world(px: number, py: number): [number, number] {
    return [ROOM.x + px * ART_SCALE, ROOM.y + py * ART_SCALE];
}

function puffTexture(scene: Phaser.Scene): string {
    const key = 'life-puff';
    if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, 4, 4);
        const ctx = canvas?.getContext();
        if (!canvas || !ctx) {
            return '__WHITE';
        }
        const cells: [number, number, number][] = [
            [1, 0, 0.5], [2, 0, 0.5], [0, 1, 0.5], [1, 1, 1], [2, 1, 1], [3, 1, 0.5],
            [0, 2, 0.5], [1, 2, 1], [2, 2, 1], [3, 2, 0.5], [1, 3, 0.5], [2, 3, 0.5],
        ];
        for (const [x, y, a] of cells) {
            ctx.fillStyle = `rgba(255,255,255,${a})`;
            ctx.fillRect(x, y, 1, 1);
        }
        canvas.refresh();
    }
    return key;
}

export class CityLife {
    private parts: Phaser.GameObjects.GameObject[] = [];
    private timers: Phaser.Time.TimerEvent[] = [];
    private tweens: Phaser.Tweens.Tween[] = [];
    private style: ArtStyle;
    private enabled: boolean;
    private readonly stopWatching: () => void;

    constructor(
        private readonly scene: Phaser.Scene,
        style: ArtStyle,
    ) {
        this.style = style;
        this.enabled = getSettings().handmadeLook;
        this.build();
        this.stopWatching = watchSettings((settings) => {
            if (settings.handmadeLook !== this.enabled) {
                this.enabled = settings.handmadeLook;
                this.build();
            }
        });
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    }

    setStyle(style: ArtStyle) {
        if (style !== this.style) {
            this.style = style;
            this.build();
        }
    }

    private clear() {
        for (const timer of this.timers) {
            timer.remove();
        }
        for (const tween of this.tweens) {
            tween.remove();
        }
        this.tweens = [];
        for (const part of this.parts) {
            part.destroy();
        }
        this.timers = [];
        this.parts = [];
    }

    private build() {
        this.clear();
        if (!this.enabled) {
            return;
        }
        const life = LIFE[this.style];
        const scene = this.scene;
        const puff = puffTexture(scene);

        if (life.smoke !== null) {
            for (const [px, py] of chimneySpots()) {
                const [x, y] = world(px, py);
                const smoke = scene.add.particles(x, y, puff, {
                    lifespan: { min: 2600, max: 4200 },
                    speedX: { min: 2, max: 6 },
                    speedY: { min: -9, max: -5 },
                    scale: { start: ART_SCALE * 0.9, end: ART_SCALE * 2.4 },
                    alpha: { start: 0.8, end: 0 },
                    tint: life.smoke,
                    frequency: 420,
                });
                smoke.setDepth(DEPTH);
                smoke.fastForward(4200);
                this.parts.push(smoke);
            }
        }

        if (life.steam !== null) {
            for (const [gx, gy] of GRATES) {
                const [x, y] = world(gx + 6, gy + 3);
                const steam = scene.add.particles(x, y, puff, {
                    emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-3, -1, 6, 2), quantity: 0 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
                    lifespan: { min: 1400, max: 2200 },
                    speedX: { min: -2, max: 3 },
                    speedY: { min: -12, max: -7 },
                    scale: { start: ART_SCALE * 0.6, end: ART_SCALE * 1.6 },
                    alpha: { start: 0.28, end: 0 },
                    tint: life.steam,
                    frequency: 260,
                });
                steam.setDepth(DEPTH);
                steam.fastForward(2200);
                this.parts.push(steam);
            }
        }

        if (life.spray !== null) {
            const [x, y] = world(FOUNTAIN_X, FOUNTAIN_Y - 30);
            const spray = scene.add.particles(x, y, '__WHITE', {
                lifespan: { min: 500, max: 800 },
                speedX: { min: -9, max: 9 },
                speedY: { min: -16, max: -8 },
                gravityY: 55,
                scale: ART_SCALE,
                alpha: { start: 0.85, end: 0.2 },
                tint: life.spray,
                frequency: 70,
            });
            spray.setDepth(DEPTH);
            this.parts.push(spray);
        }

        const look = CITY_LOOKS[this.style];
        if (life.neon) {
            for (const [px, py, id] of signSpots()) {
                const [x, y] = world(px, py);
                const glow = scene.add.pointlight(x, y, Phaser.Display.Color.HexStringToColor(look.b[id].neon).color, 10, 0.05, 0.1);
                glow.setDepth(SIGN_DEPTH);
                this.parts.push(glow);
                // Every sign stutters now and then; one of them is on its way out
                const broken = id === 'tailor';
                const stutter = () => {
                    const flickers = broken ? 4 : 1 + Math.floor(Math.random() * 2);
                    for (let n = 0; n < flickers; n++) {
                        scene.time.delayedCall(n * 90, () => glow.active && glow.setVisible(false));
                        scene.time.delayedCall(n * 90 + 45, () => glow.active && glow.setVisible(true));
                    }
                };
                this.timers.push(scene.time.addEvent({ delay: broken ? 1700 : 3000 + Math.random() * 5000, loop: true, callback: stutter }));
            }
        }

        if (life.lamps) {
            eachTile('o', (tx, ty, index) => {
                const [x, y] = world(tx + TILE / 2, ty - 11);
                const colour = this.style === 'cyberpunk' ? look.lit[index % 2 ? 1 : 2] : look.lampGlass;
                const glow = scene.add.pointlight(x, y, Phaser.Display.Color.HexStringToColor(colour).color, 12, 0.14, 0.09);
                glow.setDepth(DEPTH);
                this.parts.push(glow);
                this.tweens.push(scene.tweens.add({
                    targets: glow,
                    intensity: { from: 0.1, to: 0.17 },
                    duration: 1400 + index * 230,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                }));
            });
        }
    }

    destroy() {
        this.stopWatching();
        this.clear();
    }
}
