import Phaser from 'phaser';
import { BOOK, KEY } from './comic';

const SEGMENTS = 24;
const DURATION = 360;
/** How far the sheet bows while it is in the air, in radians */
const BEND = 0.62;
/** Distance to the eye: a lifted edge is nearer, so it is drawn bigger */
const EYE = 3200;
const FRONT = 'book-leaf-front';
const BACK = 'book-leaf-back';

type Page = Phaser.GameObjects.Container;

/**
 * One leaf of the book going over the spine. The page being lifted and the page on its back are
 * each drawn once into a texture; the leaf is then a strip of quads bent through half a turn,
 * showing the first texture while it faces the reader and the second once it has gone over.
 */
export class PageTurn {
    private readonly shadow: Phaser.GameObjects.Graphics;
    private readonly shade: Phaser.GameObjects.Graphics;
    private readonly front?: Phaser.GameObjects.Mesh2D;
    private readonly back?: Phaser.GameObjects.Mesh2D;
    private tween?: Phaser.Tweens.Tween;
    private done?: () => void;
    private side: 1 | -1 = 1;

    constructor(
        private readonly scene: Phaser.Scene,
        layer: Phaser.GameObjects.Container,
    ) {
        this.shadow = scene.add.graphics();
        this.shade = scene.add.graphics();
        layer.add(this.shadow);
        // Meshes are a WebGL thing: without them the page simply changes
        if (scene.sys.renderer.type === Phaser.WEBGL) {
            for (const key of [FRONT, BACK]) {
                if (!scene.textures.exists(key)) {
                    scene.textures.addDynamicTexture(key, BOOK.pageWidth, BOOK.pageHeight);
                }
            }
            const indices: number[] = [];
            for (let i = 0; i < SEGMENTS; i++) {
                indices.push(i * 4, i * 4 + 1, i * 4 + 2, 0, i * 4 + 1, i * 4 + 2, i * 4 + 3, 0);
            }
            const blank = () => new Array<number>(SEGMENTS * 16).fill(0);
            this.front = scene.add.mesh2d(0, 0, FRONT, blank(), indices.slice(), true).setVisible(false);
            this.back = scene.add.mesh2d(0, 0, BACK, blank(), indices.slice(), true).setVisible(false);
            layer.add([this.front, this.back]);
        }
        layer.add(this.shade);
    }

    get running() {
        return !!this.done;
    }

