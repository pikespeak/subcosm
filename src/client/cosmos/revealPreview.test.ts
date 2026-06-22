// revealPreview.test — the in-session goal meter + reveal-preview logic (SUB-02/SUB-04).
//
// Pure-module proof (Phaser-free / DOM-free, like ignite.test.ts) of three claims:
//   1. HONESTY (must_haves truth 3 / T-05-10): revealPreviewSteps()'s outcome is
//      byte-identical to the engine score() the real overnight tick uses — the
//      preview is a preview of the REAL thing, never a fabricated verdict.
//   2. CAUSALITY (GAME-03 / must_haves truth 2): goalMeter() reflects score(), and
//      a nudge that biases the frontier's folded steering moves the meter's
//      `measured`/`progress01` — in BOTH directions (toward and away from goal).
//   3. SEQUENCE: an achieved frontier yields the reward phase; a miss yields the
//      miss phase — the ordered, timer-free phase list the UI plays.
import { describe, expect, test } from 'vitest';
import { goalMeter, revealPreviewSteps } from './revealPreview';
import { score } from '../../engine/score';
import { calm, chaotic, crystalline } from '../../engine/genomes';
import type { DayVector } from '../../engine/contracts';

// A minimal valid DayVector builder (mirrors score.test.ts's makeDay) — the
// preview/meter read the same fields score() reads, so the fixtures match.
function makeDay(overrides: Partial<DayVector> = {}): DayVector {
  return {
    day: 4,
    date: '2026-01-04',
    posts: 50,
    comments: 120,
    contributors: 30,
    scoreSum: 170,
    topThreads: [120, 60, 30],
    conflict: 0.2,
    momentum: 0.1,
    diversity: 0.4,
    dominantTheme: 'community',
    steering: { branch: 0, symmetry: 0, hue: 0 },
    seed: 0x1234,
    ...overrides,
  };
}

describe('goalMeter — reflects the engine score (LIVE-03 / GAME-03)', () => {
  test('measured + threshold + direction + achieved mirror score() exactly', () => {
    const day = makeDay({ conflict: 0.31 }); // calm: conflict below 0.4 → achieved
    const out = score(day, calm);
    const meter = goalMeter(day, calm);
    expect(meter.measured).toBe(out.measured);
    expect(meter.threshold).toBe(out.goal.threshold);
    expect(meter.direction).toBe(out.goal.direction);
    expect(meter.achieved).toBe(out.achieved);
  });

  test('progress01 is in [0,1] and is 1 (or capped) once achieved', () => {
    const achieved = goalMeter(makeDay({ conflict: 0.05 }), calm); // well below 0.4
    expect(achieved.progress01).toBeGreaterThanOrEqual(0);
    expect(achieved.progress01).toBeLessThanOrEqual(1);
    expect(achieved.achieved).toBe(true);
    expect(achieved.progress01).toBe(1); // past the threshold → full meter

    const missed = goalMeter(makeDay({ conflict: 0.95 }), calm); // far above 0.4
    expect(missed.progress01).toBeGreaterThanOrEqual(0);
    expect(missed.progress01).toBeLessThan(1);
    expect(missed.achieved).toBe(false);
  });

  test('progress01 grows monotonically as the day approaches the goal', () => {
    // conflict-below goal: a lower conflict is closer to (then past) the threshold.
    const far = goalMeter(makeDay({ conflict: 0.9 }), calm).progress01;
    const near = goalMeter(makeDay({ conflict: 0.5 }), calm).progress01;
    expect(near).toBeGreaterThan(far);
  });
});

describe('goalMeter — steering moves the meter both directions (GAME-03 / I-5)', () => {
  // A borderline density day: the activity sits just under the chaotic goal so the
  // bounded steering bias can pull `measured` across — proving steer→meter causality.
  const borderline = makeDay({ posts: 75, conflict: 0.4 });

  test('a toward-goal nudge raises measured + progress01', () => {
    const neutral = goalMeter({ ...borderline, steering: { branch: 0, symmetry: 0, hue: 0 } }, chaotic);
    const toward = goalMeter({ ...borderline, steering: { branch: 1, symmetry: 0, hue: 0 } }, chaotic);
    // density goal is 'above': branch lever +1 biases measured UP (toward the goal).
    expect(toward.measured).toBeGreaterThan(neutral.measured);
    expect(toward.progress01).toBeGreaterThan(neutral.progress01);
  });

  test('an away-from-goal nudge lowers measured + progress01', () => {
    const neutral = goalMeter({ ...borderline, steering: { branch: 0, symmetry: 0, hue: 0 } }, chaotic);
    const away = goalMeter({ ...borderline, steering: { branch: -1, symmetry: 0, hue: 0 } }, chaotic);
    expect(away.measured).toBeLessThan(neutral.measured);
    expect(away.progress01).toBeLessThan(neutral.progress01);
  });
});

describe('revealPreviewSteps — honest, score-backed preview (T-05-10)', () => {
  test('the preview outcome equals score() exactly (achieved + degree + goal)', () => {
    for (const [day, genome] of [
      [makeDay({ conflict: 0.31 }), calm],
      [makeDay({ posts: 88, conflict: 0.5 }), chaotic],
      [makeDay({ posts: 350, conflict: 0.2 }), crystalline],
    ] as const) {
      const preview = revealPreviewSteps(day, genome);
      const out = score(day, genome);
      expect(preview.achieved).toBe(out.achieved);
      expect(preview.degree).toBe(out.degree);
      expect(preview.goal).toEqual(out.goal);
    }
  });

  test('an achieved frontier plays freeze → resolve → reward', () => {
    const day = makeDay({ conflict: 0.1 }); // calm achieved (0.1 < 0.4)
    const steps = revealPreviewSteps(day, calm);
    expect(steps.achieved).toBe(true);
    expect(steps.phases).toEqual(['freeze', 'resolve', 'reward']);
  });

  test('a missed frontier plays freeze → resolve → miss', () => {
    const day = makeDay({ conflict: 0.95 }); // calm missed (0.95 > 0.4)
    const steps = revealPreviewSteps(day, calm);
    expect(steps.achieved).toBe(false);
    expect(steps.phases).toEqual(['freeze', 'resolve', 'miss']);
  });

  test('the preview is pure: same inputs → deeply equal result (no rng, no timers)', () => {
    const day = makeDay({ posts: 88, conflict: 0.5 });
    expect(revealPreviewSteps(day, chaotic)).toEqual(revealPreviewSteps(day, chaotic));
  });
});
