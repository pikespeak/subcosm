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
  STAR_FLOOR,
} from './synthesis';
import { render } from './render';
import { fixtureDays, calm } from '../../tests/fixtures';
import { generateDayVectors } from '../sim/generator';
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
// Frozen baseline of per-shell `elements` arrays for the fixture days. RE-BASELINED
// for VIS-DENSITY: raising STAR_FLOOR + adding STAR_BASELINE legitimately changes the
// per-day star COUNT (and therefore the rng draw count for those stars), so the dense
// fixtures now carry more elements. This snapshot is regenerated from the current
// `synthesize` output; its job is the DETERMINISM guard — same seed reproduces the same
// elements byte-for-byte (a stray non-density rng() call, or any per-element drift at a
// FIXED count, still fails loudly). It is NO LONGER the "elements unchanged vs VIS-DEPTH"
// guard (that intent was geometry-only; VIS-DENSITY is allowed to change counts).
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

  // Determinism guard (re-baselined for VIS-DENSITY): each shell's `elements` array
  // must deep-equal the (regenerated) baseline. VIS-DENSITY legitimately changed the
  // star COUNT per day, but at that fixed count every element's angle/r/energy/conflict
  // must still be byte-reproducible from the seed — if any per-element value drifted, a
  // stray non-density rng() call slipped in (RNG consumption order changed) → fails loudly.
  test('per-shell elements arrays are byte-reproducible vs the re-baselined snapshot (determinism)', () => {
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

describe('synthesize density (VIS-DENSITY)', () => {
  // Every NON-genesis shell across the FULL scripted sim arc must read as a populated
  // cluster — at least STAR_FLOOR stars — even on the quietest days (beats day-30 ≈ 9
  // posts). Genesis (day-1) is core-only by contract and is exempt. Driven through the
  // real generator + a fixed master seed so the assertion runs over the actual emitted
  // DayVectors (jitter included), not the raw beat means.
  test('every non-genesis shell across the sim arc has ≥ STAR_FLOOR stars', () => {
    const days = generateDayVectors({ seed: 0xc05c01c });
    const scene = synthesize(days, calm);
    for (const shell of scene.shells) {
      if (shell.day === 1) {
        expect(shell.elements).toEqual([]); // genesis stays core-only
        continue;
      }
      expect(shell.elements.length).toBeGreaterThanOrEqual(STAR_FLOOR);
    }
  });

  // Contrast preserved: a busy drama day (beats day-12, ≈92 posts) must carry CLEARLY
  // more stars than a quiet tail day (beats day-30, ≈9 posts). Locks "populated but
  // still contrasted" — the floor lifts the quiet day, it does not flatten the arc.
  test('a busy day has clearly more stars than a quiet day (contrast preserved)', () => {
    const days = generateDayVectors({ seed: 0xc05c01c });
    const scene = synthesize(days, calm);
    const dramaDay = scene.shells.find((s) => s.day === 12)!;
    const quietDay = scene.shells.find((s) => s.day === 30)!;
    expect(dramaDay).toBeDefined();
    expect(quietDay).toBeDefined();
    // quiet day sits at the floor; the busy day must be meaningfully denser.
    expect(quietDay.elements.length).toBe(STAR_FLOOR);
    expect(dramaDay.elements.length).toBeGreaterThan(quietDay.elements.length);
    // "clearly" more — not a 1-star difference; the busy day is at least ~1.4x denser.
    expect(dramaDay.elements.length).toBeGreaterThanOrEqual(
      Math.ceil(quietDay.elements.length * 1.4),
    );
  });

  // The cap (112) is intact: the densest fixture day (410 posts) never exceeds it.
  test('the per-day star count never exceeds the 112 cap', () => {
    const scene = synthesize(fixtureDays, calm);
    for (const shell of scene.shells) {
      expect(shell.elements.length).toBeLessThanOrEqual(112);
    }
  });
});

describe('render stub wires synthesis (ENG-04)', () => {
  test('render(days, genome, style) holds a Scene equal to synthesize(days, genome)', () => {
    const handle = render(fixtureDays, calm, minimalStyle);
    expect(handle.scene).toEqual(synthesize(fixtureDays, calm));
  });
});
