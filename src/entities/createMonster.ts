import type Phaser from 'phaser';
import { MONSTERS } from '../config/monsters';
import type { MonsterId } from '../types';
import { Ironclad } from './Ironclad';
import { Monster, type MonsterWorld } from './Monster';
import { Prism } from './Prism';
import { Shade } from './Shade';
import { Swarmlet } from './Swarmlet';

/** Frostlings use the plain chasing Monster */
const CLASSES: Record<MonsterId, typeof Monster> = {
    swarmlet: Swarmlet,
    frostling: Monster,
    shade: Shade,
    ironclad: Ironclad,
    prism: Prism,
};

/** Builds the right kind of monster and adds it to the room's monster group */
export function createMonster(scene: Phaser.Scene, id: MonsterId, x: number, y: number, world: MonsterWorld) {
    const monster = new CLASSES[id](scene, x, y, MONSTERS[id], world);
    world.monsters.add(monster);
    return monster;
}
