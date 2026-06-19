// chaotic — the Chaotic genome preset (decision D-01). DATA, not code.
//
// One of three presets (Calm / Chaotic / Crystalline) that share the Techno
// style and differ ONLY in genome data (TPL-01/TPL-03). Synthesis reads these
// knobs; it never branches on the preset name.
//
// Chaotic pole (D-01): the MAX-CONTRAST opposite of Calm — high volatility,
// high density, strong conflict-reaction, low inheritance (little continuity
// between rings). The knobs synthesis actually exercises in Phase 1:
//   - baseVar.density  → star-count multiplier (Calm 0.24 → here 0.40: dense)
//   - baseVar.spread   → base radial spread     (Calm 0.14 → here 0.34: loose)
//   - volatility       → conflict→spread gain    (Calm 0.20 → here 0.92: turbulent)
//   - baseVar.symmetry → arm count (low/few arms → conflict-driven clumping)
//
// Tuned so the divergence proof (presets.test.ts) shows a VISIBLE difference:
// at 0.40 density the dense fixture day saturates more stars than Calm's 0.24,
// and the high volatility/spread reshapes the whole Scene.
//
// GenomeSchema.parse() here is a legitimate module-load boundary (CLAUDE.md §6):
// preset data is validated once when imported; synthesis then trusts the type.
import { GenomeSchema, type Genome } from '../contracts';

export const chaotic: Genome = GenomeSchema.parse({
  version: 1,
  style: 'techno', // one style per community (TPL-04) — same style as Calm

  palette: {
    space: 'oklch',
    ramp: ['#220011', '#7a0040', '#ff2d6f', '#ffd166'],
  },

  // Signal→Param weights matrix: typed-but-unused in Phase 1 (D-05).
  weights: {},

  // Param → [min, max] ranges (typed surface; synthesis uses baseVar in Phase 1).
  ranges: {
    density: [0.3, 0.6],
    spread: [0.25, 0.6],
    symmetry: [1, 2],
  },

  // baseVar — the knobs synthesis exercises. Chaotic = high density, loose
  // spread, low (clumped) symmetry: the opposite pole from Calm.
  baseVar: {
    density: 0.4, // > Calm 0.24: many more stars per post (dense/turbulent)
    spread: 0.34, // > Calm 0.14: rings bleed into each other
    symmetry: 1, // few arms → conflict-driven clumping dominates
  },

  volatility: 0.92, // high conflict-reaction (Calm 0.20) — max contrast
  inheritance: 0.12, // little continuity between rings (Calm 0.60)

  steerGain: {
    symmetry: 0.5,
    spread: 0.5,
  },

  rareTable: [{ prob: 0.08, mutation: 'spike' }],
  allowedGenes: ['spike', 'bloom', 'aura'],

  dayBoundary: {
    tz: 'UTC',
    hour: 0,
    jitterMin: 5,
  },

  // GAME-01: the day's goal as data, legible at dawn. Scoring lands Phase 4.
  // Chaotic communities chase raw activity, not calm — an activity goal.
  dailyGoal: {
    type: 'starThreshold',
    targetParam: 'density',
    threshold: 0.7,
    direction: 'above',
  },

  actionCap: 3, // D-04 default
});
