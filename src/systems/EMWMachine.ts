import Phaser from 'phaser';
import { BLUE, ENERGY, GREEN, RAYS, RED, UV, WHEEL, WHITE } from '../config/rays';
import { DEPTH } from '../entities/effects';
import { MACHINE_LENGTH, type Player } from '../entities/Player';
import { Events } from '../events';
import type { MonsterDef, RayDef, RayId, RayMode, WeaponRule } from '../types';
import { redFalloff } from './Combat';
import { castRay, rayToRect, segmentClear } from './Navigation';
import * as fx from './rayEffects';
import type { Rect } from './roomLayout';

const SELECTED_KEY = 'selectedRadiation';
/** Rays drawn to shape a cone around walls and ray-blockers */
const CONE_RAYS = 14;
/** Named so the charge's slow multiplies with whatever else is slowing the player */
const CHARGE_FACTOR = 'greenCharge';
/** Burst tests look from just short of where the blob stopped, so they do not start inside a wall */
const BURST_BACKOFF = 1;
/** A beam held on a wall sparks this often */
const WALL_SPARK_EVERY = 110;

/** The room's unbroken secret walls, and who to tell when radiation touches one */
export interface SecretWalls {
    tiles: Rect[];
    touch(tile: Rect, type: RayId): void;
}

/**
 * What the machine needs from an enemy (src/art/v2/sheets.ts). Everything beyond the basics
 * is optional, so an enemy that has not grown a method yet is simply not affected by it.
 */
export interface RayTarget {
    def: MonsterDef;
    x: number;
    y: number;
    active: boolean;
    takeDamage(ray: RayId, amount: number): boolean | void;
    knockback?(fromX: number, fromY: number, speed: number, ms: number): void;
    slow?(factor: number, ms: number): void;
    stun?(ms: number): void;
    exposeToUv?(): boolean;
    blocksRays?: boolean;
}

/** A thrown thing White can turn round */
interface Deflectable {
    x: number;
    y: number;
    active: boolean;
    deflect?(fromX: number, fromY: number, speed: number): void;
}

/** The fourth argument of WEAPON_STATE: what the HUD cannot work out from the rule alone */
export interface WeaponStatus {
    /** The ray fire would use right now; null when the wheel is empty in RGB mode */
    ray: RayId | null;
    /** Milliseconds until a locked wheel next turns by itself; null when the wheel is the player's */
    rotateInMs: number | null;
    /** True from WHEEL.warnMs before a locked wheel turns until it has turned */
    warning: boolean;
    /** The wheel position a locked wheel will turn to; null when the wheel is the player's */
    nextIndex: number | null;
}

interface Blob {
    x: number;
    y: number;
    angle: number;
    travelled: number;
    /** How far this one goes before it bursts: longer for a fuller charge */
    range: number;
    /** 0 to 1: how full the charge was */
    power: number;
    /** Overdrive at the moment it was fired */
    boost: number;
    sprite: fx.BlobSprite;
}

interface Puddle {
    x: number;
    y: number;
    radius: number;
    left: number;
    nextTick: number;
}

/** Distance along a ray (unit vector) to where it enters a circle; 0 from inside, Infinity on a miss */
function rayToCircle(x: number, y: number, dx: number, dy: number, cx: number, cy: number, radius: number) {
    const ox = cx - x;
    const oy = cy - y;
    const along = ox * dx + oy * dy;
    const offSq = ox * ox + oy * oy - along * along;
    const radiusSq = radius * radius;
    if (offSq > radiusSq) {
        return Infinity;
    }
    const half = Math.sqrt(radiusSq - offSq);
    if (along + half < 0) {
        return Infinity;
    }
    return Math.max(0, along - half);
}

function distanceToRect(x: number, y: number, rect: Rect) {
    const nearX = Phaser.Math.Clamp(x, rect.x, rect.x + rect.width);
    const nearY = Phaser.Math.Clamp(y, rect.y, rect.y + rect.height);
    return Math.hypot(nearX - x, nearY - y);
}

/**
 * The player's weapon. A colour wheel (Q and E), a mode key (F) and one shared energy pool; what
 * is on the wheel, which modes exist and how hard it runs are set by the era's WeaponRule.
 * It emits events and never draws text or makes a sound.
 */
export class EMWMachine {
    readonly maxEnergy = ENERGY.max;
    energy = ENERGY.max;

