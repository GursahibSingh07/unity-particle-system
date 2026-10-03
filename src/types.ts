// Shared contracts. Everyone codes against these, so agree changes with the team first.

export type RadiationId = 'radio' | 'infrared' | 'ultraviolet' | 'gamma';
export type MonsterId = 'swarmlet' | 'frostling' | 'shade' | 'ironclad' | 'prism';
/** Styles that have their own palette; every sprite is baked once per ArtStyle */
export type ArtStyle = 'goldenAge' | 'noir' | 'manga' | 'plain';
/** A level's style. `finalPage` is the boss, which cycles through the art styles. */
export type StyleId = ArtStyle | 'finalPage';

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

export interface RoomDef {
    /** 10 strings of 20 characters; the legend is in docs/DESIGN.md and src/systems/roomLayout.ts */
    layout: string[];
    waves: WaveDef[];
    /** A chest appears on the C tile when the room is cleared, holding this radiation */
    reward?: RadiationId;
    /** The only radiation that breaks this room's S (secret wall) tiles */
    secret?: RadiationId;
}

export interface LevelDef {
    name: string;
    style: StyleId;
    /**
     * Radiation types the player has on entering this level. In a normal playthrough the
     * player's unlocked set (src/state.ts) is used; this is the fallback for dev jumps.
     */
    radiations: RadiationId[];
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
