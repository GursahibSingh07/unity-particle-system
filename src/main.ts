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

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')) {
    // Contact sheet of every texture, for checking art
    const { Gallery } = await import('./art/Gallery');
    config.scene = [Gallery];
}
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery2')) {
    // The v2 art, before it is switched on in the game
    const { GalleryV2 } = await import('./art/v2/Gallery');
    config.scene = [GalleryV2];
}

// Canvas text is drawn once, so the font has to be ready before any scene creates text
await document.fonts.load('30px "Pixelify Sans"');

const game = new Phaser.Game(config);
wireAudio(game);

if (import.meta.env.DEV) {
    // For the automated playthrough in tools/
    (window as unknown as { __game: Phaser.Game }).__game = game;
}
