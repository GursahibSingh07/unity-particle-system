import Phaser from 'phaser';

export class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // Files in public/assets are served from assets/, e.g.
        // this.load.image('player', 'assets/player.png');
    }

    create() {
        this.scene.start('Game');
    }
}
