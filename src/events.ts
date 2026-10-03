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
    /** (id: MonsterId, worldX: number, worldY: number) */
    MONSTER_KILLED: 'monster-killed',
    /** (worldX: number, worldY: number, multiplier: number) Radiation hit a monster; multiplier is 2, 1 or 0.25 */
    HIT: 'hit',
    /** (kind: 'heart' | 'healthUpgrade') The player picked something up */
    PICKUP: 'pickup',
    /** (id: RadiationId) A shot was fired. Continuous beams emit BEAM instead. */
    SHOT: 'shot',
    /** (id: RadiationId, on: boolean) A continuous beam or a charge-up started or stopped */
    BEAM: 'beam',
    /** () Fire was pressed with too little energy */
    DENIED: 'denied',
    /** (worldX: number, worldY: number) A monster is about to appear here */
    MONSTER_SPAWNING: 'monster-spawning',
    /** (id: MonsterId, worldX: number, worldY: number) A monster started an attack wind-up */
    MONSTER_WINDUP: 'monster-windup',
    /** (phase: number, weakTo: RadiationId) The boss changed phase */
    BOSS_PHASE: 'boss-phase',

    // Progression
    /** () The title screen is showing */
    TITLE_SHOWN: 'title-shown',
    /** (levelNumber: number, name: string, style: StyleId, introText: string[]) First room of a level began */
    LEVEL_STARTED: 'level-started',
    /** () The player opened a chest */
    CHEST_OPENED: 'chest-opened',
    /** (id: RadiationId) The player gained a radiation type */
    ITEM_GET: 'item-get',
    /** () A secret wall was broken */
    SECRET_FOUND: 'secret-found',
    /** (bonusBlocks: number) Maximum health went up */
    HEALTH_UPGRADE: 'health-upgrade',
    /** (id: MonsterId) A Field Guide page was unlocked (first kill of that monster) */
    GUIDE_UNLOCKED: 'guide-unlocked',
    /** () The ending sequence began: everything is now shown as it really is */
    ENDING_STARTED: 'ending-started',

    // Conversation between the Game/Ending scenes and the UI scene
    /** (lines: string[]) Show caption lines one at a time; the UI emits DIALOG_DONE after the last */
    DIALOG: 'dialog',
    /** () */
    DIALOG_DONE: 'dialog-done',
    /** (name: 'report' | 'guideTruth' | 'credits') Show a full-screen card; the UI emits SCREEN_DONE(name) when dismissed */
    SHOW_SCREEN: 'show-screen',
    /** (name: string) */
    SCREEN_DONE: 'screen-done',
    /** (paused: boolean) The pause screen opened or closed */
    PAUSED: 'paused',
    /** () A menu or caption was advanced */
    UI_SELECT: 'ui-select',
    /** (waveNumber: number, totalWaves: number) */
    WAVE_STARTED: 'wave-started',
    /** (levelName: string, roomNumber: number, totalRooms: number) */
    ROOM_STARTED: 'room-started',
    /** (text: string) A large message over the room; an empty string clears it */
    BANNER: 'banner',
    /** () */
    ROOM_CLEARED: 'room-cleared',
    /** (levelNumber: number) */
    LEVEL_CLEARED: 'level-cleared',
} as const;
