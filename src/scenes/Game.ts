import Phaser from 'phaser';
import { LEVELS, SANDBOX } from '../config/levels';
import { HEART } from '../config/monsters';
import { SECRET_RESIST_INTERVAL } from '../config/radiation';
import { BANNERS } from '../config/text';
import { TILE, ROOM, WORLD_HEIGHT, WORLD_WIDTH, ZOOM } from '../config/world';
import { openingRing, puff } from '../entities/effects';
import { HealthUpgrade } from '../entities/HealthUpgrade';
import { Heart } from '../entities/Heart';
import type { Monster, MonsterWorld } from '../entities/Monster';
import { BASE_MAX_HEALTH, Player } from '../entities/Player';
import type { Projectile } from '../entities/Projectile';
import { Events } from '../events';
import { Progress } from '../state';
import { awaitAnswer } from '../systems/conversation';
import { EMWMachine } from '../systems/EMWMachine';
import { Navigator } from '../systems/Navigation';
import { parseRoom, type ParsedRoom, type Rect, type RoomTile, type TileKind } from '../systems/roomLayout';
import { WaveDirector } from '../systems/WaveDirector';
import type { ArtStyle, LevelDef, MonsterId, RadiationId, RoomDef } from '../types';

/** How long the banner shows before the room fades out */
const RESTART_DELAY = 1300;
const NEXT_ROOM_DELAY = 900;
/** How long a cleared room with an unclaimed secret waits before moving on */
const SECRET_LINGER = 5000;
/** Extra time once the secret wall is open, so the upgrade is not snatched away */
const SECRET_LINGER_OPENED = 8000;
const NEXT_LEVEL_DELAY = 1400;
/** The pause after the boss falls, before everything is shown as it really is */
const ENDING_DELAY = 1600;
/** Rooms change with a quick fade to black and back, like an old Zelda */
const FADE = 250;

/**
 * The first wave waits for the level's opening captions, but never longer than this: left
 * alone, the UI takes about 4.5s for the title card and 2s a line
 */
const INTRO_TIMEOUT = 6000;
const INTRO_TIMEOUT_PER_LINE = 3000;
const CHEST_OPEN_DELAY = 300;
/** The item card is dismissed by the player; this only guards against no answer at all */
const ITEM_CARD_TIMEOUT = 45000;
/** The chest counts as touched from this far outside its tile (the player's body is 4 wide) */
const CHEST_TOUCH = 5.5;

/** The boss page is redrawn in a different comic style for each of the Prism's phases */
const BOSS_STYLES: ArtStyle[] = ['goldenAge', 'noir', 'manga', 'goldenAge'];
const STYLE_FLASH = 220;

/** Registry: health carried from one room to the next within a level */
const HEALTH_KEY = 'playerHealth';
/** Registry: how many times the player has died in each room, for the hidden mercy heart */
const DEATHS_KEY = 'roomDeaths';
/** One HUD health block is this much health */
const HEALTH_PER_BLOCK = 5;
/** The sandbox keeps its secrets under this level number */
const SANDBOX_LEVEL = -1;

/** Frame of the tiles sheet drawn for each kind of tile (see docs/DESIGN.md) */
const TILE_FRAMES: Record<TileKind, number> = {
    floor: 0,
    floorAlt: 1,
    wall: 2,
    prop: 3,
    secret: 4,
    // A chest only appears once the room is cleared
    chest: 0,
};
const CHEST_CLOSED_FRAME = 5;
const CHEST_OPEN_FRAME = 6;

export interface GameData {
    level?: number;
    room?: number;
    /** Dev only: play the sandbox level instead of LEVELS[level] */
    sandbox?: boolean;
    /** Keep the health the player left the previous room with; otherwise start at full */
    carryHealth?: boolean;
    /** The room is starting again after a death, so the level is not announced a second time */
    retry?: boolean;
}

interface Chest {
    tile: RoomTile;
    image: Phaser.GameObjects.Image;
    /** Not touchable until its entrance has played */
    readyAt: number;
    opened: boolean;
}

