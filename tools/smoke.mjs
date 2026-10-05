// Automated playthrough: boots the real game in a headless browser, plays every era with real
// keyboard and mouse input, and fails on any console error or stuck state.
//
//   npm run smoke                  the normal plan (about six minutes)
//   npm run smoke -- --long        the normal plan, then one whole timed era in real time
//   npm run smoke -- --long=retro  the same, playing that era instead of Cyberpunk (retro, manga)
//   npm run smoke -- --preview     only the production build check (also: npm run smoke:build)
//   npm run smoke -- --only=a,b    only these parts: boot, eras, death, sandbox, settings, long
//   npm run smoke -- --strict      SKIPs and console warnings also fail the run
//   npm run smoke -- --headed      show the browser window (for debugging a failure)
//
// Environment: BROWSER (path to a Chromium browser), SMOKE_VITE_PORT, SMOKE_DEBUG_PORT.
// No dependencies: Node's own fetch, http, zlib and WebSocket, and the browser's DevTools protocol.
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(import.meta.dirname, 'out');
const VITE_PORT = Number(process.env.SMOKE_VITE_PORT ?? 5190);
const DEBUG_PORT = Number(process.env.SMOKE_DEBUG_PORT ?? 9344);
const BASE_URL = `http://127.0.0.1:${VITE_PORT}/`;
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const HEADED = ARGS.includes('--headed');
const LONG_ARG = ARGS.find((arg) => arg === '--long' || arg.startsWith('--long='));
const LONG = LONG_ARG !== undefined;
/** Which timed era the long run plays: its style, as in --long=retro */
const LONG_ERA = LONG_ARG?.split('=')[1] || 'cyberpunk';
const PREVIEW = ARGS.includes('--preview');
const ONLY = ARGS.find((arg) => arg.startsWith('--only='))
    ?.slice('--only='.length)
    .split(',')
    .filter(Boolean);
const PARTS = ['boot', 'eras', 'death', 'sandbox', 'settings', 'long'];

// Generous on purpose: a slow laptop on battery must not turn into a false failure
const TIMEOUT = {
    server: 60_000,
    build: 180_000,
    browser: 30_000,
    boot: 30_000,
    room: 20_000,
    intro: 40_000,
    event: 5_000,
    wave: 45_000,
    death: 120_000,
    restart: 20_000,
    boss: 60_000,
    card: 40_000,
    protocol: 30_000,
    whole: (LONG ? 22 : 15) * 60_000,
};
/** Keys must stay down across at least one frame for Phaser's per-frame polling to see them */
const KEY_TAP_MS = 80;
const MOVE_HOLD_MS = 300;
/** World units the player must travel while a move key is held (70 units/s when written) */
const MIN_MOVE = 3;
/** A dash is 42 units when written; walls and furniture can cut it short */
const MIN_DASH = 15;
const SETTINGS_KEY = 'light-handler.settings';

// Used only when the game's own modules cannot be read (the production build has no /src)
const DEFAULT_EVENTS = {
    PLAYER_HEALTH_CHANGED: 'player-health-changed',
    PLAYER_DIED: 'player-died',
    ENERGY_CHANGED: 'energy-changed',
    RADIATION_CHANGED: 'radiation-changed',
    MONSTER_KILLED: 'monster-killed',
    PICKUP: 'pickup',
    SHOT: 'shot',
    BEAM: 'beam',
    DENIED: 'denied',
    MONSTER_SPAWNING: 'monster-spawning',
    MODE_CHANGED: 'mode-changed',
    WEAPON_STATE: 'weapon-state',
    DASHED: 'dashed',
    DASH_STATE: 'dash-state',
    UPGRADE_GET: 'upgrade-get',
    ERA_TIMER: 'era-timer',
    CHECKPOINT: 'checkpoint',
    SURGE: 'surge',
    BOSS_TELEGRAPH: 'boss-telegraph',
    ERA_SWAPPED: 'era-swapped',
    TITLE_SHOWN: 'title-shown',
    LEVEL_STARTED: 'level-started',
    SECRET_FOUND: 'secret-found',
    HEALTH_UPGRADE: 'health-upgrade',
    ENDING_STARTED: 'ending-started',
    DIALOG: 'dialog',
    DIALOG_DONE: 'dialog-done',
    SHOW_SCREEN: 'show-screen',
    SCREEN_DONE: 'screen-done',
    PAUSED: 'paused',
    UI_SELECT: 'ui-select',
    WAVE_STARTED: 'wave-started',
    ROOM_STARTED: 'room-started',
    BANNER: 'banner',
    LEVEL_CLEARED: 'level-cleared',
};
const DEFAULT_WORLD = { WORLD_WIDTH: 320, WORLD_HEIGHT: 180 };

const letter = (char) => ({ key: char, code: `Key${char.toUpperCase()}`, vk: char.toUpperCase().charCodeAt(0) });
const KEYS = {
    w: letter('w'),
    a: letter('a'),
    s: letter('s'),
    d: letter('d'),
    k: letter('k'),
    q: letter('q'),
    e: letter('e'),
    f: letter('f'),
    x: letter('x'),
    space: { key: ' ', code: 'Space', vk: 32 },
    enter: { key: 'Enter', code: 'Enter', vk: 13 },
    escape: { key: 'Escape', code: 'Escape', vk: 27 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
    up: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
    right: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
    down: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
};
const digitKey = (n) => ({ key: String(n), code: `Digit${n}`, vk: 48 + n });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------------------
// Report

const steps = [];
const skips = [];
const problems = { errors: [], warnings: [] };
let currentStep = null;
let shotCount = 0;
/** Lines for the summary that are results rather than checks (the long run's frame times) */
const findings = [];

const log = (line) => console.log(line);
const note = (line) => log(`      ${line}`);

function skip(what, reason) {
    skips.push({ step: currentStep?.name ?? 'setup', what, reason });
    log(`      SKIP ${what}: ${reason}`);
}

class SmokeFailure extends Error {}

function fail(message) {
    throw new SmokeFailure(message);
}

// ---------------------------------------------------------------------------------------
// Child processes and servers. Everything started here is stopped in cleanup(), whatever happens.

let viteProcess;
let browserProcess;
let staticServer;
let profileDir;
let buildDir;
let client;
let cleanedUp = false;

function killTree(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
        return;
    }
    if (process.platform === 'win32') {
        // child.kill() leaves the browser's helper processes behind on Windows
        const taskkill = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
        spawnSync(taskkill, ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
        child.kill('SIGKILL');
    }
}

function cleanup() {
    if (cleanedUp) {
        return;
    }
    cleanedUp = true;
    try {
        client?.close();
    } catch {
        // Already closed
    }
    try {
        staticServer?.closeAllConnections?.();
        staticServer?.close();
    } catch {
        // Already closed
    }
    killTree(browserProcess);
    killTree(viteProcess);
    removeTemp();
}

function removeTemp() {
    let gone = true;
    for (const dir of [profileDir, buildDir]) {
        if (!dir) {
            continue;
        }
        try {
            rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        } catch {
            // The browser can hold a file for a moment after it dies
        }
        gone &&= !existsSync(dir);
    }
    return gone;
}

/** The normal way out: stop everything, then make sure nothing is left behind */
async function shutdown() {
    cleanup();

    const deadline = Date.now() + 10_000;
    while (!removeTemp() && Date.now() < deadline) {
        await sleep(300);
    }
    for (const [port, what, envName] of [
        [VITE_PORT, 'game server', 'SMOKE_VITE_PORT'],
        [DEBUG_PORT, 'browser debugging', 'SMOKE_DEBUG_PORT'],
    ]) {
        for (;;) {
            try {
                await assertPortFree(port, what, envName);
                break;
            } catch {
                if (Date.now() >= deadline) {
                    log(`WARNING: port ${port} (${what}) is still in use after shutdown`);
                    break;
                }
                await sleep(200);
            }
        }
    }
}

process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.on(signal, () => {
        log(`\nInterrupted (${signal}): shutting down the browser and the server`);
        cleanup();
        process.exit(130);
    });
}

function findBrowser() {
    const env = process.env;
    const candidates = [
        env.BROWSER,
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
        '/snap/bin/chromium',
    ].filter(Boolean);

    if (env.BROWSER && !existsSync(env.BROWSER)) {
        fail(`BROWSER is set to "${env.BROWSER}", which does not exist`);
    }
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
        fail(
            'No Chromium browser found. Install Edge or Chrome, or set the BROWSER environment ' +
                `variable to the browser's executable. Looked in:\n  ${candidates.join('\n  ')}`,
        );
    }
    return found;
}

function assertPortFree(port, what, envName) {
    return new Promise((resolve, reject) => {
        const probePort = net.createServer();
        probePort.once('error', () => {
            reject(
                new SmokeFailure(
                    `Port ${port} (${what}) is already in use. A previous smoke run may still be alive; ` +
                        `stop it, or choose another port with ${envName}.`,
                ),
            );
        });
        probePort.listen(port, '127.0.0.1', () => probePort.close(() => resolve()));
    });
}

const viteBin = () => {
    const bin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    if (!existsSync(bin)) {
        fail(`Vite is not installed (${bin} is missing). Run "npm install" first.`);
    }
    return bin;
};

async function startVite() {
    let output = '';
    // process.execPath, because node is not on PATH on every machine this runs on
    viteProcess = spawn(
        process.execPath,
        [
            viteBin(),
            '--config',
            path.join(import.meta.dirname, 'vite.smoke.config.mjs'),
            '--host',
            '127.0.0.1',
            '--port',
            String(VITE_PORT),
            '--strictPort',
        ],
        { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    viteProcess.stdout.on('data', (chunk) => (output += chunk));
    viteProcess.stderr.on('data', (chunk) => (output += chunk));

    const deadline = Date.now() + TIMEOUT.server;
    while (Date.now() < deadline) {
        if (viteProcess.exitCode !== null) {
            fail(`The Vite dev server exited with code ${viteProcess.exitCode}:\n${output.trim()}`);
        }
        try {
            const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) });
            if (response.ok) {
                return;
            }
        } catch {
            // Not listening yet
        }
        await sleep(200);
    }
    fail(`The Vite dev server did not answer on ${BASE_URL} within ${TIMEOUT.server / 1000}s:\n${output.trim()}`);
}

/** The production build, into a temporary folder: the repository's own dist/ is left alone */
function buildGame() {
    buildDir = mkdtempSync(path.join(os.tmpdir(), 'light-handler-build-'));
    const result = spawnSync(process.execPath, [viteBin(), 'build', '--outDir', buildDir, '--emptyOutDir', '--logLevel', 'warn'], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: TIMEOUT.build,
    });
    if (result.status !== 0) {
        fail(`"vite build" failed (exit ${result.status ?? result.signal}):\n${`${result.stdout}\n${result.stderr}`.trim()}`);
    }
    if (!existsSync(path.join(buildDir, 'index.html'))) {
        fail(`"vite build" wrote no index.html into ${buildDir}`);
    }
    const files = readdirSync(buildDir, { recursive: true }).filter((file) => statSync(path.join(buildDir, file)).isFile());
    const bytes = files.reduce((sum, file) => sum + statSync(path.join(buildDir, file)).size, 0);
    return { files, bytes };
}

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json',
};

/** Serves the built files and nothing else: what itch.io does, without a dev server's help */
function startStaticServer(dir) {
    return new Promise((resolve, reject) => {
        staticServer = http.createServer((request, response) => {
            const pathname = decodeURIComponent(new URL(request.url, BASE_URL).pathname);
            const file = path.normalize(path.join(dir, pathname === '/' ? 'index.html' : pathname));
            if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
                response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
                return;
            }
            response.writeHead(200, {
                'content-type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
                'cache-control': 'no-store',
            });
            createReadStream(file).pipe(response);
        });
        staticServer.once('error', reject);
        staticServer.listen(VITE_PORT, '127.0.0.1', resolve);
    });
}

async function startBrowser(executable) {
    profileDir = mkdtempSync(path.join(os.tmpdir(), 'light-handler-smoke-'));
    browserProcess = spawn(
        executable,
        [
            ...(HEADED ? [] : ['--headless=new']),
            `--user-data-dir=${profileDir}`,
            `--remote-debugging-port=${DEBUG_PORT}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions',
            '--mute-audio',
            // Headless has no GPU; without this WebGL is refused
            '--enable-unsafe-swiftshader',
            // Keep the game loop at full speed even though nobody is looking at the window
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--window-size=1280,720',
            'about:blank',
        ],
        { stdio: 'ignore' },
    );

    const deadline = Date.now() + TIMEOUT.browser;
    while (Date.now() < deadline) {
        if (browserProcess.exitCode !== null) {
            fail(`The browser exited straight away with code ${browserProcess.exitCode} (${executable})`);
        }
        try {
            const targets = await (
                await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`, { signal: AbortSignal.timeout(2000) })
            ).json();
            const page = targets.find((target) => target.type === 'page');
            if (page) {
                return page.webSocketDebuggerUrl;
            }
        } catch {
            // Not listening yet
        }
        await sleep(200);
    }
    fail(`The browser did not open its debugging port ${DEBUG_PORT} within ${TIMEOUT.browser / 1000}s`);
}

// ---------------------------------------------------------------------------------------
// DevTools protocol

class Client {
    #socket;
    #nextId = 1;
    #pending = new Map();

