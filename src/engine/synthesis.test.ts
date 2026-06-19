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
import { synthesize } from './synthesis';
import { render } from './render';
import { fixtureDays, calm } from '../../tests/fixtures';
import { StyleTemplateSchema } from './contracts';

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

describe('render stub wires synthesis (ENG-04)', () => {
  test('render(days, genome, style) holds a Scene equal to synthesize(days, genome)', () => {
    const handle = render(fixtureDays, calm, minimalStyle);
    expect(handle.scene).toEqual(synthesize(fixtureDays, calm));
  });
});
