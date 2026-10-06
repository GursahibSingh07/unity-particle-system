import { describe, expect, it } from 'vitest';
import { LOOKS, LOOK_LIMITS } from '../src/config/look';
import { ART_STYLES } from './helpers';

// src/config/look.ts: the hand-made layer over each era. It must never get in the way of reading
// the fight, and the ending, which is the truth, is not printed at all.

describe('hand-made look', () => {
    it.each(ART_STYLES)('%s has a look within the limits that keep it readable', (style) => {
        const look = LOOKS[style];
        expect(look, style).toBeDefined();
        expect(look.grain).toBeGreaterThanOrEqual(0);
        expect(look.grain).toBeLessThanOrEqual(LOOK_LIMITS.grain);
        expect(look.boil).toBeGreaterThanOrEqual(0);
        expect(look.boil).toBeLessThanOrEqual(LOOK_LIMITS.boil);
        expect(look.vignette).toBeLessThanOrEqual(LOOK_LIMITS.vignette);
        for (const value of [look.paper, look.blotch, look.halftone, look.bloom]) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        }
        for (const value of [look.saturation, look.contrast, look.brightness]) {
            expect(value).toBeGreaterThan(0.7);
            expect(value).toBeLessThan(1.3);
        }
        if (look.ambient) {
            const { count, alpha, lifespan, colors } = look.ambient;
            expect(count).toBeGreaterThan(0);
            expect(count).toBeLessThanOrEqual(LOOK_LIMITS.ambientCount);
            expect(alpha[0]).toBeLessThanOrEqual(alpha[1]);
            expect(alpha[1]).toBeLessThanOrEqual(1);
            expect(lifespan[0]).toBeLessThanOrEqual(lifespan[1]);
            expect(colors.length).toBeGreaterThan(0);
        }
    });

    it('the ending is not printed: no wobble, no halftone, no glow', () => {
        const { boil, halftone, bloom } = LOOKS.plain;
        expect({ boil, halftone, bloom }).toEqual({ boil: 0, halftone: 0, bloom: 0 });
    });
});