    static async connect(url) {
        const instance = new Client();
        instance.#socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
            instance.#socket.onopen = resolve;
            instance.#socket.onerror = () => reject(new SmokeFailure(`Could not connect to the browser at ${url}`));
        });
        instance.#socket.onmessage = (event) => instance.#onMessage(JSON.parse(event.data));
        instance.#socket.onclose = () => {
            for (const { reject } of instance.#pending.values()) {
                reject(new SmokeFailure('The browser closed the connection (did it crash, or was it killed for memory?)'));
            }
            instance.#pending.clear();
        };
        return instance;
    }

    #onMessage(message) {
        if (message.id) {
            const waiting = this.#pending.get(message.id);
            if (!waiting) {
                return;
            }
            this.#pending.delete(message.id);
            clearTimeout(waiting.timer);
            if (message.error) {
                waiting.reject(new SmokeFailure(`${waiting.method}: ${message.error.message}`));
            } else {
                waiting.resolve(message.result);
            }
            return;
        }
        recordBrowserEvent(message);
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.#nextId++;
            const timer = setTimeout(() => {
                this.#pending.delete(id);
                reject(new SmokeFailure(`${method}: no answer from the browser in ${TIMEOUT.protocol / 1000}s (page frozen?)`));
            }, TIMEOUT.protocol);
            this.#pending.set(id, { resolve, reject, timer, method });
            this.#socket.send(JSON.stringify({ id, method, params }));
        });
    }

    close() {
        this.#socket?.close();
    }
}

const describeArg = (arg) => String(arg.value ?? arg.description ?? arg.unserializableValue ?? arg.type);

function recordBrowserEvent({ method, params }) {
    if (method === 'Runtime.consoleAPICalled') {
        const text = params.args.map(describeArg).join(' ');
        if (params.type === 'error' || params.type === 'assert') {
            problems.errors.push(`console.error: ${text}`);
        } else if (params.type === 'warning') {
            problems.warnings.push(`console.warn: ${text}`);
        }
    } else if (method === 'Runtime.exceptionThrown') {
        const details = params.exceptionDetails;
        const where = details.url ? ` (${details.url}:${details.lineNumber + 1})` : '';
        problems.errors.push(`uncaught exception: ${details.exception?.description ?? details.text}${where}`);
    } else if (method === 'Log.entryAdded') {
        const { level, text, url, source } = params.entry;
        // Browsers ask for a favicon on their own; the game does not have one
        if (url?.endsWith('/favicon.ico')) {
            return;
        }
        // Every page with sound gets this until the first key or click; the game unlocks audio then
        if (text.includes('AudioContext was not allowed to start')) {
            return;
        }
        const line = `browser ${source}: ${text}${url ? ` (${url})` : ''}`;
        if (level === 'error') {
            problems.errors.push(line);
        } else if (level === 'warning') {
            problems.warnings.push(line);
        }
    }
}

/** Runs a function inside the page and returns its JSON result. Promises are awaited. */
async function inPage(fn, ...args) {
    const result = await client.send('Runtime.evaluate', {
        expression: `(${fn})(...${JSON.stringify(args)})`,
        awaitPromise: true,
        returnByValue: true,
    });
    if (result.exceptionDetails) {
        const details = result.exceptionDetails;
        fail(`Reading the page failed: ${details.exception?.description ?? details.text}`);
    }
    return result.result.value;
}

// ---------------------------------------------------------------------------------------
// Code that runs inside the page

/**
 * Installed before any page script runs. It finds the Phaser.Game and records everything
 * emitted on game.events from then on, so the smoke test reads the game through its public
 * event contract.
 *
 * In dev, main.ts assigns the game to window.__game and that assignment is caught. The
 * production build must not expose it, so there the game is caught as it is constructed:
 * Phaser.Game sets `this.isBooted` in its constructor, and a setter on Object.prototype sees
 * that. Nothing in the game is changed either way.
 */
function probe(trapGlobal) {
    const PER_FRAME = new Set(['prestep', 'step', 'poststep', 'prerender', 'postrender']);
    const KEEP = 400;
    const smoke = { game: null, exposed: false, seq: 0, events: {}, frames: null, crowd: null };

    const plain = (value) => {
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
            return value;
        }
        if (typeof value === 'object') {
            try {
                const text = JSON.stringify(value);
                return text.length <= 4000 ? JSON.parse(text) : '[object]';
            } catch {
                return '[object]';
            }
        }
        return `[${typeof value}]`;
    };

    function hook(game) {
        if (smoke.game) {
            return;
        }
        smoke.game = game;
        const emit = game.events.emit;
        let lastStep = 0;
        game.events.emit = function (name, ...args) {
            if (name === 'step') {
                const now = performance.now();
                const frames = smoke.frames;
                if (frames && lastStep) {
                    const took = now - lastStep;
                    frames.count++;
                    frames.total += took;
                    frames.min = Math.min(frames.min, took);
                    frames.max = Math.max(frames.max, took);
                    if (took > 33.4) {
                        frames.slow++;
                    }
                }
                lastStep = now;
                const crowd = smoke.crowd;
                if (crowd) {
                    try {
                        const scene = game.scene.getScene('Game');
                        if (scene && scene.sys.isActive()) {
                            const era = scene.snapshot();
                            const size = era.alive + era.incoming;
                            crowd.samples++;
                            if (size > crowd.max) {
                                crowd.max = size;
                                crowd.at = era.elapsed;
                            }
                        }
                    } catch {
                        // Between scenes: nothing to count
                    }
                }
            } else if (typeof name === 'string' && !PER_FRAME.has(name)) {
                const list = (smoke.events[name] ??= []);
                list.push({ seq: ++smoke.seq, at: performance.now(), args: args.map(plain) });
                if (list.length > KEEP) {
                    list.shift();
                }
            }
            return emit.call(this, name, ...args);
        };
    }

    if (trapGlobal) {
        let game;
        Object.defineProperty(window, '__game', {
            configurable: true,
            get: () => game,
            set: (value) => {
                game = value;
                smoke.exposed = true;
                hook(value);
            },
        });
    }
    Object.defineProperty(Object.prototype, 'isBooted', {
        configurable: true,
        enumerable: false,
        get: () => undefined,
        set(value) {
            Object.defineProperty(this, 'isBooted', { value, writable: true, enumerable: true, configurable: true });
            const candidate = this;
            // After the constructor has finished: only a Phaser.Game has all of these by then
            Promise.resolve().then(() => {
                if (candidate.events && candidate.scene && candidate.loop && candidate.canvas !== undefined) {
                    hook(candidate);
                }
            });
        },
    });
    window.__smoke = smoke;
}

/** One snapshot of everything the smoke test looks at */
function snapshot(names, settingsKey) {
    const smoke = window.__smoke;
    const game = smoke?.game;
    if (!game) {
        return { hasGame: false, exposed: false, globalGame: typeof window.__game };
    }

    const last = (name) => smoke.events[name]?.at(-1) ?? null;
    const manager = game.scene;
    const active = manager.getScenes(true);
    const gameScene = manager.getScene('Game');
    const gamePaused = !!gameScene && manager.isPaused('Game');
    const gameRunning = !!gameScene && (manager.isActive('Game') || gamePaused);

    // The era's own public report (src/scenes/Game.ts)
    let era = null;
    // `player` is a private field of the Game scene: nothing public gives his position
    let player = null;
    if (gameRunning) {
        try {
            era = gameScene.snapshot();
        } catch {
            // Not created yet
        }
        const found = gameScene.player;
        if (found && typeof found.x === 'number') {
            player = { x: found.x, y: found.y, invincible: found.invincible === true };
        }
    }

    const texts = [];
    const walk = (list) => {
        for (const child of list) {
            // Alpha is not looked at: the HUD keeps its "n/5" as a transparent Text for this test to read
            if (!child || child.visible === false) {
                continue;
            }
            if (child.type === 'Text') {
                texts.push(child.text);
            } else if (Array.isArray(child.list)) {
                walk(child.list);
            }
        }
    };
    for (const scene of active) {
        walk(scene.children.list);
    }

    let storage = null;
    try {
        storage = localStorage.getItem(settingsKey);
    } catch {
        storage = '(blocked)';
    }
    const registry = game.registry;
    const rect = game.canvas.getBoundingClientRect();
    return {
        hasGame: true,
        exposed: smoke.exposed,
        globalGame: typeof window.__game,
        frame: game.loop.frame,
        seq: smoke.seq,
        now: performance.now(),
        scenes: active.map((scene) => scene.scene.key),
        gamePaused,
        era,
        player,
        texts,
        storage,
        progress: {
            upgrades: registry.get('progress.upgrades') ?? [],
            guide: registry.get('progress.guide') ?? [],
            secrets: registry.get('progress.secrets') ?? [],
            bonusHealth: registry.get('progress.bonusHealth') ?? 0,
            ended: registry.get('progress.ended') === true,
        },
        canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        room: last(names.ROOM_STARTED),
        level: last(names.LEVEL_STARTED),
        health: last(names.PLAYER_HEALTH_CHANGED),
        energy: last(names.ENERGY_CHANGED),
        radiation: last(names.RADIATION_CHANGED),
        mode: last(names.MODE_CHANGED),
        weapon: last(names.WEAPON_STATE),
        dash: last(names.DASH_STATE),
        died: last(names.PLAYER_DIED),
        timer: last(names.ERA_TIMER),
        levelCleared: last(names.LEVEL_CLEARED),
        title: last(names.TITLE_SHOWN),
    };
}

/** Everything recorded under one event name after event number `seq` */
function recorded(name, seq) {
    return (window.__smoke?.events[name] ?? []).filter((entry) => entry.seq > seq);
}

/** Starts (or reads and stops) the per-frame recorders used by the long run */
function recorders(action) {
    const smoke = window.__smoke;
    if (action === 'start') {
        smoke.frames = { count: 0, total: 0, min: Infinity, max: 0, slow: 0 };
        smoke.crowd = { max: 0, at: 0, samples: 0 };
        return null;
    }
    const result = { frames: smoke.frames, crowd: smoke.crowd };
    if (action === 'stop') {
        smoke.frames = null;
        smoke.crowd = null;
    }
    return result;
}

/** Reads the game's own config through the dev server, so nothing about the eras is hard-coded here */
async function readContent() {
    const load = async (file) => {
        try {
            return await import(/* @vite-ignore */ file);
        } catch (error) {
            return { failed: String(error) };
        }
    };
    const [levels, monsters, rays, events, world, text, flow] = await Promise.all([
        load('/src/config/levels/index.ts'),
        load('/src/config/monsters.ts'),
        load('/src/config/rays.ts'),
        load('/src/events.ts'),
        load('/src/config/world.ts'),
        load('/src/config/text.ts'),
        load('/src/config/flow.ts'),
    ]);
    return JSON.parse(
        JSON.stringify({
            levels: levels.LEVELS ?? null,
            sandbox: levels.SANDBOX ?? null,
            levelsError: levels.failed ?? null,
            monsters: monsters.MONSTERS ?? null,
            spawn: monsters.SPAWN ?? null,
            prism: monsters.PRISM ?? null,
            rays: rays.RAYS ?? null,
            rules: rays.ERA_RULES ?? null,
            defaultRule: rays.DEFAULT_RULE ?? null,
            green: rays.GREEN ?? null,
            events: events.Events ?? null,
            world: world.WORLD_WIDTH ? { WORLD_WIDTH: world.WORLD_WIDTH, WORLD_HEIGHT: world.WORLD_HEIGHT, TILE: world.TILE, ROOM: world.ROOM } : null,
            banners: text.BANNERS ?? null,
            bossWords: text.BOSS_WORDS ?? null,
            ending: text.ENDING ?? null,
            flow: flow.FLOW ?? null,
        }),
    );
}

// ---------------------------------------------------------------------------------------
// Screenshots, and a PNG reader small enough to keep here (to tell a drawn canvas from a blank one)

async function capture() {
    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(data, 'base64');
}

async function screenshot(name, png) {
    const file = `${String(++shotCount).padStart(2, '0')}-${name}.png`;
    writeFileSync(path.join(OUT_DIR, file), png ?? (await capture()));
    return file;
}

/** 8-bit RGB or RGBA, not interlaced: what the browser's screenshots are */
function decodePng(buffer) {
    let offset = 8;
    let width = 0;
    let height = 0;
    let channels = 0;
    const data = [];
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('latin1', offset + 4, offset + 8);
        const body = buffer.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            const colorType = body[9];
            channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
            if (body[8] !== 8 || channels === 0 || body[12] !== 0) {
                return null;
            }
        } else if (type === 'IDAT') {
            data.push(body);
        }
        offset += 12 + length;
    }
    const raw = zlib.inflateSync(Buffer.concat(data));
    const stride = width * channels;
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const out = pixels.subarray(y * stride, (y + 1) * stride);
        const up = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? out[x - channels] : 0;
            const b = up ? up[x] : 0;
            const c = up && x >= channels ? up[x - channels] : 0;
            let predicted = 0;
            if (filter === 1) {
                predicted = a;
            } else if (filter === 2) {
                predicted = b;
            } else if (filter === 3) {
                predicted = (a + b) >> 1;
            } else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            out[x] = (line[x] + predicted) & 0xff;
        }
    }
    return { width, height, channels, pixels };
}

/** A coarse grid of colours across the picture, for comparing two screenshots */
function sampleGrid(image, cols = 64, rows = 36) {
    const samples = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = Math.floor(((col + 0.5) / cols) * image.width);
            const y = Math.floor(((row + 0.5) / rows) * image.height);
            const at = (y * image.width + x) * image.channels;
            samples.push((image.pixels[at] << 16) | (image.pixels[at + 1] << 8) | image.pixels[at + 2]);
        }
    }
    return samples;
}

