import Phaser from 'phaser';
import { MONSTERS } from '../config/monsters';
import { BLUE, ENERGY, GREEN, RAYS, RAY_VS_CLASS, RED, UV, WHITE } from '../config/rays';
import { getSettings } from '../settings';
import type { EnemyClass, MonsterId, RayId } from '../types';
import { RAY_ICON } from './eras';
import { LABELS } from './labels';
import { CYAN, KEY, MAGENTA_INK, NEWSPRINT_LIGHT, PROCESS_YELLOW, captionBox, comicText, dots, fitWidth } from './comic';

export const RAY_ORDER: RayId[] = ['blue', 'red', 'green', 'white', 'uv'];
const SWATCH = 92;
const ICON_SCALE = 3;

const seconds = (ms: number) => `${Math.round(ms / 100) / 10}s`;

/** What each ray does, with the numbers the game is really using */
function effects(ray: RayId): string {
    const def = RAYS[ray];
    switch (ray) {
        case 'blue':
            return `A cone in front. Hits everything in it for ${def.damage}, every ${seconds(BLUE.cooldown)}. Strong against a swarm. Stopped by walls.`;
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

/** A panel's frame, with a swatch of flat colour and dots down its left side for the picture */
function frame(scene: Phaser.Scene, parts: Phaser.GameObjects.GameObject[], x: number, y: number, width: number, height: number, color: number) {
    const g = scene.add.graphics();
    captionBox(g, x, y, width, height, NEWSPRINT_LIGHT, 5, 4);
    g.fillStyle(color, 1).fillRect(x + 4, y + 4, SWATCH, height - 8);
    g.fillStyle(KEY, 1).fillRect(x + 4 + SWATCH, y + 4, 4, height - 8);
    parts.push(g, dots(scene, x + 4, y + 4, SWATCH, height - 8, KEY, 0.16));
}

/** The heading and the wording of a panel, the wording stepping down a size if it has to */
function wording(
    scene: Phaser.Scene,
    parts: Phaser.GameObjects.GameObject[],
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    tag: string,
    body: string,
    footer?: string,
) {
    const textX = x + SWATCH + 22;
    const textWidth = width - SWATCH - 38;
    const heading = comicText(scene, textX - 3, y + 8, title, 34, { display: true });
    parts.push(heading);
    if (tag) {
        const label = comicText(scene, 0, 0, tag, 16, { bold: true }).setOrigin(1, 0.5);
        const g = scene.add.graphics();
        const tagWidth = Math.ceil(label.width) + 16;
        captionBox(g, x + width - 14 - tagWidth, y + 12, tagWidth, 26, PROCESS_YELLOW, 0, 2);
        label.setPosition(x + width - 14 - 8, y + 25);
        parts.push(g, label);
        fitWidth(heading, textWidth - tagWidth - 12);
    }
    const foot = footer ? comicText(scene, textX, 0, footer, 17, { bold: true, color: MAGENTA_INK, wrap: textWidth }) : undefined;
    const footHeight = foot ? foot.height + 4 : 0;
    const room = height - 50 - 10 - footHeight;
    let text = comicText(scene, textX, y + 50, body, 20, { bold: true, wrap: textWidth });
    for (const size of [19, 18, 17, 16]) {
        if (text.height <= room) {
            break;
        }
        text.destroy();
        text = comicText(scene, textX, y + 50, body, size, { bold: true, wrap: textWidth });
    }
    parts.push(text);
    if (foot) {
        foot.setPosition(textX, y + height - 9 - foot.height);
        parts.push(foot);
    }
}

/** One ray as one panel of the book: what it does, with the numbers the game is really using */
export function buildRayPanel(scene: Phaser.Scene, ray: RayId, x: number, y: number, width: number, height: number) {
    const def = RAYS[ray];
    const parts: Phaser.GameObjects.GameObject[] = [];
    frame(scene, parts, x, y, width, height, def.color);
    parts.push(scene.add.image(x + 4 + SWATCH / 2, y + height / 2, 'icons', RAY_ICON[ray]).setScale(ICON_SCALE));

    let footer: string | undefined;
    if (getSettings().demoMode) {
        // Demo mode gives away what the game otherwise leaves the player to find out
        const names = strongAgainst(ray).map((id) => MONSTERS[id].name);
        footer = `${LABELS.strongAgainst} ${names.length > 0 ? names.join(', ') : LABELS.nothingSpecial}`;
    }
    wording(scene, parts, x, y, width, height, def.name.toUpperCase(), `${LABELS.energyCost} ${def.energyCost}/${ENERGY.max}`, effects(ray), footer);
    return parts;
}

/** The pool every ray draws on, as a panel of its own */
export function buildEnergyPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    const parts: Phaser.GameObjects.GameObject[] = [];
    frame(scene, parts, x, y, width, height, CYAN);
    const bolt = scene.add.graphics();
    const cx = x + 4 + SWATCH / 2;
    const cy = y + height / 2;
    const shape = [[8, -38], [-20, 6], [-3, 6], [-10, 38], [20, -8], [3, -8]].map(([px, py]) => new Phaser.Math.Vector2(cx + px, cy + py));
    bolt.fillStyle(KEY, 1).fillPoints(shape.map((point) => new Phaser.Math.Vector2(point.x + 3, point.y + 3)), true);
    bolt.fillStyle(PROCESS_YELLOW, 1).fillPoints(shape, true);
    bolt.lineStyle(3, KEY, 1).strokePoints(shape, true, true);
    parts.push(bolt);
    const body =
        `One pool of ${ENERGY.max} feeds every ray. It fills again at ${ENERGY.regenPerSecond} a second, ${seconds(ENERGY.regenDelay)} after the last shot. ` +
        `Run it dry and the machine locks until it is back to ${ENERGY.recoverAt}.`;
    wording(scene, parts, x, y, width, height, LABELS.energyTitle, '', body);
    return parts;
}
