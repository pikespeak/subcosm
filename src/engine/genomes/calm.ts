// calm — the Calm genome preset (decision D-01). DATA, not code.
//
// One of three presets (Calm / Chaotic / Crystalline) that share the Techno
// style and differ ONLY in genome data (TPL-01/TPL-03). Synthesis reads these
// knobs; it never branches on the preset name.
//
// Calm pole (D-01): low volatility, low density, mild conflict-reaction. The
// knobs synthesis actually exercises in Phase 1 are:
//   - baseVar.density  → star-count multiplier (mock's literal 0.30)
//   - baseVar.spread   → base radial spread     (mock's literal 0.18)
//   - volatility       → conflict→spread gain    (mock's literal 0.55)
//   - baseVar.symmetry → arm count at the calm/ordered pole
//
// GenomeSchema.parse() here is a legitimate module-load boundary (CLAUDE.md §6):
// preset data is validated once when imported; synthesis then trusts the type.
import { GenomeSchema, type Genome } from '../contracts';

export const calm: Genome = GenomeSchema.parse({
  version: 1,
  style: 'techno', // one style per community (TPL-04)

  palette: {
    space: 'oklch',
    ramp: ['#0a0e27', '#1b3b6f', '#4cc9f0', '#f1faee'],
  },

  // Signal→Param weights matrix: typed-but-unused in Phase 1 (D-05).
  weights: {},

  // Param → [min, max] ranges (typed surface; synthesis uses baseVar in Phase 1).
  ranges: {
    density: [0.18, 0.42],
    spread: [0.1, 0.4],
    symmetry: [1, 3],
  },

  // baseVar — the knobs synthesis exercises. Calm = low density, tight spread,
  // ordered (low) symmetry.
  baseVar: {
    density: 0.24, // < mock 0.30: fewer stars per post (calm/sparse)
    spread: 0.14, // < mock 0.18: tighter rings
    symmetry: 2, // ordered, few arms
  },

  volatility: 0.2, // low conflict-reaction (mock used 0.55)
  inheritance: 0.6, // moderate continuity between rings

  steerGain: {
    symmetry: 0.5,
    spread: 0.5,
  },

  rareTable: [{ prob: 0.02, mutation: 'bloom' }],
  allowedGenes: ['spike', 'bloom', 'aura'],

  dayBoundary: {
    tz: 'UTC',
    hour: 0,
    jitterMin: 5,
  },

  // GAME-01: the day's goal as data, legible at dawn. Scoring lands Phase 4.
  dailyGoal: {
    type: 'conflictBelow',
    targetParam: 'conflict',
    threshold: 0.4,
    direction: 'below',
  },

  actionCap: 3, // D-04 default
});