    private rule: WeaponRule;
    private modeIndex = 0;
    private wheelIndex = 0;
    /** Milliseconds until a locked wheel turns by itself */
    private rotateIn = 0;
    private warned = false;
    /** The last ray that could be fired, for `selected` when there is none */
    private lastRay: RayId = 'blue';

    private graphics: Phaser.GameObjects.Graphics;
    private nextShotAt = 0;
    private lastFiredAt = 0;
    /** Set when energy runs dry; firing is locked until it recovers */
    private depleted = false;
    private wasDown = false;
    /** The continuous beam or charge that BEAM was last emitted as on for */
    private beamOn: RayId | null = null;
    /** Milliseconds of Green charge, or -1 when not charging */
    private charge = -1;
    private blobs: Blob[] = [];
    private puddles: Puddle[] = [];
    private nextWallSparkAt = 0;

    /**
     * @param rule The era's rule; replace it at any time with setRule()
     * @param projectiles The room's thrown things, for White to push away
     */
    constructor(
        private scene: Phaser.Scene,
        private player: Player,
        private monsters: Phaser.Physics.Arcade.Group,
        private walls: Rect[],
        rule: WeaponRule,
        private secrets: SecretWalls | null = null,
        private projectiles: Phaser.Physics.Arcade.Group | null = null,
    ) {
        this.rule = rule;
        this.rotateIn = rule.autoRotateMs ?? 0;
        this.graphics = scene.add.graphics().setDepth(DEPTH.effect);

        const keyboard = scene.input.keyboard!;
        const bindings: [number, () => void][] = [
            [Phaser.Input.Keyboard.KeyCodes.Q, () => this.onWheelKey(-1)],
            [Phaser.Input.Keyboard.KeyCodes.E, () => this.onWheelKey(1)],
            [Phaser.Input.Keyboard.KeyCodes.F, () => this.onModeKey()],
        ];
        const keys = bindings.map(([code, handler]) => keyboard.addKey(code).on('down', handler));

        // Keep the player's choice from the previous room, if the rule still has it
        const remembered = scene.registry.get(SELECTED_KEY) as RayId | undefined;
        if (remembered) {
            this.place(remembered);
        }
        this.lastRay = this.ray ?? this.lastRay;
        this.player.setRule(rule);
        this.player.setLens(this.ray ? RAYS[this.ray].color : null);

        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            for (const key of keys) {
                key.off('down');
            }
            // A room can end mid-beam; whoever is listening must hear it stop
            this.stop();
        });
    }

    /** The mode the mode key has the machine in */
    get mode(): RayMode {
        return this.rule.modes[this.modeIndex] ?? 'rgb';
    }

    /** The ray fire would use right now; null when the wheel is empty in RGB mode */
    get ray(): RayId | null {
        switch (this.mode) {
            case 'uv':
                return 'uv';
            case 'unprism':
                return 'white';
            default:
                return this.rule.wheel[this.wheelIndex] ?? null;
        }
    }

    /** The active ray's definition (the last one that was active, when there is none) */
    get selected(): RayDef {
        return RAYS[this.ray ?? this.lastRay];
    }

    get currentRule(): WeaponRule {
        return this.rule;
    }

    /** True while a Green blob is being charged */
    get isCharging() {
        return this.charge >= 0;
    }

    /** 2 in overdrive: everything timed runs twice as fast and every hit lands twice as hard */
    private get boost() {
        return this.rule.overdrive ? 2 : 1;
    }

    private get locked() {
        return !!this.rule.autoRotateMs;
    }

    update(delta: number) {
        this.graphics.clear();
        this.updateWheel(delta);
        this.updateBlobs(delta);

        const now = this.scene.time.now;
        const down = this.scene.input.activePointer.leftButtonDown() && !this.player.isDead;
        const pressed = down && !this.wasDown;
        this.wasDown = down;

        const ray = this.ray;
        let fired = false;
        if (!ray) {
            if (pressed) {
                this.deny();
            }
        } else if (ray === 'green') {
            fired = this.updateGreen(down, pressed, delta);
        } else if (down && !this.depleted) {
            fired = this.fire(ray, delta, pressed);
        } else if (pressed) {
            this.deny();
        }

        let beaming: RayId | null = null;
        if (this.isCharging) {
            beaming = 'green';
        } else if (fired && ray === 'red') {
            beaming = 'red';
        }
        this.setBeam(beaming);

        if (fired) {
            this.lastFiredAt = now;
        } else if (now - this.lastFiredAt >= ENERGY.regenDelay) {
            this.setEnergy(this.energy + (ENERGY.regenPerSecond * delta) / 1000);
        }

        if (this.energy <= 0) {
            this.depleted = true;
        } else if (this.energy >= ENERGY.recoverAt) {
            this.depleted = false;
        }
    }

    /** Clear anything left on screen or in the air, for when the room ends or pauses mid-shot */
    stop() {
        this.graphics.clear();
        this.cancelCharge();
        this.setBeam(null);
        for (const blob of this.blobs) {
            blob.sprite.destroy();
        }
        this.blobs = [];
        this.puddles = [];
    }

    /**
     * Put the machine under another rule (the boss does this mid-fight). The mode and the colour
     * in use are kept when the new rule still has them; otherwise it falls back to the rule's
     * first mode and the first colour on its wheel.
     */
    setRule(rule: WeaponRule) {
        const ray = this.ray;
        const mode = this.mode;
        const colour = this.rule.wheel[this.wheelIndex];
        const rotation = this.rule.autoRotateMs;

        this.rule = rule;
        this.modeIndex = Math.max(0, rule.modes.indexOf(mode));
        this.wheelIndex = Math.max(0, rule.wheel.indexOf(colour));
        if (rule.autoRotateMs !== rotation) {
            this.rotateIn = rule.autoRotateMs ?? 0;
            this.warned = false;
        }

        if (this.mode !== mode) {
            this.scene.game.events.emit(Events.MODE_CHANGED, this.mode);
        }
        this.afterChange(ray);
        this.player.setRule(rule);
    }

    /** Tell the HUD where the machine and the dash stand; call once the room is ready */
    announce() {
        this.emitState();
        this.player.emitDashState();
    }

    /** Switch to a ray if the rule allows it; returns false (and does nothing) if it does not */
    select(id: RayId) {
        const ray = this.ray;
        const mode = this.mode;
        if (!this.place(id)) {
            return false;
        }
        if (this.mode !== mode) {
            this.scene.game.events.emit(Events.MODE_CHANGED, this.mode);
        }
        this.afterChange(ray);
        return true;
    }

    /** Rays are no longer owned one by one: the rule decides. Kept so older callers still run. */
    unlock(_id: RayId) {
        // Nothing to do
    }

    /** Move the mode and the wheel to a ray without telling anyone; false if the rule has no such ray */
    private place(id: RayId) {
        const special: Partial<Record<RayId, RayMode>> = { uv: 'uv', white: 'unprism' };
        const mode = special[id] ?? 'rgb';
        const modeIndex = this.rule.modes.indexOf(mode);
        if (modeIndex < 0) {
            return false;
        }
        if (mode === 'rgb') {
            const wheelIndex = this.rule.wheel.indexOf(id);
            if (wheelIndex < 0) {
                return false;
            }
            this.wheelIndex = wheelIndex;
        }
        this.modeIndex = modeIndex;
        return true;
    }

    private onWheelKey(step: 1 | -1) {
        if (this.player.frozen || this.player.isDead) {
            return;
        }
        if (this.locked) {
            this.deny();
            return;
        }
        this.turnWheel(step);
    }

    private onModeKey() {
        if (this.player.frozen || this.player.isDead || this.rule.modes.length < 2) {
            return;
        }
        const ray = this.ray;
        this.modeIndex = (this.modeIndex + 1) % this.rule.modes.length;
        this.scene.game.events.emit(Events.MODE_CHANGED, this.mode);
        this.afterChange(ray);
    }

    private turnWheel(step: 1 | -1) {
        const size = this.rule.wheel.length;
        if (size < 2) {
            return;
        }
        const ray = this.ray;
        this.wheelIndex = (this.wheelIndex + step + size) % size;
        this.afterChange(ray);
    }

    /** A locked wheel counts down, warns, and turns by itself */
    private updateWheel(delta: number) {
        const every = this.rule.autoRotateMs;
        if (!every || this.rule.wheel.length < 2) {
            return;
        }
        this.rotateIn -= delta;
        if (this.rotateIn <= 0) {
            this.rotateIn += every;
            this.warned = false;
            this.turnWheel(1);
        } else if (!this.warned && this.rotateIn <= WHEEL.warnMs) {
            this.warned = true;
            this.emitState();
        }
    }

    /** The mode, the wheel or the rule changed: `before` is the ray that was active until now */
    private afterChange(before: RayId | null) {
        const ray = this.ray;
        if (ray !== before) {
            if (this.isCharging) {
                // A wheel that turns by itself must not eat a charge that was ready to go
                this.releaseGreen();
            }
            this.cancelCharge();
            this.setBeam(null);
            this.player.setLens(ray ? RAYS[ray].color : null);
            if (ray) {
                this.lastRay = ray;
                this.scene.registry.set(SELECTED_KEY, ray);
                this.scene.game.events.emit(Events.RADIATION_CHANGED, ray);
            }
        }
        this.emitState();
    }

    private emitState() {
        const size = this.rule.wheel.length;
        const turning = this.locked && size >= 2;
        const status: WeaponStatus = {
            ray: this.ray,
            rotateInMs: turning ? Math.max(0, this.rotateIn) : null,
            warning: turning && this.warned,
            nextIndex: turning ? (this.wheelIndex + 1) % size : null,
        };
        this.scene.game.events.emit(Events.WEAPON_STATE, this.rule, this.mode, this.wheelIndex, status);
    }

    private deny() {
        this.scene.game.events.emit(Events.DENIED);
    }

    /** Emits BEAM when a continuous beam or charge starts or stops */
    private setBeam(id: RayId | null) {
        if (id === this.beamOn) {
            return;
        }
        if (this.beamOn) {
            this.scene.game.events.emit(Events.BEAM, this.beamOn, false);
        }
        this.beamOn = id;
        if (id) {
            this.scene.game.events.emit(Events.BEAM, id, true);
        }
    }

    private fire(ray: RayId, delta: number, pressed: boolean) {
        switch (ray) {
            case 'blue':
                return this.fireShot(ray, pressed, BLUE.cooldown, () => this.fireBlue());
            case 'red':
                return this.fireRed(delta);
            case 'white':
                return this.fireShot(ray, pressed, WHITE.cooldown, () => this.fireWhite());
            case 'uv':
                return this.fireShot(ray, pressed, UV.cooldown, () => this.fireUv());
            default:
                return false;
        }
    }

    /** One-off shots: pay, start the cooldown, announce. Holding fire repeats them. */
    private fireShot(ray: RayId, pressed: boolean, cooldown: number, shoot: () => void) {
        const def = RAYS[ray];
        const now = this.scene.time.now;
        if (this.energy < def.energyCost) {
            if (pressed) {
                this.deny();
            }
            return false;
        }
        if (now < this.nextShotAt) {
            return false;
        }

        // Overdrive halves the wait and leaves the price alone, so energy drains twice as fast
        this.nextShotAt = now + cooldown / this.boost;
        this.setEnergy(this.energy - def.energyCost);
        this.scene.game.events.emit(Events.SHOT, def.id);
        shoot();
        return true;
    }

    /** Where the rays leave from, and the tip of the machine where they are seen to */
    private muzzle() {
        const { x, handY: y, aimAngle: angle } = this.player;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return { x, y, angle, cos, sin, tipX: x + cos * MACHINE_LENGTH, tipY: y + sin * MACHINE_LENGTH };
    }

    /**
     * Everything inside a cone from the player's hands, and the cone's far edge for drawing.
     * Walls always cut it short; ray-blockers do too when `blockable`.
     */
    private cone(ray: RayId, range: number, halfAngleDegrees: number, blockable: boolean) {
        const { x, y, angle } = this.muzzle();
        const halfAngle = Phaser.Math.DegToRad(halfAngleDegrees);
        const monsters = this.activeMonsters();
        const blockers = blockable ? monsters.filter((monster) => monster.blocksRays === true) : [];

        const targets = monsters.filter((monster) => {
            const distance = Phaser.Math.Distance.Between(x, y, monster.x, monster.y);
            const radius = monster.def.radius;
            if (distance > range + radius) {
                return false;
            }
            // A monster is inside the cone if any part of its body is
            const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(monster.y - y, monster.x - x) - angle));
            const cover = distance > radius ? Math.asin(radius / distance) : Math.PI;
            if (off > halfAngle + cover) {
                return false;
            }
            return this.reaches(x, y, monster, blockers);
        });

        // The flash is a fan of rays, each cut short by the first thing that stops it
        const rim: fx.FxPoint[] = [];
        for (let i = 0; i <= CONE_RAYS; i++) {
            const spoke = angle - halfAngle + (i / CONE_RAYS) * halfAngle * 2;
            const cos = Math.cos(spoke);
            const sin = Math.sin(spoke);
            const toWall = castRay(x, y, spoke, range, this.walls);
            let reach = toWall;
            for (const blocker of blockers) {
                reach = Math.min(reach, rayToCircle(x, y, cos, sin, blocker.x, blocker.y, blocker.def.radius));
            }
            if (toWall < range && reach === toWall) {
                this.touchSecretAt(x, y, cos, sin, toWall, ray);
            }
            rim.push({ x: x + cos * reach, y: y + sin * reach });
        }
        return { targets, rim, origin: { x, y } };
    }

    /** True if nothing stands between a point and a monster: no wall, and no ray-blocker in front of it */
    private reaches(x: number, y: number, monster: RayTarget, blockers: RayTarget[]) {
        if (!segmentClear(x, y, monster.x, monster.y, this.walls)) {
            return false;
        }
        const distance = Math.hypot(monster.x - x, monster.y - y);
        if (distance === 0) {
            return true;
        }
        const dx = (monster.x - x) / distance;
        const dy = (monster.y - y) / distance;
        for (const blocker of blockers) {
            if (blocker === monster) {
                continue;
            }
            if (rayToCircle(x, y, dx, dy, blocker.x, blocker.y, blocker.def.radius) < distance - monster.def.radius) {
                return false;
            }
        }
        return true;
    }

    private fireBlue() {
        const def = RAYS.blue;
        const { targets, rim, origin } = this.cone('blue', BLUE.range, BLUE.halfAngle, true);
        for (const monster of targets) {
            monster.takeDamage('blue', def.damage * this.boost);
        }
        const { tipX, tipY } = this.muzzle();
        fx.blueCone(this.scene, origin, rim, def.color, BLUE.flashDuration);
        fx.muzzleFlash(this.scene, tipX, tipY, def.color);
    }

    private fireUv() {
        const def = RAYS.uv;
        const { targets, rim, origin } = this.cone('uv', UV.range, UV.halfAngle, false);
        for (const monster of targets) {
            monster.stun?.(UV.stun);
            const revealed = typeof monster.exposeToUv === 'function' && monster.exposeToUv();
            if (!revealed && monster.active) {
                fx.fizz(this.scene, monster.x, monster.y - monster.def.radius - 3);
            }
        }
        fx.uvCone(this.scene, origin, rim, def.color, UV.flashDuration);
    }

    private fireWhite() {
        const def = RAYS.white;
        const { x, y } = this.player;
        for (const monster of this.activeMonsters()) {
            const reach = WHITE.range + monster.def.radius;
            if (Phaser.Math.Distance.Between(x, y, monster.x, monster.y) > reach) {
                continue;
            }
            if (!segmentClear(x, y, monster.x, monster.y, this.walls)) {
                continue;
            }
            monster.takeDamage('white', def.damage * this.boost);
            // Pushed whether or not it was hurt: the push is the point
            if (monster.active) {
                monster.knockback?.(x, y, WHITE.knockbackSpeed, WHITE.knockbackDuration);
            }
        }

        // A copy, because a deflected projectile may leave the group
        const thrown = (this.projectiles?.getChildren().slice() ?? []) as unknown as Deflectable[];
        for (const projectile of thrown) {
            if (!projectile.active || Phaser.Math.Distance.Between(x, y, projectile.x, projectile.y) > WHITE.range) {
                continue;
            }
            projectile.deflect?.(x, y, WHITE.deflectSpeed);
        }

        for (const tile of this.secretTiles()) {
            if (distanceToRect(x, y, tile) <= WHITE.range) {
                this.secrets!.touch(tile, 'white');
            }
        }

        fx.whiteRing(this.scene, x, y, WHITE.range, def.color, WHITE.ringDuration);
        fx.shake(this.scene, 90, 0.0035);
    }

    private fireRed(delta: number) {
        const def = RAYS.red;
        const boost = this.boost;
        const seconds = delta / 1000;
        this.setEnergy(this.energy - def.energyCost * boost * seconds);

        const { x, y, angle, cos, sin, tipX, tipY } = this.muzzle();
        const monsters = this.activeMonsters();

        // Measured from the player's hands, so a monster right on top of him still burns.
        // It ends at the first wall or ray-blocker, which takes the hit itself.
        const toWall = castRay(x, y, angle, RED.range, this.walls);
        let reach = toWall;
        let blocker: RayTarget | null = null;
        for (const monster of monsters) {
            if (monster.blocksRays !== true) {
                continue;
            }
            const entry = rayToCircle(x, y, cos, sin, monster.x, monster.y, monster.def.radius);
            if (entry < reach) {
                reach = entry;
                blocker = monster;
            }
        }
        const stoppedByWall = !blocker && toWall < RED.range;
        if (stoppedByWall) {
            this.touchSecretAt(x, y, cos, sin, toWall, 'red');
        }

        for (const monster of monsters) {
            const along = Phaser.Math.Clamp((monster.x - x) * cos + (monster.y - y) * sin, 0, reach);
            const off = Math.hypot(monster.x - (x + cos * along), monster.y - (y + sin * along));
            if (monster !== blocker && off > monster.def.radius + RED.hitWidth / 2) {
                continue;
            }
            // What counts is how far the beam has travelled when it reaches the monster's near side
            const travelled = Math.max(0, along - monster.def.radius);
            monster.takeDamage('red', def.damage * boost * redFalloff(travelled) * seconds);
        }

        if (reach > MACHINE_LENGTH) {
            const end = { x: x + cos * reach, y: y + sin * reach };
            const width = (distance: number) => RED.farWidth + (RED.nearWidth - RED.farWidth) * redFalloff(distance);
            const now = this.scene.time.now;
            fx.redBeam(this.graphics, { x: tipX, y: tipY }, end, def.color, width(MACHINE_LENGTH), width(reach), now);
            if ((stoppedByWall || blocker) && now >= this.nextWallSparkAt) {
                this.nextWallSparkAt = now + WALL_SPARK_EVERY;
                fx.wallSpark(this.scene, end.x, end.y, def.color);
            }
        }
        return true;
    }

    /** Green charges while fire is held and is let go on release */
    private updateGreen(down: boolean, pressed: boolean, delta: number) {
        const def = RAYS.green;
        if (!this.isCharging) {
            // Held, not pressed: a wheel that turns to Green under a held button starts charging
            if (down && this.scene.time.now >= this.nextShotAt) {
                if (this.depleted || this.energy < def.energyCost) {
                    if (pressed) {
                        this.deny();
                    }
                    return false;
                }
                this.charge = 0;
                this.player.setSpeedFactor(CHARGE_FACTOR, GREEN.moveScale);
            }
            return this.isCharging;
        }

        if (!down) {
            return this.releaseGreen();
        }

        this.charge += delta * this.boost;
        const progress = Math.min(1, this.charge / GREEN.chargeTime);
        const { tipX, tipY } = this.muzzle();
        fx.greenCharge(
            this.graphics,
            { x: tipX, y: tipY },
            progress,
            progress >= GREEN.minCharge,
            def.color,
            this.scene.time.now,
        );
        return true;
    }

    private cancelCharge() {
        this.charge = -1;
        this.player.setSpeedFactor(CHARGE_FACTOR, 1);
    }

    /** Let the charge go: a blob if there was enough of it, a fizzle if not. Returns true if it fired. */
    private releaseGreen() {
        const def = RAYS.green;
        const progress = Math.min(1, this.charge / GREEN.chargeTime);
        this.cancelCharge();

        const { x, y, angle, tipX, tipY } = this.muzzle();
        if (progress < GREEN.minCharge || this.energy < def.energyCost) {
            fx.greenFizzle(this.scene, tipX, tipY, def.color);
            return false;
        }

        this.nextShotAt = this.scene.time.now + GREEN.cooldown / this.boost;
        this.setEnergy(this.energy - def.energyCost);
        this.scene.game.events.emit(Events.SHOT, def.id);
        fx.muzzleFlash(this.scene, tipX, tipY, def.color);

        const power = (progress - GREEN.minCharge) / (1 - GREEN.minCharge);
        const size = GREEN.blobRadius * (0.7 + 0.3 * power);
        // It sets off from his hands, not the tip, so it cannot be born inside a wall he is leaning on
        this.blobs.push({
            x,
            y,
            angle,
            travelled: 0,
            range: Phaser.Math.Linear(GREEN.minRange, GREEN.range, power),
            power,
            boost: this.boost,
            sprite: new fx.BlobSprite(this.scene, def.color, size, angle),
        });
        return true;
    }

    private updateBlobs(delta: number) {
        const now = this.scene.time.now;
        const monsters = this.blobs.length > 0 || this.puddles.length > 0 ? this.activeMonsters() : [];

        for (const blob of this.blobs.slice()) {
            const cos = Math.cos(blob.angle);
            const sin = Math.sin(blob.angle);
            const step = Math.min((GREEN.blobSpeed * delta) / 1000, blob.range - blob.travelled);

            // The first thing in its way this frame: a wall, or any enemy's body
            let stop = castRay(blob.x, blob.y, blob.angle, step, this.walls);
            let hit = stop < step;
            for (const monster of monsters) {
                if (!monster.active) {
                    continue;
                }
                const reach = monster.def.radius + GREEN.blobRadius;
                const entry = rayToCircle(blob.x, blob.y, cos, sin, monster.x, monster.y, reach);
                if (entry < stop) {
                    stop = entry;
                    hit = true;
                }
            }

            blob.x += cos * stop;
            blob.y += sin * stop;
            blob.travelled += stop;
            if (hit || blob.travelled >= blob.range - 0.01) {
                this.burst(blob, cos, sin);
            } else if (blob.travelled > MACHINE_LENGTH) {
                blob.sprite.draw(blob.x, blob.y, now);
            }
        }

        for (const puddle of this.puddles.slice()) {
            puddle.left -= delta;
            puddle.nextTick -= delta;
            if (puddle.nextTick <= 0) {
                puddle.nextTick += GREEN.puddleEvery;
                for (const monster of monsters) {
                    const reach = puddle.radius + monster.def.radius;
                    if (monster.active && Math.hypot(monster.x - puddle.x, monster.y - puddle.y) <= reach) {
                        monster.slow?.(GREEN.slowFactor, GREEN.puddleSlowDuration);
                    }
                }
            }
            if (puddle.left <= 0) {
                Phaser.Utils.Array.Remove(this.puddles, puddle);
            }
        }
    }

    private burst(blob: Blob, cos: number, sin: number) {
        const def = RAYS.green;
        Phaser.Utils.Array.Remove(this.blobs, blob);
        blob.sprite.destroy();

        const strength = GREEN.minPower + (1 - GREEN.minPower) * blob.power;
        const radius = GREEN.burstRadius * (0.7 + 0.3 * blob.power);
        const x = blob.x - cos * BURST_BACKOFF;
        const y = blob.y - sin * BURST_BACKOFF;

        const monsters = this.activeMonsters();
        const blockers = monsters.filter((monster) => monster.blocksRays === true);
        for (const monster of monsters) {
            if (Math.hypot(monster.x - x, monster.y - y) > radius + monster.def.radius) {
                continue;
            }
            if (!this.reaches(x, y, monster, blockers)) {
                continue;
            }
            monster.takeDamage('green', def.damage * strength * blob.boost);
            if (monster.active) {
                monster.slow?.(GREEN.slowFactor, GREEN.slowDuration);
            }
        }

        for (const tile of this.secretTiles()) {
            if (distanceToRect(blob.x, blob.y, tile) <= radius * 0.5) {
                this.secrets!.touch(tile, 'green');
            }
        }

        this.puddles.push({ x, y, radius, left: GREEN.puddleDuration, nextTick: GREEN.puddleEvery });
        fx.greenSplash(this.scene, x, y, radius, def.color, GREEN.puddleDuration);
        fx.shake(this.scene, 70, 0.0025);
    }

    /** A copy, because touching a secret wall can remove it from the list */
    private secretTiles() {
        return this.secrets ? this.secrets.tiles.slice() : [];
    }

    /** Tell the secret wall, if any, that a ray stopped by the walls after `reach` ended on */
    private touchSecretAt(x: number, y: number, dx: number, dy: number, reach: number, type: RayId) {
        for (const tile of this.secretTiles()) {
            if (Math.abs(rayToRect(x, y, dx, dy, tile) - reach) < 0.05) {
                this.secrets!.touch(tile, type);
                return;
            }
        }
    }

    /** A copy, because damaging a monster can remove it from the group */
    private activeMonsters() {
        return this.monsters.getChildren().filter((child) => child.active) as unknown as RayTarget[];
    }

    private setEnergy(value: number) {
        const energy = Phaser.Math.Clamp(value, 0, this.maxEnergy);
        if (energy !== this.energy) {
            this.energy = energy;
            this.scene.game.events.emit(Events.ENERGY_CHANGED, energy, this.maxEnergy);
        }
    }
}