export class Game extends Phaser.Scene {
    private levelIndex = 0;
    private roomIndex = 0;
    private sandbox = false;
    private carryHealth = false;
    private retry = false;
    /** The palette the room is drawn in right now */
    private artStyle: ArtStyle = 'goldenAge';
    private player!: Player;
    private monsters!: Phaser.Physics.Arcade.Group;
    private projectiles!: Phaser.Physics.Arcade.Group;
    private hearts!: Phaser.Physics.Arcade.Group;
    private upgrades!: Phaser.Physics.Arcade.Group;
    private solidBodies!: Phaser.Physics.Arcade.StaticGroup;
    private room!: ParsedRoom;
    private world!: MonsterWorld;
    private nav!: Navigator;
    private waves!: WaveDirector;
    private machine!: EMWMachine;
    /** Every tile image with its frame, so the boss page can be redrawn in another style */
    private tileImages: Phaser.GameObjects.Image[] = [];
    /** Secret walls still standing, with what has to go when one breaks */
    private secretTiles: RoomTile[] = [];
    private secretParts = new Map<Rect, { image: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone }>();
    private secretAnnounced = false;
    /** When a cleared room stops waiting for its secret to be claimed; 0 when not waiting */
    private lingerUntil = 0;
    private nextResistSparkAt = 0;
    private chest: Chest | null = null;
    /** Every wave is dead (the room may still be waiting for its chest to be opened) */
    private cleared = false;
    /** The room is over: nothing moves until the next one loads */
    private finished = false;
    /** Dev only: ends whatever answer from the UI the room is waiting for */
    private skipWait: (() => void) | null = null;

    constructor() {
        super('Game');
    }

    init(data: GameData) {
        this.levelIndex = Phaser.Math.Clamp(data.level ?? 0, 0, LEVELS.length - 1);
        this.sandbox = data.sandbox ?? false;
        this.roomIndex = Phaser.Math.Clamp(data.room ?? 0, 0, this.level.rooms.length - 1);
        this.carryHealth = data.carryHealth ?? false;
        this.retry = data.retry ?? false;
        this.artStyle = this.level.style === 'finalPage' ? BOSS_STYLES[0] : this.level.style;
        this.tileImages = [];
        this.secretTiles = [];
        this.secretParts.clear();
        this.secretAnnounced = false;
        this.lingerUntil = 0;
        this.nextResistSparkAt = 0;
        this.chest = null;
        this.cleared = false;
        this.finished = false;
        this.skipWait = null;
    }

