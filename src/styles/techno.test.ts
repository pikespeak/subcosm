// techno.test — the Techno StyleTemplate is valid, schema-parsed DATA (PNT-02).
//
// RED first: src/styles/techno.ts does not exist yet, so this import fails.
// GREEN: authoring techno.ts (StyleTemplateSchema.parse at module load) turns
// it green. The behaviour contract (PLAN 02-01 Task 2):
//   - importing techno does not throw (parse succeeds)
//   - id === 'techno'
//   - palette.ramp carries the cyan <-> magenta + warm-white stops
//   - motion.frontierOnly === true (drives PNT-04 reduced-motion in plan 03)
import { describe, expect, test } from 'vitest';
import { techno } from './techno';
import { StyleTemplateSchema } from '../engine/contracts';

describe('techno StyleTemplate (PNT-02)', () => {
  test('imports without throwing and is schema-valid', () => {
    expect(() => StyleTemplateSchema.parse(techno)).not.toThrow();
  });

  test('id is techno', () => {
    expect(techno.id).toBe('techno');
  });

  test('palette ramp carries the cyan, magenta and warm-white stops', () => {
    const ramp = techno.palette.ramp.map((c) => c.toLowerCase());
    expect(ramp).toContain('#46e0d8'); // cyan
    expect(ramp).toContain('#fff7e6'); // warm-white core
    // a magenta-family stop is present (the nebula counter-hue)
    expect(ramp.some((c) => /^#[ef][0-9a-f]2|^#e0|^#ff2|^#f0[0-9a-f]/.test(c) || c === '#ff4fd8')).toBe(
      true,
    );
  });

  test('motion is frontier-only (PNT-04 foundation)', () => {
    expect(techno.motion.frontierOnly).toBe(true);
  });
});
