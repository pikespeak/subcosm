// synthesis — the architecture bet: DayVector[] + Genome → Scene (PURE, style-agnostic).
//
// Ported from docs/subcosm-universe-mock.html lines 137-163 (`starCount`,
// `genShell`, `lerp`) with the MANDATORY DEVIATIONS (RESEARCH port table +
// Anti-Patterns):
//   - Seed each per-day RNG closure from `day.seed` (NOT the mock's array
//     index) — index-based seeds break under Redis ordering (SYN-01).
//   - The live globals `todaySym/todayHue/todayBranch` become `day.steering.*`.
//   - The mock's literal magic numbers (0.30 star density, 0.18/0.55 spread, the
//     >.7 / >300 arm thresholds) become `Genome` knobs so presets diverge (TPL-01).
//   - `topThreads: number[]` is reduced via `Math.max(0, ...topThreads)` →
//     scalar `top`, guarding the empty array → 0 (Pitfall 2).
//   - genesis day (`day === 1`) yields a shell with NO elements (core only).
//   - `Element.hue` is a 0..1 HINT derived deterministically from the theme +
//     steering — NEVER a color string (ENG-02). Paint maps it through the
//     StyleTemplate palette in Phase 2.
//   - Every Element/Shell is built as ONE fixed-key object literal (all keys
//     always present) for byte-identical key order (Pitfall 3 / SYN-02).
//   - No schema validation here — synthesis trusts the z.infer types; the Zod
//     boundary already ran at the fixtures/sim handoff (QA-03).
//
// Imports ONLY contracts + rng — no style/paint/Devvit code (ENG-02/ENG-03).
import { mulberry32 } from './rng';
import type {
  DayVector,
  Genome,
  Scene,
  Shell,
  Element,
  CoreNode,
} from './contracts';

// ---- helpers (ported from the mock) ----

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Deterministic 0..1 hue HINT from the day's dominant theme + steering.hue.
// A simple stable string hash folded into [0, 1), nudged by the steering hue.
// This is a HINT, never a color — paint resolves it against the palette (ENG-02).
function hueHint(day: DayVector): number {
  const s = day.dominantTheme;
  let h = 2166136261; // FNV-1a basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const base = (h >>> 0) / 4294967296; // 0..1 from the theme
  // Blend with the steering hue (fractional part keeps it in 0..1).
  const blended = base * 0.7 + (day.steering.hue - Math.floor(day.steering.hue)) * 0.3;
  return clamp01(blended);
}

// Star count: mock `Math.max(5, Math.min(112, Math.round(p*0.30)))`, with the
// 0.30 literal replaced by the genome density knob.
function starCount(posts: number, density: number): number {
  return Math.max(5, Math.min(112, Math.round(posts * density)));
}

// ---- VIS-DEPTH geometry (D-01 / D-02) — PURE, no rng() (RESEARCH Pitfall 1) ----
//
// These consume ZERO rng() calls and read only idx / N / already-derived day
// metrics, so the per-day mulberry32 stream is untouched and element positions
// stay byte-identical — only `radius` and the new `weight` scalar change.

// Falloff base — gentler than the mock's 0.85 so deep rings don't crush.
const RADIUS_EXP_BASE = 0.92;
// Blend between the exponential (perspective) term and the linear (even-spacing)
// term: exp keeps the depth feel, lin guarantees the rings keep advancing inward.
const RADIUS_EXP_WEIGHT = 0.45;
const RADIUS_LIN_WEIGHT = 0.55;
// D-02 legibility floor — no shell ever fades below this weight.
export const LEGIBILITY_FLOOR = 0.35;

/**
 * MIN_GAP — the guaranteed minimum radial separation between two adjacent shells
 * (the no-blob guarantee, D-01). Even spacing of N rings would give 1/N; we take
 * ~0.9 of that as the hard floor so deep rings stay individually distinguishable
 * at the production target N≈30. Exported for the synthesis test assertions.
 */
export function minGapFor(n: number): number {
  return n > 0 ? 0.9 / n : 0;
}
// Convenience constant at the test fixture's shell count (N=3). The runtime
// floor is computed per-call via minGapFor(N); the test asserts gap ≥ MIN_GAP.
export const MIN_GAP = minGapFor(3);

/**
 * shellRadius — clamped-minimum-gap falloff (RESEARCH Pattern 1A, recommended).
 * Blend an exponential (perspective) term with a linear (even-spacing) term,
 * then enforce a hard minimum gap from the previous ring so adjacent shells are
 * never closer than minGap. Frontier (idx 0) is the largest. PURE — no rng().
 *
 * @param idx        0 = frontier (newest) .. N-1 = oldest
 * @param n          total shell count (days.length)
 * @param prevRadius the previous (outer) shell's radius, or null at idx 0
 */
export function shellRadius(
  idx: number,
  n: number,
  prevRadius: number | null,
): number {
  const expPart = Math.pow(RADIUS_EXP_BASE, idx);
  const linPart = n > 0 ? 1 - idx / n : 1;
  const blended = expPart * RADIUS_EXP_WEIGHT + linPart * RADIUS_LIN_WEIGHT;
  if (idx === 0 || prevRadius === null) return blended;
  // enforce the monotonic minimum gap inward from the previous ring
  return Math.min(prevRadius - minGapFor(n), blended);
}

/**
 * shellWeight — per-shell legibility weight (D-02). Older shells fade with age,
 * standout days (high conflict / energy) keep accents, clamped so nothing drops
 * below LEGIBILITY_FLOOR. PURE — reads only idx / N / day metrics, no rng().
 *
 * @param idx       0 = frontier (newest) .. N-1 = oldest
 * @param n         total shell count
 * @param conflict  day.conflict (0..1) — drives the standout accent
 * @param energy    an energy proxy in 0..1 (already derived from day fields)
 */
