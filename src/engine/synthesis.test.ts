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
import { synthesize, MIN_GAP, LEGIBILITY_FLOOR } from './synthesis';
import { render } from './render';
import { fixtureDays, calm } from '../../tests/fixtures';
import { StyleTemplateSchema } from './contracts';
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
  // decreasing AND each adjacent pair separated by at least MIN_GAP (no central
  // blob). Asserted at the fixture's shell count (N=3); the production target is
  // N≈30 — the clamped-min-gap floor scales with N so the guarantee holds there.
  test('radius is strictly decreasing with a guaranteed minimum gap (D-01)', () => {
    const scene = synthesize(fixtureDays, calm);
    const radii = scene.shells.map((s) => s.radius);
    expect(radii.length).toBeGreaterThan(1);
    for (let i = 1; i < radii.length; i++) {
      const gap = radii[i - 1]! - radii[i]!;
      // strictly decreasing
      expect(radii[i]!).toBeLessThan(radii[i - 1]!);
      // and never closer than the legibility floor gap (no-blob guarantee)
      expect(gap).toBeGreaterThanOrEqual(MIN_GAP - 1e-9);
    }
    // frontier (idx 0) is the largest ring
    expect(radii[0]).toBe(Math.max(...radii));
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
