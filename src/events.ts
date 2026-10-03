// Emitted on the global bus (`scene.game.events`) so any scene, including the HUD, can listen.
// Listeners must be removed on scene shutdown, because the bus outlives scene restarts.

export const Events = {
    /** (health: number, maxHealth: number) */
    PLAYER_HEALTH_CHANGED: 'player-health-changed',
    /** () */
    PLAYER_DIED: 'player-died',
    /** (energy: number, maxEnergy: number) */
    ENERGY_CHANGED: 'energy-changed',
    /** (id: RadiationId) */
    RADIATION_CHANGED: 'radiation-changed',
    /** (id: MonsterId) */
    MONSTER_KILLED: 'monster-killed',
    /** (waveNumber: number, totalWaves: number) */
    WAVE_STARTED: 'wave-started',
    /** (roomNumber: number, totalRooms: number) */
    ROOM_STARTED: 'room-started',
    /** () */
    ROOM_CLEARED: 'room-cleared',
    /** (levelNumber: number) */
    LEVEL_CLEARED: 'level-cleared',
} as const;
