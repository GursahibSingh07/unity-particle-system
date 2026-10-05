import { ROOM, ROOM_COLS, ROOM_ROWS, TILE } from '../config/world';
import type { Rect } from './roomLayout';

// Grid navigation for monsters (no Phaser, so it can be unit tested).
// A distance field is flooded outwards from the player's tile; a monster walks "downhill",
// aiming at the furthest tile on its route that it can reach in a straight line. That keeps
// movement smooth: it never has to visit tile centres one by one.

const CELLS = ROOM_COLS * ROOM_ROWS;
const DIAGONAL = Math.SQRT2;
/** How many tiles ahead along the route a monster looks for a straight shortcut */
const LOOKAHEAD = 10;
/** Extra room kept between a monster and a corner when testing straight lines */
const CORNER_MARGIN = 0.5;
/** Rectangles are grown by this much, so a ray cannot slip along the seam between two tiles */
const SEAM = 0.01;

const NEIGHBOURS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
];

export interface Point {
    x: number;
    y: number;
}

/**
 * Distance along a ray until it enters a rectangle grown by `pad`, or Infinity on a miss.
 * (dx, dy) must be a unit vector. A ray starting inside returns 0.
 */
export function rayToRect(x: number, y: number, dx: number, dy: number, rect: Rect, pad = 0) {
    pad += SEAM;
    let near = 0;
    let far = Infinity;

    const left = rect.x - pad;
    const right = rect.x + rect.width + pad;
    if (dx === 0) {
        if (x <= left || x >= right) {
            return Infinity;
        }
    } else {
        const a = (left - x) / dx;
        const b = (right - x) / dx;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
    }

    const top = rect.y - pad;
    const bottom = rect.y + rect.height + pad;
    if (dy === 0) {
        if (y <= top || y >= bottom) {
            return Infinity;
        }
    } else {
        const a = (top - y) / dy;
        const b = (bottom - y) / dy;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
    }

    return near < far ? near : Infinity;
}

/** Distance along a ray to the nearest of `rects`, capped at `maxDistance` */
export function castRay(
    x: number,
    y: number,
    angle: number,
    maxDistance: number,
    rects: Rect[],
    pad = 0,
) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let nearest = maxDistance;
    for (const rect of rects) {
        nearest = Math.min(nearest, rayToRect(x, y, dx, dy, rect, pad));
    }
    return nearest;
}

/** True when nothing in `rects` (grown by `pad`) lies between the two points */
export function segmentClear(x1: number, y1: number, x2: number, y2: number, rects: Rect[], pad = 0) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length === 0) {
        return true;
    }
    const dx = (x2 - x1) / length;
    const dy = (y2 - y1) / length;
    for (const rect of rects) {
        if (rayToRect(x1, y1, dx, dy, rect, pad) < length) {
            return false;
        }
    }
    return true;
}

export function cellOf(x: number, y: number) {
    return {
        col: Math.min(ROOM_COLS - 1, Math.max(0, Math.floor((x - ROOM.x) / TILE))),
        row: Math.min(ROOM_ROWS - 1, Math.max(0, Math.floor((y - ROOM.y) / TILE))),
    };
}

export function cellCentre(col: number, row: number): Point {
    return { x: ROOM.x + col * TILE + TILE / 2, y: ROOM.y + row * TILE + TILE / 2 };
}

const indexOf = (col: number, row: number) => row * ROOM_COLS + col;
const inGrid = (col: number, row: number) => col >= 0 && col < ROOM_COLS && row >= 0 && row < ROOM_ROWS;

/** Walking distance, in tiles, from every tile to a goal tile */
export class FlowField {
    readonly distance = new Float32Array(CELLS).fill(Infinity);

    constructor(private blocked: boolean[]) {}

    isBlocked(col: number, row: number) {
        return !inGrid(col, row) || this.blocked[indexOf(col, row)];
    }

    distanceAt(col: number, row: number) {
        return inGrid(col, row) ? this.distance[indexOf(col, row)] : Infinity;
    }

