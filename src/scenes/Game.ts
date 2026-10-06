import Phaser from 'phaser';
import { ERA, FLOW, SECRET } from '../config/flow';
import { LEVELS, SANDBOX } from '../config/levels';
import { HEART } from '../config/monsters';
import { DEFAULT_RULE, ERA_RULES, SECRET_RESIST_INTERVAL } from '../config/rays';
import { SQUARE_LAYOUT } from '../config/square';
import { BANNERS } from '../config/text';
import { ART_SCALE, ROOM, TILE, WORLD_HEIGHT, WORLD_WIDTH, ZOOM } from '../config/world';
import { openingRing, puff } from '../entities/effects';
import { Hazards } from '../entities/Hazard';
import { HealthUpgrade } from '../entities/HealthUpgrade';
import { Heart } from '../entities/Heart';
import type { Monster, MonsterWorld } from '../entities/Monster';
import { BASE_MAX_HEALTH, Player } from '../entities/Player';
import type { Projectile } from '../entities/Projectile';
import { Events } from '../events';
import { watchSettings } from '../settings';
import { Progress } from '../state';
import { awaitAnswer } from '../systems/conversation';
import { EMWMachine } from '../systems/EMWMachine';
import { checkpointSeconds } from '../systems/eraClock';
import { EraSpawner } from '../systems/EraSpawner';
import { Navigator } from '../systems/Navigation';
import { shake } from '../systems/rayEffects';
import { floorInFront, parseRoom, type ParsedRoom, type Rect, type RoomTile, mergeRects } from '../systems/roomLayout';
import { WaveDirector } from '../systems/WaveDirector';
import { HandmadeLook } from '../systems/handmade';
import { CityLife } from '../systems/cityLife';
import type { ArtStyle, LevelDef, MonsterId, RayId, RoomDef, UpgradeId, WeaponRule } from '../types';

/** The square's picture lies under everything; lamp heads and awnings are drawn over everyone, flyers included */
const CITY_DEPTH = 0.5;
const CITY_OVER_DEPTH = 4.8;

/** Registry: where a death in this era goes back to (seconds on the clock, or the wave) */
const CHECKPOINT_KEY = 'eraCheckpoint';
/** Registry: how many times the player has died at each checkpoint, for the hidden mercy heart */
const DEATHS_KEY = 'roomDeaths';
/** One HUD health block is this much health */
const HEALTH_PER_BLOCK = 5;
/** The sandbox keeps its secrets under this level number */
const SANDBOX_LEVEL = -1;

/** Drawn when a room is not the city square (a bad layout must not crash the game) */
const PLAIN_COLORS = { floor: 0x4a4a58, floorAlt: 0x52525f, wall: 0x1d1d28, secret: 0x1d1d28, prop: 0x7a7a8a };

const RAY_IDS: readonly string[] = ['blue', 'red', 'green', 'white', 'uv'];

export interface GameData {
    /** Which era (index into LEVELS). Any era can be started with no earlier progress. */
    level?: number;
    /** Sandbox only: which test room */
    room?: number;
    /** Dev only: play the sandbox level instead of LEVELS[level] */
    sandbox?: boolean;
    /** The era is starting again after a death: no title card, and it picks up from the checkpoint */
    retry?: boolean;
    /** Started from the cover's era select (demo mode). Carried along; the flow is the same. */
    demo?: boolean;
}

interface Checkpoint {
    key: string;
    /** Seconds on the clock in a timed era; the wave (from 0) in an era of waves */
    at: number;
}

interface Crack {
    tile: RoomTile;
    image: Phaser.GameObjects.Image | null;
    broken: boolean;
}

/**
 * One era: the city square, the machine under that era's rule, and either waves or a clock.
 * It never draws text or makes a sound: it emits events and waits for the UI scene's answers.
 */
