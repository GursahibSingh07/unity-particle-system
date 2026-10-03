// Automated playthrough: boots the real game in a headless browser, plays every room with
// real keyboard and mouse input, and fails on any console error or stuck state.
//
//   npm run smoke                 normal run
//   npm run smoke -- --strict     SKIPs and console warnings also fail the run
//   npm run smoke -- --headed     show the browser window (for debugging a failure)
//
// Environment: BROWSER (path to a Chromium browser), SMOKE_VITE_PORT, SMOKE_DEBUG_PORT.
// No dependencies: Node's own fetch and WebSocket talk to the browser's DevTools protocol.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(import.meta.dirname, 'out');
const VITE_PORT = Number(process.env.SMOKE_VITE_PORT ?? 5190);
const DEBUG_PORT = Number(process.env.SMOKE_DEBUG_PORT ?? 9344);
const BASE_URL = `http://127.0.0.1:${VITE_PORT}/`;
const STRICT = process.argv.includes('--strict');
const HEADED = process.argv.includes('--headed');

// Generous on purpose: a slow laptop on battery must not turn into a false failure
const TIMEOUT = {
    server: 60_000,
    browser: 30_000,
    boot: 30_000,
    room: 20_000,
    wave: 45_000,
    death: 120_000,
    restart: 20_000,
    protocol: 30_000,
    whole: 15 * 60_000,
};
/** Keys must stay down across at least one frame for Phaser's per-frame polling to see them */
const KEY_TAP_MS = 80;
const MOVE_HOLD_MS = 300;
/** World units the player must travel while a move key is held (70 units/s when written) */
const MIN_MOVE = 3;

// Used only when the game's own modules cannot be read from the dev server
const DEFAULT_EVENTS = {
    PLAYER_HEALTH_CHANGED: 'player-health-changed',
    PLAYER_DIED: 'player-died',
    ENERGY_CHANGED: 'energy-changed',
    RADIATION_CHANGED: 'radiation-changed',
    WAVE_STARTED: 'wave-started',
    ROOM_STARTED: 'room-started',
    LEVEL_CLEARED: 'level-cleared',
};
const DEFAULT_WORLD = { WORLD_WIDTH: 320, WORLD_HEIGHT: 180 };

const KEYS = {
    w: { key: 'w', code: 'KeyW', vk: 87 },
    a: { key: 'a', code: 'KeyA', vk: 65 },
    s: { key: 's', code: 'KeyS', vk: 83 },
    d: { key: 'd', code: 'KeyD', vk: 68 },
    k: { key: 'k', code: 'KeyK', vk: 75 },
};
const digitKey = (n) => ({ key: String(n), code: `Digit${n}`, vk: 48 + n });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------
// Report

const steps = [];
const skips = [];
const problems = { errors: [], warnings: [] };
let currentStep = null;
let shotCount = 0;

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
// Child processes. Everything started here is stopped in cleanup(), whatever happens.

let viteProcess;
let browserProcess;
let profileDir;
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
    killTree(browserProcess);
    killTree(viteProcess);
    removeProfile();
}

function removeProfile() {
    if (!profileDir) {
        return true;
    }
    try {
        rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
        // The browser can hold a file for a moment after it dies
    }
    return !existsSync(profileDir);
}

/** The normal way out: stop everything, then make sure nothing is left behind */
async function shutdown() {
    cleanup();

    const deadline = Date.now() + 10_000;
    while (!removeProfile() && Date.now() < deadline) {
        await sleep(300);
    }
    for (const [port, what, envName] of [
        [VITE_PORT, 'Vite dev server', 'SMOKE_VITE_PORT'],
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
        log(`\nInterrupted (${signal}): shutting down the browser and the dev server`);
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
        const probe = net.createServer();
        probe.once('error', () => {
            reject(
                new SmokeFailure(
                    `Port ${port} (${what}) is already in use. A previous smoke run may still be alive; ` +
                        `stop it, or choose another port with ${envName}.`,
                ),
            );
        });
        probe.listen(port, '127.0.0.1', () => probe.close(() => resolve()));
    });
}

