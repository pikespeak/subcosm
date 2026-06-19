// generator.test — the simulator's two guarantees, proven (mirrors
// src/engine/synthesis.test.ts lines 1-50).
//
//   1. DETERMINISM (SIM-03): the same seed yields a byte-identical DayVector[],
//      asserted BOTH structurally (toEqual) AND at the byte level (JSON.stringify
//      equality, which catches object key-order drift — RESEARCH Pitfall 3).
//   2. SENSITIVITY (SIM-03): a different seed yields a visibly different (but
//      still well-told) universe.
//   3. SCHEMA-VALIDITY (SIM-02/QA-03): every emitted DayVector already satisfies
//      DayVectorSchema — the generator parsed at its OUTPUT boundary.
//   4. BEATS (SIM-01): the output data contains the required story beats —
//      a cold-start genesis day, exactly one drama spike, exactly one AMA day,
//      and quiet days — asserted on the DATA, not on internal beat indices.
//
// RED (Task 1): `generateDayVectors` does not exist yet, so this file fails to
// import. Task 2 implements the generator + beats table and turns it GREEN.
import { describe, expect, test } from 'vitest';
import { generateDayVectors } from './generator';
import { DayVectorSchema } from '../engine/contracts';

describe('generateDayVectors determinism (SIM-03)', () => {
  test('same seed → byte-identical DayVector[]', () => {
    const a = generateDayVectors({ seed: 12345 });
    const b = generateDayVectors({ seed: 12345 });
    expect(a).toEqual(b); // structural deep-equal
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // byte / key-order (SIM-03)
  });

  test('different seeds → a visibly different universe (SIM-03 sensitivity)', () => {
    const one = generateDayVectors({ seed: 1 });
    const two = generateDayVectors({ seed: 2 });
    expect(JSON.stringify(one)).not.toBe(JSON.stringify(two));
  });
});

describe('generateDayVectors schema-validity (SIM-02 / QA-03 — the output boundary)', () => {
  test('every emitted DayVector passes DayVectorSchema.parse without throwing', () => {
    const days = generateDayVectors({ seed: 777 });
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) {
      expect(() => DayVectorSchema.parse(d)).not.toThrow();
    }
  });

  test('the seed is threaded into every emitted day (config.seed drives generation)', () => {
    const days = generateDayVectors({ seed: 42 });
    // Each day carries an integer seed (the per-day seed derived from the master).
    for (const d of days) {
      expect(Number.isInteger(d.seed)).toBe(true);
    }
  });
});

describe('generateDayVectors story beats (SIM-01)', () => {
  const days = generateDayVectors({ seed: 2024 });

  test('produces a ~30-day arc with positive, ascending day numbers from genesis', () => {
    expect(days.length).toBeGreaterThanOrEqual(25);
    expect(days.length).toBeLessThanOrEqual(40);
    expect(days[0]!.day).toBe(1);
    for (let i = 0; i < days.length; i++) {
      expect(days[i]!.day).toBeGreaterThan(0);
      if (i > 0) expect(days[i]!.day).toBeGreaterThan(days[i - 1]!.day);
    }
  });

  test('day-1 cold-start is quiet and empty-array-safe (Pitfall 5)', () => {
    const genesis = days[0]!;
    expect(genesis.day).toBe(1);
    expect(genesis.posts).toBeLessThanOrEqual(5);
    // topThreads must NEVER be empty (a spread into Math.max would yield -Infinity).
    expect(genesis.topThreads.length).toBeGreaterThan(0);
    expect(Math.max(...genesis.topThreads)).toBeGreaterThan(0);
  });

  test('contains exactly one drama-spike day (high conflict)', () => {
    const dramaDays = days.filter((d) => d.conflict >= 0.7);
    expect(dramaDays.length).toBe(1);
  });

  test('contains exactly one AMA day (a few huge topThreads clusters)', () => {
    // An AMA produces a handful of HUGE threads that dwarf every other day —
    // distinct from the drama spike (whose largest thread is far smaller).
    const amaDays = days.filter(
      (d) => d.topThreads.length >= 1 && d.topThreads.length <= 5 && Math.max(...d.topThreads) >= 1000,
    );
    expect(amaDays.length).toBe(1);
  });

  test('contains quiet days (low activity beyond genesis)', () => {
    const quietDays = days.slice(1).filter((d) => d.posts < 30 && d.conflict < 0.3);
    expect(quietDays.length).toBeGreaterThan(0);
  });
});
