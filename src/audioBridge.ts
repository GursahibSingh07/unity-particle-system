import type Phaser from 'phaser';
import { audio, type MusicId, type SfxId } from './audio';
import { LEVELS } from './config/levels';
import { Events } from './events';
import type { RadiationId, StyleId } from './types';

const MUSIC_FOR_STYLE: Record<StyleId, MusicId> = {
    goldenAge: 'goldenAge',
    noir: 'noir',
    manga: 'manga',
    finalPage: 'boss',
    plain: 'ending',
};

const SHOT_SFX: Partial<Record<RadiationId, SfxId>> = {
    radio: 'radio',
    ultraviolet: 'ultraviolet',
    gamma: 'gamma',
};

/** Gameplay code only emits events; this turns them into music and sound. */
export function wireAudio(game: Phaser.Game) {
    // Browsers only allow sound after the player has pressed something
    window.addEventListener('keydown', audio.unlock);
    window.addEventListener('pointerdown', audio.unlock);

    const events = game.events;
    let lastHealth = Infinity;

    const stopLoops = () => {
        audio.setLoop('infrared', false);
        audio.setLoop('gammaCharge', false);
    };

    events.on(Events.ROOM_STARTED, (levelName: string) => {
        stopLoops();
        // Covers rooms reached without a LEVEL_STARTED (restarts, dev jumps); a no-op if already playing
        const level = LEVELS.find((candidate) => candidate.name === levelName);
        audio.playMusic(MUSIC_FOR_STYLE[level?.style ?? 'goldenAge']);
    });

    events.on(Events.TITLE_SHOWN, () => {
        stopLoops();
        audio.playMusic('title');
    });
    events.on(Events.LEVEL_STARTED, (_level: number, _name: string, style: StyleId) => {
        audio.playMusic(MUSIC_FOR_STYLE[style]);
    });
    events.on(Events.ENDING_STARTED, () => {
        stopLoops();
        audio.playMusic('ending');
    });
    events.on(Events.PAUSED, stopLoops);

    events.on(Events.CHEST_OPENED, () => audio.sfx('chestOpen'));
    events.on(Events.ITEM_GET, () => audio.sfx('itemGet'));
    events.on(Events.SECRET_FOUND, () => audio.sfx('secret'));
    events.on(Events.UI_SELECT, () => audio.sfx('uiSelect'));

    events.on(Events.SHOT, (id: RadiationId) => {
        const sfx = SHOT_SFX[id];
        if (sfx) {
            audio.sfx(sfx);
        }
    });
    events.on(Events.BEAM, (id: RadiationId, on: boolean) => {
        if (id === 'infrared') {
            audio.setLoop('infrared', on);
        } else if (id === 'gamma') {
            audio.setLoop('gammaCharge', on);
        }
    });
    events.on(Events.DENIED, () => audio.sfx('denied'));
    events.on(Events.RADIATION_CHANGED, () => audio.sfx('switch'));

    events.on(Events.HIT, (_x: number, _y: number, multiplier: number) => {
        if (multiplier > 1) {
            audio.sfx('hitWeak');
        } else if (multiplier === 1) {
            audio.sfx('hitNormal');
        } else if (multiplier > 0) {
            audio.sfx('hitResist');
        }
    });
    events.on(Events.MONSTER_KILLED, () => audio.sfx('monsterDie'));
    events.on(Events.BOSS_PHASE, () => audio.sfx('bossPhase'));

    events.on(Events.PLAYER_HEALTH_CHANGED, (health: number) => {
        if (health < lastHealth && health > 0) {
            audio.sfx('playerHurt');
        }
        lastHealth = health;
    });
    events.on(Events.PLAYER_DIED, () => {
        stopLoops();
        audio.sfx('playerDie');
    });
    events.on(Events.PICKUP, () => audio.sfx('heart'));
    events.on(Events.ROOM_CLEARED, () => {
        stopLoops();
        audio.sfx('roomClear');
    });
}