export class Game extends Phaser.Scene {
    private levelIndex = 0;
    private roomIndex = 0;
    private sandbox = false;
    private retry = false;
    private demo = false;
    /** The era the square is drawn in right now (the boss changes it) */
    private artStyle: ArtStyle = 'goldenAge';
    private player!: Player;
    private monsters!: Phaser.Physics.Arcade.Group;
    private projectiles!: Phaser.Physics.Arcade.Group;
    private hearts!: Phaser.Physics.Arcade.Group;
    private upgrades!: Phaser.Physics.Arcade.Group;
    private solidBodies!: Phaser.Physics.Arcade.StaticGroup;
    private devNoDamage = false;
    private room!: ParsedRoom;
    private world!: MonsterWorld;
    private nav!: Navigator;
    private waves!: WaveDirector;
    private machine!: EMWMachine;
    /** The ice patches and acid pools on the floor */
    private hazards!: Hazards;
    /** The clock and the spawner of a timed era; null in an era of waves */
    private era: EraSpawner | null = null;
    private cityImages: Phaser.GameObjects.Image[] = [];
    /** Paper, grain, wobble and motes over the square (src/config/look.ts) */
    private look: HandmadeLook | null = null;
    /** Smoke, steam, spray, neon: what moves in the square (src/systems/cityLife.ts) */
    private life: CityLife | null = null;
    private crack: Crack | null = null;
    /** The cracked walls still standing: the machine reads this same list */
    private secretTiles: RoomTile[] = [];
    private nextResistSparkAt = 0;
    /** The intro and the upgrade card are done: enemies come and the clock runs */
    private started = false;
    /** The era is won (waves) or its clock has run out */
    private cleared = false;
    /** The era is over: nothing moves until the next one loads */
    private finished = false;
    /** Ends whatever answer from the UI the era is waiting for (K does this in dev) */
    private skipWait: (() => void) | null = null;
    /** The click that put a card away must not also fire: held until the button has been let go */
    private fireLocked = false;

    constructor() {
        super('Game');
    }

    init(data: GameData) {
        this.sandbox = data.sandbox ?? false;
        this.levelIndex = Phaser.Math.Clamp(data.level ?? 0, 0, LEVELS.length - 1);
        this.roomIndex = Phaser.Math.Clamp(data.room ?? 0, 0, this.level.rooms.length - 1);
        this.retry = data.retry ?? false;
        this.demo = data.demo ?? false;
        // The boss era opens in the Golden look and the Prism takes it from there
        this.artStyle = this.level.style === 'finalPage' ? 'goldenAge' : this.level.style;
        this.era = null;
        this.cityImages = [];
        this.life = null;
        this.crack = null;
        this.secretTiles = [];
        this.nextResistSparkAt = 0;
        this.started = false;
        this.cleared = false;
        this.finished = false;
        this.skipWait = null;
        this.fireLocked = false;
    }

