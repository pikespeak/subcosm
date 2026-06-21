// ignite.test — the no-strobe guarantee, proven mathematically (D-04).
//
// igniteParams is a PURE function of (conflict, energy, time, speed). Because it
// has no Phaser/DOM/rng dependency we can sweep its entire input domain and assert
// the analytic bound the gentle-shimmer baseline rests on:
//   pulse ∈ [SHIMMER_BASE − AMPLITUDE_MAX, SHIMMER_BASE + AMPLITUDE_MAX], never 0.
// The legacy ignite swung [~0.10, 1.0] and read as a harsh on/off blink — described
// here by concept only (no literal formula reproduced), the new bound replaces it.
//
// Beyond the bound this asserts the DATA-DRIVEN differentiation (D-03):
//   conflict → amplitude/hardness (a stormy day pulses harder),
//   energy   → tempo (an energetic day shimmers faster),
// and that a calm day vs a high-conflict day produce measurably different pulse
// envelopes — the differentiation that makes success criterion #2 pass.
import { describe, expect, test } from 'vitest';
import {
  igniteParams,
  SHIMMER_BASE,
  AMPLITUDE_MAX,
  TWINKLE_BASE,
  TWINKLE_AMPLITUDE_MAX,
} from './ignite';

const CONFLICTS = [0, 0.25, 0.5, 0.75, 1];
const ENERGIES = [0, 0.25, 0.5, 0.75, 1];
const SPEEDS = [0, 0.5, 1, 2];
// A dense time sweep across many sine phases (ms). 600 samples over ~0..60s.
const TIMES = Array.from({ length: 600 }, (_, i) => i * 100);

describe('igniteParams no-strobe bound (D-04)', () => {
  test('pulse stays within [SHIMMER_BASE − AMPLITUDE_MAX, SHIMMER_BASE + AMPLITUDE_MAX] and never reaches 0', () => {
    const floor = SHIMMER_BASE - AMPLITUDE_MAX;
    const cap = SHIMMER_BASE + AMPLITUDE_MAX;
    // The floor itself must be comfortably away from 0 (the no-strobe margin).
    expect(floor).toBeGreaterThan(0.5);
    for (const conflict of CONFLICTS) {
      for (const energy of ENERGIES) {
        for (const speed of SPEEDS) {
          for (const time of TIMES) {
            const { pulse } = igniteParams(conflict, energy, time, speed);
            expect(pulse).toBeGreaterThan(0);
            // Allow a hair of float slack on the analytic bound.
            expect(pulse).toBeGreaterThanOrEqual(floor - 1e-9);
            expect(pulse).toBeLessThanOrEqual(cap + 1e-9);
          }
        }
      }
    }
    // Full-domain sweep with thousands of expect() calls — generous timeout so a
    // loaded full-suite run never flakes on the default 5s (the math is instant).
  }, 30_000);

  test('twinkle stays within its bounded band and never reaches 0', () => {
    const floor = TWINKLE_BASE - TWINKLE_AMPLITUDE_MAX;
    const cap = TWINKLE_BASE + TWINKLE_AMPLITUDE_MAX;
    expect(floor).toBeGreaterThan(0.5);
    for (const conflict of CONFLICTS) {
      for (const energy of ENERGIES) {
        for (const speed of SPEEDS) {
          for (const time of TIMES) {
            const { twinkle } = igniteParams(conflict, energy, time, speed);
            expect(twinkle).toBeGreaterThan(0);
            expect(twinkle).toBeGreaterThanOrEqual(floor - 1e-9);
            expect(twinkle).toBeLessThanOrEqual(cap + 1e-9);
          }
        }
      }
    }
  }, 30_000);
});

// Peak deviation of `pulse` from the shimmer base over a fixed window — a proxy
// for "how hard does this day pulse". Larger swing ⇒ harder/more dramatic ignite.
function peakAmplitude(conflict: number, energy: number, speed: number): number {
  let maxDev = 0;
  for (const time of TIMES) {
    const { pulse } = igniteParams(conflict, energy, time, speed);
    maxDev = Math.max(maxDev, Math.abs(pulse - SHIMMER_BASE));
  }
  return maxDev;
}

// Count sign changes of (pulse − SHIMMER_BASE) over the window — a proxy for tempo
// (how many times the shimmer crosses its rest level = how fast it breathes).
function crossings(conflict: number, energy: number, speed: number): number {
  let count = 0;
  let prevSign = 0;
  for (const time of TIMES) {
    const { pulse } = igniteParams(conflict, energy, time, speed);
    const sign = Math.sign(pulse - SHIMMER_BASE);
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) count++;
    if (sign !== 0) prevSign = sign;
  }
  return count;
}

describe('igniteParams data-driven differentiation (D-03)', () => {
  test('higher conflict produces a larger pulse amplitude (conflict → amplitude/hardness)', () => {
    const speed = 1;
    const energy = 0.5;
    const calmAmp = peakAmplitude(0, energy, speed);
    const midAmp = peakAmplitude(0.5, energy, speed);
    const stormAmp = peakAmplitude(1, energy, speed);
    expect(midAmp).toBeGreaterThan(calmAmp);
    expect(stormAmp).toBeGreaterThan(midAmp);
  });

  test('higher energy produces a faster shimmer tempo (energy → tempo)', () => {
    const speed = 1;
    const conflict = 0.5;
    const slow = crossings(conflict, 0, speed);
    const fast = crossings(conflict, 1, speed);
    expect(fast).toBeGreaterThan(slow);
  });

  test('a calm day and a high-conflict day produce measurably different pulse envelopes', () => {
    const speed = 1;
    const calmAmp = peakAmplitude(0, 0.2, speed);
    const stormAmp = peakAmplitude(1, 0.8, speed);
    // The two envelopes must differ by a meaningful margin (not just numerically).
    expect(stormAmp - calmAmp).toBeGreaterThan(0.05);
  });

  test('a calm day barely breathes (its amplitude is a small fraction of the cap)', () => {
    const calmAmp = peakAmplitude(0, 0, 1);
    expect(calmAmp).toBeLessThan(AMPLITUDE_MAX * 0.5);
  });
});