/** How much of the picture is drawn: distinct colours, and the share taken by the commonest one */
function describePicture(samples) {
    const counts = new Map();
    for (const color of samples) {
        counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    return { colors: counts.size, flat: Math.max(...counts.values()) / samples.length };
}

/** Fraction of grid points whose colour differs noticeably between two screenshots */
function difference(a, b) {
    let changed = 0;
    for (let i = 0; i < a.length; i++) {
        const delta =
            Math.abs((a[i] >> 16) - (b[i] >> 16)) + Math.abs(((a[i] >> 8) & 0xff) - ((b[i] >> 8) & 0xff)) + Math.abs((a[i] & 0xff) - (b[i] & 0xff));
        if (delta > 48) {
            changed++;
        }
    }
    return changed / a.length;
}

/** Takes a screenshot, saves it, and fails unless a picture has really been drawn */
async function expectDrawn(name, what) {
    const png = await capture();
    await screenshot(name, png);
    const image = decodePng(png);
    if (!image) {
        skip(`${what} is not blank`, 'the screenshot is not an 8-bit RGB PNG, so its pixels cannot be read');
        return null;
    }
    const samples = sampleGrid(image);
    const { colors, flat } = describePicture(samples);
    if (colors < 12 || flat > 0.9) {
        fail(`${what} looks blank: ${colors} distinct colours in the screenshot, ${Math.round(flat * 100)}% of it one colour`);
    }
    note(`${what} is drawn (${colors} colours sampled, the commonest covers ${Math.round(flat * 100)}%)`);
    return samples;
}

// ---------------------------------------------------------------------------------------
// Driving the game

let eventNames = DEFAULT_EVENTS;
let world = DEFAULT_WORLD;
let content;

const look = () => inPage(snapshot, eventNames, SETTINGS_KEY);
const eventsSince = (name, seq) => inPage(recorded, name, seq);

/** Polls until `test` returns something truthy; throws with the last thing seen otherwise */
async function waitFor(what, timeout, test, interval = 100) {
    const deadline = Date.now() + timeout;
    let state;
    for (;;) {
        state = await look();
        const result = test(state);
        if (result) {
            return result === true ? state : result;
        }
        if (Date.now() >= deadline) {
            break;
        }
        await sleep(interval);
    }
    fail(`Timed out after ${timeout / 1000}s waiting for ${what}. Last seen: ${describeState(state)}`);
}

/** Waits for an event recorded after `seq` (that `accept` agrees with) and returns it */
async function waitEvent(what, name, seq, timeout = TIMEOUT.event, accept = () => true) {
    const deadline = Date.now() + timeout;
    for (;;) {
        const found = (await eventsSince(name, seq)).find((entry) => accept(entry.args));
        if (found) {
            return found;
        }
        if (Date.now() >= deadline) {
            break;
        }
        await sleep(60);
    }
    fail(`Timed out after ${timeout / 1000}s waiting for ${what} (no "${name}" event). Last seen: ${describeState(await look())}`);
}

/** Waits `ms`, then fails if the event came anyway */
async function expectNoEvent(what, name, seq, ms, accept = () => true) {
    await sleep(ms);
    const found = (await eventsSince(name, seq)).filter((entry) => accept(entry.args));
    if (found.length > 0) {
        fail(`${what}, but "${name}" was emitted with ${JSON.stringify(found[0].args)}`);
    }
}

function describeState(state) {
    if (!state?.hasGame) {
        return 'the Phaser game was never found (did the page fail to load, or did main.ts stop exposing window.__game in dev?)';
    }
    const room = state.room ? `room ${state.room.args[1]}/${state.room.args[2]} of "${state.room.args[0]}"` : 'no room started';
    const health = state.health ? `health ${state.health.args[0]}/${state.health.args[1]}` : 'health unknown';
    const energy = state.energy ? `energy ${Math.round(state.energy.args[0])}/${state.energy.args[1]}` : 'energy unknown';
    const era = state.era
        ? `era { started ${state.era.started}, waiting ${state.era.waiting}, cleared ${state.era.cleared}, finished ${state.era.finished}, ` +
          `wave ${state.era.wave}, alive ${state.era.alive}, incoming ${state.era.incoming}` +
          (state.era.timed ? `, clock ${state.era.elapsed.toFixed(1)}s, ${state.era.secondsLeft}s left` : '') +
          ' }'
        : 'no era';
    return `scenes [${state.scenes.join(', ')}]${state.gamePaused ? ' (Game paused)' : ''}, ${room}, ${era}, ${health}, ${energy}, frame ${state.frame}`;
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function keyDown({ key, code, vk }) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
}

async function keyUp({ key, code, vk }) {
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
}

async function tap(key) {
    await keyDown(key);
    await sleep(KEY_TAP_MS);
    await keyUp(key);
}

/** Screen position of a world point. The canvas is letterboxed, so this goes through its real rect. */
function toScreen(canvas, worldX, worldY) {
    return {
        x: canvas.left + (worldX / world.WORLD_WIDTH) * canvas.width,
        y: canvas.top + (worldY / world.WORLD_HEIGHT) * canvas.height,
    };
}

let lastPointer = { x: 640, y: 360 };

async function mouse(type, point, pressed) {
    lastPointer = point;
    await client.send('Input.dispatchMouseEvent', {
        type,
        x: point.x,
        y: point.y,
        button: type === 'mouseMoved' ? 'none' : 'left',
        buttons: pressed ? 1 : 0,
        clickCount: type === 'mouseMoved' ? 0 : 1,
    });
}

async function releaseEverything() {
    // A failed step must not leave a key or the mouse held down for the next one
    for (const key of Object.values(KEYS)) {
        await keyUp(key);
    }
    await mouse('mouseReleased', lastPointer, false);
}

/** Opens the game with the given query string and waits until a frame loop is running */
async function open(query) {
    const errorsBefore = problems.errors.length;
    await client.send('Page.navigate', { url: BASE_URL + query });
    let firstFrame;
    let stuckSince;
    await waitFor(`the game to start at ${query || '/'}`, TIMEOUT.boot, (state) => {
        if (!state.hasGame || state.scenes.length === 0) {
            return false;
        }
        firstFrame ??= state.frame;
        stuckSince ??= Date.now();
        // An exception in a scene's update stops the loop for good; no point waiting out the timeout
        if (state.frame === firstFrame && problems.errors.length > errorsBefore && Date.now() - stuckSince > 3000) {
            fail(`The game loop stopped at frame ${state.frame} after an error while starting at ${query || '/'}`);
        }
        // Frames must actually advance: a game object that exists but never ticks is stuck
        return state.frame > firstFrame;
    });
}

const roomIs = (state, levelName, roomNumber) =>
    state.scenes?.includes('Game') && state.room?.args[0] === levelName && state.room?.args[1] === roomNumber;

async function waitForRoom(level, roomNumber, timeout = TIMEOUT.room, afterSeq = 0) {
    return waitFor(`room ${roomNumber} of "${level.name}" to start`, timeout, (state) =>
        roomIs(state, level.name, roomNumber) && state.room.seq > afterSeq && state.era ? state : false,
    );
}

/** The sandbox has no era of its own: everything is switched on there (as in src/scenes/Game.ts) */
const ruleOf = (level) => level.rule ?? (level === content.sandbox ? content.defaultRule : content.rules?.[level.style]) ?? content.defaultRule;

/** Checks the HUD shows "<number>/<total>". Wording is the UI owner's, so only the numbers are read. */
function checkHud(state, number, total, what = 'era') {
    const counters = state.texts.flatMap((text) => [...String(text).matchAll(/(\d+)\s*\/\s*(\d+)/g)]);
    if (counters.length === 0) {
        skip(`HUD ${what} counter`, 'no visible text shows "<n>/<total>", so the HUD cannot be compared with the game');
        return;
    }
    if (!counters.some((match) => Number(match[1]) === number && Number(match[2]) === total)) {
        fail(`The HUD does not show ${what} ${number}/${total}. Visible text: ${JSON.stringify(state.texts)}`);
    }
    note(`HUD shows ${number}/${total}`);
}

/**
 * Puts the era's title card, its captions and its item card away with Space, the way a player
 * does, and checks each was answered by the UI rather than by the Game scene's timeout.
 */
async function passIntro(level, tag, afterSeq = 0) {
    const grants = level.grants ?? [];
    const begun = await waitFor(`the title card of "${level.name}"`, TIMEOUT.room, (state) =>
        state.level?.seq > afterSeq && state.level.args[1] === level.name ? state : false,
    );
    const from = begun.level.seq;
    if (!same(begun.level.args[3], level.introText ?? [])) {
        fail(`"${eventNames.LEVEL_STARTED}" carried ${JSON.stringify(begun.level.args[3])}, not the era's introText`);
    }
    await sleep(350);
    await screenshot(`${tag}-title-card`);

    let cardShot = grants.length === 0;
    let presses = 0;
    const deadline = Date.now() + TIMEOUT.intro;
    for (;;) {
        const state = await look();
        if (state.era?.started) {
            break;
        }
        if (Date.now() >= deadline) {
            fail(
                `Pressing Space ${presses} times in ${TIMEOUT.intro / 1000}s did not put the title card, captions and item card of ` +
                    `"${level.name}" away. Visible text: ${JSON.stringify(state.texts)}. ${describeState(state)}`,
            );
        }
        if (!cardShot && (await eventsSince(eventNames.UPGRADE_GET, from)).length > 0) {
            cardShot = true;
            await sleep(700);
            await screenshot(`${tag}-item-card`);
        }
        await tap(KEYS.space);
        presses++;
        await sleep(280);
    }

    const [done, selects, upgrades, screens, dashes] = await Promise.all(
        [eventNames.DIALOG_DONE, eventNames.UI_SELECT, eventNames.UPGRADE_GET, eventNames.SCREEN_DONE, eventNames.DASHED].map((name) =>
            eventsSince(name, from),
        ),
    );
    if (done.length === 0) {
        fail(`The era started without "${eventNames.DIALOG_DONE}": the UI never answered the title card of "${level.name}"`);
    }
    if (selects.length === 0) {
        fail(`No "${eventNames.UI_SELECT}" while the captions were up: Space did not advance them (they only timed out)`);
    }
    if (grants.length > 0) {
        const got = upgrades[0]?.args[0];
        if (!got) {
            fail(`"${level.name}" grants ${grants.join(', ')} but no "${eventNames.UPGRADE_GET}" was emitted`);
        }
        if (!same([...got].sort(), [...grants].sort())) {
            fail(`"${eventNames.UPGRADE_GET}" carried [${got.join(', ')}], but "${level.name}" grants [${grants.join(', ')}]`);
        }
        if (!screens.some((entry) => entry.args[0] === 'itemGet')) {
            fail(`The item card of "${level.name}" was never answered with "${eventNames.SCREEN_DONE}"("itemGet")`);
        }
    } else if (upgrades.length > 0) {
        fail(`"${level.name}" grants nothing, but "${eventNames.UPGRADE_GET}" carried ${JSON.stringify(upgrades[0].args[0])}`);
    }
    if (dashes.length > 0) {
        fail('A Space press that put a caption or card away also dashed');
    }
    note(
        `title card, ${(level.introText ?? []).length} captions` +
            (grants.length > 0 ? ` and the item card (${grants.join(', ')})` : '') +
            ` put away with Space (${presses} presses)`,
    );
    return look();
}

/** Holds each of W, A, S, D in turn and checks the player really travels that way */
async function checkMovement() {
    const before = await look();
    if (!before.player) {
        skip('movement', 'the player object was not found in the Game scene (looked for scene.player)');
        return;
    }

    // Right then left, up then down, so the player ends close to where he started (the start
    // tile has a wall below it)
    const moves = [
        ['d', 'x', 1],
        ['a', 'x', -1],
        ['w', 'y', -1],
        ['s', 'y', 1],
    ];
    const travelled = [];
    for (const [name, axis, sign] of moves) {
        const from = (await look()).player;
        await keyDown(KEYS[name]);
        await sleep(MOVE_HOLD_MS);
        const to = (await look()).player;
        await keyUp(KEYS[name]);
        await sleep(KEY_TAP_MS);

        const distance = (to[axis] - from[axis]) * sign;
        if (distance < MIN_MOVE) {
            fail(
                `Holding ${name.toUpperCase()} for ${MOVE_HOLD_MS}ms moved the player ${distance.toFixed(1)} units ` +
                    `(expected at least ${MIN_MOVE}); he went from (${from.x.toFixed(1)}, ${from.y.toFixed(1)}) ` +
                    `to (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`,
            );
        }
        travelled.push(`${name.toUpperCase()} ${distance.toFixed(0)}`);
    }
    note(`WASD moves the player (units: ${travelled.join(', ')})`);
}

const lowestEnergy = (entries) => (entries.length > 0 ? Math.min(...entries.map((entry) => entry.args[0])) : null);

/** A point to aim at: level with the player, towards the wider side of the square */
function aimPoint(state, reach = 40) {
    const from = state.player ?? { x: world.WORLD_WIDTH / 2, y: world.WORLD_HEIGHT / 2 };
    return toScreen(state.canvas, from.x < world.WORLD_WIDTH / 2 ? from.x + reach : from.x - reach, from.y);
}

async function waitForEnergy() {
    return waitFor('energy to recover before firing', 15_000, (state) =>
        state.energy && state.energy.args[0] >= state.energy.args[1] * 0.7 ? state : false,
    );
}

/**
 * Fires one ray with the real mouse button and checks the machine reports it: SHOT for the
 * flashes, BEAM on and off for the laser, a charge and then SHOT for the blob. `ray` null means
 * whatever is selected (a wheel that turns by itself may change it mid-shot).
 */
async function fireRay(ray, shotName) {
    const ready = await waitForEnergy();
    const before = ready.energy.args[0];
    const seq = ready.seq;
    const aim = aimPoint(ready);
    const label = ray ?? 'the selected ray';

    await mouse('mouseMoved', aim, false);
    await sleep(KEY_TAP_MS);
    await mouse('mousePressed', aim, true);
    let how;
    try {
        if (ray === 'red') {
            await waitEvent('the laser to switch on', eventNames.BEAM, seq, TIMEOUT.event, (args) => args[0] === 'red' && args[1] === true);
            await sleep(350);
            how = 'BEAM on';
        } else if (ray === 'green') {
            await waitEvent('the blob to start charging', eventNames.BEAM, seq, TIMEOUT.event, (args) => args[0] === 'green' && args[1] === true);
            await sleep((content.green?.chargeTime ?? 550) + 250);
            how = 'charged';
        } else if (ray) {
            await waitEvent(`a ${ray} shot`, eventNames.SHOT, seq, TIMEOUT.event, (args) => args[0] === ray);
            how = 'SHOT';
        } else {
            // Any ray: something must be reported within a second and a half of holding fire
            const deadline = Date.now() + 1500;
            for (;;) {
                const [shots, beams] = await Promise.all([eventsSince(eventNames.SHOT, seq), eventsSince(eventNames.BEAM, seq)]);
                if (shots.length > 0 || beams.some((entry) => entry.args[1] === true)) {
                    how = shots.length > 0 ? `SHOT ${shots[0].args[0]}` : `BEAM ${beams[0].args[0]}`;
                    break;
                }
                if (Date.now() >= deadline) {
                    fail('Holding the left mouse button for 1.5s produced neither a SHOT nor a BEAM event');
                }
                await sleep(60);
            }
            await sleep(500);
        }
        if (shotName) {
            await screenshot(shotName);
        }
    } finally {
        await mouse('mouseReleased', aim, false);
    }

    if (ray === 'red') {
        await waitEvent('the laser to switch off', eventNames.BEAM, seq, TIMEOUT.event, (args) => args[0] === 'red' && args[1] === false);
        how += ' and off';
    } else if (ray === 'green') {
        await waitEvent('the blob to be released', eventNames.SHOT, seq, TIMEOUT.event, (args) => args[0] === 'green');
        how += ', SHOT on release';
    }

    // A blob only costs energy as it leaves
    let lowest = null;
    const deadline = Date.now() + 1500;
    do {
        lowest = lowestEnergy(await eventsSince(eventNames.ENERGY_CHANGED, seq));
        if (lowest !== null && lowest < before) {
            break;
        }
        await sleep(80);
    } while (Date.now() < deadline);
    if (lowest === null || lowest >= before) {
        fail(`Firing ${label} was reported (${how}) but spent no energy (it stayed at ${Math.round(before)})`);
    }
    note(`fired ${label}: ${how}, energy ${Math.round(before)} -> ${Math.round(lowest)}`);
}

/** The colour wheel under this rule: Q and E turn it and every colour on it fires */
async function checkWheel(rule, tag) {
    const state = await look();
    if (!state.weapon) {
        fail(`No "${eventNames.WEAPON_STATE}" event was emitted, so the wheel cannot be read`);
    }
    const [announced, mode, index] = state.weapon.args;
    if (!same(announced.wheel, rule.wheel) || !same(announced.modes, rule.modes)) {
        fail(
            `The machine announced wheel [${announced.wheel}] and modes [${announced.modes}], ` +
                `but this era's rule is wheel [${rule.wheel}] and modes [${rule.modes}]`,
        );
    }
    const size = rule.wheel.length;

    if (size === 0) {
        const seq = state.seq;
        await tap(KEYS.q);
        await tap(KEYS.e);
        await expectNoEvent('The wheel is empty, so Q and E should do nothing', eventNames.RADIATION_CHANGED, seq, 400);
        note('the wheel is empty: Q and E do nothing');
        return;
    }
    if (mode !== 'rgb') {
        fail(`The era began in mode "${mode}", not on the colour wheel`);
    }

    if (rule.autoRotateMs) {
        // Wait for it to turn first, so the Q and E presses fall well clear of the next turn
        const turned = await waitEvent(
            'the locked wheel to turn by itself',
            eventNames.RADIATION_CHANGED,
            state.seq,
            rule.autoRotateMs + 3000,
        );
        if (!rule.wheel.includes(turned.args[0])) {
            fail(`The wheel turned by itself to "${turned.args[0]}", which is not on it ([${rule.wheel}])`);
        }
        const waited = Math.round(turned.at - state.now);
        const afterTurn = await look();
        await tap(KEYS.q);
        await tap(KEYS.e);
        await expectNoEvent('The wheel is locked, so Q and E should not turn it', eventNames.RADIATION_CHANGED, afterTurn.seq, 500);
        const denied = await eventsSince(eventNames.DENIED, afterTurn.seq);
        note(
            `the locked wheel turned by itself to ${turned.args[0]} after ${waited}ms (period ${rule.autoRotateMs}ms); ` +
                `Q and E were refused (${denied.length} "${eventNames.DENIED}")`,
        );
        const warnings = (await eventsSince(eventNames.WEAPON_STATE, 0)).filter((entry) => entry.args[3]?.warning === true);
        if (warnings.length === 0) {
            skip('wheel warning', `no "${eventNames.WEAPON_STATE}" with status.warning was seen before the wheel turned`);
        }
        await fireRay(null, `${tag}-firing`);
        return;
    }

    let at = index;
    for (let i = 0; i < size; i++) {
        const ray = rule.wheel[at];
        await fireRay(ray, i === 0 ? `${tag}-firing-${ray}` : null);
        const next = rule.wheel[(at + 1) % size];
        const seq = (await look()).seq;
        await tap(KEYS.e);
        const changed = await waitEvent(`E to turn the wheel from ${ray} to ${next}`, eventNames.RADIATION_CHANGED, seq);
        if (changed.args[0] !== next) {
            fail(`E turned the wheel from ${ray} to "${changed.args[0]}", expected ${next} (wheel [${rule.wheel}])`);
        }
        at = (at + 1) % size;
    }
    const back = rule.wheel[(at - 1 + size) % size];
    const seq = (await look()).seq;
    await tap(KEYS.q);
    const changed = await waitEvent(`Q to turn the wheel back to ${back}`, eventNames.RADIATION_CHANGED, seq);
    if (changed.args[0] !== back) {
        fail(`Q turned the wheel from ${rule.wheel[at]} to "${changed.args[0]}", expected ${back}`);
    }
    await tap(KEYS.e);
    note(`Q and E turn the wheel through [${rule.wheel.join(', ')}] and each of them fires`);
}

/** The mode key under this rule: F goes through every mode, and UV and White fire */
async function checkModes(rule, tag) {
    const state = await look();
    const modes = rule.modes;
    if (modes.length < 2) {
        await tap(KEYS.f);
        await expectNoEvent(`The rule has one mode (${modes[0]}), so F should do nothing`, eventNames.MODE_CHANGED, state.seq, 450);
        if (modes[0] === 'unprism') {
            await fireRay('white', `${tag}-firing-white`);
        }
        note(`one mode (${modes[0]}): F does nothing`);
        return;
    }

    let at = Math.max(0, modes.indexOf(state.weapon?.args[1] ?? modes[0]));
    for (let i = 0; i < modes.length; i++) {
        const next = modes[(at + 1) % modes.length];
        const seq = (await look()).seq;
        await tap(KEYS.f);
        const changed = await waitEvent(`F to switch to ${next}`, eventNames.MODE_CHANGED, seq);
        if (changed.args[0] !== next) {
            fail(`F switched to mode "${changed.args[0]}", expected ${next} (modes [${modes}])`);
        }
        at = (at + 1) % modes.length;
        if (next === 'uv') {
            await fireRay('uv', `${tag}-firing-uv`);
        } else if (next === 'unprism') {
            await fireRay('white', `${tag}-firing-white`);
        }
    }
    note(`F goes through the modes [${modes.join(', ')}] and back`);
}

/** The dash under this rule: Space spends a charge and moves him; with none left it is refused */
async function checkDash(rule, tag) {
    const max = rule.dashCharges;
    const start = await look();
    if (!start.player) {
        skip('dash', 'the player object was not found in the Game scene');
        return;
    }
    if (max === 0) {
        await tap(KEYS.space);
        await expectNoEvent('This era has no dash', eventNames.DASHED, start.seq, 450);
        const after = (await look()).player;
        const moved = Math.hypot(after.x - start.player.x, after.y - start.player.y);
        if (moved > MIN_MOVE) {
            fail(`This era has no dash, but Space moved the player ${moved.toFixed(1)} units`);
        }
        note('no dash in this era: Space does nothing');
        return;
    }

    const ready = await waitFor('every dash charge to be ready', rule.dashCooldownMs * max + 4000, (state) =>
        state.dash && state.dash.args[0] === max && state.dash.args[1] === max ? state : false,
    );
    // Standing still, he dashes where he aims: along the row he stands in, towards the open side
    const aim = aimPoint(ready, 60);
    await mouse('mouseMoved', aim, false);
    await sleep(150);

    let from = (await look()).player;
    let total = 0;
    for (let used = 1; used <= max; used++) {
        const seq = (await look()).seq;
        await tap(KEYS.space);
        const dashed = await waitEvent(`dash ${used} of ${max}`, eventNames.DASHED, seq);
        if (!same(dashed.args, [max - used, max])) {
            fail(`"${eventNames.DASHED}" carried ${JSON.stringify(dashed.args)} after dash ${used}, expected [${max - used}, ${max}]`);
        }
        if (used === 1) {
            await screenshot(`${tag}-dash`);
        }
        await sleep(320);
        const to = (await look()).player;
        const moved = Math.hypot(to.x - from.x, to.y - from.y);
        if (moved < MIN_DASH) {
            fail(
                `Dash ${used} moved the player ${moved.toFixed(1)} units, from (${from.x.toFixed(0)}, ${from.y.toFixed(0)}) ` +
                    `to (${to.x.toFixed(0)}, ${to.y.toFixed(0)}); expected at least ${MIN_DASH}`,
            );
        }
        total += moved;
        from = to;
    }

    const empty = await look();
    await tap(KEYS.space);
    await expectNoEvent(`All ${max} charges are spent, so Space should not dash`, eventNames.DASHED, empty.seq, 400);

    const back = await waitEvent(
        'a dash charge to come back',
        eventNames.DASH_STATE,
        empty.seq,
        rule.dashCooldownMs + 3000,
        (args) => args[0] >= 1,
    );
    note(
        `Space dashes: ${max} charge${max > 1 ? 's' : ''}, ${total.toFixed(0)} units in all, refused when empty, ` +
            `a charge back ${((back.at - empty.now) / 1000).toFixed(1)}s later (cooldown ${rule.dashCooldownMs / 1000}s)`,
    );
}

/** A timed era's clock: it runs in real time, stands still under the pause page, and runs again */
async function checkClock(continuous, tag) {
    const first = await look();
    if (!first.era?.timed) {
        fail(`This era has a \`continuous\` table but snapshot().timed is ${first.era?.timed}`);
    }
    const watch = 3000;
    await sleep(watch);
    const second = await look();
    const ran = second.era.elapsed - first.era.elapsed;
    const real = (second.now - first.now) / 1000;
    if (ran < real * 0.6 || ran > real * 1.25) {
        fail(`The clock moved ${ran.toFixed(2)}s in ${real.toFixed(2)}s of real time`);
    }
    const ticks = await eventsSince(eventNames.ERA_TIMER, first.seq);
    if (ticks.length < 2) {
        fail(`Only ${ticks.length} "${eventNames.ERA_TIMER}" events in ${real.toFixed(1)}s; the HUD clock needs one a second`);
    }
    for (const tick of ticks) {
        if (tick.args[1] !== continuous.duration) {
            fail(`"${eventNames.ERA_TIMER}" carried a total of ${tick.args[1]}s, but the era lasts ${continuous.duration}s`);
        }
    }
    if (ticks.at(-1).args[0] >= ticks[0].args[0]) {
        fail(`The clock is not counting down: ${ticks.map((tick) => tick.args[0]).join(', ')}`);
    }
    note(`the clock counts down in real time (${ran.toFixed(2)}s in ${real.toFixed(2)}s; ${second.era.secondsLeft}s left)`);

    await tap(KEYS.escape);
    await waitEvent('the pause page to open on Esc', eventNames.PAUSED, second.seq, TIMEOUT.event, (args) => args[0] === true);
    const paused = await look();
    if (!paused.gamePaused) {
        fail('The pause page opened but the Game scene is not paused');
    }
    await sleep(1500);
    await screenshot(`${tag}-paused`);
    const still = await look();
    if (Math.abs(still.era.elapsed - paused.era.elapsed) > 0.001) {
        fail(`The clock moved from ${paused.era.elapsed.toFixed(2)}s to ${still.era.elapsed.toFixed(2)}s under the pause page`);
    }
    await tap(KEYS.escape);
    await waitEvent('the pause page to close on Esc', eventNames.PAUSED, still.seq, TIMEOUT.event, (args) => args[0] === false);
    await sleep(1500);
    const resumed = await look();
    if (resumed.gamePaused || resumed.era.elapsed < still.era.elapsed + 0.7) {
        fail(`After resuming, the clock went from ${still.era.elapsed.toFixed(2)}s to ${resumed.era.elapsed.toFixed(2)}s in 1.5s`);
    }
    note(`Esc pauses (clock held at ${still.era.elapsed.toFixed(1)}s for 1.5s) and resumes`);
}

/** Presses K (dev key) until the era is over; returns the state once LEVEL_CLEARED has been seen */
async function pressKUntilCleared(level, number, fromSeq, timeout) {
    const deadline = Date.now() + timeout;
    let presses = 0;
    for (;;) {
        const state = await look();
        if (state.levelCleared && state.levelCleared.seq > fromSeq) {
            if (state.levelCleared.args[0] !== number) {
                fail(`"${eventNames.LEVEL_CLEARED}" carried ${state.levelCleared.args[0]}, expected ${number}`);
            }
            return { state, presses };
        }
        if (!state.scenes.includes('Game')) {
            fail(`The Game scene stopped before "${level.name}" was cleared. Active scenes: [${state.scenes.join(', ')}]`);
        }
        if (Date.now() >= deadline) {
            fail(`"${level.name}" was not cleared within ${timeout / 1000}s of pressing K (${presses} presses). ${describeState(state)}`);
        }
        await tap(KEYS.k);
        presses++;
        await sleep(250);
    }
}

async function expectNextEra(index, clearedSeq) {
    const next = content.levels[index + 1];
    const state = await waitFor(`era ${index + 2} "${next.name}" to start`, TIMEOUT.room, (s) =>
        roomIs(s, next.name, 1) && s.room.seq > clearedSeq && s.era ? s : false,
    );
    if (state.era.level !== index + 1) {
        fail(`After era ${index + 1} the game loaded level index ${state.era.level}, expected ${index + 1}`);
    }
    checkHud(state, index + 2, content.levels.length);
    note(`era ${index + 2} "${next.name}" started`);
    return state;
}

// ---------------------------------------------------------------------------------------
// Steps

async function step(name, action) {
    currentStep = { name, status: 'PASS', detail: '' };
    steps.push(currentStep);
    const errorsBefore = problems.errors.length;
    const started = Date.now();
    log(`\n[${steps.length}] ${name}`);

    try {
        await action();
    } catch (error) {
        currentStep.status = 'FAIL';
        // Anything that is not a SmokeFailure is a bug in this script; show where
        currentStep.detail = error instanceof SmokeFailure ? error.message : (error.stack ?? String(error));
    }

    const newErrors = problems.errors.slice(errorsBefore);
    if (newErrors.length > 0) {
        currentStep.status = 'FAIL';
        const list = newErrors.map((line) => `console: ${line}`).join('\n');
        currentStep.detail = currentStep.detail ? `${currentStep.detail}\n${list}` : list;
    }

    if (currentStep.status === 'FAIL') {
        try {
            const file = await screenshot(`FAIL-${slug(name).slice(0, 60)}`);
            currentStep.detail += `\nscreenshot of the failure: tools/out/${file}`;
            await releaseEverything();
        } catch {
            // The browser is gone; the failure itself is already recorded
        }
        for (const line of currentStep.detail.split('\n')) {
            log(`      ${line}`);
        }
    }
    log(`  ${currentStep.status} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    const passed = currentStep.status === 'PASS';
    currentStep = null;
    return passed;
}

async function bootStep() {
    await open('');
    const state = await look();
    note(`game is running; active scenes: [${state.scenes.join(', ')}]`);
    if (!state.exposed) {
        fail('main.ts did not assign the game to window.__game in dev (docs/DESIGN.md, dev helpers)');
    }
    if (!same(state.scenes, ['Title'])) {
        fail(`Opening / should show the cover alone, but the active scenes are [${state.scenes.join(', ')}]`);
    }

    content = await inPage(readContent);
    if (content.events) {
        eventNames = { ...DEFAULT_EVENTS, ...content.events };
    } else {
        skip('event names', 'src/events.ts could not be read from the dev server; using the names known when this script was written');
    }
    if (content.world) {
        world = content.world;
    } else {
        skip('world size', 'src/config/world.ts could not be read from the dev server; assuming 320x180');
    }
    if (!content.levels?.length) {
        fail(`Could not read LEVELS from /src/config/levels/index.ts: ${content.levelsError ?? 'it is empty'}`);
    }
    if (!content.rules) {
        fail('Could not read ERA_RULES from /src/config/rays.ts');
    }
    const eras = content.levels.map((level, i) => `${i + 1} "${level.name}"`).join(', ');
    note(`eras found: ${eras}${content.sandbox ? `; sandbox with ${content.sandbox.rooms.length} rooms` : ''}`);
    await waitFor('the cover to announce itself', TIMEOUT.event, (s) => !!s.title);
    await sleep(500);
    await expectDrawn('cover', 'the cover');
}

/** From the cover: any key starts a normal game at era 1 with nothing owned */
async function newGameStep() {
    const cover = await look();
    if (!same(cover.scenes, ['Title'])) {
        await open('');
    }
    const before = await look();
    if (before.storage && JSON.parse(before.storage).demoMode) {
        fail(`Demo mode is on in ${SETTINGS_KEY} before the test touched it: ${before.storage}`);
    }
    await tap(KEYS.enter);
    const level = content.levels[0];
    const started = await waitForRoom(level, 1, TIMEOUT.room, before.seq);
    if (started.era.level !== 0 || started.era.sandbox) {
        fail(`A key on the cover started level index ${started.era.level} (sandbox ${started.era.sandbox}), expected era 1`);
    }
    if (started.progress.upgrades.length > 0 || started.progress.guide.length > 0 || started.progress.bonusHealth !== 0) {
        fail(`A new game began with progress already: ${JSON.stringify(started.progress)}`);
    }
    note('a key press on the cover started era 1 with nothing owned');
    const ready = await passIntro(level, 'new-game', before.seq);
    if (!same([...ready.progress.upgrades].sort(), [...(level.grants ?? [])].sort())) {
        fail(`After the item card the player owns [${ready.progress.upgrades}], expected [${level.grants}]`);
    }
    checkHud(ready, 1, content.levels.length);
    await screenshot('new-game-era-1');
    return ready;
}

/** Opens an era with the dev URL, puts its cards away and checks the HUD and movement */
async function enterEra(index) {
    const level = content.levels[index];
    const tag = `era-${index + 1}`;
    await open(`?level=${index + 1}&nodamage`);
    const loaded = await waitForRoom(level, 1);
    if (loaded.era.level !== index) {
        fail(`?level=${index + 1} loaded level index ${loaded.era.level}`);
    }
    const expectedStyle = level.style === 'finalPage' ? 'goldenAge' : level.style;
    if (loaded.era.style !== expectedStyle) {
        fail(`"${level.name}" is drawn in "${loaded.era.style}", expected "${expectedStyle}"`);
    }
    // Whatever the earlier eras hand over is owned without a card
    const earlier = content.levels.slice(0, index).flatMap((era) => era.grants ?? []);
    for (const id of earlier) {
        if (!loaded.progress.upgrades.includes(id)) {
            fail(`Starting at era ${index + 1}, "${id}" (given by an earlier era) is not owned: [${loaded.progress.upgrades}]`);
        }
    }
    const ready = await passIntro(level, tag);
    if (!ready.player?.invincible) {
        skip('?nodamage', 'the player is not marked invincible, so the era checks may be cut short by a death');
    }
    checkHud(ready, index + 1, content.levels.length);
    await screenshot(`${tag}-started`);
    return { level, tag, rule: ruleOf(level), roomSeq: ready.room.seq };
}

async function goldenStep() {
    const { level, tag, rule, roomSeq } = await enterEra(0);
    await checkMovement();
    await checkWheel(rule, tag);
    await checkModes(rule, tag);
    await checkDash(rule, tag);

    const waves = level.rooms[0].waves.length;
    const { state, presses } = await pressKUntilCleared(
        level,
        1,
        roomSeq,
        level.rooms[0].waves.reduce((sum, wave) => sum + (wave.delay ?? 1000), 0) + TIMEOUT.wave,
    );
    const seen = (await eventsSince(eventNames.WAVE_STARTED, roomSeq)).map((entry) => entry.args);
    const expected = Array.from({ length: waves }, (_, i) => [i + 1, waves]);
    if (!same(seen, expected)) {
        fail(`K through "${level.name}" started waves ${JSON.stringify(seen)}, expected ${JSON.stringify(expected)}`);
    }
    // Every kind that fell is written up in the Field Guide, once
    const kinds = [...new Set(level.rooms[0].waves.flatMap((wave) => wave.spawns.map((group) => group.monster)))];
    const missing = kinds.filter((id) => !state.progress.guide.includes(id));
    if (missing.length > 0) {
        fail(`Every wave was killed, but the Field Guide has no page for [${missing}] (it has [${state.progress.guide}])`);
    }
    if (new Set(state.progress.guide).size !== state.progress.guide.length) {
        fail(`The Field Guide lists a page twice: [${state.progress.guide}]`);
    }
    note(`K cleared the ${waves} waves (${presses} presses); the Field Guide has all ${kinds.length} kinds`);
    await screenshot(`${tag}-cleared`);
    await expectNextEra(0, state.levelCleared.seq);
}

async function timedStep(index) {
    const { level, tag, rule, roomSeq } = await enterEra(index);
    const continuous = level.rooms[0].continuous;
    if (!continuous) {
        fail(`Era ${index + 1} "${level.name}" has no \`continuous\` table`);
    }
    await checkMovement();
    await checkWheel(rule, tag);
    await checkModes(rule, tag);
    await checkDash(rule, tag);
    await checkClock(continuous, tag);

    const every = continuous.checkpointEvery ?? 45;
    const { state, presses } = await pressKUntilCleared(level, index + 1, roomSeq, TIMEOUT.wave);
    const [checkpoints, surges, ticks, banners] = await Promise.all(
        [eventNames.CHECKPOINT, eventNames.SURGE, eventNames.ERA_TIMER, eventNames.BANNER].map((name) => eventsSince(name, roomSeq)),
    );
    if (checkpoints.length === 0) {
        fail(`No "${eventNames.CHECKPOINT}" on the way to the end of "${level.name}" (one every ${every}s of ${continuous.duration}s)`);
    }
    if (surges.length !== 1) {
        fail(`"${eventNames.SURGE}" was emitted ${surges.length} times in "${level.name}", expected once`);
    }
    if (ticks.at(-1)?.args[0] !== 0) {
        fail(`The last "${eventNames.ERA_TIMER}" carried ${ticks.at(-1)?.args[0]}s left, expected 0`);
    }
    if (content.banners && !banners.some((entry) => entry.args[0] === content.banners.timeUp)) {
        skip('time-up banner', `no "${eventNames.BANNER}" carried "${content.banners.timeUp}"`);
    }
    if (!state.era?.cleared && state.scenes.includes('Game')) {
        fail(`"${eventNames.LEVEL_CLEARED}" was emitted but snapshot().cleared is false`);
    }
    note(`K wound the clock to zero (${presses} presses): ${checkpoints.length} checkpoint${checkpoints.length > 1 ? 's' : ''}, the surge, then time up`);
    await screenshot(`${tag}-time-up`);
    await expectNextEra(index, state.levelCleared.seq);
}