async function startVite() {
    const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    if (!existsSync(viteBin)) {
        fail(`Vite is not installed (${viteBin} is missing). Run "npm install" first.`);
    }

    let output = '';
    // process.execPath, because node is not on PATH on every machine this runs on
    viteProcess = spawn(
        process.execPath,
        [
            viteBin,
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
                reject(new SmokeFailure('The browser closed the connection (did it crash?)'));
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
 * Installed before any page script runs. main.ts assigns the Phaser.Game to window.__game in
 * dev; this catches that assignment and records everything emitted on game.events from the
 * very first event, so the smoke test reads the game through its public event contract.
 */
function probe() {
    const PER_FRAME = new Set(['prestep', 'step', 'poststep', 'prerender', 'postrender']);
    const KEEP = 300;
    const smoke = { game: null, seq: 0, events: {} };

    const plain = (value) =>
        value === null || ['string', 'number', 'boolean'].includes(typeof value) ? value : `[${typeof value}]`;

    let game;
    Object.defineProperty(window, '__game', {
        configurable: true,
        get: () => game,
        set: (value) => {
            game = value;
            smoke.game = value;
            const emit = value.events.emit;
            value.events.emit = function (name, ...args) {
                if (typeof name === 'string' && !PER_FRAME.has(name)) {
                    const list = (smoke.events[name] ??= []);
                    list.push({ seq: ++smoke.seq, args: args.map(plain) });
                    if (list.length > KEEP) {
                        list.shift();
                    }
                }
                return emit.call(this, name, ...args);
            };
        },
    });
    window.__smoke = smoke;
}

/** One snapshot of everything the smoke test looks at */
function snapshot(names) {
    const smoke = window.__smoke;
    const game = smoke?.game;
    if (!game) {
        return { hasGame: false };
    }

    const last = (name) => smoke.events[name]?.at(-1) ?? null;
    const scenes = game.scene.getScenes(true);
    const gameScene = scenes.find((scene) => scene.scene.key === 'Game');

    // `player` is a private field of the Game scene; fall back to looking for it by class name
    let player = null;
    if (gameScene) {
        const found =
            gameScene.player ?? gameScene.children.list.find((child) => child.constructor?.name === 'Player');
        if (found && typeof found.x === 'number') {
            player = { x: found.x, y: found.y };
        }
    }

    const rect = game.canvas.getBoundingClientRect();
    return {
        hasGame: true,
        frame: game.loop.frame,
        seq: smoke.seq,
        scenes: scenes.map((scene) => scene.scene.key),
        player,
        texts: scenes.flatMap((scene) =>
            scene.children.list.filter((child) => child.type === 'Text' && child.visible).map((child) => child.text),
        ),
        canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        room: last(names.ROOM_STARTED),
        health: last(names.PLAYER_HEALTH_CHANGED),
        energy: last(names.ENERGY_CHANGED),
        radiation: last(names.RADIATION_CHANGED),
        died: last(names.PLAYER_DIED),
        levelCleared: last(names.LEVEL_CLEARED),
        waves: smoke.events[names.WAVE_STARTED] ?? [],
        lowestEnergy: (smoke.events[names.ENERGY_CHANGED] ?? []).map((entry) => ({
            seq: entry.seq,
            energy: entry.args[0],
        })),
    };
}

/** Reads the game's own config through the dev server, so room counts are never hard-coded here */
async function readContent() {
    const load = async (file) => {
        try {
            return await import(/* @vite-ignore */ file);
        } catch (error) {
            return { failed: String(error) };
        }
    };
    const [levels, monsters, radiation, events, world] = await Promise.all([
        load('/src/config/levels/index.ts'),
        load('/src/config/monsters.ts'),
        load('/src/config/radiation.ts'),
        load('/src/events.ts'),
        load('/src/config/world.ts'),
    ]);
    return JSON.parse(
        JSON.stringify({
            levels: levels.LEVELS ?? null,
            sandbox: levels.SANDBOX ?? null,
            levelsError: levels.failed ?? null,
            monsters: monsters.MONSTERS ?? null,
            radiations: radiation.RADIATIONS ?? null,
            events: events.Events ?? null,
            world: world.WORLD_WIDTH ? { WORLD_WIDTH: world.WORLD_WIDTH, WORLD_HEIGHT: world.WORLD_HEIGHT } : null,
        }),
    );
}

// ---------------------------------------------------------------------------------------
// Driving the game

let eventNames = DEFAULT_EVENTS;
let world = DEFAULT_WORLD;
let content;

const look = () => inPage(snapshot, eventNames);

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

function describeState(state) {
    if (!state?.hasGame) {
        return 'window.__game was never set (did main.ts stop exposing it in dev, or did the page fail to load?)';
    }
    const room = state.room ? `room ${state.room.args[1]}/${state.room.args[2]} of "${state.room.args[0]}"` : 'no room started';
    const health = state.health ? `health ${state.health.args[0]}/${state.health.args[1]}` : 'health unknown';
    const energy = state.energy ? `energy ${Math.round(state.energy.args[0])}/${state.energy.args[1]}` : 'energy unknown';
    return `scenes [${state.scenes.join(', ')}], ${room}, ${health}, ${energy}, frame ${state.frame}`;
}

async function screenshot(name) {
    const file = `${String(++shotCount).padStart(2, '0')}-${name}.png`;
    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(OUT_DIR, file), Buffer.from(data, 'base64'));
    return file;
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

async function mouse(type, point, pressed) {
    await client.send('Input.dispatchMouseEvent', {
        type,
        x: point.x,
        y: point.y,
        button: type === 'mouseMoved' ? 'none' : 'left',
        buttons: pressed ? 1 : 0,
        clickCount: type === 'mouseMoved' ? 0 : 1,
    });
}

async function releaseEverything(point) {
    // A failed step must not leave a key or the mouse held down for the next one
    for (const key of Object.values(KEYS)) {
        await keyUp(key);
    }
    await mouse('mouseReleased', point ?? { x: 640, y: 360 }, false);
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

async function waitForRoom(level, roomNumber, timeout = TIMEOUT.room) {
    return waitFor(`room ${roomNumber} of "${level.name}" to start`, timeout, (state) =>
        roomIs(state, level.name, roomNumber),
    );
}

/** Checks the HUD shows "<room>/<total>". Wording is the UI owner's, so only the numbers are read. */
function checkHud(state, roomNumber, total) {
    const counters = state.texts.flatMap((text) => [...text.matchAll(/(\d+)\s*\/\s*(\d+)/g)]);
    if (counters.length === 0) {
        skip('HUD room counter', 'no visible text shows "<room>/<total>", so the HUD cannot be compared with the room');
        return;
    }
    if (!counters.some((match) => Number(match[1]) === roomNumber && Number(match[2]) === total)) {
        fail(`The HUD does not show room ${roomNumber}/${total}. Visible text: ${JSON.stringify(state.texts)}`);
    }
    note(`HUD shows ${roomNumber}/${total}`);
}

/** Holds each of W, A, S, D in turn and checks the player really travels that way */
async function checkMovement() {
    const before = await look();
    if (!before.player) {
        skip('movement', 'the player object was not found in the Game scene (looked for scene.player and a child of class Player)');
        return;
    }

    // Right then left, down then up, so the player ends close to where it started
    const moves = [
        ['d', 'x', 1],
        ['a', 'x', -1],
        ['s', 'y', 1],
        ['w', 'y', -1],
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
                    `(expected at least ${MIN_MOVE}); it went from (${from.x.toFixed(1)}, ${from.y.toFixed(1)}) ` +
                    `to (${to.x.toFixed(1)}, ${to.y.toFixed(1)})`,
            );
        }
        travelled.push(`${name.toUpperCase()} ${distance.toFixed(0)}`);
    }
    note(`WASD moves the player (units: ${travelled.join(', ')})`);
}

/** Lowest energy reported after event number `seq`, or null when no energy event came */
function lowestEnergySince(state, seq) {
    const values = state.lowestEnergy.filter((entry) => entry.seq > seq).map((entry) => entry.energy);
    return values.length > 0 ? Math.min(...values) : null;
}

/**
 * Holds the left mouse button and checks energy is spent. Returns false when it was not.
 * `shotName` is a screenshot taken while the button is down.
 */
async function fireSpendsEnergy(shotName) {
    // Start from a pool with room to drop, in case an earlier check drained it
    const ready = await waitFor('energy to recover before firing', 15_000, (state) => {
        if (!state.energy) {
            return state;
        }
        return state.energy.args[0] >= state.energy.args[1] * 0.6 ? state : false;
    });
    if (!ready.energy) {
        skip('firing', `no "${eventNames.ENERGY_CHANGED}" event has been emitted, so energy cannot be read`);
        return true;
    }

    const energyBefore = ready.energy.args[0];
    const seqBefore = ready.seq;
    // Aim away from the player, towards whichever side of the room has more space
    const from = ready.player ?? { x: world.WORLD_WIDTH / 2, y: world.WORLD_HEIGHT / 2 };
    const aim = toScreen(ready.canvas, from.x < world.WORLD_WIDTH / 2 ? from.x + 40 : from.x - 40, from.y);

    await mouse('mouseMoved', aim, false);
    await sleep(KEY_TAP_MS);
    await mouse('mousePressed', aim, true);

    const spent = (state) => {
        const lowest = lowestEnergySince(state, seqBefore);
        return lowest !== null && lowest < energyBefore;
    };
    let state;
    const holdUntil = Date.now() + 2500;
    do {
        await sleep(100);
        state = await look();
    } while (!spent(state) && Date.now() < holdUntil);

    if (shotName) {
        await screenshot(shotName);
    }
    await mouse('mouseReleased', aim, false);

    // A charged shot only costs energy when the button comes back up
    const releaseUntil = Date.now() + 1500;
    while (!spent(state) && Date.now() < releaseUntil) {
        await sleep(100);
        state = await look();
    }

    if (spent(state)) {
        note(
            `firing ${state.radiation?.args[0] ?? 'the selected radiation'} spent energy ` +
                `(${Math.round(energyBefore)} -> ${Math.round(lowestEnergySince(state, seqBefore))})`,
        );
        return true;
    }
    return false;
}

/** Presses the radiation's number key and waits for the game to report the switch */
async function selectRadiation(id) {
    const def = content.radiations?.[id];
    if (!def) {
        return `"${id}" has no definition in RADIATIONS`;
    }
    const before = await look();
    if (before.radiation?.args[0] === id) {
        return null;
    }
    await tap(digitKey(def.key));
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        const state = await look();
        if (state.radiation?.seq > (before.radiation?.seq ?? 0) && state.radiation.args[0] === id) {
            return null;
        }
        await sleep(100);
    }
    return `pressing ${def.key} did not select "${id}" (no "${eventNames.RADIATION_CHANGED}" event for it)`;
}

/** Movement and firing can be cut short by the player dying under real monsters, so they get retries */
async function withRetries(what, attempts, action) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await action();
        } catch (error) {
            const state = await look();
            const dead = state.health && state.health.args[0] <= 0;
            if (!(error instanceof SmokeFailure) || attempt >= attempts || !dead) {
                throw error;
            }
            note(`the player died during the ${what} check; waiting for the room to restart (attempt ${attempt} of ${attempts})`);
            await releaseEverything();
            const diedAt = state.seq;
            await waitFor('the room to restart after the player died', TIMEOUT.restart, (s) => s.room?.seq > diedAt);
        }
    }
}

