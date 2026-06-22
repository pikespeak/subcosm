// score — the deterministic scoring spine: a FROZEN DayVector + Genome → Outcome.
//
// PURE module (mirrors synthesis.ts purity discipline, ENG-03): imports ONLY
// synthesis helpers + contract types — NO Math.random, NO Devvit, NO I/O. The
// same (day, genome) always yields the same Outcome, so any client re-derives the
// identical achieved/degree verdict from the stored Ring record (LIVE-03 / D-09).
//
// The scorer measures with synthesis's OWN derivations (starCount / deriveArms),
// so the metric the community chases is EXACTLY the one painted (one source of
// truth — no determinism drift). Genome thresholds are LOCKED (D-01); only the
// per-goal normalization scale is tuned here so each goal is reachable-but-not-
// automatic on plausible activity (OQ1, proven in score.test.ts).
//
// This is a one-shot call at the tick (RESEARCH Anti-Patterns: NEVER per-frame,
// NEVER inside synthesis or the rAF loop). The returned object satisfies
// OutcomeSchema; the tick trusts it (the single build-boundary parse runs there).
import { starCount, deriveArms, STAR_FLOOR } from './synthesis';
import type { DayVector, Genome, Outcome } from './contracts';

// ── Tuning constants (Claude's discretion — RESEARCH degree formula + OQ1) ─────

/**
 * DENSITY_NORM_CAP — [ASSUMED] the upper edge of the density normalization band
 * `[STAR_FLOOR, DENSITY_NORM_CAP]`. The raw `starCount` over the simulator arc
 * (Chaotic density 0.40) spans STAR_FLOOR (18, every quiet day) up to ~46 on the
 * drama/AMA peak. The Chaotic goal targets the NORMALIZED density > 0.7; sizing
 * the band so a genuinely busy day clears 0.7 while quiet/mid days fall short
 * makes the goal reachable-but-not-automatic (OQ1): at cap 55, drama (~46 stars)
 * → (46-18)/(55-18) ≈ 0.76 (achieved), a mid day (~37) → 0.51 (missed), quiet
 * (18) → 0 (missed). The 112 hard cap on `starCount` itself is unchanged — this
 * is only the goal-comparison scale. Proven numerically in score.test.ts.
 */
export const DENSITY_NORM_CAP = 55;

/**
 * SYMMETRY_DEGREE_SPAN — [ASSUMED] the arm-count span used to normalize the
 * symmetry `degree` into 0..1. `deriveArms` returns small integers (knob-1 ..
 * knob+1); the threshold is the knob (5 for Crystalline). A span of 2 maps a
 * 1-arm overshoot/undershoot to a full half-step of degree, keeping `degree`
 * monotonic in the integer distance to the threshold without ever exceeding 1.
 */
const SYMMETRY_DEGREE_SPAN = 2;

/**
 * STEER_BIAS_CAP — [ASSUMED] = 0.15. The maximum absolute shift the aggregated
 * steering may apply to `measured`, expressed as a FRACTION of the goal's per-goal
 * degree span (`degreeBounds(targetParam, threshold).max - .min`). For conflict /
 * density the span is 1.0 (the 0..1 axis) → max shift ±0.15; for symmetry the span
 * is `2 × SYMMETRY_DEGREE_SPAN` = 4 arms → max shift ±0.6 arms.
 *
 * This is the encoding of invariant I-5 — steering BIASES the mean, it NEVER
 * dictates the outcome. The cap is a true BIAS, not a DICTATE:
 *   - A BORDERLINE day sits within the cap of the threshold (e.g. conflict 0.45 vs
 *     goal <0.40), so full toward-goal steering can pull it across — the GAME-03
 *     positive link.
 *   - A CLEARLY-FAILED day sits MORE than the cap past the threshold (e.g. conflict
 *     0.95 vs <0.40), so even MAXIMUM toward-goal steering cannot reach it — it stays
 *     failed. Symmetrically a CLEARLY-ACHIEVED day cannot be thrown by away-from-goal
 *     steering. Proven by the prohibition (never-dictates) test in score.test.ts.
 *
 * The contribution reads the ALREADY-FOLDED `day.steering` directly (the tick's
 * foldSteering applied the per-param steer gain exactly once before score() runs);
 * it is NOT re-multiplied by that gain here (re-applying would double-count, breaking
 * the single-fold OQ3/D-08 guarantee). The lever is first saturated to [-1, 1] so an
 * extreme folded value can NEVER exceed the cap.
 */
export const STEER_BIAS_CAP = 0.15;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Hard-clamp a value into [lo, hi]. */
const clampTo = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** The targetParam-specific bounds [min, max] for the normalized degree scale. */
function degreeBounds(targetParam: string, threshold: number): {
  min: number;
  max: number;
} {
  switch (targetParam) {
    case 'conflict':
    case 'density':
      // Both measured values live on a normalized 0..1 axis.
      return { min: 0, max: 1 };
    case 'symmetry':
      // Integer arm count: a symmetric span around the threshold keeps degree
      // monotonic in the (small) integer distance.
      return {
        min: threshold - SYMMETRY_DEGREE_SPAN,
        max: threshold + SYMMETRY_DEGREE_SPAN,
      };
    default:
      return { min: 0, max: 1 };
  }
}