    /** Diagonal steps may not cut across the corner of a blocked tile */
    private canStep(col: number, row: number, dc: number, dr: number, goal: number) {
        const target = indexOf(col + dc, row + dr);
        if (!inGrid(col + dc, row + dr) || (this.blocked[target] && target !== goal)) {
            return false;
        }
        if (dc !== 0 && dr !== 0) {
            return !this.isBlocked(col + dc, row) && !this.isBlocked(col, row + dr);
        }
        return true;
    }

    compute(goalCol: number, goalRow: number) {
        const distance = this.distance;
        distance.fill(Infinity);
        if (!inGrid(goalCol, goalRow)) {
            return;
        }

        // The goal counts as open even if it is blocked, so wide monsters can still
        // head for a player who is hugging a wall
        const goal = indexOf(goalCol, goalRow);
        distance[goal] = 0;

        // Dijkstra over 200 tiles; the open list is small enough to scan for its minimum
        const open = [goal];
        const done = new Uint8Array(CELLS);
        while (open.length > 0) {
            let best = 0;
            for (let i = 1; i < open.length; i++) {
                if (distance[open[i]] < distance[open[best]]) {
                    best = i;
                }
            }
            const current = open[best];
            open[best] = open[open.length - 1];
            open.pop();
            if (done[current]) {
                continue;
            }
            done[current] = 1;

            const col = current % ROOM_COLS;
            const row = (current - col) / ROOM_COLS;
            for (const [dc, dr] of NEIGHBOURS) {
                // Flooding runs backwards (goal to monster), so test the step in walking order
                const fromCol = col + dc;
                const fromRow = row + dr;
                if (!inGrid(fromCol, fromRow) || this.blocked[indexOf(fromCol, fromRow)]) {
                    continue;
                }
                if (!this.canStep(fromCol, fromRow, -dc, -dr, goal)) {
                    continue;
                }
                const next = indexOf(fromCol, fromRow);
                const cost = distance[current] + (dc !== 0 && dr !== 0 ? DIAGONAL : 1);
                if (cost < distance[next]) {
                    distance[next] = cost;
                    open.push(next);
                }
            }
        }
    }

    /** The neighbouring tile that is closest to the goal, or null if there is no way on */
    next(col: number, row: number) {
        const goalDistance = this.distanceAt(col, row);
        let best: { col: number; row: number } | null = null;
        let bestDistance = goalDistance;
        for (const [dc, dr] of NEIGHBOURS) {
            const distance = this.distanceAt(col + dc, row + dr);
            if (distance >= bestDistance) {
                continue;
            }
            if (dc !== 0 && dr !== 0 && (this.isBlocked(col + dc, row) || this.isBlocked(col, row + dr))) {
                continue;
            }
            best = { col: col + dc, row: row + dr };
            bestDistance = distance;
        }
        return best;
    }
}

/** Tells monsters which way to walk to reach a moving goal (the player) around solid tiles. */
export class Navigator {
    readonly goal: Point = { x: 0, y: 0 };

    private blocked: boolean[] = [];
    /** Only the tiles that stop a flyer */
    private walled: boolean[] = [];
    private narrow!: FlowField;
    /** For monsters wider than a tile: tiles next to a solid count as blocked */
    private wide!: FlowField;
    /** For flyers: the fountain and the street furniture are open air */
    private air!: FlowField;
    private goalCell = -1;

    /**
     * `walls` are the solids that also stop flyers (buildings). Without it everything solid
     * stops them, which is right for a room that has no props.
     */
    constructor(
        private solids: Rect[],
        private walls: Rect[] = solids,
    ) {
        this.rebuild();
    }

