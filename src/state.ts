import type Phaser from 'phaser';
import type { MonsterId, RadiationId } from './types';

// The player's progress for the current playthrough, kept in the game registry so every
// scene sees the same thing. Nothing is saved between page loads.

type Registry = Phaser.Data.DataManager;

const RADIATIONS = 'progress.radiations';
const CLEARED = 'progress.clearedRooms';
const GUIDE = 'progress.guide';
const BONUS_HEALTH = 'progress.bonusHealth';
const SECRETS = 'progress.secrets';
const ENDED = 'progress.ended';

/** Health added by each secret, in health points (one HUD block is 5) */
export const SECRET_HEALTH_BONUS = 10;

const roomKey = (level: number, room: number) => `${level}:${room}`;

function list<T>(registry: Registry, key: string): T[] {
    return (registry.get(key) as T[] | undefined) ?? [];
}

function addTo<T>(registry: Registry, key: string, value: T) {
    const current = list<T>(registry, key);
    if (current.includes(value)) {
        return false;
    }
    registry.set(key, [...current, value]);
    return true;
}

export const Progress = {
    /** Forget everything: call when a new game starts from the title screen */
    reset(registry: Registry) {
        for (const key of [RADIATIONS, CLEARED, GUIDE, BONUS_HEALTH, SECRETS, ENDED]) {
            registry.remove(key);
        }
    },

    radiations: (registry: Registry) => list<RadiationId>(registry, RADIATIONS),
    /** Returns true if it was newly unlocked */
    unlockRadiation: (registry: Registry, id: RadiationId) => addTo(registry, RADIATIONS, id),

    clearedRooms: (registry: Registry) => list<string>(registry, CLEARED),
    isRoomCleared: (registry: Registry, level: number, room: number) =>
        list<string>(registry, CLEARED).includes(roomKey(level, room)),
    markRoomCleared: (registry: Registry, level: number, room: number) =>
        addTo(registry, CLEARED, roomKey(level, room)),

    guide: (registry: Registry) => list<MonsterId>(registry, GUIDE),
    /** Returns true if this is the first time this monster was recorded */
    unlockGuide: (registry: Registry, id: MonsterId) => addTo(registry, GUIDE, id),

    /** Secrets found, as "level:room" keys */
    secrets: (registry: Registry) => list<string>(registry, SECRETS),
    isSecretFound: (registry: Registry, level: number, room: number) =>
        list<string>(registry, SECRETS).includes(roomKey(level, room)),
    /** Returns true if this room's secret was not already found; also raises bonus health */
    findSecret(registry: Registry, level: number, room: number) {
        if (!addTo(registry, SECRETS, roomKey(level, room))) {
            return false;
        }
        registry.set(BONUS_HEALTH, Progress.bonusHealth(registry) + SECRET_HEALTH_BONUS);
        return true;
    },
    bonusHealth: (registry: Registry) => (registry.get(BONUS_HEALTH) as number | undefined) ?? 0,

    /** True once the ending has been seen: the Field Guide then shows the truth */
    ended: (registry: Registry) => registry.get(ENDED) === true,
    markEnded: (registry: Registry) => registry.set(ENDED, true),
};
