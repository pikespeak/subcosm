// rng.test — sequence stability for mulberry32 (SYN-01 entropy contract).
//
// Proves the PRNG is deterministic: a fixed seed produces a known, stable
// first-N-values sequence, and two generators seeded identically march in
// lockstep. If this drifts, every Scene the engine produces drifts with it.
import { describe, expect, test } from 'vitest';
import { mulberry32 } from './rng';

describe('mulberry32 sequence stability', () => {
  test('a fixed seed produces a known, stable sequence', () => {
    const rng = mulberry32(123456789);
    const sequence = [rng(), rng(), rng(), rng(), rng()];

    // Golden values captured from the verbatim mock port (seed 123456789).
    expect(sequence).toEqual([
      0.2577907438389957, 0.9707721115555614, 0.7853280142880976,
      0.20616457983851433, 0.30307188746519387,
    ]);
  });

  test('values are floats in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('two generators with the same seed march in lockstep', () => {
    const a = mulberry32(987654321);
    const b = mulberry32(987654321);
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  test('different seeds diverge', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});
