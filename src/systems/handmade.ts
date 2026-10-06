import Phaser from 'phaser';
import { ART_PIXEL, BOIL_FPS, GRAIN_FPS, LOOKS, type Ambient, type EraLook } from '../config/look';
import { ART_SCALE, ROOM } from '../config/world';
import { getSettings, watchSettings } from '../settings';
import type { ArtStyle } from '../types';

// The hand-made layer (src/config/look.ts): one camera filter that prints the frame on paper by
// an unsteady hand, and a few ambient motes in the air. Attach it to a scene's main camera with
// `new HandmadeLook(scene, style)`; `setStyle` follows an era switch. WebGL only: on a canvas
// renderer it does nothing.

const NODE = 'FilterHandmade';
/** The motes fly over everything that walks or is thrown, under the hit effects */
const AMBIENT_DEPTH = 5.5;
/** The art is 640 pixels across, whatever size the canvas is drawn at */
const ART_WIDTH = 640;

const FRAGMENT = `
#pragma phaserTemplate(shaderName)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uArtPixel;
uniform float uBoilStep;
uniform float uGrainStep;
/* saturation, contrast, brightness */
uniform vec3 uGrade;
uniform vec3 uTint;
uniform vec3 uLift;
/* paper, blotch, grain, vignette */
uniform vec4 uPaper;
/* boil, halftone */
uniform vec2 uPrint;

varying vec2 outTexCoord;

float hash(vec2 p)
{
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p)
{
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++)
    {
        v += a * noise(p);
        p *= 2.03;
        a *= 0.5;
    }
    return v;
}

void main()
{
    vec2 px = outTexCoord * uResolution;
    vec2 art = px / uArtPixel;
    vec2 fromCentre = outTexCoord - 0.5;
    vec2 uv = outTexCoord;

    /* The hand: the picture is redrawn a few times a second, never quite in the same place */
    if (uPrint.x > 0.0)
    {
        vec2 q = art / 40.0 + uBoilStep * 7.31;
        vec2 wobble = vec2(noise(q), noise(q + 19.7)) - 0.5;
        uv += wobble * 2.0 * uPrint.x * uArtPixel / uResolution;
    }

    vec3 col = texture2D(uMainSampler, uv).rgb;

    /* The grade */
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, uGrade.x);
    col = (col - 0.5) * uGrade.y + 0.5;
    col *= uGrade.z * uTint;

    /* Halftone: a 45 degree screen of dots that grows in the shadows */
    if (uPrint.y > 0.0)
    {
        vec2 r = mat2(0.7071, -0.7071, 0.7071, 0.7071) * px / (uArtPixel * 2.5);
        float radius = sqrt(clamp((0.85 - luma) / 0.85, 0.0, 1.0)) * 0.55;
        float d = length(fract(r) - 0.5);
        float inked = 1.0 - smoothstep(radius - 0.08, radius + 0.08, d);
        col *= 1.0 - inked * 0.2 * uPrint.y;
    }

    /* The paper: crossed fibres and tooth, a few specks, and ink that did not take evenly */
    vec2 warped = px + vec2(noise(px * 0.02), noise(px * 0.02 + 5.3)) * 60.0;
    float fibres = smoothstep(0.7, 0.97, noise(mat2(0.8, -0.6, 0.6, 0.8) * warped * vec2(0.4, 0.06)))
        + smoothstep(0.7, 0.97, noise(mat2(0.6, 0.8, -0.8, 0.6) * warped * vec2(0.4, 0.06) + 9.1));
    float tooth = noise(px * 0.7) - 0.5;
    col *= 1.0 - uPaper.x * (0.09 * tooth + 0.08 * fibres);
    float blotch = fbm(px / 170.0);
    col *= 1.0 + uPaper.y * 0.16 * (blotch - 0.5);
    float speck = step(0.997, hash(floor(px / 1.5) + 3.1));
    col *= 1.0 - speck * uPaper.x * 0.4;
    col += uLift * (1.0 - col);

    /* Grain */
    col += (noise(px * 0.8 + uGrainStep * 37.7) - 0.5) * uPaper.z * 2.5;

    /* Vignette */
    float corner = smoothstep(0.35, 0.95, length(fromCentre * vec2(1.0, 0.75)) * 1.5);
    col *= 1.0 - corner * uPaper.w * 0.55;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

class HandmadeFilter extends Phaser.Filters.Controller {
    look: EraLook;

    constructor(camera: Phaser.Cameras.Scene2D.Camera, look: EraLook) {
        super(camera, NODE);
        this.look = look;
    }
}

class FilterHandmade extends Phaser.Renderer.WebGL.RenderNodes.BaseFilterShader {
    constructor(manager: Phaser.Renderer.WebGL.RenderNodes.RenderNodeManager) {
        super(NODE, manager, undefined, FRAGMENT);
    }

    setupUniforms(controller: HandmadeFilter, drawingContext: Phaser.Renderer.WebGL.DrawingContext) {
        const look = controller.look;
        const seconds = performance.now() / 1000;
        const program = this.programManager;
        program.setUniform('uResolution', [drawingContext.width, drawingContext.height]);
        program.setUniform('uArtPixel', Math.max(1, (drawingContext.width / ART_WIDTH) * (ART_PIXEL / 2)));
        program.setUniform('uBoilStep', Math.floor(seconds * BOIL_FPS) % 1000);
        program.setUniform('uGrainStep', Math.floor(seconds * GRAIN_FPS) % 1000);
        program.setUniform('uGrade', [look.saturation, look.contrast, look.brightness]);
        program.setUniform('uTint', look.tint);
        program.setUniform('uLift', look.lift);
        program.setUniform('uPaper', [look.paper, look.blotch, look.grain, look.vignette]);
        program.setUniform('uPrint', [look.boil, look.halftone]);
    }
}

/** One small white texture per kind of mote, tinted when emitted */
function moteTexture(scene: Phaser.Scene, kind: Ambient['kind']): string {
    const key = `mote-${kind}`;
    if (scene.textures.exists(key)) {
        return key;
    }
    const shapes: Record<Ambient['kind'], [number, number, number][]> = {
        dust: [[1, 0, 0.5], [0, 1, 0.5], [1, 1, 1], [2, 1, 0.5], [1, 2, 0.5]],
        rain: [[0, 0, 0.25], [0, 1, 0.45], [0, 2, 0.6], [0, 3, 0.75], [0, 4, 0.9], [0, 5, 1], [0, 6, 1], [0, 7, 0.8]],
        ash: [[0, 0, 0.9], [1, 0, 0.6], [1, 1, 1], [0, 1, 0.5]],
        flecks: [[0, 0, 1], [1, 0, 1], [2, 1, 0.7]],
        leaves: [[1, 0, 1], [2, 0, 0.8], [0, 1, 0.8], [1, 1, 1], [2, 1, 1], [1, 2, 0.6]],
    };
    const cells = shapes[kind];
    const width = Math.max(...cells.map(([x]) => x)) + 1;
    const height = Math.max(...cells.map(([, y]) => y)) + 1;
    const canvas = scene.textures.createCanvas(key, width, height);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) {
        return '__WHITE';
    }
    for (const [x, y, alpha] of cells) {
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(x, y, 1, 1);
    }
    canvas.refresh();
    return key;
}

function emitAmbient(scene: Phaser.Scene, ambient: Ambient): Phaser.GameObjects.Particles.ParticleEmitter {
    const [low, high] = ambient.alpha;
    const peak = (low + high) / 2;
    const falling = ambient.kind === 'rain';
    const margin = falling ? 60 : 10;
    const zone = new Phaser.Geom.Rectangle(ROOM.x - margin, ROOM.y - margin, ROOM.width + margin * 2, ROOM.height + margin);
    const meanSpeed = (range: [number, number]) => (range[0] + range[1]) / 2;
    const lean = Phaser.Math.RadToDeg(Math.atan2(-meanSpeed(ambient.speedX), meanSpeed(ambient.speedY)));
    const emitter = scene.add.particles(0, 0, moteTexture(scene, ambient.kind), {
        emitZone: { type: 'random', source: zone, quantity: 0 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: { min: ambient.lifespan[0], max: ambient.lifespan[1] },
        speedX: { min: ambient.speedX[0], max: ambient.speedX[1] },
        speedY: { min: ambient.speedY[0], max: ambient.speedY[1] },
        scale: ART_SCALE,
        tint: ambient.colors,
        rotate: falling ? lean : ambient.kind === 'leaves' ? { min: 0, max: 360 } : 0,
        // Rain is seen at once; everything else drifts in and out of the light
        alpha: falling ? { min: low, max: high } : { onEmit: () => 0, onUpdate: (_particle, _key, t) => Math.sin(Math.PI * t) * peak },
        frequency: Math.max(10, ambient.lifespan[1] / ambient.count),
        maxAliveParticles: ambient.count,
    });
    emitter.setDepth(AMBIENT_DEPTH);
    emitter.fastForward(ambient.lifespan[1]);
    return emitter;
}

export class HandmadeLook {
    private filter: HandmadeFilter | null = null;
    private bloom: Phaser.Filters.ParallelFilters | null = null;
    private ambient: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    private style: ArtStyle;
    private enabled: boolean;
    private readonly stopWatching: () => void;

    /** `ambient: false` leaves the motes out (the cover is a printed page, not a place) */
    constructor(
        private readonly scene: Phaser.Scene,
        style: ArtStyle,
        private readonly options: { ambient?: boolean } = {},
    ) {
        this.style = style;
        this.enabled = getSettings().handmadeLook;
        const renderer = scene.renderer;
        if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
            if (!renderer.renderNodes.hasNode(NODE)) {
                renderer.renderNodes.addNodeConstructor(NODE, FilterHandmade);
            }
            const camera = scene.cameras.main;
            // The glow goes first, so the paper and grain are printed over it
            const [bloom] = Phaser.Actions.AddEffectBloom(camera, { threshold: 0.62, blurRadius: 3, blurSteps: 4 });
            this.bloom = bloom.parallelFilters;
            this.filter = camera.filters.external.add(new HandmadeFilter(camera, LOOKS[style])) as HandmadeFilter;
        }
        this.apply();
        this.stopWatching = watchSettings((settings) => {
            if (settings.handmadeLook !== this.enabled) {
                this.enabled = settings.handmadeLook;
                this.apply();
            }
        });
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    }

    setStyle(style: ArtStyle) {
        if (style !== this.style) {
            this.style = style;
            this.apply();
        }
    }

    private apply() {
        const look = LOOKS[this.style];
        if (this.filter) {
            this.filter.look = look;
            this.filter.setActive(this.enabled);
        }
        if (this.bloom) {
            this.bloom.blend.amount = look.bloom;
            this.bloom.setActive(this.enabled && look.bloom > 0);
        }
        this.ambient?.destroy();
        this.ambient = this.enabled && look.ambient && this.options.ambient !== false ? emitAmbient(this.scene, look.ambient) : null;
    }

    destroy() {
        this.stopWatching();
        this.ambient?.destroy();
        this.ambient = null;
        this.filter = null;
        this.bloom = null;
    }
}