/** The boss era, the ending, the way back to the cover, and a second game that starts clean */
async function bossStep() {
    const index = content.levels.length - 1;
    const { level, tag, rule, roomSeq } = await enterEra(index);
    const begun = await look();

    // The modes first and fast: the Prism changes the rule a few seconds into the fight
    await checkModes(rule, tag);
    const swappedEarly = await eventsSince(eventNames.ERA_SWAPPED, roomSeq);
    if (swappedEarly.length > 0) {
        skip('boss rule before the first switch', 'the Prism switched era while the three modes were being checked');
    }

    const spawning = await waitEvent('the Prism to be announced', eventNames.MONSTER_SPAWNING, roomSeq, TIMEOUT.room);
    const [x, y] = spawning.args;
    const away = Math.hypot(x - begun.player.x, y - begun.player.y);
    const least = content.spawn?.minDistance ?? 56;
    if (away < least) {
        fail(`The Prism was announced ${away.toFixed(0)} units from the player at (${x.toFixed(0)}, ${y.toFixed(0)}); the least allowed is ${least}`);
    }
    await waitFor('the Prism to appear', TIMEOUT.room, (state) => state.era?.alive >= 1);
    note(`the Prism appeared ${away.toFixed(0)} units from the player`);

    const telegraph = await waitEvent('the Prism to announce an era switch', eventNames.BOSS_TELEGRAPH, roomSeq, TIMEOUT.boss);
    const [coming, inMs] = telegraph.args;
    await sleep(400);
    await screenshot(`${tag}-telegraph`);
    const swap = await waitEvent(`the switch to ${coming}`, eventNames.ERA_SWAPPED, telegraph.seq, inMs + 5000);
    const took = swap.at - telegraph.at;
    if (swap.args[0] !== coming) {
        fail(`The Prism announced "${coming}" but switched to "${swap.args[0]}"`);
    }
    if (took < inMs - 500 || took > inMs + 2500) {
        fail(`The switch came ${Math.round(took)}ms after it was announced; the announcement said ${inMs}ms`);
    }
    const order = content.prism?.eras ?? [];
    if (order.length > 0 && coming !== order[1]) {
        fail(`The first switch was to "${coming}", expected "${order[1]}" (PRISM.eras is [${order}])`);
    }
    await sleep(300);
    const after = await look();
    if (after.era.style !== coming) {
        fail(`After the switch the square is drawn in "${after.era.style}", not "${coming}"`);
    }
    const expectedRule = content.rules[coming];
    const [announced] = after.weapon.args;
    if (after.weapon.seq < swap.seq || !same(announced.wheel, expectedRule.wheel) || !same(announced.modes, expectedRule.modes)) {
        fail(
            `After the switch to ${coming} the machine announces wheel [${announced.wheel}] and modes [${announced.modes}], ` +
                `expected wheel [${expectedRule.wheel}] and modes [${expectedRule.modes}]`,
        );
    }
    // The UI slams the name of the era across the screen as the square redraws
    const word = (content.levels.find((era) => era.style === coming)?.name ?? coming).toUpperCase();
    const shown = after.texts.some((text) => String(text).toUpperCase() === word);
    if (!shown) {
        skip('boss era word', `"${word}" was not on screen 300ms after the switch`);
    }
    await screenshot(`${tag}-swapped-${coming}`);
    note(
        `BOSS_TELEGRAPH(${coming}, ${inMs}ms) then ERA_SWAPPED ${Math.round(took)}ms later; the square and the machine ` +
            `follow (wheel [${announced.wheel}], modes [${announced.modes}])${shown ? `, "${word}" shown` : ''}`,
    );

    await checkMovement();
    await checkDash(rule, tag);

    const { state, presses } = await pressKUntilCleared(level, index + 1, roomSeq, TIMEOUT.wave);
    note(`K felled the Prism (${presses} presses)`);
    await endingStep(state.levelCleared.seq);
}

