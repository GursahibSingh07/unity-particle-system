import { describe, expect, it } from 'vitest';
import { paintCity } from '../src/art/v2/city/scene';
import { ART_STYLES } from './helpers';

// The square is painted in code at boot, weathering and all (src/art/v2/city/weather.ts). Every
// mark comes from a fixed hash, so every boot must paint exactly the same picture.

describe('the painted square', () => {
    it.each(ART_STYLES)('%s is the same picture on every boot', (style) => {
        const first = paintCity(style);
        const second = paintCity(style);
        expect(first.base.data.every((value, i) => value === second.base.data[i])).toBe(true);
        expect(first.over.data.every((value, i) => value === second.over.data[i])).toBe(true);
    });

    it.each(ART_STYLES)('%s covers the whole picture: no hole left in the base layer', (style) => {
        const { base } = paintCity(style);
        let holes = 0;
        for (let i = 3; i < base.data.length; i += 4) {
            if (base.data[i] === 0) {
                holes++;
            }
        }
        expect(holes).toBe(0);
    });
});