    create() {
        this.cameras.main.setZoom(ZOOM).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        this.cameras.main.fadeIn(FADE, 0, 0, 0);
        this.physics.world.setBounds(ROOM.x, ROOM.y, ROOM.width, ROOM.height);

        const room = parseRoom(this.roomDef.layout);
        this.room = room;
        this.seedRadiation();
        if (this.levelIndex === 0 && this.roomIndex === 0 && !this.sandbox && !this.retry) {
            // A new game: the last playthrough's deaths earn no mercy in this one
            this.registry.remove(DEATHS_KEY);
        }

        const secretFound = Progress.isSecretFound(this.registry, this.levelKey, this.roomIndex);
        if (secretFound) {
            // The wall stays broken, and the prize stays taken, for the rest of the playthrough
            for (const tile of room.secrets) {
                Phaser.Utils.Array.Remove(room.solids, tile);
                Phaser.Utils.Array.Remove(room.walls, tile);
            }
        } else {
            this.secretTiles = room.secrets.slice();
        }

        this.solidBodies = this.physics.add.staticGroup();
        const solid = new Set(room.solids);
        for (const tile of room.tiles) {
            // Props sit on top of a floor tile
            if (tile.kind === 'prop') {
                this.addTileImage(tile, TILE_FRAMES.floor);
            }
            const open = tile.kind === 'secret' && secretFound;
            const image = this.addTileImage(tile, open ? TILE_FRAMES.floor : TILE_FRAMES[tile.kind]);
            if (solid.has(tile)) {
                const zone = this.addSolid(tile);
                if (tile.kind === 'secret') {
                    this.secretParts.set(tile, { image, zone });
                }
            }
        }

        const maxHealth = BASE_MAX_HEALTH + Progress.bonusHealth(this.registry);
        this.player = new Player(this, room.start.x, room.start.y, this.artStyle, maxHealth);
        if (this.carryHealth) {
            const carried = this.registry.get(HEALTH_KEY) as number | undefined;
            this.player.health = Phaser.Math.Clamp(carried ?? maxHealth, 1, maxHealth);
        }

        this.nav = new Navigator(room.solids);
        this.nav.setGoal(this.player.x, this.player.y);
        // These groups are updated by hand in update(), so that everything stops when the room ends
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
        this.machine = new EMWMachine(
            this,
            this.player,
            this.monsters,
            room.walls,
            Progress.radiations(this.registry),
            { tiles: this.secretTiles, touch: (tile, type) => this.onSecretTouched(tile, type) },
        );

        this.physics.add.collider(this.player, this.solidBodies);
        this.physics.add.collider(this.monsters, this.solidBodies);
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
            const projectile = object as Projectile;
            this.player.hurt(projectile.damage);
            projectile.shatter();
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

        if (room.upgrade && room.secrets.length > 0 && !secretFound) {
            new HealthUpgrade(this, this.upgrades, room.upgrade.x + TILE / 2, room.upgrade.y + TILE / 2);
        }
        this.placeMercyHeart(room);

        const events = this.game.events;
        events.on(Events.MONSTER_KILLED, this.onMonsterKilled, this);
        events.on(Events.BOSS_PHASE, this.onBossPhase, this);
        events.on(Events.PAUSED, this.onPaused, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            events.off(Events.MONSTER_KILLED, this.onMonsterKilled, this);
            events.off(Events.BOSS_PHASE, this.onBossPhase, this);
            events.off(Events.PAUSED, this.onPaused, this);
        });

        if (import.meta.env.DEV) {
            // K clears the current wave for testing. It also opens the chest that follows and
            // stops waiting for the UI, so a test can get through a room on K alone.
            this.input.keyboard!.on('keydown-K', () => {
                for (const monster of this.monsters.getChildren().slice()) {
                    (monster as Monster).kill();
                }
                if (this.skipWait) {
                    this.skipWait();
                } else if (this.chest && !this.chest.opened && !this.finished) {
                    this.openChest();
                } else if (this.lingerUntil) {
                    this.lingerUntil = 1;
                }
            });
            // ?nodamage: nothing hurts the player, for automated tests
            this.player.invincible = new URLSearchParams(window.location.search).has('nodamage');
        }

        // Tell the HUD where things stand at the start of the room
        events.emit(Events.BANNER, '');
        events.emit(Events.ROOM_STARTED, this.level.name, this.roomIndex + 1, this.level.rooms.length);
        events.emit(Events.PLAYER_HEALTH_CHANGED, this.player.health, this.player.maxHealth);
        events.emit(Events.ENERGY_CHANGED, this.machine.energy, this.machine.maxEnergy);
        events.emit(Events.RADIATION_CHANGED, this.machine.selected.id);

