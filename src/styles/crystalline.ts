// crystalline — the Crystalline StyleTemplate (ice-blue, faceted). DATA, not code.
//
// Crystalline is NOT a new StyleId (Open Question 2 resolved): it is a `techno`-id
// instance with a different palette + a faceted primitive gene. Authoring it as
// data — same StyleIdEnum (['techno','comic','pixel']), zero contract change —
// proves the architecture bet: a new LOOK is a new data file, not engine code
// (TPL-01/TPL-03). One style per community (TPL-04); synthesis never reads it
// (ENG-02) — paint maps Element.hue (0..1) through `palette.ramp` and selects the
// faceted primitive via `genes.facet`.
//
// Crystalline character (D-05): ice-blue / white, faceted, high-symmetry — a cold,
// ordered, many-armed lattice that reads clearly distinct from the warm neon
// cyan↔magenta of Calm/Chaotic Techno at a glance. The ramp matches the
// Crystalline GENOME (src/engine/genomes/crystalline.ts) so style + genome agree:
//   ['#04121a','#0e4d5e','#46e0d8','#e8fbff'] — deep ice, teal, cyan, white-blue.
//
// The schema parse below is the legitimate module-load boundary (CLAUDE.md §6):
// validated once on import; paint trusts the z.infer type and never re-parses in
// the rAF loop (QA-03).
import { StyleTemplateSchema, type StyleTemplate } from '../engine/contracts';

export const crystalline: StyleTemplate = StyleTemplateSchema.parse({
  id: 'techno', // techno-id variant — NOT a new StyleId (no contract change, Open Q2)
  substrate: 'deep-space', // same dark glowing space stage as Techno

  palette: {
    space: 'oklch',
    // Ice-blue → white-blue ramp (matches the Crystalline genome). Cold and
    // ordered: deep ice, teal, cyan, white-blue core — distinct from Techno's
    // warm cyan→magenta→warm-white neon (D-05).
    ramp: ['#04121a', '#0e4d5e', '#46e0d8', '#e8fbff'],
  },

  // Crisper, slightly brighter connective strokes than Techno — a lattice reads
  // as sharp lines, not soft arcs (PNT-02 — paint reads these, never hard-codes).
  line: { width: 1, join: 'miter', alpha: 0.28 },

  // Additive glow fill (same blend == mock 'lighter'); a touch lower alpha keeps
  // the cold palette from washing to white.
  fill: { mode: 'additive', alpha: 0.45 },

  // Tighter falloff than Techno — crisp facets over soft bloom.
  texture: { kind: 'radial-glow', scale: 3.6 },

  // genes: Gene → PrimitiveRef. The signature difference: the `facet` gene maps to
  // the angular star-polygon primitive (primitives.ts addFacetStar), so a star in
  // a Crystalline community is drawn faceted, not round — paint-only, no synthesis
  // change. The genome's allowedGenes are facet/spike/aura.
  genes: {
    star: 'facet-star', // round dot → faceted star-polygon (the Crystalline tell)
    cluster: 'facet-cluster',
    filament: 'glow-arc',
    facet: 'facet-star',
    spike: 'facet-spike',
    aura: 'glow-aura',
    core: 'glow-core',
  },

  // Less bloom, more grain than Techno — crystalline edges stay sharp, not hazy.
  postFX: { bloom: 0.35, grain: 0.06 },

  // Same PNT-03/PNT-04 contract: only the frontier animates. A slightly slower
  // speed suits the ordered, low-volatility Crystalline character.
  motion: { frontierOnly: true, speed: 0.8 },

  // Chrome typography unchanged (UI-SPEC: Space Grotesk family).
  type: { family: 'Space Grotesk', weight: 600 },
});
