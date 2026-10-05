import { LEVELS } from '../config/levels';
import type { RayId, StyleId, UpgradeId } from '../types';
import { ERA_FALLBACK_NAMES } from './labels';

/** Frames of the `icons` sheet */
export const RAY_ICON: Record<RayId, number> = { blue: 0, red: 1, green: 2, white: 3, uv: 4 };
export const DASH_ICON = 5;

/** Frames of the `era-icons` sheet */
export const ERA_ICON: Partial<Record<StyleId, number>> = { goldenAge: 0, cyberpunk: 1, retro: 2, manga: 3 };

/** What an era is called, from the level data so the words stay with their owner */
export function eraName(style: StyleId): string {
    return LEVELS.find((level) => level.style === style)?.name ?? ERA_FALLBACK_NAMES[style] ?? String(style);
}

export const isRay = (id: UpgradeId): id is RayId => id in RAY_ICON;