/**
 * Presses K (dev key: kill the current wave) until the room is over.
 * Returns how the room ended: 'next-room', 'level-cleared', 'next-level' or 'left-game'.
 */
async function clearRoom(level, roomIndex) {
    const room = level.rooms[roomIndex];
    const roomNumber = roomIndex + 1;
    const isLast = roomNumber === level.rooms.length;
    const delays = room.waves.reduce((sum, wave) => sum + (wave.delay ?? 1000), 0);
    const deadline = Date.now() + delays + TIMEOUT.wave;

    let state = await look();
    let roomSeq = state.room.seq;
    let restarts = 0;

    for (;;) {
        state = await look();
        const wavesSeen = state.waves.filter((wave) => wave.seq > roomSeq).length;

        if (!state.scenes.includes('Game')) {
            if (isLast) {
                return { how: 'left-game', wavesSeen, state };
            }
            fail(`The Game scene stopped in the middle of the level. Active scenes: [${state.scenes.join(', ')}]`);
        }
        if (state.levelCleared && state.levelCleared.seq > roomSeq) {
            if (!isLast) {
                fail(`"${eventNames.LEVEL_CLEARED}" was emitted after room ${roomNumber} of ${level.rooms.length}`);
            }
            return { how: 'level-cleared', wavesSeen, state };
        }
        if (state.room.seq > roomSeq) {
            const [name, number] = state.room.args;
            if (name === level.name && number === roomNumber) {
                // The player died and the room started again; keep going
                restarts++;
                roomSeq = state.room.seq;
            } else if (name === level.name && number === roomNumber + 1 && !isLast) {
                return { how: 'next-room', wavesSeen, state, restarts };
            } else if (name !== level.name && isLast) {
                return { how: 'next-level', wavesSeen, state };
            } else {
                fail(`After room ${roomNumber} of "${level.name}" the game started room ${number} of "${name}"`);
            }
        }

        if (Date.now() >= deadline) {
            fail(
                `Room ${roomNumber} of "${level.name}" did not finish within ${Math.round((delays + TIMEOUT.wave) / 1000)}s ` +
                    `of pressing K. Waves started: ${wavesSeen} of ${room.waves.length}. Last seen: ${describeState(state)}`,
            );
        }
        await tap(KEYS.k);
        await sleep(200);
    }
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
            const file = await screenshot(`FAIL-${slug(name)}`);
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
    await screenshot('boot');

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
    const rooms = content.levels.map((level) => `"${level.name}" ${level.rooms.length}`).join(', ');
    note(`levels found (rooms): ${rooms}${content.sandbox ? `, sandbox ${content.sandbox.rooms.length}` : ''}`);
}

