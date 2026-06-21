// Outcome contract — unit tests (RED first).
//
// OutcomeSchema is the typed scoring result (D-02): the resolved daily goal, the
// measured metric at freeze, the achieved verdict, and a 0..1 degree. These tests
// pin the boundary: a valid outcome parses, a degree out of [0,1] is rejected, an
// absent `achieved` is rejected, and DayVector accepts the firmed outcome (or its
// absence on the live frontier). Mirrors the contract-test discipline of the repo.
import { describe, expect, test } from 'vitest';
import { OutcomeSchema } from './Outcome';
import { DayVectorSchema } from './DayVector';

const validGoal = {
  type: 'conflictBelow' as const,
  targetParam: 'conflict',
  threshold: 0.4,
  direction: 'below' as const,
};

const validOutcome = {
  goal: validGoal,
  measured: 0.31,
  achieved: true,
  degree: 0.5,
};

describe('OutcomeSchema', () => {
  test('parses a well-formed outcome', () => {
    expect(() => OutcomeSchema.parse(validOutcome)).not.toThrow();
    const parsed = OutcomeSchema.parse(validOutcome);
    expect(parsed.achieved).toBe(true);
    expect(parsed.degree).toBe(0.5);
    expect(parsed.goal).toEqual(validGoal);
  });

  test('rejects degree > 1', () => {
    expect(() => OutcomeSchema.parse({ ...validOutcome, degree: 2 })).toThrow();
  });

  test('rejects degree < 0', () => {
    expect(() => OutcomeSchema.parse({ ...validOutcome, degree: -0.1 })).toThrow();
  });

  test('rejects an absent achieved', () => {
    const { achieved: _omit, ...noAchieved } = validOutcome;
    expect(() => OutcomeSchema.parse(noAchieved)).toThrow();
  });

  test('rejects a non-number measured', () => {
    expect(() =>
      OutcomeSchema.parse({ ...validOutcome, measured: 'x' }),
    ).toThrow();
  });
});

describe('DayVector.outcome (firmed)', () => {
  const baseDay = {
    day: 4,
    date: '2026-01-04',
    posts: 12,
    comments: 30,
    contributors: 5,
    scoreSum: 42,
    topThreads: [8, 5, 2],
    conflict: 0.31,
    momentum: 0.1,
    diversity: 0.3,
    dominantTheme: 'community',
    steering: { branch: 0, symmetry: 0, hue: 0 },
    seed: 123,
  };

  test('parses a DayVector carrying a valid outcome (frozen ring)', () => {
    expect(() =>
      DayVectorSchema.parse({ ...baseDay, outcome: validOutcome }),
    ).not.toThrow();
  });

  test('parses a DayVector with outcome omitted (live frontier)', () => {
    expect(() => DayVectorSchema.parse(baseDay)).not.toThrow();
  });

  test('rejects a DayVector with a malformed outcome (degree 2)', () => {
    expect(() =>
      DayVectorSchema.parse({
        ...baseDay,
        outcome: { ...validOutcome, degree: 2 },
      }),
    ).toThrow();
  });
});

describe('barrel export', () => {
  test('OutcomeSchema and Outcome resolve from the contracts barrel', async () => {
    const mod = await import('./index');
    expect(mod.OutcomeSchema).toBeDefined();
    expect(() => mod.OutcomeSchema.parse(validOutcome)).not.toThrow();
  });
});
