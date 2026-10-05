import Phaser from 'phaser';
import { ENDING_SCENE } from '../config/flow';
import { MONSTERS } from '../config/monsters';
import { TORCH } from '../config/rays';
import { SQUARE_LAYOUT } from '../config/square';
import { ENDING } from '../config/text';
import { ART_SCALE, ROOM, TILE, WORLD_HEIGHT, WORLD_WIDTH, ZOOM } from '../config/world';
import { Bystander } from '../entities/Bystander';
import { DEPTH } from '../entities/effects';
import { MACHINE_LENGTH, Player } from '../entities/Player';
import { Events } from '../events';
import { Progress } from '../state';
import { worldScale } from '../systems/artScale';
import { showDialog, showScreen } from '../systems/conversation';
import { Navigator, castRay, segmentClear, type Point } from '../systems/Navigation';
import { parseRoom, type Rect } from '../systems/roomLayout';
import type { MonsterId } from '../types';

/** The whole scene is drawn in the one style that is not a comic */
const STYLE = 'plain';
const CITY_DEPTH = 0.5;
const CITY_OVER_DEPTH = 4.8;

/** Rays drawn to shape the torch's cone around walls */
const CONE_RAYS = 8;
/** Frames of `prism-plain`: 0 and 1 swap the lights, 2 has the door open */
const CAR_DOOR_OPEN = 2;
/** The police car is parked in the mouth of the north street, in front of the town hall */
const CAR = { x: 160, y: 70, width: 28, height: 14 };

interface CastMember {
    kind: MonsterId;
    x: number;
    y: number;
    animal?: boolean;
    /** Walks (rides) round these points instead of standing */
    route?: Point[];
}

/**
 * Who is in the square on an ordinary afternoon: a handful, not everyone he ever fought.
 * World units; anyone whose spot turns out not to be open paving is moved to the nearest that is.
 */
const CAST: CastMember[] = [
    // A man in a dark coat, outside the shops
    { kind: 'ghost', x: 96, y: 66 },
    // The ice-cream vendor, by the lamp
    { kind: 'snowman', x: 238, y: 86 },
    // A jogger, getting his breath back
    { kind: 'skitter', x: 228, y: 142 },
    // A cyclist doing slow laps of the west side
    {
        kind: 'ironclad',
        x: 36,
        y: 94,
        route: [
            { x: 124, y: 94 },
            { x: 124, y: 126 },
            { x: 36, y: 126 },
            { x: 36, y: 94 },
        ],
    },
    // Two small dogs
    { kind: 'slime', x: 88, y: 146, animal: true },
    { kind: 'slime', x: 99, y: 151, animal: true },
    // Pigeons, at the foot of the fountain
    { kind: 'rat', x: 130, y: 141, animal: true },
    { kind: 'rat', x: 138, y: 147, animal: true },
    { kind: 'rat', x: 124, y: 149, animal: true },
    { kind: 'rat', x: 141, y: 139, animal: true },
];

