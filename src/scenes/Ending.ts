import Phaser from 'phaser';
import { LEVELS } from '../config/levels';
import { MONSTERS } from '../config/monsters';
import { TORCH } from '../config/radiation';
import { ENDING } from '../config/text';
import { ROOM, TILE, WORLD_HEIGHT, WORLD_WIDTH, ZOOM } from '../config/world';
import { Bystander } from '../entities/Bystander';
import { DEPTH } from '../entities/effects';
import { MACHINE_LENGTH, Player } from '../entities/Player';
import { Events } from '../events';
import { Progress } from '../state';
import { showDialog, showScreen } from '../systems/conversation';
import { Navigator, castRay, segmentClear, type Point } from '../systems/Navigation';
import { parseRoom, type Rect, type TileKind } from '../systems/roomLayout';
import type { MonsterId } from '../types';

/** The whole scene is drawn in the one style that is not a comic */
const STYLE = 'plain';

/** The world comes back out of the white the boss page ended on */
const FADE_IN = 900;
const FADE_OUT = 700;
/** He keeps the torch for this long at most... */
const PLAY_TIME = 12000;
/** ...or until he has shone it at this many different people */
const PEOPLE_TO_BOTHER = 3;
/** Quiet beats between the steps of the sequence */
const BEAT = 900;
/** Guards against a caption or a card that is never answered; the player normally dismisses them */
const DIALOG_TIMEOUT = 20000;
const DIALOG_TIMEOUT_PER_LINE = 6000;
const SCREEN_TIMEOUT = 90000;

/** Rays drawn to shape the torch's cone around walls */
const CONE_RAYS = 8;
/** Pigeons take off when he walks this close */
const SHOO_DISTANCE = 13;
const PIGEONS = 5;
/** The people who were never monsters, in the order they are stood around the room */
const PEOPLE: MonsterId[] = ['frostling', 'shade', 'ironclad'];

/** In daylight a secret wall is just a wall, and there was never a chest */
const TILE_FRAMES: Record<TileKind, number> = {
    floor: 0,
    floorAlt: 1,
    wall: 2,
    prop: 3,
    secret: 2,
    chest: 0,
};

/**
 * The twist. The boss room again, in plain daylight: the monsters are passers-by, the Prism
 * is a police car and the EMW Machine is a pocket torch. The player gets a short moment with
 * the torch, then it is taken out of his hands and the UI scene tells the rest.
 */
export class Ending extends Phaser.Scene {
    private player!: Player;
    private nav!: Navigator;
    private walls: Rect[] = [];
    private bystanders: Bystander[] = [];
    private car!: Phaser.GameObjects.Sprite;
    private cone!: Phaser.GameObjects.Graphics;
    private bothered = new Set<Bystander>();
    private controlTaken = false;

    constructor() {
        super('Ending');
    }

    create() {
        this.bystanders = [];
        this.bothered.clear();
        this.controlTaken = false;

        const events = this.game.events;
        events.emit(Events.ENDING_STARTED);
        events.emit(Events.BANNER, '');

        this.cameras.main.setZoom(ZOOM).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        this.cameras.main.fadeIn(FADE_IN, 255, 255, 255);
        this.physics.world.setBounds(ROOM.x, ROOM.y, ROOM.width, ROOM.height);

        // The same room the Prism was fought in
        const room = parseRoom(LEVELS[LEVELS.length - 1].rooms.at(-1)!.layout);
        this.walls = room.walls;
        const solids = this.physics.add.staticGroup();
        for (const tile of room.tiles) {
            if (tile.kind === 'prop') {
                this.add.image(tile.x, tile.y, `tiles-${STYLE}`, TILE_FRAMES.floor).setOrigin(0, 0);
            }
            this.add.image(tile.x, tile.y, `tiles-${STYLE}`, TILE_FRAMES[tile.kind]).setOrigin(0, 0);
        }
        for (const solid of room.solids) {
            solids.add(this.add.zone(solid.x + TILE / 2, solid.y + TILE / 2, TILE, TILE));
        }

        this.player = new Player(this, room.start.x, room.start.y, STYLE);
        this.nav = new Navigator(room.solids);
        this.nav.setGoal(room.start.x, room.start.y);
        this.cone = this.add.graphics().setDepth(DEPTH.effect);

        const obstacles = this.physics.add.staticGroup();
        this.placeCast(room.start, obstacles);
        this.physics.add.collider(this.player, solids);
        this.physics.add.collider(this.player, obstacles);

        this.time.delayedCall(PLAY_TIME, () => this.takeControl());
    }

