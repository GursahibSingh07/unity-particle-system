import Phaser from 'phaser';
import { MONSTERS } from '../config/monsters';
import { BLUE, ENERGY, GREEN, RAYS, RAY_VS_CLASS, RED, UV, WHITE } from '../config/rays';
import { getSettings } from '../settings';
import type { EnemyClass, MonsterId, RayId } from '../types';
import { RAY_ICON } from './eras';
import { LABELS } from './labels';
import { GREY, INK, PAPER_SHADE, RED as RED_INK, makeText } from './theme';

const RAY_ORDER: RayId[] = ['blue', 'red', 'green', 'white', 'uv'];
const ROW_GAP = 8;
const ICON_SCALE = 2;
const ICON_SIZE = 24 * ICON_SCALE;

const seconds = (ms: number) => `${Math.round(ms / 100) / 10}s`;

/** What each ray does, with the numbers the game is really using */
function effects(ray: RayId): string {
    const def = RAYS[ray];
    switch (ray) {
        case 'blue':
            return `A cone in front. Hits everything in it for ${def.damage}, every ${seconds(BLUE.cooldown)}. Stopped by walls.`;
        case 'red':
            return (
                `A laser while you hold fire. ${def.damage} a second up close, ` +
                `falling to ${Math.round(def.damage * RED.farDamage)} at full range. Passes through enemies.`
            );
        case 'green':
            return (
                `Tap for a short lob (${Math.round(def.damage * GREEN.minPower)}); hold ${seconds(GREEN.chargeTime)} for a long one (${def.damage}). ` +
                `The burst slows, and leaves a pool that slows for ${seconds(GREEN.puddleDuration)}.`
            );
        case 'white':
            return `A ring all round you. Pushes enemies back, turns thrown things round, and hits for ${def.damage}.`;
        case 'uv':
            return `A cone that reveals what hides and halves its health. Dazzles everything in it for ${seconds(UV.stun)}. No damage otherwise.`;
    }
}

/** Enemies a ray is better than usual against: the part the game otherwise leaves the player to find out */
export function strongAgainst(ray: RayId): MonsterId[] {
    return (Object.keys(MONSTERS) as MonsterId[]).filter((id) => {
        const kind: EnemyClass = MONSTERS[id].class;
        return kind !== 'boss' && (ray === 'uv' ? kind === 'stealth' : RAY_VS_CLASS[ray][kind] > 1);
    });
}

/** The rays an enemy is weak to */
export function weakTo(id: MonsterId): RayId[] {
    return RAY_ORDER.filter((ray) => strongAgainst(ray).includes(id));
}

export const rayNames = (rays: RayId[]) => rays.map((ray) => RAYS[ray].name.toUpperCase()).join(', ');

/** The pause screen's page on the machine: every ray and exactly what it does */
export function buildWeaponGuide(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    const demo = getSettings().demoMode;
    const g = scene.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [g];
    const rowHeight = Math.floor((height - ROW_GAP * (RAY_ORDER.length - 1)) / RAY_ORDER.length);
    const textX = ICON_SIZE + 32;
    const textWidth = width - textX - 16;

    RAY_ORDER.forEach((ray, i) => {
        const def = RAYS[ray];
        const top = i * (rowHeight + ROW_GAP);
        g.fillStyle(PAPER_SHADE, 1).fillRect(0, top, width, rowHeight);
        g.fillStyle(def.color, 1).fillRect(0, top, 8, rowHeight);

        parts.push(scene.add.image(20 + ICON_SIZE / 2, top + rowHeight / 2, 'icons', RAY_ICON[ray]).setScale(ICON_SCALE));
        parts.push(makeText(scene, textX, top + 8, def.name.toUpperCase(), 25, { bold: true, color: INK }));
        parts.push(
            makeText(scene, width - 16, top + 12, `${LABELS.energyCost} ${def.energyCost}/${ENERGY.max}`, 15, { color: GREY }).setOrigin(1, 0),
        );
        const body = makeText(scene, textX, top + 36, effects(ray), 15, { color: INK, wrap: textWidth, lineSpacing: 1 });
        parts.push(body);

        if (demo) {
            const names = strongAgainst(ray).map((id) => MONSTERS[id].name);
            const line = `${LABELS.strongAgainst} ${names.length > 0 ? names.join(', ') : LABELS.nothingSpecial}`;
            parts.push(makeText(scene, textX, top + rowHeight - 22, line, 15, { bold: true, color: RED_INK, wrap: textWidth }));
        }
    });

    return scene.add.container(x, y, parts);
}
