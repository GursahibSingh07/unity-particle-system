import type Phaser from 'phaser';
import { audio, type LoopId, type MusicId, type SfxId } from './audio';
import { LEVELS } from './config/levels';
import { Events } from './events';
import { watchSettings } from './settings';
import type { RayId, StyleId } from './types';

const MUSIC_FOR_STYLE: Record<StyleId, MusicId> = {
    goldenAge: 'goldenAge',
    cyberpunk: 'cyberpunk',
    retro: 'retro',
    manga: 'manga',
    finalPage: 'boss',
    plain: 'ending',
};

/** Rays that fire in single shots */
const SHOT_SFX: Partial<Record<RayId, SfxId>> = {
    blue: 'blue',
    green: 'greenRelease',
    white: 'white',
    uv: 'uv',
};

/** Rays that hold a sound while the button is down: the laser, and the blob charging */
const BEAM_LOOP: Partial<Record<RayId, LoopId>> = {
    red: 'red',
    green: 'greenCharge',
};

/** The boss's warning sound is this long; it is timed to run straight into the swap */
const TELEGRAPH_SOUND_MS = 1800;

/** Gameplay code only emits events; this turns them into music and sound. */
export function wireAudio(game: Phaser.Game) {
    // Browsers only allow sound after the player has pressed something
    window.addEventListener('keydown', audio.unlock);
    window.addEventListener('pointerdown', audio.unlock);
    watchSettings((settings) => audio.setVolume(settings.musicVolume, settings.sfxVolume));

    const events = game.events;
    let lastHealth = Infinity;
    /** Dash charges last reported, so only a charge coming back makes a sound */
    let lastCharges = Infinity;

    const stopLoops = () => {
        for (const loop of Object.values(BEAM_LOOP)) {
            audio.setLoop(loop, false);
        }
    };

    events.on(Events.ROOM_STARTED, (levelName: string) => {
        stopLoops();
        lastCharges = Infinity;
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

    events.on(Events.ITEM_GET, () => audio.sfx('itemGet'));
    events.on(Events.UPGRADE_GET, () => audio.sfx('upgrade'));
    events.on(Events.SECRET_FOUND, () => audio.sfx('secret'));
    events.on(Events.UI_SELECT, () => audio.sfx('uiSelect'));

    // The machine
    events.on(Events.SHOT, (id: RayId) => {
        const sfx = SHOT_SFX[id];
        if (sfx) {
            audio.sfx(sfx);
        }
    });
    events.on(Events.BEAM, (id: RayId, on: boolean) => {
        const loop = BEAM_LOOP[id];
        if (loop) {
            audio.setLoop(loop, on);
        }
    });
    events.on(Events.DENIED, () => audio.sfx('denied'));
    events.on(Events.RADIATION_CHANGED, () => audio.sfx('wheel'));
    events.on(Events.MODE_CHANGED, () => audio.sfx('mode'));

    // The dash
    events.on(Events.DASHED, () => audio.sfx('dash'));
    events.on(Events.DASH_STATE, (chargesLeft: number) => {
        if (chargesLeft > lastCharges) {
            audio.sfx('dashReady');
        }
        lastCharges = chargesLeft;
    });

    // Timed eras and the boss
    events.on(Events.CHECKPOINT, () => audio.sfx('checkpoint'));
    events.on(Events.SURGE, () => audio.sfx('surge'));
    events.on(Events.BOSS_TELEGRAPH, (_style: StyleId, inMs: number) => {
        window.setTimeout(() => audio.sfx('bossTelegraph'), Math.max(0, inMs - TELEGRAPH_SOUND_MS));
    });
    events.on(Events.ERA_SWAPPED, () => audio.sfx('eraSwap'));
    events.on(Events.HAZARD, (kind: 'ice' | 'acid', on: boolean) => {
        if (on) {
            audio.sfx(kind);
        }
    });

    // Hits: these three are how the player learns which ray suits which enemy
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
