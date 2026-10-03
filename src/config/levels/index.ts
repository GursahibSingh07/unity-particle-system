import type { LevelDef } from '../../types';
import { boss } from './boss';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { sandbox } from './sandbox';

/** The shipped game, in play order: three comic pages and the boss */
export const LEVELS: LevelDef[] = [level1, level2, level3, boss];

/** Dev-only test level: open the game with ?sandbox in the URL */
export const SANDBOX: LevelDef = sandbox;