    create() {
        this.cameras.main.setZoom(ZOOM).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        this.cameras.main.fadeIn(FLOW.fade, 0, 0, 0);
        this.look = new HandmadeLook(this, this.artStyle);
        this.physics.world.setBounds(ROOM.x, ROOM.y, ROOM.width, ROOM.height);

        if (!this.retry) {
            // An era entered afresh starts its clock at zero, and old deaths earn no mercy in it
            this.registry.remove(CHECKPOINT_KEY);
            this.registry.remove(DEATHS_KEY);
        }
        this.grantEarlierEras();

        const room = parseRoom(this.roomDef.layout);
        this.room = room;
        this.drawSquare(room);
        this.solidBodies = this.physics.add.staticGroup();
        // Buildings and furniture are merged separately: flyers pass over one and not the other,
        // and the collider asks which it is by the block's centre
        const walls = new Set(room.walls);
        const furniture = room.solids.filter((tile) => !walls.has(tile));
        for (const block of [...mergeRects(room.walls), ...mergeRects(furniture)]) {
            this.solidBodies.add(this.add.zone(block.x + block.width / 2, block.y + block.height / 2, block.width, block.height));
        }
        this.addCrack(room);

        // Every era, and every retry, starts at full health
        const maxHealth = BASE_MAX_HEALTH + Progress.bonusHealth(this.registry);
        this.player = new Player(this, room.start.x, room.start.y, this.artStyle, maxHealth);

        // The walls are passed too, so flyers can plan over the fountain and the furniture
        this.nav = new Navigator(room.solids, room.walls);
        this.nav.setGoal(this.player.x, this.player.y);
        // These groups are updated by hand in update(), so that everything stops when the era ends
        this.monsters = this.physics.add.group();
        this.projectiles = this.physics.add.group();
        this.hearts = this.physics.add.group();
        this.upgrades = this.physics.add.group();

        this.world = {
            player: this.player,
            nav: this.nav,
            solids: room.solids,
            walls: room.walls,
            style: this.artStyle,
            monsters: this.monsters,
            projectiles: this.projectiles,
            summon: (id, x, y) => this.waves.summon(id, x, y),
        };
        this.waves = new WaveDirector(this, this.roomDef, this.world);
        // Nothing arrives until the title card and the upgrade card have been put away
        this.waves.hold();
        // Enemies reach this through Hazards.of(scene)
        this.hazards = new Hazards(this, this.player, this.artStyle);
        this.machine = new EMWMachine(
            this,
            this.player,
            this.monsters,
            room.walls,
            this.weaponRule(),
            { tiles: this.secretTiles, touch: (tile, type) => this.onSecretTouched(tile, type) },
            this.projectiles,
        );
        // Space also puts captions and cards away, so no dash while the era waits on one
        this.player.dashAllowed = () => !this.skipWait && !this.finished;

        const checkpoint = this.checkpointAt;
        const continuous = this.roomDef.continuous;
        if (continuous) {
            this.era = new EraSpawner(this, continuous, this.waves, this.monsters, checkpoint, {
                onCheckpoint: (seconds) => this.saveCheckpoint(seconds),
                onTimeUp: () => this.onTimeUp(),
            });
        } else {
            this.waves.startAtWave(checkpoint);
        }

        this.addColliders();
        this.placeMercyHeart(room);

        const events = this.game.events;
        events.on(Events.MONSTER_KILLED, this.onMonsterKilled, this);
        events.on(Events.WAVE_STARTED, this.onWaveStarted, this);
        events.on(Events.ERA_SWAPPED, this.onEraSwapped, this);
        events.on(Events.PAUSED, this.onPaused, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            events.off(Events.MONSTER_KILLED, this.onMonsterKilled, this);
            events.off(Events.WAVE_STARTED, this.onWaveStarted, this);
            events.off(Events.ERA_SWAPPED, this.onEraSwapped, this);
            events.off(Events.PAUSED, this.onPaused, this);
        });

