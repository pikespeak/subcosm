// score.test — the deterministic scoring spine, proven (GAME-02 / LIVE-03 / OQ1).
//
// Three guarantees:
//   1. DETERMINISM (LIVE-03 / D-09): score(day, genome) called twice with the
//      same inputs is deeply equal — a pure function, no rng, no I/O. A second
//      client re-derives the identical verdict.
//   2. RE-USE (LIVE-03): the scorer measures with synthesis's OWN starCount /
//      deriveArms, so the metric the player chases is exactly the one painted.
//   3. ACHIEVABILITY (OQ1): each genome's fixed goal is reachable-but-not-automatic
//      — achieved on at least one plausible day and missed on at least one — and
//      `degree` is always in [0,1], never NaN.
import { describe, expect, test } from 'vitest';
import { score, STEER_BIAS_CAP } from './score';
import { starCount, deriveArms } from './synthesis';
import { OutcomeSchema, type DayVector, type Steering } from './contracts';
import { calm, chaotic, crystalline } from './genomes';
import { generateDayVectors } from '../sim/generator';

// A minimal valid DayVector builder for the constructed-day assertions. The sim
// arc maxes out ~90 posts, so the symmetry goal (deriveArms needs posts>300 for
// a 6th arm) is exercised with explicit high-activity days here — a genuinely
// busy community day, not the gentle simulator beats (reachable-but-not-automatic).
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

describe('score — purity / output shape', () => {
  test('the returned object satisfies OutcomeSchema', () => {
    const out = score(makeDay(), calm);
    expect(() => OutcomeSchema.parse(out)).not.toThrow();
  });

  test('outcome.goal === the genome dailyGoal', () => {
    expect(score(makeDay(), calm).goal).toEqual(calm.dailyGoal);
    expect(score(makeDay(), chaotic).goal).toEqual(chaotic.dailyGoal);
    expect(score(makeDay(), crystalline).goal).toEqual(crystalline.dailyGoal);
  });
});