        if (this.roomIndex === 0 && !this.sandbox && !this.retry) {
            // The UI shows the level's title card and captions; the monsters wait for it
            const introText = this.level.introText ?? [];
            this.waves.hold();
            this.waitForUi(Events.DIALOG_DONE, INTRO_TIMEOUT + INTRO_TIMEOUT_PER_LINE * introText.length, () =>
                this.waves.release(),
            );
            events.emit(Events.LEVEL_STARTED, this.levelIndex + 1, this.level.name, this.level.style, introText);
        }
    }

    update(time: number, delta: number) {
        this.player.update();

        if (this.finished) {
            return;
        }

        if (this.player.isDead) {
            this.countDeath();
            this.leave(BANNERS.roomFailed, RESTART_DELAY, {
                level: this.levelIndex,
                room: this.roomIndex,
                sandbox: this.sandbox,
                retry: true,
            });
            return;
        }

        this.nav.setGoal(this.player.x, this.player.y);
        if (!this.player.frozen) {
            this.machine.update(delta);
        }
        // Copies, because updating can destroy members
        for (const monster of this.monsters.getChildren().slice()) {
            monster.update(time, delta);
        }
        for (const projectile of this.projectiles.getChildren().slice()) {
            projectile.update();
        }
        for (const heart of this.hearts.getChildren().slice()) {
            heart.update();
        }

        this.waves.update();
        if (this.waves.cleared && !this.cleared) {
            this.onRoomCleared();
        }
        this.updateChest();
        this.updateLinger();
    }

    private get level(): LevelDef {
        return this.sandbox ? SANDBOX : LEVELS[this.levelIndex];
    }

    private get roomDef(): RoomDef {
        return this.level.rooms[this.roomIndex];
    }

    /** The level number this room's progress is kept under */
    private get levelKey() {
        return this.sandbox ? SANDBOX_LEVEL : this.levelIndex;
    }

    /** Identifies this room in the registry */
    private get roomKey() {
        return `${this.sandbox ? 'sandbox' : this.levelIndex}:${this.roomIndex}`;
    }

    private get deaths() {
        return (this.registry.get(DEATHS_KEY) as Record<string, number> | undefined) ?? {};
    }

    /**
     * A normal playthrough arrives with its unlocked radiation already in the registry. A new
     * game or a dev jump arrives with none, and gets what the level expects by this room.
     */
    private seedRadiation() {
        if (Progress.radiations(this.registry).length > 0) {
            return;
        }
        const earlier = this.level.rooms.slice(0, this.roomIndex).map((room) => room.reward);
        for (const id of [...this.level.radiations, ...earlier]) {
            if (id) {
                Progress.unlockRadiation(this.registry, id);
            }
        }
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

    private addTileImage(tile: Rect, frame: number) {
        const image = this.add.image(tile.x, tile.y, `tiles-${this.artStyle}`, frame).setOrigin(0, 0);
        this.tileImages.push(image);
        return image;
    }

    private addSolid(tile: Rect) {
        const zone = this.add.zone(tile.x + TILE / 2, tile.y + TILE / 2, TILE, TILE);
        this.solidBodies.add(zone);
        return zone;
    }

    private countDeath() {
        const deaths = { ...this.deaths };
        deaths[this.roomKey] = (deaths[this.roomKey] ?? 0) + 1;
        this.registry.set(DEATHS_KEY, deaths);
    }

    /** Hidden mercy: after dying here twice, a heart waits beside the start. Never announced. */
    private placeMercyHeart(room: ParsedRoom) {
        if ((this.deaths[this.roomKey] ?? 0) < HEART.mercyDeaths) {
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

    private onPaused(paused: boolean) {
        // Nothing may still be humming, or go off, when the game comes back
        if (paused) {
            this.machine.stop();
        }
    }

    /** The boss page: each phase of the Prism redraws the whole room in another comic style */
    private onBossPhase(phase: number) {
        if (this.level.style !== 'finalPage') {
            return;
        }
        const style = BOSS_STYLES[(phase - 1) % BOSS_STYLES.length];
        if (style === this.artStyle) {
            return;
        }
        this.artStyle = style;
        this.world.style = style;

        this.cameras.main.flash(STYLE_FLASH, 255, 255, 255);
        for (const image of this.tileImages) {
            image.setTexture(`tiles-${style}`, image.frame.name);
        }
        this.player.setStyle(style);
        for (const monster of this.monsters.getChildren()) {
            (monster as Monster).setStyle(style);
        }
        for (const projectile of this.projectiles.getChildren()) {
            (projectile as Projectile).setStyle(style);
        }
    }

    /** Radiation reached a secret wall: only the room's own secret type breaks it */
    private onSecretTouched(tile: Rect, type: RadiationId) {
        if (this.finished || !this.secretParts.has(tile)) {
            return;
        }
        if (type !== this.roomDef.secret) {
            // A dull spark: something is odd about this wall, but this is not the way in
            if (this.time.now >= this.nextResistSparkAt) {
                this.nextResistSparkAt = this.time.now + SECRET_RESIST_INTERVAL;
                puff(this, tile.x + TILE / 2, tile.y + TILE / 2, 0x8a8a94, 3, 7);
            }
            return;
        }

        // A wall more than one tile wide comes down together
        const group = [tile];
        for (let i = 0; i < group.length; i++) {
            for (const other of this.secretTiles) {
                const touching = Math.abs(other.x - group[i].x) + Math.abs(other.y - group[i].y) === TILE;
                if (touching && !group.includes(other)) {
                    group.push(other);
                }
            }
        }
        for (const broken of group) {
            const parts = this.secretParts.get(broken)!;
            this.secretParts.delete(broken);
            parts.zone.destroy();
            parts.image.setFrame(TILE_FRAMES.floor);
            // The same arrays are read by the machine, the monsters and the navigator
            Phaser.Utils.Array.Remove(this.room.solids, broken);
            Phaser.Utils.Array.Remove(this.room.walls, broken);
            Phaser.Utils.Array.Remove(this.secretTiles, broken as RoomTile);
            puff(this, broken.x + TILE / 2, broken.y + TILE / 2, 0xffffff, 10, 14);
            puff(this, broken.x + TILE / 2, broken.y + TILE / 2, 0x6b6257, 8, 10);
        }
        this.nav.rebuild();
        this.cameras.main.shake(140, 0.004);

        if (!this.secretAnnounced) {
            this.secretAnnounced = true;
            // The UI scene makes its own flourish for this; a banner as well would say it twice
            this.game.events.emit(Events.SECRET_FOUND);
        }
    }

    private collectUpgrade(upgrade: HealthUpgrade) {
        if (this.finished || this.player.isDead || !upgrade.active) {
            return;
        }
        const { x, y } = upgrade;
        upgrade.destroy();
        Progress.findSecret(this.registry, this.levelKey, this.roomIndex);

        const bonus = Progress.bonusHealth(this.registry);
        openingRing(this, x, y, 18, 0xff4d5a);
        puff(this, x, y, 0xff4d5a, 8, 14);
        this.game.events.emit(Events.PICKUP, 'healthUpgrade');
        this.game.events.emit(Events.HEALTH_UPGRADE, bonus / HEALTH_PER_BLOCK);
        this.player.raiseMaxHealth(BASE_MAX_HEALTH + bonus);
    }

    private onRoomCleared() {
        this.cleared = true;
        const deaths = { ...this.deaths };
        delete deaths[this.roomKey];
        this.registry.set(DEATHS_KEY, deaths);
        // Nothing thrown before the last monster fell should spoil the moment
        for (const projectile of this.projectiles.getChildren().slice()) {
            (projectile as Projectile).shatter();
        }

        if (this.roomDef.reward && this.room.chest) {
            this.spawnChest(this.room.chest);
        } else if (this.upgrades.countActive(true) > 0) {
            // A secret is still here: give the player a moment to act on what they noticed
            this.lingerUntil = this.time.now + SECRET_LINGER;
            this.game.events.emit(Events.BANNER, BANNERS.roomCleared);
            this.time.delayedCall(NEXT_ROOM_DELAY, () => this.game.events.emit(Events.BANNER, ''));
        } else {
            this.completeRoom();
        }
    }

    /** After the last monster, wait for an unclaimed secret: a while if untouched, longer once it is open */
    private updateLinger() {
        if (!this.lingerUntil) {
            return;
        }
        const collected = this.upgrades.countActive(true) === 0;
        const deadline = this.lingerUntil + (this.secretAnnounced ? SECRET_LINGER_OPENED : 0);
        if (collected || this.time.now >= deadline) {
            this.lingerUntil = 0;
            this.completeRoom();
        }
    }

    /** The reward for clearing the room: it is not finished until this has been opened */
    private spawnChest(tile: RoomTile) {
        const x = tile.x + TILE / 2;
        const y = tile.y + TILE / 2;
        const image = this.add.image(x, y, `tiles-${this.artStyle}`, CHEST_CLOSED_FRAME).setScale(0.2);
        this.tileImages.push(image);
        this.tweens.add({ targets: image, scale: 1, duration: 320, ease: 'Back.easeOut' });
        openingRing(this, x, y, 20, 0xffe27a);
        puff(this, x, y, 0xffe27a, 8, 16);
        this.chest = { tile, image, readyAt: this.time.now + 350, opened: false };

        // Solid, unless the player is standing right where it lands (then it simply opens)
        if (this.distanceToTile(tile) > CHEST_TOUCH) {
            this.addSolid(tile);
            this.room.solids.push(tile);
            this.nav.rebuild();
        }
    }

    private distanceToTile(tile: Rect) {
        const { x, y } = this.player;
        const nearX = Phaser.Math.Clamp(x, tile.x, tile.x + tile.width);
        const nearY = Phaser.Math.Clamp(y, tile.y, tile.y + tile.height);
        return Math.hypot(nearX - x, nearY - y);
    }

    private updateChest() {
        const chest = this.chest;
        if (!chest || chest.opened || this.time.now < chest.readyAt) {
            return;
        }
        if (this.distanceToTile(chest.tile) <= CHEST_TOUCH) {
            this.openChest();
        }
    }

    private openChest() {
        const chest = this.chest!;
        const id = this.roomDef.reward!;
        chest.opened = true;
        chest.image.setFrame(CHEST_OPEN_FRAME);
        puff(this, chest.image.x, chest.image.y - 4, 0xffe27a, 6, 10);
        this.game.events.emit(Events.CHEST_OPENED);

        // He stands and looks at what he has found until the card is put away
        this.player.frozen = true;
        this.machine.stop();
        const carryOn = () => {
            this.machine.select(id);
            this.player.frozen = false;
            this.completeRoom();
        };

        this.time.delayedCall(CHEST_OPEN_DELAY, () => {
            const isNew = Progress.unlockRadiation(this.registry, id);
            this.machine.unlock(id);
            if (!isNew) {
                // Already owned (a dev jump): nothing to show
                carryOn();
                return;
            }
            this.waitForUi(Events.SCREEN_DONE, ITEM_CARD_TIMEOUT, carryOn, (name) => name === 'itemGet');
            this.game.events.emit(Events.ITEM_GET, id);
        });
    }

    /** The room is done: on to the next room, the next level, or the ending */
    private completeRoom() {
        this.registry.set(HEALTH_KEY, this.player.health);
        if (!this.sandbox) {
            Progress.markRoomCleared(this.registry, this.levelIndex, this.roomIndex);
        }

        if (this.roomIndex + 1 < this.level.rooms.length) {
            this.leave(BANNERS.roomCleared, NEXT_ROOM_DELAY, {
                level: this.levelIndex,
                room: this.roomIndex + 1,
                sandbox: this.sandbox,
                carryHealth: true,
            });
            return;
        }

        this.game.events.emit(Events.LEVEL_CLEARED, this.levelIndex + 1);
        if (this.sandbox) {
            // The sandbox leads nowhere
            this.finished = true;
            this.machine.stop();
            this.waves.halt();
            this.game.events.emit(Events.BANNER, 'Sandbox cleared');
        } else if (this.levelIndex + 1 < LEVELS.length) {
            // A new level starts at full health
            this.leave(BANNERS.levelCleared, NEXT_LEVEL_DELAY, { level: this.levelIndex + 1, room: 0 });
        } else {
            this.leave('', ENDING_DELAY, null);
        }
    }

    /**
     * Freeze the room, show a message, then fade out and load the next room.
     * `next` is null after the last room of the last level: the ending follows.
     */
    private leave(message: string, delay: number, next: GameData | null) {
        this.finished = true;
        this.machine.stop();
        this.waves.halt();
        this.physics.pause();
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
            // The comic drains to white before the ending; rooms cut to black
            const shade = next ? 0 : 255;
            camera.fadeOut(next ? FADE : FADE * 3, shade, shade, shade);
        });
    }
}
