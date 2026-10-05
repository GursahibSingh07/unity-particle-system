// Emitted on the global bus (`scene.game.events`) so any scene, including the HUD, can listen.
// Listeners must be removed on scene shutdown, because the bus outlives scene restarts.

export const Events = {
    /** (health: number, maxHealth: number) */
    PLAYER_HEALTH_CHANGED: 'player-health-changed',
    /** () */
    PLAYER_DIED: 'player-died',
    /** (energy: number, maxEnergy: number) */
    ENERGY_CHANGED: 'energy-changed',
    /** (id: RayId) */
    RADIATION_CHANGED: 'radiation-changed',
    /** (id: MonsterId, worldX: number, worldY: number) */
    MONSTER_KILLED: 'monster-killed',
    /** (worldX: number, worldY: number, multiplier: number) Radiation hit a monster; multiplier is 2, 1 or 0.25 */
    HIT: 'hit',
    /** (kind: 'heart' | 'healthUpgrade') The player picked something up */
    PICKUP: 'pickup',
    /** (id: RayId) A shot was fired. Continuous beams emit BEAM instead. */
    SHOT: 'shot',
    /** (id: RayId, on: boolean) A continuous beam or a charge-up started or stopped */
    BEAM: 'beam',
    /** () Fire was pressed with too little energy */
    DENIED: 'denied',
    /** (worldX: number, worldY: number) A monster is about to appear here */
    MONSTER_SPAWNING: 'monster-spawning',
    /** (id: MonsterId, worldX: number, worldY: number) A monster started an attack wind-up */
    MONSTER_WINDUP: 'monster-windup',
    /** (health: number, maxHealth: number) The boss appeared, was hurt, or died (health 0) */
    BOSS_HEALTH: 'boss-health',
    /** (phase: number, weakTo: RayId) The boss changed phase */
    BOSS_PHASE: 'boss-phase',

    // The machine and the dash (v2)
    /** (mode: RayMode) The mode key was pressed and the machine changed mode */
    MODE_CHANGED: 'mode-changed',
    /**
     * (rule: WeaponRule, mode: RayMode, wheelIndex: number, status: WeaponStatus) Everything the
     * HUD needs to draw the colour wheel: emitted at era start, on every wheel turn, mode change
     * and rule change, and once 1000ms before a locked wheel turns by itself.
     * status = { ray: RayId | null, rotateInMs: number | null, warning: boolean, nextIndex: number | null }
     * (rotateInMs and nextIndex are null unless the wheel turns by itself; count down from rotateInMs)
     */
    WEAPON_STATE: 'weapon-state',
    /** (chargesLeft: number, maxCharges: number) The player dashed */
    DASHED: 'dashed',
    /** (chargesLeft: number, maxCharges: number, msUntilNextCharge: number) Dash charges changed (also sent at era start); maxCharges 0 means no dash this era */
    DASH_STATE: 'dash-state',
    /** (ids: UpgradeId[]) The player was handed these as the era began; the UI shows ONE card for all of them and answers SCREEN_DONE('itemGet') */
    UPGRADE_GET: 'upgrade-get',

    // Timed eras (v2)
    /** (secondsLeft: number, totalSeconds: number) Once a second during a continuous era */
    ERA_TIMER: 'era-timer',
    /** () A checkpoint was reached: dying now restarts from here */
    CHECKPOINT: 'checkpoint',
    /** () The final surge of a timed era began */
    SURGE: 'surge',
    /** (style: ArtStyle, inMs: number) The boss is about to switch the era; shown over its head */
    BOSS_TELEGRAPH: 'boss-telegraph',
    /** (style: ArtStyle) The era the room is drawn in changed mid-fight (the boss) */
    ERA_SWAPPED: 'era-swapped',
    /** (kind: 'ice' | 'acid', on: boolean) The player stepped onto or off a floor hazard */
    HAZARD: 'hazard',

    // Settings (v2)
    /** (settings: Settings) A setting changed; see src/settings.ts */
    SETTINGS_CHANGED: 'settings-changed',

    // Progression
    /** () The title screen is showing */
    TITLE_SHOWN: 'title-shown',
    /** (levelNumber: number, name: string, style: StyleId, introText: string[]) First room of a level began */
    LEVEL_STARTED: 'level-started',
    /** () The player opened a chest */
    CHEST_OPENED: 'chest-opened',
    /** (id: RayId) The player gained a radiation type */
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