/**
 * The twist. The same city square in plain daylight, with every detail back: the monsters are
 * passers-by, the Prism is a police car and the EMW Machine is a pocket torch. The player gets
 * a short moment with the torch, then it is taken out of his hands and the UI scene tells the
 * rest. Nobody here is laughed at.
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
    /** Dev only: ends whatever answer from the UI the scene is waiting for */
    private skipWait: (() => void) | null = null;

    constructor() {
        super('Ending');
    }

    create() {
        this.bystanders = [];
        this.bothered.clear();
        this.controlTaken = false;
        this.skipWait = null;

        const events = this.game.events;
        events.emit(Events.ENDING_STARTED);
        events.emit(Events.BANNER, '');

        this.cameras.main.setZoom(ZOOM).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        this.cameras.main.fadeIn(ENDING_SCENE.fadeIn, 255, 255, 255);
        this.physics.world.setBounds(ROOM.x, ROOM.y, ROOM.width, ROOM.height);

        // The square he has been defending all along
        const room = parseRoom([...SQUARE_LAYOUT]);
        this.walls = room.walls;
        this.drawSquare();
        const solids = this.physics.add.staticGroup();
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

        this.time.delayedCall(ENDING_SCENE.playTime, () => this.takeControl());

        if (import.meta.env.DEV) {
            // K moves the ending on: it takes the torch away, then skips each caption and card
            this.input.keyboard!.on('keydown-K', () => {
                if (this.skipWait) {
                    this.skipWait();
                } else {
                    this.takeControl();
                }
            });
        }
    }

    update(_time: number, delta: number) {
        this.player.update();
        this.cone.clear();

        const { x, y } = this.player;
        for (const bystander of this.bystanders) {
            bystander.update(delta, x, y);
        }
        if (this.controlTaken) {
            return;
        }

        const canStand = (px: number, py: number) => this.canStand(px, py);
        for (const bystander of this.bystanders) {
            const near = Math.hypot(bystander.x - x, bystander.y - y) < ENDING_SCENE.shooDistance;
            if (bystander.animal && near) {
                bystander.bother(x, y, canStand);
            }
        }

        if (this.input.activePointer.leftButtonDown()) {
            this.shineTorch();
        }
    }

    /** The square's picture in plain daylight, and the layer of it that people walk behind */
    private drawSquare() {
        if (!this.textures.exists(`city-${STYLE}`)) {
            return;
        }
        this.add.image(ROOM.x, ROOM.y, `city-${STYLE}`).setOrigin(0, 0).setScale(ART_SCALE).setDepth(CITY_DEPTH);
        this.add
            .image(ROOM.x, ROOM.y, `city-${STYLE}-over`)
            .setOrigin(0, 0)
            .setScale(ART_SCALE)
            .setDepth(CITY_OVER_DEPTH);
    }

    /** True if a bystander could stand at this point: on open paving, inside the square */
    private canStand(x: number, y: number) {
        const margin = TILE / 2;
        const insideX = x > ROOM.x + margin && x < ROOM.x + ROOM.width - margin;
        const insideY = y > ROOM.y + margin && y < ROOM.y + ROOM.height - margin;
        return insideX && insideY && !this.nav.isSolid(x, y);
    }

    /** The given spot if it is open paving, or else the nearest tile centre that is */
    private openSpot(x: number, y: number): Point {
        if (this.canStand(x, y)) {
            return { x, y };
        }
        let best: Point = { x, y };
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

    /** Park the police car and put the people, the dogs and the pigeons about the square */
    private placeCast(start: Point, obstacles: Phaser.Physics.Arcade.StaticGroup) {
        this.car = worldScale(this.add.sprite(CAR.x, CAR.y, `prism-${STYLE}`, 0)).setDepth(DEPTH.monster);
        // Its two frames swap the lights: the flashing colours he was fighting
        if (this.anims.exists(`prism-${STYLE}-move`)) {
            this.car.play(`prism-${STYLE}-move`);
        }
        obstacles.add(this.add.zone(CAR.x, CAR.y + 2, CAR.width, CAR.height));

        for (const member of CAST) {
            if (!this.textures.exists(`${member.kind}-${STYLE}`)) {
                continue;
            }
            const radius = MONSTERS[member.kind].radius;
            const spot = this.openSpot(member.x, member.y);
            // People stand in his way; animals and anyone on the move do not
            let obstacle: Phaser.GameObjects.Zone | undefined;
            if (!member.animal && !member.route) {
                obstacle = this.add.zone(spot.x, spot.y, radius * 2, radius * 2);
                obstacles.add(obstacle);
            }
            const bystander = new Bystander(this, spot.x, spot.y, member.kind, radius, {
                animal: member.animal,
                route: member.route,
                obstacle,
            });
            // Pigeons and dogs do not all look the same way
            if (member.animal) {
                bystander.setFlipX(this.bystanders.length % 2 === 0);
            }
            this.bystanders.push(bystander);
        }

        // Still shaken from a moment ago: the two people nearest him are already turning away
        this.time.delayedCall(ENDING_SCENE.fadeIn * 0.6, () => {
            this.bystanders
                .filter((bystander) => !bystander.animal && !bystander.walks)
                .sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y))
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
            if (bystander.bother(x, y, canStand) && !bystander.animal) {
                this.bothered.add(bystander);
            }
        }

        if (this.bothered.size >= ENDING_SCENE.peopleToBother) {
            // Let the last flinch play out before the car door opens
            this.bothered.clear();
            this.time.delayedCall(ENDING_SCENE.beat, () => this.takeControl());
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
        // He turns to the flashing lights, and the car door opens
        this.player.aim(Phaser.Math.Angle.Between(this.player.x, this.player.handY, this.car.x, this.car.y));
        if (this.car.texture.has(String(CAR_DOOR_OPEN))) {
            this.car.anims.stop();
            this.car.setFrame(CAR_DOOR_OPEN);
        }

        const registry = this.registry;
        const { beat } = ENDING_SCENE;
        this.after(beat, () =>
            this.say(ENDING.reveal, () =>
                this.say(ENDING.arrest, () => {
                    this.lowerTorch();
                    this.after(beat, () =>
                        this.show('report', () => {
                            // From now on the Field Guide shows what each thing really was
                            Progress.markEnded(registry);
                            this.show('guideTruth', () => this.show('credits', () => this.backToTitle()));
                        }),
                    );
                }),
            ),
        );
    }

    private say(lines: string[], done: () => void) {
        const timeout = ENDING_SCENE.dialogTimeout + ENDING_SCENE.dialogTimeoutPerLine * lines.length;
        this.wait(done, (finish) => showDialog(this, lines, timeout, finish));
    }

    private show(screen: string, done: () => void) {
        this.wait(done, (finish) => showScreen(this, screen, ENDING_SCENE.screenTimeout, finish));
    }

    /** Ask the UI for something and carry on when it answers, times out, or (dev) K is pressed */
    private wait(done: () => void, ask: (finish: () => void) => () => void) {
        const finish = () => {
            this.skipWait = null;
            done();
        };
        const cancel = ask(finish);
        this.skipWait = () => {
            cancel();
            finish();
        };
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
        camera.fadeOut(ENDING_SCENE.fadeOut, 0, 0, 0);
    }
}
