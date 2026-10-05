import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../src/settings';

// src/settings.ts keeps what it has read in a module variable, so every test loads a fresh
// copy of the module against its own stand-in for the browser's localStorage.

const STORAGE_KEY = 'light-handler.settings';

class FakeStorage {
    readonly data = new Map<string, string>();
    getItem(key: string) {
        return this.data.get(key) ?? null;
    }
    setItem(key: string, value: string) {
        this.data.set(key, value);
    }
}

async function load(storage?: unknown) {
    vi.resetModules();
    if (storage === undefined) {
        vi.unstubAllGlobals();
    } else {
        vi.stubGlobal('localStorage', storage);
    }
    return import('../src/settings');
}

let storage: FakeStorage;

beforeEach(() => {
    storage = new FakeStorage();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('settings', () => {
    it('defaults: music 0.7, sound 0.9, screen shake on, demo mode off', async () => {
        const { DEFAULT_SETTINGS, getSettings } = await load(storage);
        expect(DEFAULT_SETTINGS).toEqual({ musicVolume: 0.7, sfxVolume: 0.9, screenShake: true, demoMode: false, godMode: false });
        expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('demo mode must be off by default: judges get the normal game', async () => {
        const { DEFAULT_SETTINGS } = await load(storage);
        expect(DEFAULT_SETTINGS.demoMode).toBe(false);
    });

    it('reads what was saved, and fills the rest from the defaults', async () => {
        storage.setItem(STORAGE_KEY, JSON.stringify({ musicVolume: 0.2, demoMode: true, godMode: false }));
        const { getSettings } = await load(storage);
        expect(getSettings()).toEqual({ musicVolume: 0.2, sfxVolume: 0.9, screenShake: true, demoMode: true, godMode: false });
    });

    it('plays with the defaults when what was saved cannot be read', async () => {
        storage.setItem(STORAGE_KEY, '{not json');
        const { DEFAULT_SETTINGS, getSettings } = await load(storage);
        expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('plays with the defaults when storage is blocked, and still applies changes', async () => {
        const blocked = {
            getItem() {
                throw new Error('blocked');
            },
            setItem() {
                throw new Error('blocked');
            },
        };
        const { DEFAULT_SETTINGS, getSettings, updateSettings } = await load(blocked);
        expect(getSettings()).toEqual(DEFAULT_SETTINGS);
        expect(updateSettings({ sfxVolume: 0.1 }).sfxVolume).toBe(0.1);
        expect(getSettings().sfxVolume).toBe(0.1);
    });

    it('plays with the defaults when there is no localStorage at all', async () => {
        const { DEFAULT_SETTINGS, getSettings, updateSettings } = await load();
        expect(getSettings()).toEqual(DEFAULT_SETTINGS);
        expect(updateSettings({ demoMode: true, godMode: false }).demoMode).toBe(true);
    });

    it('never hands out the defaults object itself, so a change cannot alter them', async () => {
        const { DEFAULT_SETTINGS, getSettings, updateSettings } = await load(storage);
        expect(getSettings()).not.toBe(DEFAULT_SETTINGS);
        updateSettings({ musicVolume: 0, screenShake: false });
        expect(DEFAULT_SETTINGS).toEqual({ musicVolume: 0.7, sfxVolume: 0.9, screenShake: true, demoMode: false, godMode: false });
    });

    it('updateSettings merges the change, returns the result and saves all of it', async () => {
        const { getSettings, updateSettings } = await load(storage);
        const result = updateSettings({ musicVolume: 0.3 });
        expect(result).toEqual({ musicVolume: 0.3, sfxVolume: 0.9, screenShake: true, demoMode: false, godMode: false });
        expect(getSettings()).toEqual(result);
        expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(result);

        updateSettings({ demoMode: true, godMode: false });
        expect(getSettings()).toEqual({ musicVolume: 0.3, sfxVolume: 0.9, screenShake: true, demoMode: true, godMode: false });
        expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(getSettings());
    });

    it('what is saved is read back by the next page load', async () => {
        const first = await load(storage);
        first.updateSettings({ sfxVolume: 0.4, screenShake: false });
        const second = await load(storage);
        expect(second.getSettings()).toEqual({ musicVolume: 0.7, sfxVolume: 0.4, screenShake: false, demoMode: false, godMode: false });
    });

    it('watchSettings calls back at once and on every change, until it is stopped', async () => {
        const { updateSettings, watchSettings } = await load(storage);
        const seen: Settings[] = [];
        const stop = watchSettings((settings) => seen.push(settings));
        expect(seen).toHaveLength(1);
        expect(seen[0].demoMode).toBe(false);

        updateSettings({ demoMode: true, godMode: false });
        expect(seen).toHaveLength(2);
        expect(seen[1].demoMode).toBe(true);

        stop();
        updateSettings({ demoMode: false, godMode: false });
        expect(seen).toHaveLength(2);
    });
});