/**
 * steerContribution — the bounded, direction-aware steering offset for a goal,
 * derived PURELY from the ALREADY-FOLDED `day.steering` (GAME-03, within I-5).
 *
 * Lever mapping (the player's nudge → the scored axis):
 *   - symmetry goal → `day.steering.symmetry` (the "make it more faceted" lever)
 *   - density  goal → `day.steering.branch`   (structural spread populates the frontier)
 *   - conflict goal → `day.steering.branch`   (branch loosens/tightens structure)
 *   - any other     → 0 (safe fallback; hue is never a scored lever)
 *
 * The lever is read DIRECTLY (the tick's foldSteering already applied the steer
 * gain once — it is NOT re-applied) and saturated to [-1, 1] so an extreme value can never
 * exceed the cap. It is scaled by the per-goal cap and made direction-aware: a
 * positive (toward-goal) lever always moves `measured` in the goal-FAVORABLE
 * direction (ADD for 'above', SUBTRACT for 'below'); a negative (away-from-goal)
 * lever always hurts. The signed offset is hard-clamped to [-cap, +cap].
 */
function steerContribution(
  goal: { targetParam: string; threshold: number; direction: 'above' | 'below' },
  day: DayVector,
): number {
  let lever: number;
  switch (goal.targetParam) {
    case 'symmetry':
      lever = day.steering.symmetry;
      break;
    case 'density':
    case 'conflict':
      lever = day.steering.branch;
      break;
    default:
      return 0; // hue / unknown params are never a scored lever
  }

  // Saturate the (already-folded) lever to [-1, 1] — the clamp guarantees the
  // contribution can never exceed the per-goal cap, regardless of input size.
  const saturated = clampTo(lever, -1, 1);

  const { min, max } = degreeBounds(goal.targetParam, goal.threshold);
  const cap = STEER_BIAS_CAP * (max - min);

  // Direction-aware: a positive lever helps the goal. For 'above' that means
  // ADDING to measured; for 'below' that means SUBTRACTING from it.
  const signedOffset = (goal.direction === 'above' ? 1 : -1) * saturated * cap;

  return clampTo(signedOffset, -cap, cap);
}

/**
 * measure — the derived metric for a goal's targetParam, computed deterministically
 * from the FROZEN DayVector using synthesis's own math (LIVE-03):
 *   - conflict → `day.conflict` directly (already 0..1)
 *   - density  → `starCount(posts, density)` normalized over [STAR_FLOOR, DENSITY_NORM_CAP]
 *   - symmetry → `deriveArms(day, genome)` (the exact integer arm count)
 * Unknown params fall back to `day.conflict` (a safe 0..1 scalar).
 */
export function measure(targetParam: string, day: DayVector, genome: Genome): number {
  switch (targetParam) {
    case 'conflict':
      return day.conflict;
    case 'density': {
      const density = genome.baseVar?.density ?? 0.3;
      const n = starCount(day.posts, density);
      return clamp01((n - STAR_FLOOR) / (DENSITY_NORM_CAP - STAR_FLOOR));
    }
    case 'symmetry':
      return deriveArms(day, genome);
    default:
      return day.conflict;
  }
}

/**
 * score — the deterministic verdict for `day` under `genome`'s fixed daily goal.
 *
 * `achieved` is direction-aware against the LOCKED genome threshold. `degree` is
 * the clamped, normalized distance to the threshold over the per-goal scale, kept
 * MONOTONIC in distance for BOTH an achieved goal (how far past the threshold) and
 * a miss (how far short) — so a near-miss reads close to 1 and a blow-out near 0,
 * never NaN, never out of [0,1]. PURE: no rng, no I/O (ENG-03).
 */
export function score(day: DayVector, genome: Genome): Outcome {
  const goal = genome.dailyGoal;
  // Activity base (unchanged) + the bounded, direction-aware steering offset
  // (GAME-03). The offset reads the already-folded day.steering and is hard-clamped
  // to a fraction of the goal span (I-5: biases the mean, never dictates).
  const base = measure(goal.targetParam, day, genome);
  const offset = steerContribution(goal, day);
  const shifted = base + offset;
  // Re-clamp to the metric's own axis: conflict/density to [0,1]; symmetry stays a
  // real number on the arm axis (degree tolerates non-integers).
  const measured =
    goal.targetParam === 'conflict' || goal.targetParam === 'density'
      ? clamp01(shifted)
      : shifted;
  const threshold = goal.threshold;
  const { min, max } = degreeBounds(goal.targetParam, threshold);

  const achieved =
    goal.direction === 'above'
      ? measured > threshold
      : measured < threshold;

  // Normalize the signed distance to the threshold over the per-goal scale.
  // above: distance grows toward `max`; below: distance grows toward `min`.
  // For a miss the distance is negative, so we mirror it over the SAME denominator
  // (so degree stays monotonic in |distance|) — a tiny miss ≈ a tiny achieve.
  const span = goal.direction === 'above' ? max - threshold : threshold - min;
  const signed =
    goal.direction === 'above' ? measured - threshold : threshold - measured;
  // achieved → signed ≥ 0 → degree = signed/span; missed → signed < 0 → mirror.
  const degree = span > 0 ? clamp01(Math.abs(signed) / span) : achieved ? 1 : 0;

  return { goal, measured, achieved, degree };
}