async function endingStep(fromSeq) {
    const delay = (content.flow?.endingDelay ?? 1400) + (content.flow?.endingFade ?? 900);
    await waitFor('the Ending scene to start', delay + TIMEOUT.room, (state) => state.scenes.includes('Ending'));
    await waitEvent('the ending to announce itself', eventNames.ENDING_STARTED, fromSeq);
    await sleep(1500);
    await expectDrawn('ending-square', 'the ending');

    // K takes the torch away and skips the first captions. It stops there: one K too many would
    // skip a card without the UI ever answering for it. The rest is read with Space, as a player does.
    const screens = ['report', 'guideTruth', 'credits'];
    let deadline = Date.now() + TIMEOUT.card;
    for (;;) {
        if ((await eventsSince(eventNames.DIALOG, fromSeq)).length >= 2) {
            break;
        }
        if (Date.now() >= deadline) {
            fail(`K did not take the torch away and skip the first captions within ${TIMEOUT.card / 1000}s. ${describeState(await look())}`);
        }
        await tap(KEYS.k);
        await sleep(300);
    }
    const dialogs = await eventsSince(eventNames.DIALOG, fromSeq);
    const lines = dialogs.flatMap((entry) => entry.args[0]);
    if (content.ending && !same(lines, [...content.ending.reveal, ...content.ending.arrest])) {
        fail(`The ending's captions were ${JSON.stringify(lines)}, expected ENDING.reveal then ENDING.arrest`);
    }
    await sleep(500);
    await screenshot('ending-arrest');
    let read = 0;
    deadline = Date.now() + TIMEOUT.card;
    while ((await eventsSince(eventNames.DIALOG_DONE, dialogs[1].seq)).length === 0) {
        if (Date.now() >= deadline) {
            const state = await look();
            fail(`Space did not get through the officer's ${dialogs[1].args[0].length} lines in ${TIMEOUT.card / 1000}s. Visible text: ${JSON.stringify(state.texts)}`);
        }
        await tap(KEYS.space);
        read++;
        await sleep(300);
    }
    note(`the reveal (${dialogs[0].args[0].length} lines) skipped with K; the arrest (${dialogs[1].args[0].length} lines) read with Space (${read} presses)`);

    for (const name of screens) {
        const shown = await waitEvent(`the "${name}" card`, eventNames.SHOW_SCREEN, fromSeq, TIMEOUT.card, (args) => args[0] === name);
        let presses = 0;
        let shot = false;
        const seen = new Set();
        // The value of the report's last "Label: value" line, which the card draws as a text of its own
        const charge = name === 'report' && content.ending ? content.ending.report.at(-1).replace(/^[^:]*:\s*/, '') : null;
        deadline = Date.now() + TIMEOUT.card;
        for (;;) {
            if ((await eventsSince(eventNames.SCREEN_DONE, shown.seq)).some((entry) => entry.args[0] === name)) {
                break;
            }
            if (Date.now() >= deadline) {
                const state = await look();
                fail(`Space did not put the "${name}" card away in ${TIMEOUT.card / 1000}s. Visible text: ${JSON.stringify(state.texts)}`);
            }
            for (const text of (await look()).texts) {
                seen.add(String(text));
            }
            // The report types itself out a row at a time: its picture is taken once the charge is on it
            if (!shot && (charge ? seen.has(charge) : presses >= 3)) {
                shot = true;
                await sleep(250);
                await screenshot(`ending-${slug(name)}`);
            }
            await tap(KEYS.space);
            presses++;
            await sleep(350);
        }
        if (charge && !seen.has(charge)) {
            fail(`The report card was put away without ever showing its last line: "${content.ending.report.at(-1)}"`);
        }
        note(`the "${name}" card was shown and put away with Space (${presses} presses)`);
    }

    const cover = await waitFor('the cover to come back after the credits', TIMEOUT.room, (state) =>
        same(state.scenes, ['Title']) && state.title?.seq > fromSeq ? state : false,
    );
    if (!cover.progress.ended) {
        fail('The ending finished but Progress.ended is not set (the Field Guide would not show the truth)');
    }
    await sleep(600);
    await screenshot('ending-back-on-cover');
    note('back on the cover; only the Title scene is running');

    const again = await newGameStep();
    if (again.progress.ended) {
        fail('A second new game still has Progress.ended set');
    }
    note('a second new game started clean: era 1, nothing owned, the item card shown again');
}