    /** Read the solids again: call after the list changes (a secret wall breaks, a chest appears) */
    rebuild() {
        this.blocked = new Array(CELLS).fill(false);
        for (const solid of this.solids) {
            const { col, row } = cellOf(solid.x + solid.width / 2, solid.y + solid.height / 2);
            this.blocked[indexOf(col, row)] = true;
        }
        this.walled = new Array(CELLS).fill(false);
        for (const wall of this.walls) {
            const { col, row } = cellOf(wall.x + wall.width / 2, wall.y + wall.height / 2);
            this.walled[indexOf(col, row)] = true;
        }
        this.air = new FlowField(this.walled);

        const padded = this.blocked.map((_, i) => {
            const col = i % ROOM_COLS;
            const row = (i - col) / ROOM_COLS;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (!inGrid(col + dc, row + dr) || this.blocked[indexOf(col + dc, row + dr)]) {
                        return true;
                    }
                }
            }
            return false;
        });

        this.narrow = new FlowField(this.blocked);
        this.wide = new FlowField(padded);
        this.goalCell = -1;
        this.setGoal(this.goal.x, this.goal.y);
    }

    /** Call every frame; the fields are only rebuilt when the goal changes tile */
    setGoal(x: number, y: number) {
        this.goal.x = x;
        this.goal.y = y;
        const { col, row } = cellOf(x, y);
        if (indexOf(col, row) !== this.goalCell) {
            this.goalCell = indexOf(col, row);
            this.narrow.compute(col, row);
            this.wide.compute(col, row);
            this.air.compute(col, row);
        }
    }

    private fieldFor(radius: number) {
        return radius > TILE / 2 ? this.wide : this.narrow;
    }

    isSolid(x: number, y: number) {
        const { col, row } = cellOf(x, y);
        return this.blocked[indexOf(col, row)];
    }

    /** True for a tile that stops flyers as well as walkers */
    isWall(x: number, y: number) {
        const { col, row } = cellOf(x, y);
        return this.walled[indexOf(col, row)];
    }

    /** True if a body of this radius can walk straight between the two points */
    canWalk(x1: number, y1: number, x2: number, y2: number, radius: number) {
        return segmentClear(x1, y1, x2, y2, this.solids, radius + CORNER_MARGIN);
    }

    /** True if a body of this radius can fly straight between the two points */
    canFly(x1: number, y1: number, x2: number, y2: number, radius: number) {
        return segmentClear(x1, y1, x2, y2, this.walls, radius + CORNER_MARGIN);
    }

    /** Walking distance to the goal in tiles, Infinity if it cannot be reached */
    distanceToGoal(x: number, y: number, radius = 0) {
        const { col, row } = cellOf(x, y);
        return this.fieldFor(radius).distanceAt(col, row);
    }

    /** Centres of the open tiles a body of this radius could stand on and reach the goal from */
    reachableCells(radius = 0) {
        const field = this.fieldFor(radius);
        const cells: Point[] = [];
        for (let row = 0; row < ROOM_ROWS; row++) {
            for (let col = 0; col < ROOM_COLS; col++) {
                if (!field.isBlocked(col, row) && field.distanceAt(col, row) < Infinity) {
                    cells.push(cellCentre(col, row));
                }
            }
        }
        return cells;
    }

    /**
     * Writes the point a body at (x, y) should walk towards right now into `out`.
     * Returns false when the goal cannot be reached at all (the caller may then go straight).
     * A `flying` body plans over the fountain and the furniture; only walls are in its way.
     */
    waypoint(x: number, y: number, radius: number, out: Point, flying = false) {
        out.x = this.goal.x;
        out.y = this.goal.y;
        const rects = flying ? this.walls : this.solids;
        const pad = radius + CORNER_MARGIN;
        if (segmentClear(x, y, this.goal.x, this.goal.y, rects, pad)) {
            return true;
        }

        let field = flying ? this.air : this.fieldFor(radius);
        let { col, row } = cellOf(x, y);
        if (field.distanceAt(col, row) === Infinity) {
            // A wide body standing beside a wall (a street entry) is off the wide field:
            // the narrow one still gets it out into the open
            field = flying ? field : this.narrow;
            if (field.distanceAt(col, row) === Infinity) {
                return false;
            }
        }

        for (let step = 0; step < LOOKAHEAD; step++) {
            const next = field.next(col, row);
            if (!next) {
                break;
            }
            // Written straight into `out`: this runs for every monster several times a second
            const centreX = ROOM.x + next.col * TILE + TILE / 2;
            const centreY = ROOM.y + next.row * TILE + TILE / 2;
            // Always accept the first step, so a monster pressed against a corner keeps moving
            if (step > 0 && !segmentClear(x, y, centreX, centreY, rects, pad)) {
                break;
            }
            out.x = centreX;
            out.y = centreY;
            col = next.col;
            row = next.row;
        }
        return true;
    }
}
