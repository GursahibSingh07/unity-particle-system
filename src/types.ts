// Shared contracts. Everyone codes against these, so agree changes with the team first.

/** The five rays of the EMW Machine (docs/DESIGN.md section 5) */
export type RayId = 'blue' | 'red' | 'green' | 'white' | 'uv';
/** What the mode key cycles through: the colour wheel, the UV lens, or white light */
export type RayMode = 'rgb' | 'uv' | 'unprism';
/** Enemy classes: each ray is good against some and poor against others */
export type EnemyClass = 'swarm' | 'armor' | 'speed' | 'stealth' | 'projectile' | 'boss';
export type MonsterId =
    | 'rat'
    | 'slime'
    | 'bat'
    | 'ironclad'
    | 'golem'
    | 'zigbat'
    | 'skitter'
    | 'ghost'
    | 'wraith'
    | 'snowman'
    | 'acidSlime'
    | 'prism';
/** Eras that have their own look; every sprite is baked once per ArtStyle */
export type ArtStyle = 'goldenAge' | 'cyberpunk' | 'retro' | 'manga' | 'plain';
/** Things the player is handed as an era begins, each shown on an item card */
export type UpgradeId = RayId | 'dash' | 'doubleDash';
/** A level's style. `finalPage` is the boss, which cycles through the art styles. */
export type StyleId = ArtStyle | 'finalPage';

export interface RayDef {
    id: RayId;
    name: string;
    /** Number key that selects it (1-4) */
    key: number;
    color: number;
    /** Per shot, or per second for continuous beams */
    damage: number;
    /** Per shot, or per second for continuous beams */
    energyCost: number;
}

export interface MonsterDef {
    id: MonsterId;
    name: string;
    /** Decides which rays are strong or weak against it (RAY_VS_CLASS in config/rays.ts) */
    class: EnemyClass;
    color: number;
    radius: number;
    maxHealth: number;
    speed: number;
    contactDamage: number;
    weakTo: RayId[];
    resists: RayId[];
}

/** Anything the EMW Machine can hit */
export interface Damageable {
    takeDamage(type: RayId, amount: number): void;
}

export interface SpawnGroup {
    monster: MonsterId;
    count: number;
}

export interface WaveDef {
    spawns: SpawnGroup[];
    /** Milliseconds between the previous wave ending and this one spawning (default 1000) */
    delay?: number;
}

/** One line of a continuous era's spawn table */
export interface SpawnEntry {
    monster: MonsterId;
    /** Relative chance of being picked */
    weight: number;
    /** Seconds into the era before it can appear (default 0) */
    from?: number;
    /** How many arrive together (default 1) */
    group?: number;
}

/** A timed era: survive until the clock runs out */
export interface ContinuousDef {
    /** Seconds to survive */
    duration: number;
    /** Milliseconds between spawns at the start and at the end; it ramps between them */
    spawnEvery: [number, number];
    /** Never more than this many enemies alive at once */
    maxAlive: number;
    table: SpawnEntry[];
    /** Seconds before the end at which the final surge begins (default 20) */
    surge?: number;
    /** Dying restarts from the last multiple of this many seconds (default 45) */
    checkpointEvery?: number;
}

/** What an era does to the EMW Machine and the dash */
export interface WeaponRule {
    /** Colours on the wheel in RGB mode, in wheel order */
    wheel: RayId[];
    /** Modes the mode key cycles through */
    modes: RayMode[];
    /** Fires twice as fast, hits twice as hard, drains energy twice as fast */
    overdrive?: boolean;
    /** The wheel is locked and turns by itself every this many milliseconds */
    autoRotateMs?: number;
    /** 0 means the dash is not available yet */
    dashCharges: number;
    dashCooldownMs: number;
}

export interface RoomDef {
    /** 10 strings of 20 characters; the legend is in docs/DESIGN.md and src/systems/roomLayout.ts */
    layout: string[];
    waves: WaveDef[];
    /** Enemies keep coming from the street entries until a timer runs out; `waves` is then empty */
    continuous?: ContinuousDef;
    /** A chest appears on the C tile when the room is cleared, holding this radiation */
    reward?: RayId;
    /** The only radiation that breaks this room's S (secret wall) tiles */
    secret?: RayId;
}

export interface LevelDef {
    name: string;
    style: StyleId;
    /**
     * Radiation types the player has on entering this level. In a normal playthrough the
     * player's unlocked set (src/state.ts) is used; this is the fallback for dev jumps.
     */
    radiations: RayId[];
    /** How the machine and the dash behave in this era (default: DEFAULT_RULE in config/rays.ts) */
    rule?: WeaponRule;
    /** Handed to the player as the era begins, each on its own item card */
    grants?: UpgradeId[];
    /** Lines shown as a caption card when the level begins */
    introText?: string[];
    rooms: RoomDef[];
}

/** One Field Guide page */
export interface GuideEntry {
    /** The Handler's name for it */
    title: string;
    /** His confident field note, shown during the game */
    note: string;
    /** What it really was, shown after the ending */
    truth: string;
}
