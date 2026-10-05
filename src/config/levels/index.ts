import type { LevelDef } from '../../types';
import { boss } from './boss';
import { cyberpunk } from './cyberpunk';
import { golden } from './golden';
import { manga } from './manga';
import { retro } from './retro';
import { sandbox } from './sandbox';

/** The shipped game, in play order: four eras of the same city square, then the boss */
export const LEVELS: LevelDef[] = [golden, cyberpunk, retro, manga, boss];

/** Dev-only test level: open the game with ?sandbox in the URL */
export const SANDBOX: LevelDef = sandbox;