/** One room, played the way a person would: look, move, shoot, clear the waves, move on */
async function roomStep(level, roomIndex, query) {
    const roomNumber = roomIndex + 1;
    const total = level.rooms.length;
    const tag = slug(`${level.name}-room-${roomNumber}`);

    if (query !== null) {
        await open(query);
    }
    const loaded = await waitForRoom(level, roomNumber);
    note(`room ${roomNumber}/${total} of "${level.name}" started`);
    checkHud(loaded, roomNumber, total);
    await screenshot(`${tag}-loaded`);

    await withRetries('movement', 3, async () => {
        await waitForRoom(level, roomNumber);
        await checkMovement();
    });

    // A different radiation in each room, so a level's whole set gets fired over its rooms
    const radiation = level.radiations[roomIndex % level.radiations.length];
    await withRetries('firing', 3, async () => {
        await waitForRoom(level, roomNumber);
        const problem = await selectRadiation(radiation);
        if (problem) {
            fail(`Could not select radiation: ${problem}`);
        }
        if (!(await fireSpendsEnergy(`${tag}-firing`))) {
            fail(`Holding the left mouse button with "${radiation}" selected did not spend any energy`);
        }
    });

    await waitForRoom(level, roomNumber);
    const end = await clearRoom(level, roomIndex);
    const waves = level.rooms[roomIndex].waves.length;
    if (end.wavesSeen !== waves) {
        fail(
            `Room ${roomNumber} of "${level.name}" ended after ${end.wavesSeen} "${eventNames.WAVE_STARTED}" events, ` +
                `but it defines ${waves} waves`,
        );
    }
    await screenshot(`${tag}-${end.how}`);

    if (end.how === 'next-room') {
        note(`K cleared all waves (${waves}); the game moved on to room ${roomNumber + 1}/${total}`);
        checkHud(end.state, roomNumber + 1, total);
    } else {
        note(`K cleared all waves (${waves}); the level ended (${end.how})`);
    }
}