    /**
     * Lifts `lifting` (a page showing now) and lays `landing` (the page printed on its back) on
     * the other side. `side` is the side the leaf starts on: 1 for the right-hand page. Both
     * pages are hidden while the leaf stands in for them; `done` is called when it has landed.
     */
    start(lifting: Page, landing: Page, side: 1 | -1, done: () => void) {
        this.finish();
        if (!this.front || !this.back) {
            lifting.setVisible(false);
            done();
            return;
        }
        this.side = side;
        this.capture(FRONT, lifting);
        this.capture(BACK, landing);
        lifting.setVisible(false);
        landing.setVisible(false);
        // Along the leaf from the spine: the right-hand page starts at its left edge, the
        // left-hand page (and the back of a right-hand one) at its right edge
        this.setTexCoords(this.front.vertices, side === 1);
        this.setTexCoords(this.back.vertices, side !== 1);
        this.front.setVisible(true);
        this.back.setVisible(true);
        this.done = done;
        this.layout(0);
        this.tween = this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: DURATION,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => this.layout(tween.getValue() ?? 0),
            onComplete: () => this.finish(),
        });
    }

    /** Lands the leaf at once: the next turn, or closing the book, does not wait for this one */
    finish() {
        const done = this.done;
        if (!done) {
            return;
        }
        this.done = undefined;
        this.tween?.stop();
        this.tween = undefined;
        this.front?.setVisible(false);
        this.back?.setVisible(false);
        this.shadow.clear();
        this.shade.clear();
        done();
    }

    destroy() {
        this.done = undefined;
        this.tween?.stop();
        this.tween = undefined;
    }

    private capture(key: string, page: Page) {
        const texture = this.scene.textures.get(key) as Phaser.Textures.DynamicTexture;
        const { x, y } = page;
        const visible = page.visible;
        // Drawn from its own corner, wherever it lies in the book
        page.setPosition(0, 0).setVisible(true);
        texture.clear();
        texture.draw(page);
        texture.render();
        page.setPosition(x, y).setVisible(visible);
    }

    private setTexCoords(vertices: number[], fromLeftEdge: boolean) {
        for (let i = 0; i < SEGMENTS; i++) {
            const a = i / SEGMENTS;
            const b = (i + 1) / SEGMENTS;
            const u0 = fromLeftEdge ? a : 1 - a;
            const u1 = fromLeftEdge ? b : 1 - b;
            const at = i * 16;
            vertices[at + 2] = u0;
            vertices[at + 3] = 0;
            vertices[at + 6] = u1;
            vertices[at + 7] = 0;
            vertices[at + 10] = u0;
            vertices[at + 11] = 1;
            vertices[at + 14] = u1;
            vertices[at + 15] = 1;
        }
    }

    /** Bends the leaf to `t` of the way over (0 flat where it started, 1 flat on the other side) */
    private layout(t: number) {
        const front = this.front!;
        const back = this.back!;
        const { spine, top, pageWidth, pageHeight } = BOOK;
        const middle = top + pageHeight / 2;
        const turn = Math.PI * t;
        const lift = Math.sin(turn);
        const length = pageWidth / SEGMENTS;
        const shade = this.shade.clear();
        const shadow = this.shadow.clear();

        // The sheet in profile: along is the distance from the spine across the book, up is the
        // height off it
        let along = 0;
        let up = 0;
        let reach = 0;
        const project = (a: number, h: number) => {
            const scale = 1 + h / EYE;
            return { x: spine + this.side * a * scale, y0: middle - (pageHeight / 2) * scale, y1: middle + (pageHeight / 2) * scale };
        };
        let from = project(0, 0);
        for (let i = 0; i < SEGMENTS; i++) {
            // The free edge leads and the part by the spine follows, so the sheet bows
            const middleOfSegment = (i + 0.5) / SEGMENTS;
            const angle = Phaser.Math.Clamp(turn + BEND * lift * (2 * middleOfSegment - 1), 0, Math.PI);
            along += Math.cos(angle) * length;
            up += Math.sin(angle) * length;
            reach = Math.abs(along) > Math.abs(reach) ? along : reach;
            const to = project(along, up);
            const facing = Math.cos(angle) >= 0;
            const at = i * 16;
            const show = facing ? front.vertices : back.vertices;
            const hide = facing ? back.vertices : front.vertices;
            const corners = [from.x, from.y0, to.x, to.y0, from.x, from.y1, to.x, to.y1];
            for (let corner = 0; corner < 4; corner++) {
                show[at + corner * 4] = corners[corner * 2];
                show[at + corner * 4 + 1] = corners[corner * 2 + 1];
                // A quad with no area draws nothing
                hide[at + corner * 4] = 0;
                hide[at + corner * 4 + 1] = 0;
            }
            // Paper turned from the light goes dark; the underside darker than the top
            const dark = Math.sin(angle) * (facing ? 0.34 : 0.26) + (facing ? 0 : 0.05 * lift);
            if (dark > 0.004) {
                shade.fillStyle(KEY, Math.min(0.6, dark));
                shade.fillPoints(
                    [
                        new Phaser.Math.Vector2(from.x, from.y0),
                        new Phaser.Math.Vector2(to.x, to.y0),
                        new Phaser.Math.Vector2(to.x, to.y1),
                        new Phaser.Math.Vector2(from.x, from.y1),
                    ],
                    true,
                );
            }
            from = to;
        }
        // The free edge of the sheet, so paper reads against paper
        shade.lineStyle(2, KEY, 0.55 * Math.min(1, lift * 4)).lineBetween(from.x, from.y0, from.x, from.y1);

        // What the leaf hides from the light: the pages under it, from the spine out to where its
        // edge hangs, and a little beyond in the direction it is falling
        const edge = this.side * along;
        const ahead = (t > 0.5 ? -1 : 1) * this.side * 34 * lift;
        const bands = 7;
        for (let band = 0; band < bands; band++) {
            const end = spine + edge + (ahead * band) / (bands - 1);
            const left = Math.min(spine, end);
            const right = Math.max(spine, end);
            shadow.fillStyle(KEY, 0.09 * lift).fillRect(left, top, right - left, pageHeight);
        }
        // And the page it left behind lies in its shade near the spine
        const behind = this.side * Math.max(0, reach - along, 40 * lift);
        for (let band = 1; band <= 4; band++) {
            const width = (Math.abs(behind) * band) / 4;
            shadow.fillStyle(KEY, 0.06 * lift).fillRect(this.side === 1 ? spine : spine - width, top, width, pageHeight);
        }
    }
}