    update() {
        this.player.update();
        this.cone.clear();
        if (this.controlTaken) {
            return;
        }

        const { x, y } = this.player;
        const canStand = (px: number, py: number) => this.canStand(px, py);
        for (const bystander of this.bystanders) {
            if (bystander.small && Math.hypot(bystander.x - x, bystander.y - y) < SHOO_DISTANCE) {
                bystander.bother(x, y, canStand);
            }
        }

        if (this.input.activePointer.leftButtonDown()) {
            this.shineTorch();
        }
    }

    /** True if a bystander could stand at this point: on open floor, inside the room */
    private canStand(x: number, y: number) {
        const margin = TILE / 2;
        const insideX = x > ROOM.x + margin && x < ROOM.x + ROOM.width - margin;
        const insideY = y > ROOM.y + margin && y < ROOM.y + ROOM.height - margin;
        return insideX && insideY && !this.nav.isSolid(x, y);
    }

    /** Stand the police car, the people and the pigeons around the room, well apart */
    private placeCast(start: Point, obstacles: Phaser.Physics.Arcade.StaticGroup) {
        const taken: Point[] = [];
        // The spot furthest from everything already placed (the player counts), within reach
        const pick = (cells: Point[], minFromPlayer: number, maxFromPlayer: number) => {
            let best: Point | null = null;
            let bestScore = -1;
            for (const cell of cells) {
                const fromPlayer = Math.hypot(cell.x - start.x, cell.y - start.y);
                if (fromPlayer < minFromPlayer || fromPlayer > maxFromPlayer) {
                    continue;
                }
                let score = fromPlayer;
                for (const other of taken) {
                    score = Math.min(score, Math.hypot(cell.x - other.x, cell.y - other.y));
                }
                if (score > bestScore) {
                    best = cell;
                    bestScore = score;
                }
            }
            return best;
        };

        // The car needs a clear tile all round it, and is parked up the far end
        const open = this.nav.reachableCells(0);
        const roomy = this.nav.reachableCells(MONSTERS.prism.radius);
        const parking = pick(roomy, 70, Infinity) ?? pick(roomy, 0, Infinity) ?? pick(open, 0, Infinity) ?? start;
        taken.push(parking);
        this.car = this.add.sprite(parking.x, parking.y, `prism-${STYLE}`, 0).setDepth(DEPTH.monster);
        // Its two frames swap the lights: the flashing colours he was fighting
        this.car.play(`prism-${STYLE}-move`);
        const carBody = this.add.zone(parking.x, parking.y + 2, 28, 18);
        obstacles.add(carBody);

        for (const kind of PEOPLE) {
            const spot = pick(open, 34, 86) ?? pick(open, 20, Infinity);
            if (!spot) {
                continue;
            }
            taken.push(spot);
            const person = new Bystander(this, spot.x, spot.y, kind, MONSTERS[kind].radius);
            obstacles.add(person);
            this.bystanders.push(person);
        }

        const roost = pick(open, 30, 80) ?? pick(open, 20, Infinity);
        if (roost) {
            for (let i = 0; i < PIGEONS; i++) {
                const angle = (i / PIGEONS) * Math.PI * 2;
                const reach = i === 0 ? 0 : Phaser.Math.FloatBetween(6, 11);
                let x = roost.x + Math.cos(angle) * reach;
                let y = roost.y + Math.sin(angle) * reach;
                if (!this.canStand(x, y)) {
                    x = roost.x;
                    y = roost.y;
                }
                const pigeon = new Bystander(this, x, y, 'swarmlet', MONSTERS.swarmlet.radius);
                pigeon.setFlipX(i % 2 === 0);
                this.bystanders.push(pigeon);
            }
        }

        // Still shaken from a moment ago: a couple of them are already turning away
        this.time.delayedCall(FADE_IN * 0.6, () => {
            this.bystanders
                .filter((bystander) => !bystander.small)
                .slice(0, 2)
                .forEach((bystander) => bystander.bother(start.x, start.y, (x, y) => this.canStand(x, y)));
        });
    }

