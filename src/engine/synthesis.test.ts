// synthesis.test — the architecture bet, proven.
//
// Two guarantees the whole engine rests on:
//   1. DETERMINISM (SYN-01/SYN-02): identical DayVector[] + Genome → a
//      byte-identical Scene, asserted BOTH structurally (toEqual) AND at the
//      byte level (JSON.stringify equality, which catches object key-order drift
//      — RESEARCH Pitfall 3).
//   2. DATA-SENSITIVITY (SYN-04): changing the community data visibly changes
//      the Scene — a sparse cold-start day yields fewer elements than a dense day.
//
// In Task 1 (RED) `synthesize` does not exist yet, so this file fails to import.
// Task 2 implements synthesize + render and turns it GREEN.
import { describe, expect, test } from 'vitest';
import {
  synthesize,
  minGapFor,
  RADIUS_FLOOR,
  LEGIBILITY_FLOOR,
} from './synthesis';
import { render } from './render';
import { fixtureDays, calm } from '../../tests/fixtures';
import { DayVectorSchema, type DayVector } from './contracts';
import { StyleTemplateSchema } from './contracts';

// Build a synthetic, newest-first DayVector[] of `n` days for the at-scale
// geometry assertions (CR-01 / WR-04). The fixtures only cover N=3, which never
// reaches the deep-ring regime where the old falloff went negative; this lets the
// geometry contract be proven at the production target N≈30 (and beyond). Values
// vary per day so it is not a degenerate uniform case, but they never matter to
// shellRadius (which reads only idx / n) — the variety just exercises shellWeight.
function syntheticDays(n: number): DayVector[] {
  const days: DayVector[] = [];
  for (let i = 0; i < n; i++) {
    const dayNumber = n - i; // newest first: idx 0 = highest day number, idx n-1 = day 1
    days.push(
      DayVectorSchema.parse({
        day: dayNumber,
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        posts: 50 + (i % 100),
        comments: 100 + i * 3,
        contributors: 10 + (i % 50),
        scoreSum: 200 + i * 5,
        topThreads: [120 + i, 60, 30],
        conflict: (i % 10) / 10,
        momentum: ((i % 5) - 2) / 2,
        diversity: (i % 7) / 6,
        dominantTheme: `theme-${i}`,
        steering: { branch: 0.1, symmetry: 1, hue: (i % 9) / 9 },
        seed: 0x1000 + i,
      }),
    );
  }
  return days;
}
// Frozen pre-D-01 baseline of per-shell `elements` arrays, captured from the
// ORIGINAL (Math.pow(0.85, idx)) synthesize output before the geometry change.
// VIS-DEPTH must change ONLY `radius` (+ the new `weight`); element positions/
// energies stay byte-identical (proves zero new rng() calls — RESEARCH Pitfall 1).
import elementsBaseline from '../../tests/synthesis-elements-baseline.json';

// Minimal valid StyleTemplate for the render-stub assertion. Synthesis never
// reads it; render only forwards days+genome to synthesize in Phase 1.
const minimalStyle = StyleTemplateSchema.parse({
  id: 'techno',
  substrate: 'dark',
  palette: { space: 'oklch', ramp: ['#000', '#fff'] },
  line: { width: 1, join: 'round', alpha: 1 },
  fill: { mode: 'solid', alpha: 1 },
  texture: { kind: 'none', scale: 1 },
  genes: { spike: 'line' },
  postFX: { bloom: 0.2, grain: 0.1 },
  motion: { frontierOnly: true, speed: 1 },
  type: { family: 'mono', weight: 400 },
});

describe('synthesize determinism (SYN-01/SYN-02)', () => {
  test('same inputs → byte-identical Scene', () => {
    const a = synthesize(fixtureDays, calm);
    const b = synthesize(fixtureDays, calm);
    expect(a).toEqual(b); // structural deep-equal
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // byte / key-order
  });
});

describe('synthesize data-sensitivity (SYN-04)', () => {
  test('a sparse cold-start day yields fewer elements than a dense day', () => {
    const scene = synthesize(fixtureDays, calm);
    // shells are in days[] order: [0]=dense high-conflict, [2]=cold-start day-1.
    const denseShell = scene.shells[0]!;
    const coldShell = scene.shells[2]!;
    expect(coldShell.elements.length).toBeLessThan(denseShell.elements.length);
  });

  test('the genesis (day-1) shell carries no elements — core only', () => {
    const scene = synthesize(fixtureDays, calm);
    const coldShell = scene.shells[2]!;
    expect(coldShell.day).toBe(1);
    expect(coldShell.elements).toEqual([]);
  });
});