/** Golden: a death restarts the wave he fell in, at full health, with no title card */
async function goldenDeathStep() {
    const level = content.levels[0];
    await open('?level=1');
    await waitForRoom(level, 1);
    const ready = await passIntro(level, 'death-golden');
    if (ready.player?.invincible) {
        fail('The player is invincible without ?nodamage');
    }

    // On to wave 2, so that "the wave" and "the era" are different places to restart from
    await waitEvent('wave 1', eventNames.WAVE_STARTED, ready.room.seq - 1, TIMEOUT.room, (args) => args[0] === 1);
    let deadline = Date.now() + TIMEOUT.wave;
    for (;;) {
        if ((await eventsSince(eventNames.WAVE_STARTED, ready.room.seq)).some((entry) => entry.args[0] === 2)) {
            break;
        }
        if (Date.now() >= deadline) {
            fail('K did not bring on wave 2');
        }
        await tap(KEYS.k);
        await sleep(300);
    }
    const start = await look();
    note(`standing still in wave 2 of "${level.name}" (health ${start.health?.args[0] ?? '?'})`);

    const dead = await waitFor('the monsters to kill a player who stands still', TIMEOUT.death, (state) => state.died?.seq > start.seq, 200);
    note(`the player died (health ${dead.health?.args[0]})`);
    await screenshot('death-golden');

    const restarted = await waitFor('the era to restart after the death', TIMEOUT.restart, (state) =>
        state.room?.seq > dead.died.seq && state.era?.started ? state : false,
    );
    if (restarted.room.args[0] !== level.name) {
        fail(`After dying in "${level.name}" the game started "${restarted.room.args[0]}"`);
    }
    const wave = await waitEvent('a wave after the restart', eventNames.WAVE_STARTED, restarted.room.seq, TIMEOUT.room);
    if (wave.args[0] !== 2) {
        fail(`After dying in wave 2 the era restarted at wave ${wave.args[0]} (snapshot().checkpoint is ${restarted.era.checkpoint})`);
    }
    if ((await eventsSince(eventNames.LEVEL_STARTED, dead.died.seq)).length > 0) {
        fail('The title card was shown again after a death');
    }
    // As it was when the era restarted: the wave may already be on him again by now
    const healed = restarted;
    if (!healed.health || healed.health.seq < restarted.room.seq || healed.health.args[0] !== healed.health.args[1]) {
        fail(`The era restarted but health is ${healed.health?.args[0]}/${healed.health?.args[1]}, not full`);
    }
    note(`restarted at wave 2 with full health (${healed.health.args[0]}/${healed.health.args[1]}) and no title card`);
    await screenshot('death-golden-restarted');
}

/** A timed era: a death goes back to the last checkpoint, at full health */
async function timedDeathStep() {
    const sandbox = content.sandbox;
    const roomNumber = sandbox.rooms.findIndex((room) => room.continuous) + 1;
    if (roomNumber === 0) {
        skip('death in a timed era', 'the sandbox has no timed room');
        return;
    }
    const continuous = sandbox.rooms[roomNumber - 1].continuous;
    const every = continuous.checkpointEvery ?? 45;

    // Standing still he usually falls between the first checkpoint and the end; when the
    // enemies are slow about it and the clock runs out first, try again
    for (let attempt = 1; attempt <= 3; attempt++) {
        await open(`?sandbox&room=${roomNumber}`);
        const start = await waitForRoom(sandbox, roomNumber);
        note(`standing still in sandbox room ${roomNumber} (${continuous.duration}s, a checkpoint every ${every}s), attempt ${attempt}`);

        const end = await waitFor(
            'the player to die or the clock to run out',
            continuous.duration * 1000 + TIMEOUT.restart,
            (state) => (state.died?.seq > start.room.seq || state.room?.seq > start.room.seq || state.era?.cleared ? state : false),
            100,
        );
        if (!(end.died?.seq > start.room.seq)) {
            note('he survived to the end of the clock');
            continue;
        }
        const reached = (await eventsSince(eventNames.CHECKPOINT, start.room.seq)).filter((entry) => entry.seq < end.died.seq).length;
        const expected = reached * every;
        if (reached === 0) {
            note('he died before the first checkpoint; trying again for a death past one');
            if (attempt < 3) {
                continue;
            }
        }
        await screenshot('death-timed');
        const banners = (await eventsSince(eventNames.BANNER, end.died.seq - 1)).map((entry) => entry.args[0]);

        const restarted = await waitFor('the room to restart after the death', TIMEOUT.restart, (state) =>
            state.room?.seq > end.died.seq && state.era?.started ? state : false,
        );
        if (restarted.room.args[1] !== roomNumber) {
            fail(`After dying in sandbox room ${roomNumber} the game started room ${restarted.room.args[1]}`);
        }
        if (restarted.era.checkpoint !== expected) {
            fail(`He died after ${reached} checkpoint(s), but the retry's checkpoint is ${restarted.era.checkpoint}s, expected ${expected}s`);
        }
        if (restarted.era.elapsed < expected || restarted.era.elapsed > expected + 5) {
            fail(`The retry's clock reads ${restarted.era.elapsed.toFixed(1)}s, expected to pick up from ${expected}s`);
        }
        const firstTick = (await eventsSince(eventNames.ERA_TIMER, end.died.seq))[0];
        if (firstTick && firstTick.args[0] !== continuous.duration - expected) {
            fail(`The retry's clock first showed ${firstTick.args[0]}s left, expected ${continuous.duration - expected}s`);
        }
        if (!restarted.health || restarted.health.seq < restarted.room.seq || restarted.health.args[0] !== restarted.health.args[1]) {
            fail(`The room restarted but health is ${restarted.health?.args[0]}/${restarted.health?.args[1]}, not full`);
        }
        if (content.banners && reached > 0 && !banners.includes(content.banners.checkpointRetry)) {
            skip('checkpoint banner', `no "${eventNames.BANNER}" carried "${content.banners.checkpointRetry}" after the death`);
        }
        note(
            `died after ${reached} checkpoint(s); restarted at ${expected}s on the clock (${restarted.era.secondsLeft}s left) ` +
                `with full health (${restarted.health.args[0]}/${restarted.health.args[1]})`,
        );
        await screenshot('death-timed-restarted');
        if (reached === 0) {
            skip('death past a checkpoint', 'three attempts all ended before the first checkpoint, so only a restart from 0 was seen');
        }
        return;
    }
    skip('death in a timed era', `a player standing still survived sandbox room ${roomNumber} three times`);
}

/** One sandbox room: it loads, something arrives, and K clears it through to the next */
async function sandboxRoomStep(roomIndex, query) {
    const sandbox = content.sandbox;
    const roomNumber = roomIndex + 1;
    const total = sandbox.rooms.length;
    const room = sandbox.rooms[roomIndex];
    const tag = `sandbox-room-${roomNumber}`;

    if (query !== null) {
        await open(query);
    }
    const loaded = await waitForRoom(sandbox, roomNumber);
    if (!loaded.era.sandbox || loaded.era.room !== roomIndex) {
        fail(`Expected sandbox room index ${roomIndex}, got ${JSON.stringify({ sandbox: loaded.era.sandbox, room: loaded.era.room })}`);
    }
    checkHud(loaded, roomNumber, total, 'room');

    const firstDelay = room.waves[0]?.delay ?? 1000;
    if (firstDelay > 10_000) {
        note(`its first wave waits ${firstDelay / 1000}s; not waiting for it`);
        await screenshot(`${tag}-loaded`);
        return;
    }
    const busy = await waitFor('something to arrive', TIMEOUT.room, (state) =>
        roomIs(state, sandbox.name, roomNumber) && state.era && state.era.alive + state.era.incoming > 0 ? state : false,
    );
    await sleep(700);
    await screenshot(`${tag}-loaded`);
    note(`room ${roomNumber}/${total} loaded; ${busy.era.alive + busy.era.incoming} arriving`);

    if (roomNumber === total) {
        return;
    }
    const deadline = Date.now() + room.waves.reduce((sum, wave) => sum + (wave.delay ?? 1000), 0) + TIMEOUT.wave;
    let presses = 0;
    for (;;) {
        const state = await look();
        if (state.room.seq > loaded.room.seq) {
            if (state.room.args[1] !== roomNumber + 1) {
                fail(`After sandbox room ${roomNumber} the game started room ${state.room.args[1]}`);
            }
            break;
        }
        if (Date.now() >= deadline) {
            fail(`Sandbox room ${roomNumber} did not finish under K (${presses} presses). ${describeState(state)}`);
        }
        await tap(KEYS.k);
        presses++;
        await sleep(220);
    }
    if (!room.continuous) {
        const waves = (await eventsSince(eventNames.WAVE_STARTED, loaded.room.seq)).filter((entry) => entry.args[1] === room.waves.length).length;
        if (waves < room.waves.length) {
            fail(`Sandbox room ${roomNumber} ended after ${waves} "${eventNames.WAVE_STARTED}" events, but it defines ${room.waves.length} waves`);
        }
    }
    note(`K cleared it (${presses} presses); room ${roomNumber + 1} started`);
}

