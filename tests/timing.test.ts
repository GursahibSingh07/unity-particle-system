import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/config/levels';
import { ENDING_SCENE, FLOW } from '../src/config/flow';
import { checkpointSeconds } from '../src/systems/eraClock';
import { ERA_CASES } from './helpers';

// The jam rule (docs/rules.md): a complete loop of 10 to 15 minutes. This is a guard, not a
// measurement: it adds up what the data fixes (the clocks of the timed eras) and what
// docs/DESIGN.md section 2 allows for the parts that depend on the player, so that nobody
// pushes the game outside the rule by editing one number. Only a timed human playthrough
// proves the real figure (docs/TESTING.md, pre-submission checklist).

const JAM = { min: 10, max: 15 };

/** Minutes, from the table in docs/DESIGN.md section 2 */
const ALLOWANCE = {
    coverAndIntro: 0.5,
    boss: 2,
    ending: 1,
};
/** What section 2 says a timed era takes: its clock plus cards and captions */
const TIMED_ERA_BUDGET = 2.25;
/** The title card, the captions and the item card in front of a timed era's clock (docs/LEVELS.md) */
const CARDS_PER_TIMED_ERA = 15 / 60;

const timed = ERA_CASES.filter(({ level }) => level.rooms[0].continuous).map(({ label, level }) => ({
    label,
    continuous: level.rooms[0].continuous!,
}));
const clockMinutes = timed.reduce((sum, { continuous }) => sum + continuous.duration, 0) / 60;
const fixed = ALLOWANCE.coverAndIntro + ALLOWANCE.boss + ALLOWANCE.ending;
const turns = ((LEVELS.length - 1) * (FLOW.nextEraDelay + 2 * FLOW.fade)) / 60000;

/** A run with no deaths */
const clean = fixed + clockMinutes + timed.length * CARDS_PER_TIMED_ERA + turns;
/**
 * One death in each timed era. A death costs the time back to the last checkpoint: half an
 * interval on average, a whole one at worst (docs/LEVELS.md).
 */
const withDeaths = clean + timed.reduce((sum, { continuous }) => sum + checkpointSeconds(continuous) / 2, 0) / 60;

describe('timing budget (jam rule: 10 to 15 minutes)', () => {
    it('has four timed eras to add up', () => {
        expect(timed).toHaveLength(4);
    });

    it(`a clean run is inside the window (computed: ${clean.toFixed(2)} min)`, () => {
        expect(clean, `clean run of ${clean.toFixed(2)} minutes`).toBeGreaterThanOrEqual(JAM.min);
        expect(clean, `clean run of ${clean.toFixed(2)} minutes`).toBeLessThanOrEqual(JAM.max);
    });

    it(`a run with one death in every timed era is still inside it (computed: ${withDeaths.toFixed(2)} min)`, () => {
        expect(withDeaths, `run of ${withDeaths.toFixed(2)} minutes with one average death per timed era`).toBeLessThanOrEqual(JAM.max);
    });

    it.each(timed)('$label: the clock fits the 2.25 minutes the design gives a timed era', ({ label, continuous }) => {
        const minutes = continuous.duration / 60 + CARDS_PER_TIMED_ERA;
        expect(continuous.duration, `${label}: a timed era under a minute is not an era`).toBeGreaterThanOrEqual(60);
        expect(minutes, `${label}: ${continuous.duration}s of clock plus cards is ${minutes.toFixed(2)} min`).toBeLessThanOrEqual(TIMED_ERA_BUDGET);
    });

    it('the timed eras are the same length, so no era outstays the others', () => {
        const durations = timed.map(({ continuous }) => continuous.duration);
        expect(new Set(durations).size, `timed era durations: ${durations.join(', ')}`).toBe(1);
    });

    it('the waits that guard against an unanswered card cannot themselves break the window', () => {
        // If the UI never answered at all, every era would wait these out before starting
        const intro = LEVELS.reduce((sum, level) => sum + FLOW.introTimeout + FLOW.introTimeoutPerLine * (level.introText?.length ?? 0), 0);
        const cards = LEVELS.filter((level) => (level.grants ?? []).length > 0).length * FLOW.upgradeCardTimeout;
        expect((intro + cards) / 60000, 'minutes of timeouts across the eras').toBeLessThan(JAM.max);
    });

    it('the ending fits its minute if the player just reads', () => {
        // The torch, then the beats; reading time is the player's own
        const fixedMs = ENDING_SCENE.fadeIn + ENDING_SCENE.playTime + 2 * ENDING_SCENE.beat + ENDING_SCENE.fadeOut;
        expect(fixedMs / 60000, 'minutes of the ending that pass without a key press').toBeLessThanOrEqual(ALLOWANCE.ending);
    });
});
