// Player settings. Kept in the browser's localStorage, so they survive a reload; everything
// else about a playthrough (src/state.ts) does not.

export interface Settings {
    /** 0 to 1 */
    musicVolume: number;
    /** 0 to 1 */
    sfxVolume: number;
    screenShake: boolean;
    /** Every era can be started from the cover */
    demoMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
    musicVolume: 0.7,
    sfxVolume: 0.9,
    screenShake: true,
    demoMode: false,
};

const STORAGE_KEY = 'light-handler.settings';

let current: Settings | null = null;
const listeners = new Set<(settings: Settings) => void>();

function read(): Settings {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>;
        return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
        // Storage can be blocked (private windows, embedded frames): play with the defaults
        return { ...DEFAULT_SETTINGS };
    }
}

export function getSettings(): Settings {
    current ??= read();
    return current;
}

export function updateSettings(change: Partial<Settings>): Settings {
    current = { ...getSettings(), ...change };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
        // Not saved, but still applied for this session
    }
    for (const listener of listeners) {
        listener(current);
    }
    return current;
}

/** Calls back now and on every change; returns a function that stops it */
export function watchSettings(listener: (settings: Settings) => void): () => void {
    listeners.add(listener);
    listener(getSettings());
    return () => listeners.delete(listener);
}