/** The sandbox room with a cracked wall: the wrong ray leaves it, the right one breaks it */
async function secretStep() {
    const sandbox = content.sandbox;
    const roomIndex = sandbox.rooms.findIndex((room) => room.secret);
    if (roomIndex < 0) {
        skip('secret', 'no sandbox room has a secret');
        return;
    }
    const room = sandbox.rooms[roomIndex];
    const rule = ruleOf(sandbox);
    const row = room.layout.findIndex((line) => line.includes('S'));
    const col = room.layout[row].indexOf('S');
    const tile = world.TILE ?? 16;
    const top = world.ROOM?.y ?? 20;
    const crack = { x: col * tile + tile / 2, y: top + row * tile + tile / 2 };
    if (col !== 0) {
        skip('secret', `the crack is at (${col}, ${row}); this check only knows how to walk to one in the west wall`);
        return;
    }

    await open(`?sandbox&room=${roomIndex + 1}&nodamage`);
    const start = await waitForRoom(sandbox, roomIndex + 1);
    if (start.era.secretBroken) {
        fail('snapshot().secretBroken is true before anything was fired');
    }
    const maxBefore = start.health.args[1];

    // Along the bottom row to the west wall, then up level with the crack
    await keyDown(KEYS.a);
    await waitFor('the player to reach the west side', 8000, (state) => state.player.x <= tile * 2.5, 40);
    await keyUp(KEYS.a);
    if ((await look()).player.y > crack.y + 2) {
        await keyDown(KEYS.w);
        await waitFor('the player to come level with the crack', 5000, (state) => state.player.y <= crack.y + 2, 30);
        await keyUp(KEYS.w);
    }
    const placed = await look();
    note(`walked to (${placed.player.x.toFixed(0)}, ${placed.player.y.toFixed(0)}); the crack is at (${crack.x}, ${crack.y}), needs ${room.secret}`);
    const aim = toScreen(placed.canvas, crack.x, crack.y);
    const index = placed.weapon.args[2];
    const size = rule.wheel.length;

    const fireAtCrack = async (ray, holdMs, shotName) => {
        const ready = await waitForEnergy();
        await mouse('mouseMoved', aim, false);
        await sleep(KEY_TAP_MS);
        await mouse('mousePressed', aim, true);
        const deadline = Date.now() + holdMs;
        let broken = false;
        while (Date.now() < deadline && !broken) {
            await sleep(100);
            broken = (await look()).era.secretBroken;
        }
        await screenshot(shotName);
        await mouse('mouseReleased', aim, false);
        await sleep(900);
        const [shots, beams] = await Promise.all([eventsSince(eventNames.SHOT, ready.seq), eventsSince(eventNames.BEAM, ready.seq)]);
        const fired = shots.some((entry) => entry.args[0] === ray) || beams.some((entry) => entry.args[0] === ray && entry.args[1] === true);
        if (!fired) {
            fail(`Holding fire did not fire ${ray} (shots ${JSON.stringify(shots.map((entry) => entry.args[0]))})`);
        }
    };

    // Every other colour on the wheel first
    const order = Array.from({ length: size }, (_, i) => rule.wheel[(index + i) % size]);
    const wrong = order.filter((ray) => ray !== room.secret);
    for (const ray of [...wrong, room.secret]) {
        let current = (await look()).radiation?.args[0] ?? rule.wheel[index];
        for (let turns = 0; current !== ray && turns < size; turns++) {
            const seq = (await look()).seq;
            await tap(KEYS.e);
            current = (await waitEvent('the wheel to turn', eventNames.RADIATION_CHANGED, seq)).args[0];
        }
        if (current !== ray) {
            fail(`Could not turn the wheel to ${ray}`);
        }
        const before = await look();
        await fireAtCrack(ray, ray === room.secret ? 4000 : 1200, `secret-${ray}`);
        const after = await look();
        const found = await eventsSince(eventNames.SECRET_FOUND, before.seq);
        if (ray !== room.secret) {
            if (after.era.secretBroken || found.length > 0) {
                fail(`The wrong ray (${ray}) broke the crack, which needs ${room.secret}`);
            }
            note(`${ray} (the wrong ray) leaves the crack standing`);
        } else {
            if (!after.era.secretBroken || found.length === 0) {
                fail(`${ray} did not break the crack: secretBroken ${after.era.secretBroken}, ${found.length} "${eventNames.SECRET_FOUND}" events`);
            }
            note(`${ray} (the right ray) broke it: snapshot().secretBroken, "${eventNames.SECRET_FOUND}"`);
        }
    }

    // The upgrade drops onto the paving in front of the crack: step onto it if he is not there
    const frontX = crack.x + tile;
    const picked = async (timeout) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            if ((await eventsSince(eventNames.HEALTH_UPGRADE, placed.seq)).length > 0) {
                return true;
            }
            await sleep(100);
        }
        return false;
    };
    if (!(await picked(1500))) {
        const here = (await look()).player;
        const key = here.x > frontX ? KEYS.a : KEYS.d;
        await keyDown(key);
        const got = await picked(2500);
        await keyUp(key);
        if (!got) {
            fail(`The crack broke but no "${eventNames.HEALTH_UPGRADE}" came when the player stood in front of it at (${frontX}, ${crack.y})`);
        }
    }
    const after = await waitFor('maximum health to rise', TIMEOUT.event, (state) => (state.health.args[1] > maxBefore ? state : false));
    const pickups = (await eventsSince(eventNames.PICKUP, placed.seq)).map((entry) => entry.args[0]);
    if (!pickups.includes('healthUpgrade')) {
        fail(`Maximum health rose but no "${eventNames.PICKUP}"("healthUpgrade") was emitted (saw ${JSON.stringify(pickups)})`);
    }
    if (after.progress.bonusHealth !== after.health.args[1] - maxBefore) {
        fail(`Maximum health rose by ${after.health.args[1] - maxBefore} but Progress.bonusHealth is ${after.progress.bonusHealth}`);
    }
    note(`the upgrade was collected: maximum health ${maxBefore} -> ${after.health.args[1]}`);
    await screenshot('secret-collected');
}

/** Settings from the cover: a volume and demo mode, saved, and demo mode's era select */
async function settingsStep() {
    await open('');
    await inPage((key) => localStorage.removeItem(key), SETTINGS_KEY);
    await open('');
    await waitFor('the cover', TIMEOUT.event, (state) => same(state.scenes, ['Title']) && !!state.title);
    const saved = async () => JSON.parse((await look()).storage ?? 'null');
    try {
        await sleep(500);
        await tap(KEYS.s);
        await waitFor('the settings sheet to open on S', TIMEOUT.event, (state) => state.texts.some((text) => /demo mode/i.test(String(text))));
        await screenshot('settings-open');

        // Music is the first row: one step down
        await tap(KEYS.left);
        const afterVolume = await waitFor('the music volume to be saved', TIMEOUT.event, (state) => (state.storage ? state : false));
        const volume = JSON.parse(afterVolume.storage).musicVolume;
        if (!(Math.abs(volume - 0.6) < 1e-9)) {
            fail(`Left on the music row saved musicVolume ${volume}, expected 0.6 (one step down from the default 0.7)`);
        }
        // Demo mode is the fourth row
        await tap(KEYS.down);
        await tap(KEYS.down);
        await tap(KEYS.down);
        await tap(KEYS.enter);
        await waitFor('demo mode to be saved', TIMEOUT.event, (state) => state.storage && JSON.parse(state.storage).demoMode === true);
        const stored = await saved();
        if (stored.sfxVolume !== 0.9 || stored.screenShake !== true) {
            fail(`Changing music and demo mode also changed something else: ${JSON.stringify(stored)}`);
        }
        await screenshot('settings-changed');
        note(`music volume 0.7 -> ${volume} and demo mode on, saved in localStorage: ${JSON.stringify(stored)}`);

        await tap(KEYS.escape);
        const select = await waitFor('the cover to offer the eras', TIMEOUT.event, (state) =>
            content.levels.every((level) => state.texts.some((text) => String(text) === level.name)) ? state : false,
        );
        await sleep(300);
        await screenshot('settings-demo-cover');
        if (!same(select.scenes, ['Title'])) {
            fail(`Closing the settings left the scenes [${select.scenes.join(', ')}]`);
        }

        // It must survive a reload, and a key that is not an era must not start anything
        await open('');
        await waitFor('the era select after a reload', TIMEOUT.event, (state) =>
            same(state.scenes, ['Title']) && content.levels.every((level) => state.texts.some((text) => String(text) === level.name)),
        );
        await sleep(500);
        await tap(KEYS.x);
        await sleep(600);
        const idle = await look();
        if (!same(idle.scenes, ['Title'])) {
            fail(`With demo mode on, the X key started the game (scenes [${idle.scenes.join(', ')}])`);
        }
        note('demo mode survived a reload; the cover offers every era and ignores other keys');

        const pick = 3;
        const level = content.levels[pick - 1];
        await tap(digitKey(pick));
        const started = await waitForRoom(level, 1, TIMEOUT.room, idle.seq);
        if (started.era.level !== pick - 1) {
            fail(`Key ${pick} on the demo cover started level index ${started.era.level}`);
        }
        const earlier = content.levels.slice(0, pick - 1).flatMap((era) => era.grants ?? []);
        const missing = earlier.filter((id) => !started.progress.upgrades.includes(id));
        if (missing.length > 0) {
            fail(`Demo mode started era ${pick} without the earlier eras' upgrades: missing [${missing}]`);
        }
        checkHud(started, pick, content.levels.length);
        await passIntro(level, 'settings-demo-era', idle.seq);
        await screenshot('settings-demo-era-3');
        note(`key ${pick} started era ${pick} "${level.name}" with the earlier upgrades owned`);

        // Put it back the way a player would, to prove the toggle works both ways
        await open('');
        await waitFor('the cover', TIMEOUT.event, (state) => same(state.scenes, ['Title']) && !!state.title);
        await sleep(500);
        await tap(KEYS.s);
        await waitFor('the settings sheet', TIMEOUT.event, (state) => state.texts.some((text) => /demo mode/i.test(String(text))));
        await tap(KEYS.right);
        await tap(KEYS.down);
        await tap(KEYS.down);
        await tap(KEYS.down);
        await tap(KEYS.enter);
        await waitFor('the defaults to be saved', TIMEOUT.event, (state) => {
            const now = state.storage ? JSON.parse(state.storage) : null;
            return now && now.demoMode === false && Math.abs(now.musicVolume - 0.7) < 1e-9;
        });
        await tap(KEYS.escape);
        await sleep(300);
        note('music volume and demo mode put back through the settings sheet');
    } finally {
        // Whatever happened above, the next step and the next run start from the defaults
        await inPage((key) => localStorage.removeItem(key), SETTINGS_KEY);
    }
    if ((await look()).storage !== null) {
        fail(`${SETTINGS_KEY} is still in localStorage after the test`);
    }
}

/**
 * One whole timed era in real time, no K: a simple bot keeps moving and firing while the page
 * counts the crowd and times every frame.
 */
