// techno — the Techno StyleTemplate (the first authored skin). DATA, not code.
//
// The architecture bet (CLAUDE.md): look is DATA. A StyleTemplate is consumed by
// paint ONLY; synthesis never reads it (ENG-02). One style per community
// (TPL-04); `techno` ships first ('comic'/'pixel' are stretch).
//
// PNT-02 — the look lives here, NOT hard-coded in the painter:
//   - `palette.ramp` is the hue->color mapping paint applies to Element.hue
//     (a 0..1 hint). Deep-space indigo -> cyan -> magenta -> warm-white, lifted
//     from the mock's authored gradient (docs/subcosm-universe-mock.html: range
//     track l.41 #6366f1 -> #d946ef -> #fff7e6; core glow l.259 #fff7e6).
//   - `genes` maps each synthesis Gene to a primitive ref the painter resolves
//     (primitives.ts). New gene -> new data row, zero painter change.
//   - `motion.frontierOnly` drives PNT-04 reduced-motion (only the frontier
//     animates; consumed by plan 03's reduced-motion + bake-on-freeze).
//
// The schema parse below is a legitimate module-load boundary
// (CLAUDE.md §6): the skin data is validated once on import; paint then trusts
// the z.infer type and never re-parses inside the rAF loop (QA-03).
import { StyleTemplateSchema, type StyleTemplate } from '../engine/contracts';

export const techno: StyleTemplate = StyleTemplateSchema.parse({
  id: 'techno', // one style per community (TPL-04)
  substrate: 'deep-space', // dark glowing space stage (UI-SPEC Color: #04030a)

  palette: {
    space: 'oklch',
    // The curated bespoke Techno signature (D-07): the hue->color ramp paint maps
    // Element.hue (0..1) through. Ordered cold -> hot -> core to read as the
    // SUBCOSM brand (docs/subcosm.png), NOT generic neon fractal:
    //   #04030a deep-space ink (matches the stage bg, so cold/old shells recede)
    //   #2b1f6b deep electric-violet (a richer cold bridge than a flat indigo —
    //           lets the cyan and magenta poles read as the two signature hues
    //           instead of muddying into a single blue)
    //   #46e0d8 the SIGNATURE cyan pole (logo glints; chrome harmonizes here)
    //   #d946ef the SIGNATURE magenta nebula pole (the counter-hue)
    //   #fff7e6 the warm-white genesis core (the cross-flare + dot stop)
    // The two-pole cyan<->magenta separation across a deep-violet bridge is the
    // bespoke move: most days land cyan/violet, high-conflict redshift pushes
    // toward magenta, and only the core reaches warm-white. (Look is DATA — PNT-02.)
    ramp: ['#04030a', '#2b1f6b', '#46e0d8', '#d946ef', '#fff7e6'],
  },

  // Filament/arc stroke treatment (PNT-02 — the painter reads these, never
  // hard-codes them). Mirrors the mock's thin connective arcs (l.201/250).
  line: { width: 1, join: 'round', alpha: 0.22 },

  // Additive glow fill: the mock paints with globalCompositeOperation='lighter'
  // (l.195) -> the painter uses BlendModes.ADD. alpha caps the per-glow energy.
  fill: { mode: 'additive', alpha: 0.5 },

  // Soft radial-falloff texture for every glow (primitives.ts bakes ONE reused
  // texture; scale tunes the falloff radius).
  texture: { kind: 'radial-glow', scale: 4.5 },

  // genes: Gene -> PrimitiveRef. The synthesis gene vocabulary (Genome
  // allowedGenes: spike/bloom/aura/facet) maps to painter primitives. Element
  // kinds (star/cluster/filament) also resolve through this table.
  genes: {
    star: 'glow-point',
    cluster: 'glow-cluster',
    filament: 'glow-arc',
    spike: 'glow-spike',
    bloom: 'glow-bloom',
    aura: 'glow-aura',
    core: 'glow-core',
  },

  // Bloom-forward, light grain — the neon Techno bloom (UI-SPEC). Drives the
  // optional post-FX pass; values are data so a future style dials them down.
  postFX: { bloom: 0.6, grain: 0.08 },

  // PNT-04 foundation: only the frontier animates; everything else is baked
  // (PNT-03). `speed` scales the frontier twinkle/ignite (consumed in plan 03).
  motion: { frontierOnly: true, speed: 1 },

  // Chrome/label typography (UI-SPEC: Space Grotesk / Space Mono family).
  type: { family: 'Space Grotesk', weight: 600 },
});
