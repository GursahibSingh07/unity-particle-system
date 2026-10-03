// Shared contracts. Everyone codes against these, so agree changes with the team first.

export type RadiationId = 'radio' | 'infrared' | 'ultraviolet' | 'gamma';
export type MonsterId = 'swarmlet' | 'frostling' | 'shade' | 'ironclad' | 'prism';
export type StyleId = 'goldenAge' | 'noir' | 'manga' | 'eightBit' | 'finalPage';

export interface RadiationDef {
    id: RadiationId;
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
    color: number;
    radius: number;
    maxHealth: number;
    speed: number;
    contactDamage: number;
    weakTo: RadiationId[];
    resists: RadiationId[];
}

/** Anything the EMW Machine can hit */
export interface Damageable {
    takeDamage(type: RadiationId, amount: number): void;
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

/** Position and size in pixels, measured from the room's top-left corner */
export interface WallDef {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RoomDef {
    walls?: WallDef[];
    waves: WaveDef[];
}

export interface LevelDef {
    name: string;
    style: StyleId;
    /** Radiation types the player can use in this level */
    radiations: RadiationId[];
    introText?: string;
    rooms: RoomDef[];
}