/** Stand still in a room with monsters until they kill the player, then expect the room to restart */
async function deathStep(level, levelIndex, roomIndex) {
    const roomNumber = roomIndex + 1;
    await open(`?level=${levelIndex + 1}&room=${roomNumber}`);
    const start = await waitForRoom(level, roomNumber);
    note(`standing still in room ${roomNumber} of "${level.name}" (health ${start.health?.args[0] ?? '?'})`);

    // A restart of the same room also proves a death, in case the death event is renamed
    const dead = await waitFor(
        'the monsters to kill a player who stands still',
        TIMEOUT.death,
        (state) => state.died?.seq > start.room.seq || state.room?.seq > start.room.seq,
        200,
    );
    if (!dead.died) {
        skip('death event', `the room restarted but no "${eventNames.PLAYER_DIED}" event was seen`);
    }
    note(`the player died (health ${dead.health?.args[0] ?? '?'})`);
    await screenshot('death');

    const restarted = await waitFor(
        'the room to restart after the death',
        TIMEOUT.restart,
        (state) => state.room?.seq > start.room.seq,
    );
    const [name, number] = restarted.room.args;
    if (name !== level.name || number !== roomNumber) {
        fail(`After dying in room ${roomNumber} of "${level.name}" the game started room ${number} of "${name}"`);
    }

    const healed = await waitFor('health to be full again after the restart', TIMEOUT.restart, (state) => {
        const health = state.health;
        return health?.seq > restarted.room.seq && health.args[0] === health.args[1];
    }).catch(() => null);
    if (!healed) {
        const state = await look();
        fail(`The room restarted but health is ${state.health?.args[0]}/${state.health?.args[1]}, not full`);
    }
    note(`room ${roomNumber} restarted with full health (${healed.health.args[0]}/${healed.health.args[1]})`);
    checkHud(healed, roomNumber, level.rooms.length);
    await screenshot('death-restarted');
}

