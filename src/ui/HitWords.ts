import Phaser from 'phaser';
import { ONOMATOPOEIA } from '../config/text';
import { ZOOM } from '../config/world';
import { burst, burstPoints } from './draw';
import { Depth, HUD_STRIP, INK, RED, SCREEN_HEIGHT, SCREEN_WIDTH, WHITE, YELLOW, makeText } from './theme';

type Kind = 'weak' | 'normal' | 'resist';

// A beam reports a hit many times a second. These keep the words readable and the room visible.
const MIN_GAP: Record<Kind, number> = { weak: 260, normal: 420, resist: 380 };
const MAX_ALIVE: Record<Kind, number> = { weak: 3, normal: 2, resist: 2 };
// The word lists belong to the writers: these are the names each kind has gone by
const WORD_KEYS: Record<Kind, string[]> = { weak: ['weak', 'strong'], normal: ['normal', 'neutral'], resist: ['resist', 'feeble'] };

/**
 * Comic sound words at the point of a hit. This is the only way the game tells the player
 * about weaknesses, so the three kinds differ in size, colour, shape and motion all at once:
 * a strong ray (above 1) is a big burst, a neutral one (1) small, a poor one (below 1) tiny and grey.
 */
export class HitWords {
    private lastAt: Record<Kind, number> = { weak: -9999, normal: -9999, resist: -9999 };
    private alive: Record<Kind, number> = { weak: 0, normal: 0, resist: 0 };
    private lastWord: Record<Kind, string> = { weak: '', normal: '', resist: '' };
    private seed = 1;

    constructor(private readonly scene: Phaser.Scene) {}

    show(worldX: number, worldY: number, multiplier: number) {
        const kind: Kind = multiplier > 1 ? 'weak' : multiplier < 1 ? 'resist' : 'normal';
        const now = this.scene.time.now;
        if (now - this.lastAt[kind] < MIN_GAP[kind] || this.alive[kind] >= MAX_ALIVE[kind]) {
            return;
        }
        const table = ONOMATOPOEIA as Record<string, string[] | undefined>;
        const words = WORD_KEYS[kind].map((key) => table[key]).find((list) => Array.isArray(list));
        if (!words || words.length === 0) {
            return;
        }
        this.lastAt[kind] = now;

        // Never the same word twice running, when there is a choice
        const choices = words.length > 1 ? words.filter((word) => word !== this.lastWord[kind]) : words;
        const word = Phaser.Utils.Array.GetRandom(choices);
        this.lastWord[kind] = word;

        const x = worldX * ZOOM + Phaser.Math.Between(-28, 28);
        // Above the monster, so the word never covers what was hit
        const y = worldY * ZOOM - Phaser.Math.Between(44, 70);

        this.alive[kind]++;
        const done = () => {
            this.alive[kind]--;
        };
        if (kind === 'weak') {
            this.weak(x, y, word, done, multiplier >= 2 ? 1.15 : 0.95);
        } else if (kind === 'normal') {
            this.normal(x, y, word, done);
        } else {
            this.resist(x, y, word, done);
        }
    }

    private weak(x: number, y: number, word: string, done: () => void, size: number) {
        const text = makeText(this.scene, 0, 0, word, 46, {
            bold: true,
            color: RED,
            stroke: INK,
            strokeThickness: 9,
        }).setOrigin(0.5);
        const half = text.width / 2;
        const g = this.scene.add.graphics();
        const seed = this.seed++;
        // The shadow is the same burst in ink, dropped down and right
        burst(g, burstPoints(6, 7, 44, 30, 11, 0.3, seed, (half + 34) / 44), INK, INK, 0);
        burst(g, burstPoints(0, 0, 44, 30, 11, 0.3, seed, (half + 34) / 44), YELLOW, INK, 5);

        const container = this.scene.add
            .container(this.clampX(x, half + 40), this.clampY(y, 50), [g, text])
            .setDepth(Depth.words + 2)
            .setAngle(Phaser.Math.Between(-13, 13))
            .setScale(0.3);
        this.scene.tweens.chain({
            targets: container,
            tweens: [
                { scale: 1.18 * size, duration: 90, ease: 'Quad.easeOut' },
                { scale: size, duration: 70 },
                { scale: 1.04 * size, duration: 420 },
                { alpha: 0, scale: 1.25 * size, duration: 130 },
            ],
            onComplete: () => {
                container.destroy();
                done();
            },
        });
    }

    private normal(x: number, y: number, word: string, done: () => void) {
        const text = makeText(this.scene, this.clampX(x, 40), this.clampY(y + 16, 20), word, 24, {
            bold: true,
            color: WHITE,
            stroke: INK,
            strokeThickness: 6,
        })
            .setOrigin(0.5)
            .setDepth(Depth.words + 1)
            .setAngle(Phaser.Math.Between(-6, 6))
            .setScale(0.6);
        this.scene.tweens.chain({
            targets: text,
            tweens: [
                { scale: 1, duration: 70, ease: 'Quad.easeOut' },
                { y: text.y - 14, duration: 300 },
                { alpha: 0, y: text.y - 22, duration: 110 },
            ],
            onComplete: () => {
                text.destroy();
                done();
            },
        });
    }

    private resist(x: number, y: number, word: string, done: () => void) {
        // Small, grey, and it drops: the shot bounced off
        const text = makeText(this.scene, this.clampX(x, 30), this.clampY(y + 28, 16), word, 17, {
            color: 0xb9b6c6,
            stroke: 0x2a2638,
            strokeThickness: 4,
        })
            .setOrigin(0.5)
            .setDepth(Depth.words);
        this.scene.tweens.chain({
            targets: text,
            tweens: [
                { y: text.y - 8, duration: 90, ease: 'Quad.easeOut' },
                { y: text.y + 16, duration: 330, ease: 'Quad.easeIn' },
                { alpha: 0, y: text.y + 22, duration: 110 },
            ],
            onComplete: () => {
                text.destroy();
                done();
            },
        });
    }

    private clampX(x: number, half: number) {
        return Phaser.Math.Clamp(x, half + 8, SCREEN_WIDTH - half - 8);
    }

    private clampY(y: number, half: number) {
        return Phaser.Math.Clamp(y, HUD_STRIP + half + 6, SCREEN_HEIGHT - half - 8);
    }
}
