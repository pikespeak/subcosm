// presets.test.ts — the TPL-03 proof: same DayVector[], three presets, diverging Scenes.
//
// This is the payoff of the architecture bet ("provably different worlds from the
// same data + config"). It runs the SHARED `fixtureDays` through `synthesize(...)`
// with each of the three genome presets (Calm / Chaotic / Crystalline) and asserts:
//   1. Calm vs Chaotic differ MEASURABLY — a shell's element count differs
//      (density knob → star count). This is the "visibly different universe" claim.
//   2. Calm vs Crystalline differ — JSON.stringify inequality (symmetry/volatility
//      knobs reshape the shell even where the count matches).
//   3. Each preset is INDEPENDENTLY deterministic — re-synthesizing the same preset
//      yields a byte-identical Scene (the SYN-02 guarantee survives adding presets).
//
// The divergence MUST come purely from genome DATA — synthesis.ts is byte-unchanged
// by this plan and contains no `preset ===` branch. If a knob did not move the
// Scene, the PRESET data was adjusted, never the engine.
import { describe, expect, test } from 'vitest';
import { synthesize } from './synthesis';
import type { Scene } from './contracts';
import { calm, chaotic, crystalline } from './genomes';
import { fixtureDays } from '../../tests/fixtures';

// Total element count across all shells — the simplest "how dense is this universe".
function totalElements(scene: Scene): number {
  return scene.shells.reduce((sum, shell) => sum + shell.elements.length, 0);
}

// Frontier (index 0 = newest day) element count.
function frontierElements(scene: Scene): number {
  return scene.shells[0]!.elements.length;
}

describe('TPL-03: three presets, same DayVector[], diverging Scenes', () => {
  test('all three presets parse as data and synthesize without throwing', () => {
    expect(() => synthesize(fixtureDays, calm)).not.toThrow();
    expect(() => synthesize(fixtureDays, chaotic)).not.toThrow();
    expect(() => synthesize(fixtureDays, crystalline)).not.toThrow();
    // Each shares the Techno style — divergence is genome data, not style.
    expect(calm.style).toBe('techno');
    expect(chaotic.style).toBe('techno');
    expect(crystalline.style).toBe('techno');
  });

  test('Calm vs Chaotic differ measurably in element density (TPL-03)', () => {
    const calmScene = synthesize(fixtureDays, calm);
    const chaoticScene = synthesize(fixtureDays, chaotic);

    // The density knob drives star count — Chaotic (dense pole) produces a
    // different frontier-shell element count than Calm (sparse pole).
    expect(frontierElements(calmScene)).not.toBe(frontierElements(chaoticScene));
    // And the universe as a whole is denser under Chaotic.
    expect(totalElements(chaoticScene)).toBeGreaterThan(totalElements(calmScene));
    // Whole-Scene inequality too (belt and suspenders).
    expect(JSON.stringify(calmScene)).not.toBe(JSON.stringify(chaoticScene));
  });

  test('Calm vs Crystalline differ (symmetry/volatility reshape the Scene) (TPL-03)', () => {
    const calmScene = synthesize(fixtureDays, calm);
    const crystallineScene = synthesize(fixtureDays, crystalline);

    // Crystalline's high-symmetry / low-volatility knobs reshape the shell —
    // JSON inequality proves the Scene diverges from Calm.
    expect(JSON.stringify(calmScene)).not.toBe(JSON.stringify(crystallineScene));
  });

  test('Chaotic vs Crystalline are themselves distinct poles (TPL-03)', () => {
    const chaoticScene = synthesize(fixtureDays, chaotic);
    const crystallineScene = synthesize(fixtureDays, crystalline);
    expect(JSON.stringify(chaoticScene)).not.toBe(JSON.stringify(crystallineScene));
  });

  test('each preset is independently deterministic (byte-identical re-synthesis)', () => {
    for (const preset of [calm, chaotic, crystalline]) {
      const a = synthesize(fixtureDays, preset);
      const b = synthesize(fixtureDays, preset);
      expect(a).toEqual(b); // structural deep-equal
      expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // key-order / byte-level
    }
  });
});