/** A fresh page for each radiation, so the check finishes before the monsters reach the player */
async function sandboxRadiationStep(id) {
    const sandbox = content.sandbox;
    await open('?sandbox');
    await waitForRoom(sandbox, 1);

    const problem = await selectRadiation(id);
    if (problem) {
        skip(`sandbox radiation "${id}"`, problem);
        return;
    }
    if (!(await fireSpendsEnergy(`sandbox-${id}`))) {
        skip(`sandbox radiation "${id}"`, 'holding the left mouse button did not spend energy (not built yet?)');
    }
}

function pickDeathRoom() {
    // The busiest first wave of the first level kills a standing player soonest
    const level = content.levels[0];
    let best = 0;
    let bestCount = -1;
    level.rooms.forEach((room, index) => {
        const count = (room.waves[0]?.spawns ?? []).reduce((sum, group) => sum + group.count, 0);
        if (count > bestCount) {
            best = index;
            bestCount = count;
        }
    });
    return { level, levelIndex: 0, roomIndex: best };
}

/**
 * Plays a level's rooms back to back like a real run. After a failure the next room is
 * opened directly, so one broken room does not hide the state of the ones after it.
 */
async function playLevel(level, label, levelQuery) {
    let openDirectly = true;
    for (let roomIndex = 0; roomIndex < level.rooms.length; roomIndex++) {
        const roomNumber = roomIndex + 1;
        const query = openDirectly ? `${levelQuery}&room=${roomNumber}` : null;
        openDirectly = !(await step(
            `${label} room ${roomNumber}/${level.rooms.length}` +
                (query ? ` (opened with ${query})` : ' (reached by playing)'),
            () => roomStep(level, roomIndex, query),
        ));
    }
}

async function run() {
    const browser = findBrowser();
    await assertPortFree(VITE_PORT, 'Vite dev server', 'SMOKE_VITE_PORT');
    await assertPortFree(DEBUG_PORT, 'browser debugging', 'SMOKE_DEBUG_PORT');

    rmSync(OUT_DIR, { recursive: true, force: true });
    mkdirSync(OUT_DIR, { recursive: true });

    log(`Light Handler smoke test${STRICT ? ' (strict)' : ''}`);
    log(`browser: ${browser}`);
    await startVite();
    log(`dev server: ${BASE_URL}`);
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
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${probe})()` });

    if (!(await step('Boot the game at /', bootStep))) {
        // Nothing else can be trusted if the game does not start
        return;
    }

    for (const [levelIndex, level] of content.levels.entries()) {
        await playLevel(level, `Level ${levelIndex + 1} "${level.name}"`, `?level=${levelIndex + 1}`);
    }

    const death = pickDeathRoom();
    await step(
        `Death restarts the room (level ${death.levelIndex + 1} room ${death.roomIndex + 1})`,
        () => deathStep(death.level, death.levelIndex, death.roomIndex),
    );

    if (!content.sandbox) {
        currentStep = { name: 'sandbox' };
        skip('sandbox', 'no SANDBOX level is exported from src/config/levels/index.ts');
        currentStep = null;
        return;
    }
    const sandbox = content.sandbox;
    await playLevel(sandbox, 'Sandbox', '?sandbox');
    for (const id of sandbox.radiations) {
        await step(`Sandbox: fire ${id}`, () => sandboxRadiationStep(id));
    }
}

function summarise() {
    const failed = steps.filter((entry) => entry.status === 'FAIL');
    const warnings = [...new Set(problems.warnings)];

    log('\n----------------------------------------------------------------');
    for (const [index, entry] of steps.entries()) {
        log(`${entry.status}  [${index + 1}] ${entry.name}`);
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
try {
    await run();
    ok = summarise();
} catch (error) {
    // Failures outside a step: no browser, port in use, dev server would not start
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
