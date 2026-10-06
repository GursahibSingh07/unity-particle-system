import '@fontsource/pixelify-sans/400.css';
import Phaser from 'phaser';
import { wireAudio } from './audioBridge';
import { WORLD_HEIGHT, WORLD_WIDTH, ZOOM } from './config/world';
import { Boot } from './scenes/Boot';
import { Ending } from './scenes/Ending';
import { Game } from './scenes/Game';
import { Title } from './scenes/Title';
import { UI } from './scenes/UI';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: WORLD_WIDTH * ZOOM,
    height: WORLD_HEIGHT * ZOOM,
    backgroundColor: '#12121c',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
        },
    },
    scene: [Boot, Title, Game, Ending, UI],
};

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery2')) {
    // Contact sheet of every texture, for checking art
    const { GalleryV2 } = await import('./art/v2/Gallery');
    config.scene = [GalleryV2];
}

// Canvas text is drawn once, so the font has to be ready before any scene creates text
await document.fonts.load('30px "Pixelify Sans"');

const game = new Phaser.Game(config);
wireAudio(game);

// Phaser asks for the next frame only after this one returns, so one error thrown anywhere in a
// frame (a scene, a key handler, a tween) would stop the game for good. Lose the frame instead.
const step = game.step.bind(game);
const reported = new Set<string>();
const safeStep = (time: number, delta: number) => {
    try {
        step(time, delta);
    } catch (error) {
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
        if (!reported.has(message)) {
            reported.add(message);
            console.error('A frame failed and was skipped', error);
        }
    }
};
game.step = safeStep;
if (game.isRunning) {
    game.loop.callback = safeStep;
}

if (import.meta.env.DEV) {
    // For the automated playthrough in tools/
    (window as unknown as { __game: Phaser.Game }).__game = game;
}