async function longStep() {
    const index = content.levels.findIndex((level) => level.style === LONG_ERA);
    const level = content.levels[index];
    const continuous = level?.rooms[0].continuous;
    if (!continuous) {
        fail(`--long=${LONG_ERA}: no timed era has that style`);
    }
    const { tag, rule, roomSeq } = await enterEra(index);
    await inPage(recorders, 'start');
    const began = await look();
    const startedAt = Date.now();
    note(`playing ${continuous.duration}s of "${level.name}" in real time (cap ${continuous.maxAlive} alive)`);

    const moves = ['d', 'w', 'a', 's'];
    let held = null;
    let firing = false;
    let tick = 0;
    let lastReport = 0;
    let worstCrowd = 0;
    const deadline = Date.now() + (continuous.duration + 60) * 1000;
    try {
        for (;;) {
            const state = await look();
            if (state.levelCleared?.seq > roomSeq || state.era?.cleared || !roomIs(state, level.name, 1)) {
                break;
            }
            if (Date.now() >= deadline) {
                fail(`The clock had not run out ${continuous.duration + 60}s after it started. ${describeState(state)}`);
            }
            if (state.died?.seq > roomSeq) {
                fail('The player died during the long run although ?nodamage is on');
            }
            worstCrowd = Math.max(worstCrowd, state.era.alive + state.era.incoming);

            // A lap of the square, a quarter at a time
            const move = moves[Math.floor(tick / 12) % moves.length];
            if (move !== held) {
                if (held) {
                    await keyUp(KEYS[held]);
                }
                await keyDown(KEYS[move]);
                held = move;
            }
            // Aim round in a circle; hold fire for most of a second (a blob needs the release)
            const angle = tick / 7;
            const aim = toScreen(state.canvas, state.player.x + Math.cos(angle) * 50, state.player.y + Math.sin(angle) * 50);
            if (tick % 9 === 0 && firing) {
                await mouse('mouseReleased', aim, false);
                firing = false;
            } else if (!firing) {
                await mouse('mousePressed', aim, true);
                firing = true;
            } else {
                await mouse('mouseMoved', aim, true);
            }
            if (tick % 40 === 39 && rule.wheel.length > 1) {
                await tap(KEYS.e);
            }
            if (tick % 55 === 54 && rule.dashCharges > 0) {
                await tap(KEYS.space);
            }
            const second = Math.floor(state.era.elapsed / 20);
            if (second > lastReport) {
                lastReport = second;
                const mid = await inPage(recorders, 'read');
                note(
                    `${Math.round(state.era.elapsed)}s: ${state.era.alive} alive, ${state.era.incoming} incoming, ` +
                        `most so far ${mid.crowd.max}; frames avg ${(mid.frames.total / mid.frames.count).toFixed(1)}ms`,
                );
                if (second === 3) {
                    await screenshot(`${tag}-long-60s`);
                }
                if (second === 5) {
                    await screenshot(`${tag}-long-surge`);
                }
            }
            tick++;
            await sleep(100);
        }
    } finally {
        if (held) {
            await keyUp(KEYS[held]);
        }
        await mouse('mouseReleased', lastPointer, false);
    }
    const wall = (Date.now() - startedAt) / 1000;
    const { frames, crowd } = await inPage(recorders, 'stop');
    await screenshot(`${tag}-long-end`);

    const ticks = await eventsSince(eventNames.ERA_TIMER, roomSeq);
    if (ticks.at(-1)?.args[0] !== 0) {
        fail(`The last "${eventNames.ERA_TIMER}" carried ${ticks.at(-1)?.args[0]}s left, expected 0`);
    }
    const cleared = await waitFor('the era to be cleared when the clock ran out', TIMEOUT.event, (state) => state.levelCleared?.seq > roomSeq);
    if (cleared.levelCleared.args[0] !== index + 1) {
        fail(`"${eventNames.LEVEL_CLEARED}" carried ${cleared.levelCleared.args[0]}, expected ${index + 1}`);
    }
    const [checkpoints, surges, kills] = await Promise.all(
        [eventNames.CHECKPOINT, eventNames.SURGE, eventNames.MONSTER_KILLED].map((name) => eventsSince(name, roomSeq)),
    );
    const expectedCheckpoints = Math.ceil(continuous.duration / (continuous.checkpointEvery ?? 45)) - 1;
    if (checkpoints.length !== expectedCheckpoints) {
        fail(`${checkpoints.length} "${eventNames.CHECKPOINT}" events in a ${continuous.duration}s era, expected ${expectedCheckpoints}`);
    }
    if (surges.length !== 1) {
        fail(`"${eventNames.SURGE}" was emitted ${surges.length} times, expected once`);
    }
    const most = Math.max(crowd.max, worstCrowd);
    if (most > continuous.maxAlive) {
        fail(`${most} enemies were alive or incoming at ${crowd.at.toFixed(1)}s; maxAlive is ${continuous.maxAlive}`);
    }
    if (crowd.samples === 0) {
        skip('crowd cap per frame', 'the per-frame counter never ran; the cap was only checked ten times a second');
    }
    if (most === 0) {
        fail('No enemy was ever alive during the long run');
    }
    const expectedWall = continuous.duration - began.era.elapsed;
    if (wall > expectedWall * 1.15 + 3) {
        fail(`The ${continuous.duration}s clock took ${wall.toFixed(1)}s of real time: the game is running slow`);
    }
    const average = frames.total / frames.count;
    const line =
        `long run ("${level.name}", ${continuous.duration}s): timer reached 0 after ${wall.toFixed(1)}s of real time; ` +
        `most alive + incoming ${most} of ${continuous.maxAlive} (per frame, ${crowd.samples} samples); ${kills.length} kills, ` +
        `${checkpoints.length} checkpoints, 1 surge; frame time min ${frames.min.toFixed(1)}ms, avg ${average.toFixed(1)}ms ` +
        `(${(1000 / average).toFixed(0)} fps), max ${frames.max.toFixed(0)}ms, ${frames.slow} of ${frames.count} frames over 33ms ` +
        `(headless software rendering)`;
    note(line);
    findings.push(line);
    await expectNextEra(index, cleared.levelCleared.seq);
}

// ---------------------------------------------------------------------------------------
// The production build

/** The cover of the built game: drawn, no errors, no dev helpers */
async function previewBootStep(build) {
    note(`built ${build.files.length} files, ${(build.bytes / 1024 / 1024).toFixed(2)} MB`);
    await open('');
    const state = await look();
    if (state.globalGame !== 'undefined') {
        fail(`window.__game is ${state.globalGame} in the production build; it must be undefined`);
    }
    if (!same(state.scenes, ['Title'])) {
        fail(`The built game opened with scenes [${state.scenes.join(', ')}], expected the cover alone`);
    }
    await sleep(800);
    const canvases = await inPage(() => document.querySelectorAll('canvas').length);
    if (canvases !== 1) {
        fail(`The page has ${canvases} canvas elements, expected 1`);
    }
    await expectDrawn('preview-cover', 'the cover of the built game');
    note('window.__game is undefined; the cover is the only scene');
}

/** Dev URL parameters must do nothing in the build */
async function previewParamsStep() {
    for (const query of ['?level=3', '?sandbox&room=5', '?gallery', '?gallery2']) {
        await open(query);
        await sleep(1500);
        const state = await look();
        if (!same(state.scenes, ['Title'])) {
            fail(`${query} skipped the cover in the production build: scenes [${state.scenes.join(', ')}]`);
        }
    }
    await screenshot('preview-level-3-is-the-cover');
    note('?level=3, ?sandbox&room=5, ?gallery and ?gallery2 all show the cover');
}

/** A key starts the game; K and ?nodamage do nothing */
async function previewPlayStep() {
    await open('?nodamage');
    await waitFor('the cover', TIMEOUT.event, (state) => same(state.scenes, ['Title']) && !!state.title);
    await sleep(600);
    const cover = await look();
    await tap(KEYS.enter);
    const started = await waitFor('a key press to start the game', TIMEOUT.room, (state) =>
        state.scenes.includes('Game') && state.room?.seq > cover.seq && state.era ? state : false,
    );
    if (started.era.level !== 0 || started.era.sandbox) {
        fail(`The built game started at level index ${started.era.level} (sandbox ${started.era.sandbox})`);
    }
    note(`a key press started "${started.room.args[0]}"`);

    // In dev, K ends the wait for the title card. Here the card must stay up.
    await sleep(600);
    const waiting = await look();
    if (!waiting.era.waiting) {
        skip('K under the title card', 'the era was not waiting on a card when K was to be pressed');
    } else {
        await tap(KEYS.k);
        await sleep(500);
        const after = await look();
        if (!after.era.waiting || after.era.started) {
            fail('K skipped the title card in the production build');
        }
    }

    const deadline = Date.now() + TIMEOUT.intro;
    while (!(await look()).era?.started) {
        if (Date.now() >= deadline) {
            fail('Space did not put the title card and the item card away in the production build');
        }
        await tap(KEYS.space);
        await sleep(280);
    }
    const playing = await waitFor('the first wave to arrive', TIMEOUT.room, (state) => (state.era?.alive >= 3 ? state : false));
    await tap(KEYS.k);
    await sleep(250);
    await tap(KEYS.k);
    await sleep(500);
    const after = await look();
    if (after.era.wave !== playing.era.wave) {
        fail(`K moved the game on from wave ${playing.era.wave} to wave ${after.era.wave} in the production build`);
    }
    if (after.era.alive === 0) {
        fail(`K killed everything alive in the production build (${playing.era.alive} -> 0)`);
    }
    if (after.player?.invincible) {
        fail('?nodamage made the player invincible in the production build');
    }
    await expectDrawn('preview-playing', 'the built game in play');
    note(`K did nothing (${playing.era.alive} alive before it, ${after.era.alive} after, still wave ${after.era.wave}); ?nodamage did nothing`);
}

// ---------------------------------------------------------------------------------------
// The plan

async function connectBrowser(browser, trapGlobal) {
    client = await Client.connect(await startBrowser(browser));
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Page.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false,
    });
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${probe})(${trapGlobal})` });
}

const wants = (part) => (ONLY ? ONLY.includes(part) : part !== 'long' || LONG);

async function runDev(browser) {
    await startVite();
    log(`dev server: ${BASE_URL}`);
    await connectBrowser(browser, true);

    if (!(await step('Boot to the cover', bootStep))) {
        // Nothing else can be trusted if the game does not start
        return;
    }
    const levels = content.levels;
    const last = levels.length - 1;

    if (wants('boot')) {
        await step('New game from the cover: cards put away with Space, HUD 1/5', newGameStep);
    }
    if (wants('eras')) {
        for (const [index, level] of levels.entries()) {
            const name = `Era ${index + 1} "${level.name}" (?level=${index + 1}&nodamage)`;
            if (index === last) {
                await step(`${name}: modes, the Prism, an era switch, the ending, back to the cover, a second new game`, bossStep);
            } else if (level.rooms[0].continuous) {
                await step(`${name}: movement, weapon rule, dash, clock, pause, K to the end`, () => timedStep(index));
            } else {
                await step(`${name}: movement, weapon rule, K through the waves`, goldenStep);
            }
        }
    }
    if (wants('death')) {
        await step('Death in Golden restarts the wave', goldenDeathStep);
        await step('Death in a timed era restarts from the last checkpoint', timedDeathStep);
    }
    if (wants('sandbox')) {
        if (!content.sandbox) {
            currentStep = { name: 'sandbox' };
            skip('sandbox', 'no SANDBOX level is exported from src/config/levels/index.ts');
            currentStep = null;
        } else {
            const rooms = content.sandbox.rooms.length;
            let openDirectly = true;
            for (let roomIndex = 0; roomIndex < rooms; roomIndex++) {
                const query = openDirectly ? `?sandbox&room=${roomIndex + 1}&nodamage` : null;
                // After a failure the next room is opened directly, so one broken room does not hide the rest
                openDirectly = !(await step(
                    `Sandbox room ${roomIndex + 1}/${rooms}` + (query ? ` (opened with ${query})` : ' (reached by playing)'),
                    () => sandboxRoomStep(roomIndex, query),
                ));
            }
            await step('Sandbox secret: the wrong ray, the right ray, the upgrade', secretStep);
        }
    }
    if (wants('settings')) {
        await step('Settings from the cover: volume, demo mode, saved, era select', settingsStep);
    }
    if (wants('long')) {
        await step(`Long run: the whole of the ${LONG_ERA} era in real time, no K`, longStep);
    }
}

async function runPreview(browser) {
    let build;
    if (
        !(await step('Build the game into a temporary folder', async () => {
            build = buildGame();
            await startStaticServer(buildDir);
            note(`serving the build at ${BASE_URL}`);
        }))
    ) {
        return;
    }
    await connectBrowser(browser, false);
    if (!(await step('Production build: the cover renders with no errors and no window.__game', () => previewBootStep(build)))) {
        return;
    }
    await step('Production build: dev URL parameters do not skip the cover', previewParamsStep);
    await step('Production build: a key starts the game; K and ?nodamage do nothing', previewPlayStep);
}

async function run() {
    if (ONLY) {
        const unknown = ONLY.filter((part) => !PARTS.includes(part));
        if (unknown.length > 0) {
            fail(`--only: unknown part "${unknown.join(', ')}". Parts: ${PARTS.join(', ')}`);
        }
    }
    const browser = findBrowser();
    await assertPortFree(VITE_PORT, 'game server', 'SMOKE_VITE_PORT');
    await assertPortFree(DEBUG_PORT, 'browser debugging', 'SMOKE_DEBUG_PORT');

    rmSync(OUT_DIR, { recursive: true, force: true });
    mkdirSync(OUT_DIR, { recursive: true });

    const flavour = [PREVIEW && 'production build', LONG && 'long', STRICT && 'strict', ONLY && `only ${ONLY.join(', ')}`].filter(Boolean);
    log(`Light Handler smoke test${flavour.length > 0 ? ` (${flavour.join(', ')})` : ''}`);
    log(`browser: ${browser}`);
    if (PREVIEW) {
        await runPreview(browser);
    } else {
        await runDev(browser);
    }
}

function summarise() {
    const failed = steps.filter((entry) => entry.status === 'FAIL');
    const warnings = [...new Set(problems.warnings)];

    log('\n----------------------------------------------------------------');
    for (const [index, entry] of steps.entries()) {
        log(`${entry.status}  [${index + 1}] ${entry.name}`);
    }
    if (findings.length > 0) {
        log('\nMeasured:');
        for (const line of findings) {
            log(`  - ${line}`);
        }
    }
    if (skips.length > 0) {
        log(`\nSKIPPED checks (${skips.length}):`);
        for (const entry of skips) {
            log(`  - ${entry.what} [${entry.step}]: ${entry.reason}`);
        }
    }
    if (warnings.length > 0) {
        log(`\nConsole warnings (${warnings.length}):`);
        for (const line of warnings) {
            log(`  - ${line}`);
        }
    }
    if (problems.errors.length > 0) {
        log(`\nConsole errors (${problems.errors.length}):`);
        for (const line of problems.errors) {
            log(`  - ${line}`);
        }
    }

    const strictFailure = STRICT && (skips.length > 0 || warnings.length > 0);
    const ok = steps.length > 0 && failed.length === 0 && problems.errors.length === 0 && !strictFailure;
    const shots = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).length : 0;
    log(
        `\n${ok ? 'PASS' : 'FAIL'}: ${steps.length - failed.length} of ${steps.length} steps passed, ` +
            `${failed.length} failed, ${skips.length} checks skipped, ${problems.errors.length} console errors, ` +
            `${warnings.length} console warnings. ${shots} screenshots in tools/out/`,
    );
    if (strictFailure && failed.length === 0 && problems.errors.length === 0) {
        log('Failed only because of --strict: skipped checks and console warnings count as failures.');
    }
    return ok;
}

const watchdog = setTimeout(() => {
    log(`\nFAIL: the whole run took longer than ${TIMEOUT.whole / 60_000} minutes; giving up`);
    cleanup();
    process.exit(1);
}, TIMEOUT.whole);

let ok = false;
const runStarted = Date.now();
try {
    await run();
    ok = summarise();
    log(`Took ${((Date.now() - runStarted) / 1000).toFixed(0)}s.`);
} catch (error) {
    // Failures outside a step: no browser, port in use, server would not start
    log(`\n${error instanceof SmokeFailure ? error.message : (error.stack ?? error)}`);
    if (steps.length > 0) {
        summarise();
    }
    log('\nFAIL: the smoke test could not run to the end');
} finally {
    clearTimeout(watchdog);
    await shutdown();
}
process.exit(ok ? 0 : 1);