    /** All the machine ever did: a weak yellow cone that makes people shield their eyes */
    private shineTorch() {
        const { x, handY: y, aimAngle } = this.player;
        const halfAngle = Phaser.Math.DegToRad(TORCH.halfAngle);

        const tipX = x + Math.cos(aimAngle) * MACHINE_LENGTH;
        const tipY = y + Math.sin(aimAngle) * MACHINE_LENGTH;
        const points = [new Phaser.Math.Vector2(tipX, tipY)];
        for (let i = 0; i <= CONE_RAYS; i++) {
            const angle = aimAngle - halfAngle + (i / CONE_RAYS) * halfAngle * 2;
            const reach = castRay(x, y, angle, TORCH.range, this.walls);
            points.push(new Phaser.Math.Vector2(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach));
        }
        // A cheap bulb: it wavers
        const waver = 0.85 + 0.15 * Math.sin(this.time.now / 70);
        this.cone.fillStyle(TORCH.color, TORCH.alpha * waver);
        this.cone.fillPoints(points, true);

        const canStand = (px: number, py: number) => this.canStand(px, py);
        for (const bystander of this.bystanders) {
            const distance = Math.hypot(bystander.x - x, bystander.y - y);
            if (distance > TORCH.range + bystander.radius) {
                continue;
            }
            const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(bystander.y - y, bystander.x - x) - aimAngle));
            const cover = distance > bystander.radius ? Math.asin(bystander.radius / distance) : Math.PI;
            if (off > halfAngle + cover || !segmentClear(x, y, bystander.x, bystander.y, this.walls)) {
                continue;
            }
            if (bystander.bother(x, y, canStand) && !bystander.small) {
                this.bothered.add(bystander);
            }
        }

        if (this.bothered.size >= PEOPLE_TO_BOTHER) {
            // Let the last flinch play out before the car door opens
            this.bothered.clear();
            this.time.delayedCall(BEAT, () => this.takeControl());
        }
    }

    /** The torch is no longer his to wave about. From here the UI scene tells the story. */
    private takeControl() {
        if (this.controlTaken) {
            return;
        }
        this.controlTaken = true;
        this.cone.clear();
        this.player.frozen = true;
        // He turns to the flashing lights
        this.player.aim(Phaser.Math.Angle.Between(this.player.x, this.player.handY, this.car.x, this.car.y));

        const registry = this.registry;
        this.after(BEAT, () =>
            this.say(ENDING.reveal, () =>
                this.say(ENDING.arrest, () => {
                    this.lowerTorch();
                    this.after(BEAT, () =>
                        showScreen(this, 'report', SCREEN_TIMEOUT, () => {
                            // From now on the Field Guide shows what each thing really was
                            Progress.markEnded(registry);
                            showScreen(this, 'guideTruth', SCREEN_TIMEOUT, () =>
                                showScreen(this, 'credits', SCREEN_TIMEOUT, () => this.backToTitle()),
                            );
                        }),
                    );
                }),
            ),
        );
    }

    private say(lines: string[], done: () => void) {
        showDialog(this, lines, DIALOG_TIMEOUT + DIALOG_TIMEOUT_PER_LINE * lines.length, done);
    }

    private after(delay: number, action: () => void) {
        this.time.delayedCall(delay, action);
    }

    /** He does as he is asked: the torch points at the ground */
    private lowerTorch() {
        const from = this.player.aimAngle;
        const turn = Phaser.Math.Angle.ShortestBetween(Phaser.Math.RadToDeg(from), 90);
        this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 500,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => this.player.aim(from + Phaser.Math.DegToRad(turn) * (tween.getValue() ?? 1)),
        });
    }

    private backToTitle() {
        const camera = this.cameras.main;
        camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Title'));
        camera.fadeOut(FADE_OUT, 0, 0, 0);
    }
}
