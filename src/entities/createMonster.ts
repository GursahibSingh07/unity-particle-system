import type Phaser from 'phaser';
import { MONSTERS } from '../config/monsters';
import type { MonsterId } from '../types';
import { Ironclad } from './Ironclad';
import { Monster, type MonsterWorld } from './Monster';
import { Prism } from './Prism';
import { Ghost, Wraith } from './Ghost';
import { AcidSlime, Snowman } from './Throwers';
import { Bat, ZigBat } from './Bat';
import { Golem } from './Golem';
import { Rat } from './Rat';
import { Skitter } from './Skitter';
import { Slime } from './Slime';

/** Frostlings use the plain chasing Monster */
const CLASSES: Record<MonsterId, typeof Monster> = {
    rat: Rat,
    slime: Slime,
    ghost: Ghost,
    ironclad: Ironclad,
    prism: Prism,
    // PLACEHOLDERS until the Enemies owner builds them
    bat: Bat,
    golem: Golem,
    zigbat: ZigBat,
    skitter: Skitter,
    wraith: Wraith,
    snowman: Snowman,
    acidSlime: AcidSlime,
};

/** Builds the right kind of monster and adds it to the room's monster group */
export function createMonster(scene: Phaser.Scene, id: MonsterId, x: number, y: number, world: MonsterWorld) {
    const monster = new CLASSES[id](scene, x, y, MONSTERS[id], world);
    world.monsters.add(monster);
    return monster;
}