describe('score — determinism (LIVE-03 / D-09)', () => {
  test('same inputs → deeply equal outcome', () => {
    const day = makeDay({ conflict: 0.33, posts: 88 });
    const a = score(day, chaotic);
    const b = score(day, chaotic);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('score — re-uses synthesis derivations (LIVE-03)', () => {
  test('conflict goal measures day.conflict directly', () => {
    const day = makeDay({ conflict: 0.31 });
    const out = score(day, calm); // calm: conflict below 0.4
    expect(out.measured).toBe(0.31);
    expect(out.achieved).toBe(true); // 0.31 < 0.4
  });

  test('a conflict above the threshold misses (direction below)', () => {
    const out = score(makeDay({ conflict: 0.9 }), calm);
    expect(out.achieved).toBe(false);
  });

  test('symmetry goal measures deriveArms exactly (integer arm count)', () => {
    const busy = makeDay({ posts: 350, conflict: 0.2 });
    const out = score(busy, crystalline); // symmetry above 5
    expect(out.measured).toBe(deriveArms(busy, crystalline));
    expect(out.measured).toBe(6); // posts>300 → symmetry+1
    expect(out.achieved).toBe(true); // 6 > 5
  });

  test('symmetry on a normal day misses (arms === knob, not above)', () => {
    const normal = makeDay({ posts: 80, conflict: 0.2 });
    const out = score(normal, crystalline);
    expect(out.measured).toBe(5); // knob symmetry, not above 5
    expect(out.achieved).toBe(false);
  });

  test('density goal measures the normalized starCount band', () => {
    const day = makeDay({ posts: 89 });
    const out = score(day, chaotic); // density above 0.7 (normalized)
    // measured is a normalized 0..1 number, not the raw star count.
    expect(out.measured).toBeGreaterThanOrEqual(0);
    expect(out.measured).toBeLessThanOrEqual(1);
    // raw star count is what synthesis paints.
    const raw = starCount(day.posts, chaotic.baseVar.density ?? 0.3);
    expect(raw).toBeGreaterThan(0);
  });
});

describe('score — degree bounds', () => {
  const goalDays: Array<[string, DayVector, typeof calm]> = [
    ['calm low conflict', makeDay({ conflict: 0.05 }), calm],
    ['calm high conflict', makeDay({ conflict: 0.95 }), calm],
    ['chaotic dense', makeDay({ posts: 89 }), chaotic],
    ['chaotic quiet', makeDay({ posts: 5 }), chaotic],
    ['crystalline busy', makeDay({ posts: 350 }), crystalline],
    ['crystalline normal', makeDay({ posts: 60 }), crystalline],
  ];
  test.each(goalDays)('degree ∈ [0,1] and finite for %s', (_label, day, genome) => {
    const out = score(day, genome);
    expect(out.degree).toBeGreaterThanOrEqual(0);
    expect(out.degree).toBeLessThanOrEqual(1);
    expect(Number.isNaN(out.degree)).toBe(false);
  });
});

describe('score — achievability across the sim arc (OQ1)', () => {
  const days = generateDayVectors({ seed: 0xc05c01c });

  // Calm + Chaotic goals must be reachable-but-not-automatic over the REAL
  // generated arc (conflict varies, density spans quiet→drama).
  test.each([
    ['calm', calm],
    ['chaotic', chaotic],
  ] as const)('%s goal is achieved on ≥1 and missed on ≥1 sim day', (_label, genome) => {
    const outcomes = days.map((d) => score(d, genome));
    const achievedCount = outcomes.filter((o) => o.achieved).length;
    const missedCount = outcomes.filter((o) => !o.achieved).length;
    expect(achievedCount).toBeGreaterThan(0); // reachable
    expect(missedCount).toBeGreaterThan(0); // not automatic
    for (const o of outcomes) {
      expect(o.degree).toBeGreaterThanOrEqual(0);
      expect(o.degree).toBeLessThanOrEqual(1);
    }
  });

  // Crystalline's symmetry goal needs a genuinely busy day (posts>300) — beyond
  // the gentle sim arc. Proven with explicit constructed days: a huge day reaches
  // it, a normal day does not (reachable-but-not-automatic).
  test('crystalline symmetry goal is reachable-but-not-automatic', () => {
    const huge = makeDay({ posts: 350, conflict: 0.2 });
    const normal = makeDay({ posts: 70, conflict: 0.2 });
    expect(score(huge, crystalline).achieved).toBe(true);
    expect(score(normal, crystalline).achieved).toBe(false);
    // and missed across the whole gentle sim arc (none exceed 300 posts).
    const simAchieved = days.filter((d) => score(d, crystalline).achieved).length;
    expect(simAchieved).toBe(0);
  });
});

// ── GAME-03 + I-5: the steering → scored-outcome link ──────────────────────────
//
// The scorer now reads the ALREADY-FOLDED `day.steering` as a BOUNDED, direction-
// aware contribution (score.ts steerContribution / STEER_BIAS_CAP). These tests
// prove the link is REAL (a borderline day moves with steering, both directions),
// that the bound HOLDS (a clear day never flips under MAXIMUM/extreme steering —
// I-5: biases, never dictates), and that determinism survives a non-zero steering.
//
// Lever mapping under test (mirrors score.ts): symmetry goal → steering.symmetry;
// density / conflict goals → steering.branch. A POSITIVE lever is always the
// toward-goal nudge; a NEGATIVE lever is away-from-goal.
describe('score — steering → outcome link (GAME-03)', () => {
  // The lever each genome's goal reads, and a builder that drives it.
  const steer = (over: Partial<Steering>): Steering => ({
    branch: 0,
    symmetry: 0,
    hue: 0,
    ...over,
  });
  // A toward-goal (+1) and away-from-goal (-1) full nudge on the goal's lever.
  const towardLever = (param: string, mag: number): Partial<Steering> =>
    param === 'symmetry' ? { symmetry: mag } : { branch: mag };

  // BORDERLINE days: just on the MISSING side of each threshold with zero steering.
  //   calm    conflict 0.45  (misses <0.40 by 0.05  < cap 0.15)
  //   chaotic 80 posts → density (80*0.4+10-18)/(55-18)=0.648 (misses >0.70 by ~0.05)
  //   crystalline 5 arms      (misses >5 — equal is not above; +0.6 arm clears it)
  const borderline: Array<[string, typeof calm, DayVector, string]> = [
    ['calm (conflict)', calm, makeDay({ conflict: 0.45 }), 'conflict'],
    ['chaotic (density)', chaotic, makeDay({ posts: 80 }), 'density'],
    ['crystalline (symmetry)', crystalline, makeDay({ posts: 80, conflict: 0.2 }), 'symmetry'],
  ];

  test.each(borderline)(
    'POSITIVE: %s borderline day flips MISS→ACHIEVE under full toward-goal steering',
    (_label, genome, day, param) => {
      const goalFavorable = genome.dailyGoal.direction === 'above';

      const unsteered = score({ ...day, steering: steer({}) }, genome);
      const steered = score(
        { ...day, steering: steer(towardLever(param, 1)) },
        genome,
      );

      // the unsteered borderline day MISSES; the toward-goal nudge flips it.
      expect(unsteered.achieved).toBe(false);
      expect(steered.achieved).toBe(true);

      // measured moved in the goal-favorable direction by a measurable amount.
      if (goalFavorable) {
        expect(steered.measured).toBeGreaterThan(unsteered.measured);
      } else {
        expect(steered.measured).toBeLessThan(unsteered.measured);
      }
    },
  );

  test.each(borderline)(
    'POSITIVE: %s away-from-goal steering lowers measured (moves AWAY from the goal)',
    (_label, genome, day, param) => {
      const goalFavorable = genome.dailyGoal.direction === 'above';

      const unsteered = score({ ...day, steering: steer({}) }, genome);
      const away = score(
        { ...day, steering: steer(towardLever(param, -1)) },
        genome,
      );

      // an away-from-goal nudge moves measured in the UNfavorable direction.
      if (goalFavorable) {
        expect(away.measured).toBeLessThan(unsteered.measured);
      } else {
        expect(away.measured).toBeGreaterThan(unsteered.measured);
      }
      // and it can never help a borderline-missing day achieve.
      expect(away.achieved).toBe(false);
    },
  );

  // BOUND / never-dictates (I-5): a CLEAR day's verdict is UNCHANGED even under an
  // EXTREME lever (±10) — proving the saturate-then-clamp holds regardless of input.
  //   clear-FAILED:  calm conflict 0.95; chaotic 5 posts; crystalline 4 arms (posts<300, conflict<0.7)
  //   clear-ACHIEVED: calm conflict 0.05; chaotic 350 posts; crystalline 6 arms (posts>300)
  const clearFailed: Array<[string, typeof calm, DayVector, string]> = [
    ['calm (conflict 0.95)', calm, makeDay({ conflict: 0.95 }), 'conflict'],
    ['chaotic (5 posts)', chaotic, makeDay({ posts: 5 }), 'density'],
    ['crystalline (4 arms)', crystalline, makeDay({ posts: 60, conflict: 0.9 }), 'symmetry'],
  ];
  const clearAchieved: Array<[string, typeof calm, DayVector, string]> = [
    ['calm (conflict 0.05)', calm, makeDay({ conflict: 0.05 }), 'conflict'],
    ['chaotic (350 posts)', chaotic, makeDay({ posts: 350 }), 'density'],
    ['crystalline (6 arms)', crystalline, makeDay({ posts: 350, conflict: 0.2 }), 'symmetry'],
  ];

  test.each(clearFailed)(
    'BOUND (I-5): %s clear-failed day stays achieved=false under MAXIMUM toward-goal steering (±10 clamps)',
    (_label, genome, day, param) => {
      // sanity: it is genuinely failing with zero steering.
      expect(score({ ...day, steering: steer({}) }, genome).achieved).toBe(false);
      // extreme toward-goal steering (±10) cannot manufacture a win.
      const steered = score(
        { ...day, steering: steer(towardLever(param, 10)) },
        genome,
      );
      expect(steered.achieved).toBe(false);
    },
  );

  test.each(clearAchieved)(
    'BOUND (I-5): %s clear-achieved day stays achieved=true under MAXIMUM away-from-goal steering (±10 clamps)',
    (_label, genome, day, param) => {
      // sanity: it is genuinely achieving with zero steering.
      expect(score({ ...day, steering: steer({}) }, genome).achieved).toBe(true);
      // extreme away-from-goal steering (±10) cannot throw a clear win.
      const thrown = score(
        { ...day, steering: steer(towardLever(param, -10)) },
        genome,
      );
      expect(thrown.achieved).toBe(true);
    },
  );

  test('BOUND (I-5): an extreme lever shift never exceeds STEER_BIAS_CAP × goal span', () => {
    // conflict/density span = 1 → max |shift| = 0.15; symmetry span = 4 → 0.6.
    const calmDay = makeDay({ conflict: 0.5 });
    const calmBase = score({ ...calmDay, steering: steer({}) }, calm).measured;
    const calmExtreme = score({ ...calmDay, steering: steer({ branch: 10 }) }, calm).measured;
    expect(Math.abs(calmExtreme - calmBase)).toBeLessThanOrEqual(STEER_BIAS_CAP + 1e-9);

    const crysDay = makeDay({ posts: 80, conflict: 0.2 });
    const crysBase = score({ ...crysDay, steering: steer({}) }, crystalline).measured;
    const crysExtreme = score({ ...crysDay, steering: steer({ symmetry: 10 }) }, crystalline).measured;
    const symSpan = 2 * 2; // 2 × SYMMETRY_DEGREE_SPAN
    expect(Math.abs(crysExtreme - crysBase)).toBeLessThanOrEqual(STEER_BIAS_CAP * symSpan + 1e-9);
  });

  test('DETERMINISM: a non-zero-steering day → deeply-equal AND byte-identical Outcome', () => {
    const day = makeDay({ conflict: 0.45, steering: steer({ branch: 0.7, symmetry: 0.3, hue: 0.2 }) });
    const a = score(day, calm);
    const b = score(day, calm);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('zero steering is a no-op: the activity base is unchanged (prior behavior preserved)', () => {
    // a day with all-zero steering scores exactly as the activity base (offset 0).
    const day = makeDay({ conflict: 0.31 });
    expect(score(day, calm).measured).toBe(0.31);
  });
});
