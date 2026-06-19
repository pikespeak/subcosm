// crystalline — the Crystalline genome preset (decision D-01). DATA, not code.
//
// One of three presets (Calm / Chaotic / Crystalline) that share the Techno
// style and differ ONLY in genome data (TPL-01/TPL-03). Synthesis reads these
// knobs; it never branches on the preset name.
//
// Crystalline character (D-01 / spec §4.4): high SYMMETRY (many faceted arms),
// high INHERITANCE (strong continuity between rings — a growing lattice), and
// LOW volatility (ordered, cool, faceted — turbulence stays low even under
// conflict). It is neither the Calm nor the Chaotic pole: it is an ordered,
// many-armed structure. Numeric knobs are Claude's discretion (RESEARCH Open
// Question 3), tuned so the divergence proof shows a VISIBLE difference from
// BOTH Calm and Chaotic. Final palette/look is decided in Phase 2.
//
// The knobs synthesis actually exercises in Phase 1:
//   - baseVar.symmetry → arm count (here 5: many faceted arms vs Calm's 2)
//   - baseVar.density  → star-count multiplier (moderate — structure over noise)
//   - baseVar.spread   → base radial spread     (tight — crisp facets)
//   - volatility       → conflict→spread gain    (very low: stays ordered)
//
// GenomeSchema.parse() here is a legitimate module-load boundary (CLAUDE.md §6):
// preset data is validated once when imported; synthesis then trusts the type.
import { GenomeSchema, type Genome } from '../contracts';

export const crystalline: Genome = GenomeSchema.parse({
  version: 1,
  style: 'techno', // one style per community (TPL-04) — same style as Calm/Chaotic

  palette: {
    space: 'oklch',
    ramp: ['#04121a', '#0e4d5e', '#46e0d8', '#e8fbff'],
  },

  // Signal→Param weights matrix: typed-but-unused in Phase 1 (D-05).
  weights: {},

  // Param → [min, max] ranges (typed surface; synthesis uses baseVar in Phase 1).
  ranges: {
    density: [0.2, 0.45],
    spread: [0.08, 0.25],
    symmetry: [4, 8],
  },

  // baseVar — the knobs synthesis exercises. Crystalline = many ordered arms,
  // moderate density, tight crisp spread.
  baseVar: {
    density: 0.3, // moderate — structure, not noise (between Calm 0.24 / Chaotic 0.40)
    spread: 0.1, // < Calm: crisp, tight facets
    symmetry: 5, // many faceted arms (Calm 2, Chaotic 1) — the signature knob
  },

  volatility: 0.08, // very low: conflict barely perturbs the lattice (ordered)
  inheritance: 0.9, // strong continuity between rings — a growing crystal

  steerGain: {
    symmetry: 0.5,
    spread: 0.5,
  },

  rareTable: [{ prob: 0.03, mutation: 'facet' }],
  allowedGenes: ['facet', 'spike', 'aura'],

  dayBoundary: {
    tz: 'UTC',
    hour: 0,
    jitterMin: 5,
  },

  // GAME-01: the day's goal as data, legible at dawn. Scoring lands Phase 4.
  // Crystalline communities chase form — reach a high symmetry.
  dailyGoal: {
    type: 'reachSymmetry',
    targetParam: 'symmetry',
    threshold: 5,
    direction: 'above',
  },

  actionCap: 3, // D-04 default
});
