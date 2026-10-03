import Phaser from 'phaser';
import { bakeArt } from '../art';
import type { GameData } from './Game';

export class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    create() {
        bakeArt(this);

        if (import.meta.env.DEV) {
            // ?level=2&room=3 jumps straight to a room; ?sandbox loads the test level
            const params = new URLSearchParams(window.location.search);
            if (params.has('level') || params.has('room') || params.has('sandbox')) {
                const data: GameData = {
                    level: Math.max(0, Number(params.get('level') ?? 1) - 1),
                    room: Math.max(0, Number(params.get('room') ?? 1) - 1),
                    sandbox: params.has('sandbox'),
                };
                // The HUD starts first so it is listening when the Game scene reports its state
                this.scene.launch('UI');
                this.scene.start('Game', data);
                return;
            }
        }

        this.scene.start('Title');
    }
}