        if (import.meta.env.DEV) {
            this.input.keyboard!.on('keydown-K', () => this.devSkip());
            // ?nodamage: nothing hurts the player, for automated tests
            this.devNoDamage = new URLSearchParams(window.location.search).has('nodamage');
        }
        // God mode (Settings) can be switched on and off in the middle of an era
        const stopWatching = watchSettings((settings) => {
            this.player.invincible = this.devNoDamage || settings.godMode;
        });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopWatching);

        // Tell the HUD where things stand at the start of the era
        events.emit(Events.BANNER, '');
        events.emit(Events.ROOM_STARTED, this.level.name, this.roomIndex + 1, this.level.rooms.length);
        events.emit(Events.PLAYER_HEALTH_CHANGED, this.player.health, this.player.maxHealth);
        events.emit(Events.ENERGY_CHANGED, this.machine.energy, this.machine.maxEnergy);
        events.emit(Events.RADIATION_CHANGED, this.machine.selected.id);
        // WEAPON_STATE and DASH_STATE, for the colour wheel and the dash pips
        this.machine.announce();
        // The clock shows what is on it before it starts to run
        this.era?.announce();

        if (this.sandbox || this.retry) {
            this.begin();
            return;
        }
        // The UI shows the era's title card and captions, then what the era hands over
        const introText = this.level.introText ?? [];
        this.fireLocked = true;
        this.waitForUi(Events.DIALOG_DONE, FLOW.introTimeout + FLOW.introTimeoutPerLine * introText.length, () =>
            this.handOver(),
        );
        events.emit(Events.LEVEL_STARTED, this.levelIndex + 1, this.level.name, this.level.style, introText);
    }

    update(time: number, delta: number) {
        // Phaser stops asking for frames if update throws, which freezes the game for good. One
        // bad frame is better than that: report it (the smoke test fails on any console error)
        // and carry on.
        try {
            this.step(time, delta);
        } catch (error) {
            console.error('Game.update failed', error);
        }
    }

    private step(time: number, delta: number) {
        this.player.update();

        if (this.finished) {
            return;
        }

        if (this.player.isDead) {
            this.countDeath();
            // In a timed era past its first checkpoint, he is told he is not going back to the start
            const banner = this.era && this.checkpointAt > 0 ? BANNERS.checkpointRetry : BANNERS.roomFailed;
            this.leave(banner, FLOW.restartDelay, {
                level: this.levelIndex,
                room: this.roomIndex,
                sandbox: this.sandbox,
                demo: this.demo,
                retry: true,
            });
            return;
        }

        this.nav.setGoal(this.player.x, this.player.y);
        if (this.skipWait) {
            this.fireLocked = true;
        } else if (this.fireLocked && !this.input.activePointer.leftButtonDown()) {
            this.fireLocked = false;
        }
        if (!this.player.frozen && !this.fireLocked) {
            this.machine.update(delta);
        }
        // Copies, because updating can destroy members
        for (const monster of this.monsters.getChildren().slice()) {
            if (monster.active) {
                monster.update(time, delta);
            }
        }
        for (const projectile of this.projectiles.getChildren().slice()) {
            if (projectile.active) {
                projectile.update();
            }
        }
        // After the player has moved, so ice can make him slide
        this.hazards.update(delta);
        for (const heart of this.hearts.getChildren().slice()) {
            heart.update();
        }

        this.waves.update();
        if (this.started) {
            // Only here, so the clock stands still under cards, captions and the pause screen
            this.era?.update(delta);
        }
        if (!this.era && this.waves.cleared && !this.cleared) {
            this.onWavesCleared();
        }
    }

    /** For tests and tools: where the era stands, in plain values */
    snapshot() {
        return {
            level: this.levelIndex,
            room: this.roomIndex,
            sandbox: this.sandbox,
            style: this.artStyle,
            started: this.started,
            cleared: this.cleared,
            finished: this.finished,
            waiting: this.skipWait !== null,
            timed: this.era !== null,
            elapsed: this.era?.elapsed ?? 0,
            secondsLeft: this.era?.secondsLeft ?? 0,
            surging: this.era?.isSurging ?? false,
            checkpoint: this.checkpointAt,
            wave: this.waves.waveNumber,
            alive: this.monsters.countActive(true),
            incoming: this.waves.incoming,
            secretBroken: this.crack?.broken ?? false,
        };
    }

    private get level(): LevelDef {
        return this.sandbox ? SANDBOX : LEVELS[this.levelIndex];
    }

    private get roomDef(): RoomDef {
        return this.level.rooms[this.roomIndex];
    }

    /** The rule the machine and the dash start the era under */
    private weaponRule(): WeaponRule {
        if (this.level.rule) {
            return this.level.rule;
        }
        // The sandbox has no era of its own: everything is switched on there
        return this.sandbox ? DEFAULT_RULE : (ERA_RULES[this.level.style] ?? DEFAULT_RULE);
    }

    /** The level number this era's progress is kept under */
    private get levelKey() {
        return this.sandbox ? SANDBOX_LEVEL : this.levelIndex;
    }

    /** Identifies this era in the registry */
    private get roomKey() {
        return `${this.sandbox ? 'sandbox' : this.levelIndex}:${this.roomIndex}`;
    }

    /** Where a death goes back to: seconds on the clock, or the wave (0 when nothing is saved) */
    private get checkpointAt() {
        const saved = this.registry.get(CHECKPOINT_KEY) as Checkpoint | undefined;
        return saved && saved.key === this.roomKey ? saved.at : 0;
    }

    private get deaths() {
        return (this.registry.get(DEATHS_KEY) as Record<string, number> | undefined) ?? {};
    }

    /** Deaths are counted per checkpoint: reaching the next one starts the count again */
    private get deathKey() {
        return `${this.roomKey}@${this.checkpointAt}`;
    }

    private saveCheckpoint(at: number) {
        this.registry.set(CHECKPOINT_KEY, { key: this.roomKey, at } satisfies Checkpoint);
    }

    /**
     * An era can be started with no earlier progress (the dev URL, the cover's era select):
     * whatever the eras before it hand over is owned, without a card.
     */
    private grantEarlierEras() {
        if (this.sandbox) {
            return;
        }
        for (const earlier of LEVELS.slice(0, this.levelIndex)) {
            for (const id of earlier.grants ?? []) {
                this.grant(id);
            }
        }
    }

    /** Returns true if it was not already owned */
    private grant(id: UpgradeId) {
        if (RAY_IDS.includes(id)) {
            Progress.unlockRadiation(this.registry, id as RayId);
        }
        return Progress.grantUpgrade(this.registry, id);
    }

    /** Wait for an answer from the UI scene (or the timeout); K cuts the wait short in dev */
    private waitForUi(event: string, timeout: number, done: () => void, accept?: (...args: unknown[]) => boolean) {
        const finish = () => {
            this.skipWait = null;
            done();
        };
        const cancel = awaitAnswer(this, event, timeout, finish, accept);
        this.skipWait = () => {
            cancel();
            finish();
        };
    }

    /** The title card is away: hand over what this era gives, on one card, then begin */
    private handOver() {
        const fresh = (this.level.grants ?? []).filter((id) => this.grant(id));
        if (fresh.length === 0) {
            this.begin();
            return;
        }
        // He stands and looks at what he has been given until the card is put away
        this.player.frozen = true;
        this.machine.stop();
        this.waitForUi(
            Events.SCREEN_DONE,
            FLOW.upgradeCardTimeout,
            () => {
                this.player.frozen = false;
                this.begin();
            },
            (name) => name === 'itemGet',
        );
        this.game.events.emit(Events.UPGRADE_GET, fresh);
    }

    /** Enemies may come, and the clock starts */
    private begin() {
        if (this.started || this.finished) {
            return;
        }
        this.started = true;
        this.waves.release();
        this.era?.start();
    }

    /** True when this room is the city square, which has a painted picture for every era */
    private get onSquare() {
        const walls = (row: string | undefined) => row?.replace(/S/g, '#').replace(/[^#]/g, '.');
        return (
            this.textures.exists(`city-${this.artStyle}`) &&
            this.roomDef.layout.length === SQUARE_LAYOUT.length &&
            this.roomDef.layout.every((row, i) => walls(row) === walls(SQUARE_LAYOUT[i]))
        );
    }

    /** The square's picture and the layer of it that people walk behind; the layout is only physics */
    private drawSquare(room: ParsedRoom) {
        if (this.onSquare) {
            this.cityImages = [
                this.add
                    .image(ROOM.x, ROOM.y, `city-${this.artStyle}`)
                    .setOrigin(0, 0)
                    .setScale(ART_SCALE)
                    .setDepth(CITY_DEPTH),
                this.add
                    .image(ROOM.x, ROOM.y, `city-${this.artStyle}-over`)
                    .setOrigin(0, 0)
                    .setScale(ART_SCALE)
                    .setDepth(CITY_OVER_DEPTH),
            ];
            this.life = new CityLife(this, this.artStyle);
            return;
        }
        // Not the square: flat colour, so a room that should not exist can still be seen and played
        const plain = this.add.graphics().setDepth(CITY_DEPTH);
        for (const tile of room.tiles) {
            plain.fillStyle(tile.kind === 'prop' ? PLAIN_COLORS.floor : PLAIN_COLORS[tile.kind], 1);
            plain.fillRect(tile.x, tile.y, TILE, TILE);
            if (tile.kind === 'prop') {
                plain.fillStyle(PLAIN_COLORS.prop, 1).fillCircle(tile.x + TILE / 2, tile.y + TILE / 2, TILE * 0.4);
            }
        }
    }

    /** The era's secret: a hairline crack on a building wall, or the hole left where it was found */
    private addCrack(room: ParsedRoom) {
        const tile = room.secrets[0];
        if (!tile) {
            return;
        }
        const found = Progress.isSecretFound(this.registry, this.levelKey, this.roomIndex);
        const key = `crack-${this.artStyle}`;
        const image = this.textures.exists(key)
            ? this.add
                  .image(tile.x, tile.y, key, found ? 1 : 0)
                  .setOrigin(0, 0)
                  .setScale(ART_SCALE)
                  .setDepth(SECRET.depth)
            : null;
        this.crack = { tile, image, broken: found };
        if (!found) {
            // The machine reads this same list, so taking the tile out of it later is enough
            this.secretTiles.push(tile);
        }
    }

    private addColliders() {
        this.physics.add.collider(this.player, this.solidBodies);
        // Flyers are only stopped by walls, so each monster is asked about each tile
        this.physics.add.collider(this.monsters, this.solidBodies, undefined, (monster, solid) => {
            const zone = solid as Phaser.GameObjects.Zone;
            return (monster as Monster).stoppedBy(zone.x, zone.y);
        });
        this.physics.add.collider(this.projectiles, this.solidBodies, (projectile) => {
            (projectile as Projectile).shatter();
        });
        this.physics.add.overlap(this.player, this.monsters, (_player, object) => {
            const monster = object as Monster;
            if (monster.hurtsOnTouch && this.player.hurt(monster.def.contactDamage)) {
                monster.onTouchedPlayer();
            }
        });
        this.physics.add.overlap(this.player, this.projectiles, (_player, object) => {
            // A dash passes through whatever is thrown at him
            if (this.player.isDashing) {
                return;
            }
            // The projectile decides (a deflected or still airborne one does nothing)
            (object as Projectile).hitPlayer(this.player);
        });
        // A projectile pushed back by White hurts the enemy it runs into
        this.physics.add.overlap(this.projectiles, this.monsters, (projectile, monster) => {
            (projectile as Projectile).hitMonster(monster as Monster);
        });
        this.physics.add.overlap(this.player, this.hearts, (_player, heart) => {
            // At full health the heart stays where it is, for later
            if (this.player.heal(HEART.heal)) {
                heart.destroy();
                this.game.events.emit(Events.PICKUP, 'heart');
            }
        });
        this.physics.add.overlap(this.player, this.upgrades, (_player, upgrade) => {
            this.collectUpgrade(upgrade as HealthUpgrade);
        });
    }

    private countDeath() {
        const deaths = { ...this.deaths };
        deaths[this.deathKey] = (deaths[this.deathKey] ?? 0) + 1;
        this.registry.set(DEATHS_KEY, deaths);
    }

    /** Hidden mercy: after dying twice at the same checkpoint, a heart waits beside the start. Never announced. */
    private placeMercyHeart(room: ParsedRoom) {
        if ((this.deaths[this.deathKey] ?? 0) < HEART.mercyDeaths) {
            return;
        }
        const offsets = [
            [0, 1],
            [1, 0],
            [-1, 0],
            [0, -1],
        ];
        for (const [dx, dy] of offsets) {
            const x = room.start.x + dx * TILE;
            const y = room.start.y + dy * TILE;
            if (!this.nav.isSolid(x, y)) {
                new Heart(this, this.hearts, x, y, true);
                return;
            }
        }
    }

    private onMonsterKilled(id: MonsterId, x: number, y: number) {
        // The Handler writes up each kind of monster the first time one falls
        if (Progress.unlockGuide(this.registry, id)) {
            this.game.events.emit(Events.GUIDE_UNLOCKED, id);
        }
        if (id === 'prism') {
            // Whatever it had called for no longer comes
            this.waves.dropPending();
        }

        if (this.finished || this.player.isDead) {
            return;
        }
        let chance = HEART.dropChance[id] ?? 0;
        if (this.player.health < this.player.maxHealth * HEART.lowHealth) {
            chance *= HEART.lowHealthMultiplier;
        }
        if (Math.random() < chance) {
            new Heart(this, this.hearts, x, y);
        }
    }

    /** In an era of waves each wave is a checkpoint: a retry starts with the wave he fell in */
    private onWaveStarted(waveNumber: number) {
        if (!this.era) {
            this.saveCheckpoint(waveNumber - 1);
        }
    }

    /** The Prism switched the era: the square is redrawn in it and the machine obeys its rule */
    private onEraSwapped(style: ArtStyle) {
        this.restyle(style);
        const rule = ERA_RULES[style];
        if (rule) {
            // The wheel, the modes and the overdrive are the era's; the dash stays as the fight
            // began with it, because losing it mid-fight is more than the switch is meant to cost
            // The wheel, the modes and the overdrive are the era's (v2.4); the dash stays as the
            // fight began with it, because losing it mid-fight is more than the switch should cost
            const { dashCharges, dashCooldownMs } = this.weaponRule();
            this.machine.setRule({ ...rule, dashCharges, dashCooldownMs });
        }
    }

    private onPaused(paused: boolean) {
        if (paused) {
            // Nothing may still be humming, or go off, when the game comes back
            this.machine.stop();
        } else {
            // The click on the pause screen that brought the game back is not a shot
            this.fireLocked = true;
        }
    }

    /** Redraw everything in another era's style */
    private restyle(style: ArtStyle) {
        if (style === this.artStyle) {
            return;
        }
        this.artStyle = style;
        this.world.style = style;
        this.look?.setStyle(style);
        this.life?.setStyle(style);

        this.cameras.main.flash(FLOW.styleFlash, 255, 255, 255);
        if (this.textures.exists(`city-${style}`)) {
            this.cityImages[0]?.setTexture(`city-${style}`);
            this.cityImages[1]?.setTexture(`city-${style}-over`);
        }
        if (this.crack?.image && this.textures.exists(`crack-${style}`)) {
            this.crack.image.setTexture(`crack-${style}`, this.crack.broken ? 1 : 0);
        }
        this.player.setStyle(style);
        for (const monster of this.monsters.getChildren()) {
            (monster as Monster).setStyle(style);
        }
        for (const projectile of this.projectiles.getChildren()) {
            (projectile as Projectile).setStyle(style);
        }
        this.hazards.setStyle(style);
    }

    /** A ray reached the cracked wall: only the era's own secret ray breaks it */
    private onSecretTouched(tile: Rect, type: RayId) {
        const crack = this.crack;
        if (this.finished || !crack || crack.broken || tile !== crack.tile) {
            return;
        }
        const x = tile.x + TILE / 2;
        const y = tile.y + TILE / 2;
        if (type !== this.roomDef.secret) {
            // A dull spark: something is odd about this wall, but this is not the way in
            if (this.time.now >= this.nextResistSparkAt) {
                this.nextResistSparkAt = this.time.now + SECRET_RESIST_INTERVAL;
                puff(this, x, y, 0x8a8a94, 3, 7);
            }
            return;
        }

        crack.broken = true;
        // It is still a wall: only the machine stops asking about it
        Phaser.Utils.Array.Remove(this.secretTiles, crack.tile);
        crack.image?.setFrame(1);
        puff(this, x, y, 0xffffff, 10, 14);
        puff(this, x, y, 0x6b6257, 8, 10);
        shake(this, SECRET.shake.duration, SECRET.shake.intensity);
        // The UI scene makes its own flourish for this
        this.game.events.emit(Events.SECRET_FOUND);

        const drop = this.dropPoint(crack.tile);
        new HealthUpgrade(this, this.upgrades, drop.x, drop.y, { x, y }, SECRET.dropTime);
    }

    /** Where the upgrade lands: the paving in front of the crack, or failing that the nearest open tile */
    private dropPoint(tile: RoomTile) {
        const front = floorInFront(this.roomDef.layout, tile.col, tile.row);
        if (front) {
            return { x: ROOM.x + front.col * TILE + TILE / 2, y: ROOM.y + front.row * TILE + TILE / 2 };
        }
        const x = tile.x + TILE / 2;
        const y = tile.y + TILE / 2;
        let best = { x: this.room.start.x, y: this.room.start.y };
        let bestDistance = Infinity;
        for (const cell of this.nav.reachableCells(0)) {
            const distance = Math.hypot(cell.x - x, cell.y - y);
            if (distance < bestDistance) {
                best = cell;
                bestDistance = distance;
            }
        }
        return best;
    }

    private collectUpgrade(upgrade: HealthUpgrade) {
        if (this.finished || this.player.isDead || !upgrade.active || !upgrade.landed) {
            return;
        }
        this.takeUpgrade(upgrade);
    }

    private takeUpgrade(upgrade: HealthUpgrade) {
        const { x, y } = this.player;
        upgrade.destroy();
        Progress.findSecret(this.registry, this.levelKey, this.roomIndex);

        const bonus = Progress.bonusHealth(this.registry);
        openingRing(this, x, y, 18, 0xff4d5a);
        puff(this, x, y, 0xff4d5a, 8, 14);
        this.game.events.emit(Events.PICKUP, 'healthUpgrade');
        this.game.events.emit(Events.HEALTH_UPGRADE, bonus / HEALTH_PER_BLOCK);
        this.player.raiseMaxHealth(BASE_MAX_HEALTH + bonus);
    }

    private onWavesCleared() {
        this.clearFloor();
        this.completeEra(BANNERS.levelCleared);
    }

    /** The clock ran out: whatever is left is swept off the square, and the era is won */
    private onTimeUp() {
        this.waves.halt();
        this.clearFloor();
        this.cameras.main.flash(ERA.purgeFlash, 255, 255, 255);
        // They go in a wave that spreads out from him. Nothing is counted as a kill: no Field
        // Guide page, no heart.
        const { x, y } = this.player;
        const reach = Math.hypot(ROOM.width, ROOM.height);
        for (const child of this.monsters.getChildren().slice()) {
            const monster = child as Monster;
            const distance = Math.hypot(monster.x - x, monster.y - y);
            monster.banish((distance / reach) * ERA.purgeSpread, ERA.purgePop);
        }
        // The same fanfare as a cleared wave
        this.game.events.emit(Events.ROOM_CLEARED);
        this.completeEra(BANNERS.timeUp);
    }

    /** Nothing thrown before the end should spoil the moment: no projectiles, no ice, no acid */
    private clearFloor() {
        for (const projectile of this.projectiles.getChildren().slice()) {
            (projectile as Projectile).dissolve();
        }
        this.hazards.clear();
    }

    /** The era is won: on to the next era, or the ending */
    private completeEra(banner: string) {
        this.cleared = true;
        // An upgrade knocked out of the wall but not yet picked up is not lost with the era
        for (const upgrade of this.upgrades.getChildren().slice()) {
            if (!this.player.isDead && upgrade.active) {
                this.takeUpgrade(upgrade as HealthUpgrade);
            }
        }
        this.registry.remove(CHECKPOINT_KEY);
        this.registry.remove(DEATHS_KEY);

        if (this.sandbox) {
            if (this.roomIndex + 1 < this.level.rooms.length) {
                this.leave(BANNERS.roomCleared, FLOW.roomDelay, { room: this.roomIndex + 1, sandbox: true });
                return;
            }
            // The sandbox leads nowhere
            this.game.events.emit(Events.LEVEL_CLEARED, this.levelIndex + 1);
            this.halt();
            this.game.events.emit(Events.BANNER, 'Sandbox cleared');
            return;
        }

        Progress.markRoomCleared(this.registry, this.levelIndex, this.roomIndex);
        this.game.events.emit(Events.LEVEL_CLEARED, this.levelIndex + 1);
        if (this.levelIndex + 1 < LEVELS.length) {
            this.leave(banner, FLOW.nextEraDelay, { level: this.levelIndex + 1, demo: this.demo });
        } else {
            // The boss has fallen: no words, the page drains to white, and then the truth
            this.leave('', FLOW.endingDelay, null);
        }
    }

    /** Nothing more happens in this era */
    private halt() {
        this.finished = true;
        // He stands where he is while the banner shows
        this.player.frozen = true;
        this.machine.stop();
        this.era?.stop();
        this.waves.halt();
        this.physics.pause();
    }

    /**
     * Freeze the era, show a message, then fade out and load what comes next.
     * `next` is null after the last era: the ending follows.
     */
    private leave(message: string, delay: number, next: GameData | null) {
        this.halt();
        this.game.events.emit(Events.BANNER, message);

        this.time.delayedCall(delay, () => {
            const camera = this.cameras.main;
            camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                this.game.events.emit(Events.BANNER, '');
                if (next) {
                    this.scene.restart(next);
                } else {
                    // The UI scene keeps running on top
                    this.scene.start('Ending');
                }
            });
            // The comic drains to white before the ending; eras cut to black
            const shade = next ? 0 : 255;
            camera.fadeOut(next ? FLOW.fade : FLOW.endingFade, shade, shade, shade);
        });
    }

    /**
     * Dev only (K): kill everything alive, and stop waiting for the UI. In a timed era with
     * nothing to wait for, the clock also jumps on by one checkpoint interval, so a test gets
     * through any era on K alone.
     */
    private devSkip() {
        if (this.finished) {
            return;
        }
        for (const monster of this.monsters.getChildren().slice()) {
            (monster as Monster).kill();
        }
        if (this.skipWait) {
            this.skipWait();
        } else if (this.era && this.roomDef.continuous) {
            this.era.skip(checkpointSeconds(this.roomDef.continuous));
        }
    }
}