describe('synthesize depth geometry + weight (VIS-DEPTH / D-01, D-02)', () => {
  // D-01: every ring individually distinguishable to the core — radius strictly
  // decreasing AND each adjacent pair separated by at least minGapFor(N) (no
  // central blob). The expected gap is derived PER-N via minGapFor (never a
  // hardcoded N=3 value), so the same assertion holds at any shell count.
  test('radius is strictly decreasing with a guaranteed minimum gap (D-01)', () => {
    const scene = synthesize(fixtureDays, calm);
    const radii = scene.shells.map((s) => s.radius);
    const minGap = minGapFor(radii.length);
    expect(radii.length).toBeGreaterThan(1);
    for (let i = 1; i < radii.length; i++) {
      const gap = radii[i - 1]! - radii[i]!;
      // strictly decreasing
      expect(radii[i]!).toBeLessThan(radii[i - 1]!);
      // and never closer than the per-N min gap (no-blob guarantee)
      expect(gap).toBeGreaterThanOrEqual(minGap - 1e-9);
    }
    // frontier (idx 0) is the largest ring
    expect(radii[0]).toBe(Math.max(...radii));
  });

  // CR-01 regression: at the PRODUCTION target N≈30 (and beyond), the old falloff
  // drove the deepest rings negative — colliding with / sinking into the genesis
  // core (radius 0.06) and silently dropping the oldest shell in paint. These
  // at-scale cases assert the geometry contract the N=3 fixture cannot reach.
  test.each([1, 2, 3, 30, 50, 80])(
    'depth geometry holds at N=%i (CR-01 / WR-04)',
    (n) => {
      const scene = synthesize(syntheticDays(n), calm);
      const radii = scene.shells.map((s) => s.radius);
      const core = scene.core.radius; // 0.06
      const minGap = minGapFor(n);

      expect(radii.length).toBe(n);
      // every radius is strictly positive AND a clear margin above the core, so no
      // ring collides with the genesis core or stacks into a central blob (D-01).
      // The innermost ring lands near RADIUS_FLOOR (0.12) — comfortably above the
      // core (0.06); we assert the meaningful invariant (well clear of the core)
      // rather than pinning the exact floor, since the min-gap pull can settle a
      // hair below RADIUS_FLOOR at very high N while staying far above the core.
      const coreMargin = (RADIUS_FLOOR - core) / 2; // 0.03 — half the headroom
      for (const r of radii) {
        expect(r).toBeGreaterThan(0);
        expect(r).toBeGreaterThan(core + coreMargin);
        expect(Number.isNaN(r)).toBe(false);
      }
      // strictly decreasing + per-N min gap honored at every adjacent pair.
      for (let i = 1; i < radii.length; i++) {
        const gap = radii[i - 1]! - radii[i]!;
        expect(radii[i]!).toBeLessThan(radii[i - 1]!);
        expect(gap).toBeGreaterThanOrEqual(minGap - 1e-9);
      }
      // frontier (idx 0) is the largest; oldest (idx n-1) is the smallest.
      expect(radii[0]).toBe(Math.max(...radii));
      expect(radii[n - 1]).toBe(Math.min(...radii));
    },
  );

  // N=1 edge: a single frontier shell with no inner gap, no division-by-zero.
  test('single-shell universe (N=1) has one positive radius above the core', () => {
    const scene = synthesize(syntheticDays(1), calm);
    expect(scene.shells.length).toBe(1);
    const r = scene.shells[0]!.radius;
    expect(r).toBeGreaterThan(scene.core.radius);
    expect(Number.isNaN(r)).toBe(false);
    expect(minGapFor(1)).toBe(0); // no inner gap to enforce
  });

  // D-02: every shell carries a bounded weight ≥ legibility floor (nothing fades
  // to illegible, including the oldest/genesis shell).
  test('every shell carries a weight ≥ LEGIBILITY_FLOOR (D-02)', () => {
    const scene = synthesize(fixtureDays, calm);
    for (const shell of scene.shells) {
      expect(typeof shell.weight).toBe('number');
      expect(shell.weight).toBeGreaterThanOrEqual(LEGIBILITY_FLOOR - 1e-9);
      expect(shell.weight).toBeLessThanOrEqual(1);
    }
  });

  // Pitfall 1 guard: the depth change must touch ONLY radius (+ the new weight).
  // Each shell's `elements` array must deep-equal the frozen pre-change baseline.
  // If any element angle/r/energy/conflict drifted, a stray rng() call slipped in
  // (RNG consumption order changed) → this fails loudly.
  test('per-shell elements arrays are byte-unchanged vs the pre-D-01 baseline (Pitfall 1)', () => {
    const scene = synthesize(fixtureDays, calm);
    const elements = scene.shells.map((s) => s.elements);
    expect(elements).toEqual(elementsBaseline);
    // byte-level too (catches numeric/key-order drift JSON would surface)
    expect(JSON.stringify(elements)).toBe(JSON.stringify(elementsBaseline));
  });

  // Standout days keep accents: the high-conflict dense day (fixtures[0]) should
  // carry more weight than the calm AMA day (fixtures[1]) at the same/adjacent age,
  // i.e. conflict lifts weight above pure age-fade.
  test('a high-conflict day keeps a higher weight than a calm later day (D-02 accent)', () => {
    const scene = synthesize(fixtureDays, calm);
    const denseShell = scene.shells[0]!; // day-44, conflict 0.85 (frontier)
    const amaShell = scene.shells[1]!; // day-36, conflict 0.2
    expect(denseShell.weight).toBeGreaterThan(amaShell.weight);
  });
});

describe('render stub wires synthesis (ENG-04)', () => {
  test('render(days, genome, style) holds a Scene equal to synthesize(days, genome)', () => {
    const handle = render(fixtureDays, calm, minimalStyle);
    expect(handle.scene).toEqual(synthesize(fixtureDays, calm));
  });
});