export function shellWeight(
  idx: number,
  n: number,
  conflict: number,
  energy: number,
): number {
  const ageFade = n > 1 ? lerp(1, 0.45, idx / (n - 1)) : 1; // older = dimmer
  const standout = Math.max(clamp01(conflict), clamp01(energy));
  const weighted = ageFade * 0.7 + standout * 0.4; // accent lifts standout days
  return clamp01(Math.max(LEGIBILITY_FLOOR, weighted));
}

// ---- core port ----

/**
 * synthesize — turn a validated DayVector[] + a Genome into a deterministic,
 * style-agnostic Scene. Same inputs → byte-identical Scene (SYN-01/SYN-02).
 *
 * @param days  validated community data, newest first (index 0 = frontier).
 * @param genome per-community behaviour knobs (data, not code).
 */
export function synthesize(days: DayVector[], genome: Genome): Scene {
  // Genome knobs (Phase-1 subset of §6.3). Defaults mirror the mock literals so
  // an under-specified preset still renders sanely.
  const density = genome.baseVar?.density ?? 0.3;
  const baseSpread = genome.baseVar?.spread ?? 0.18;
  const symmetryKnob = genome.baseVar?.symmetry ?? 2;
  const spreadGain = genome.volatility * 0.55; // conflict→spread, mock used 0.55

  const N = days.length;
  // Thread the previous (outer) shell's radius through the map so shellRadius can
  // enforce the monotonic minimum gap (D-01). Pure bookkeeping — no rng().
  let prevRadius: number | null = null;

  const shells: Shell[] = days.map((day, idx) => {
    const isGenesis = day.day === 1;

    // Reduce topThreads → scalar `top` (Pitfall 2: guard empty array → 0).
    const top = day.topThreads.length > 0 ? Math.max(0, ...day.topThreads) : 0;

    // One RNG closure per day, seeded from day.seed (NOT the index).
    const rng = mulberry32(day.seed);

    const elements: Element[] = [];

    if (!isGenesis) {
      const n = starCount(day.posts, density);
      // Arms: mock `conflict>.7?1:(posts>300?3:2)`. Replace the hard thresholds
      // with the genome symmetry knob, still modulated by conflict + density.
      const arms =
        day.conflict > 0.7
          ? Math.max(1, Math.round(symmetryKnob - 1))
          : day.posts > 300
            ? Math.max(1, Math.round(symmetryKnob + 1))
            : Math.max(1, Math.round(symmetryKnob));
      // Spread: mock `0.18 + conflict*0.55`, both literals genome-driven now.
      const spread = baseSpread + day.conflict * spreadGain;
      const clumps = Math.max(1, Math.round(1 + day.conflict * 5));
      const nbig = Math.max(0, Math.min(6, Math.round(top / 280)));
      const hint = hueHint(day);

      for (let s = 0; s < n; s++) {
        // Base angle: distribute over arms, conflict-driven clumping (mock l.154-155).
        let angle: number;
        if (arms > 1) {
          angle =
            (Math.floor(rng() * arms) / arms) * Math.PI * 2 +
            (rng() - 0.5) * (1.1 / arms) * Math.PI * 2;
        } else {
          const c = Math.floor(rng() * clumps) / clumps;
          angle =
            c * Math.PI * 2 +
            (rng() - 0.5) * (2 * Math.PI) * lerp(0.5, 0.12, day.conflict);
        }
        const rj = (rng() * 2 - 1) * spread; // radial jitter within the band
        const bright = 0.4 + rng() * 0.6;
        // Angry red sparks: probability scales with conflict (mock l.158).
        const redshift = rng() < day.conflict * 0.5 ? 1 : 0;
        const big = s < nbig;

        // ONE fixed-key object literal — all keys always present (Pitfall 3).
        elements.push({
          kind: big ? 'cluster' : 'star',
          angle,
          r: rj,
          size: 0.7 + bright * 1.6,
          energy: bright,
          hue: hint,
          conflict: redshift, // 0|1 redshift flag, within [0,1]
          big,
        });
      }
    }

    // Shell as ONE fixed-key object literal. Radius is the clamped-min-gap depth
    // falloff (D-01) and weight is the per-shell legibility fade (D-02) — both
    // PURE functions of idx/N/day metrics, ZERO rng() (RESEARCH Pitfall 1), so
    // element arrays stay byte-identical to the pre-change baseline.
    const radius = shellRadius(idx, N, prevRadius);
    prevRadius = radius;
    // Energy proxy in 0..1 from day scalars already on the DayVector (diversity +
    // normalized momentum magnitude) — NO rng(), no new RNG consumption.
    const energyProxy = clamp01(
      day.diversity * 0.6 + ((day.momentum + 1) / 2) * 0.4,
    );
    const weight = shellWeight(idx, N, day.conflict, energyProxy);

    const shell: Shell = {
      day: day.day,
      radius,
      weight,
      meta: {
        date: day.date,
        era: day.dominantTheme,
        theme: day.dominantTheme,
        posts: day.posts,
        comments: day.comments,
        contributors: day.contributors,
        conflict: day.conflict,
      },
      elements,
    };
    return shell;
  });

  // Genesis core: derive from the day-1 vector if present, else a quiet default.
  const genesis = days.find((d) => d.day === 1);
  const core: CoreNode = {
    radius: 0.06,
    energy: genesis ? Math.min(1, genesis.contributors / 100) : 0.5,
    hue: genesis ? hueHint(genesis) : 0.5,
  };

  return {
    core,
    shells,
    goalAchieved: null, // scoring is Phase 4 (loose default)
  };
}
