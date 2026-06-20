// ignite — the data-driven frontier shimmer math, extracted as a PURE function so
// its no-strobe bound is unit-testable (VIS-ANIM D-03/D-04).
//
// The legacy frontier pulse swung across nearly the whole [0, 1] range and read as
// a harsh on/off blink — every day animated identically off a single StyleTemplate
// constant. This replaces it with a GENTLE SHIMMER baseline plus bounded,
// per-metric modulation:
//   - conflict → amplitude / edge-hardness  (a stormy day pulses harder/sharper)
//   - energy   → tempo                       (an energetic day shimmers faster)
// momentum-driven drift is intentionally OUT of scope (deferred per research): it
// is not a Scene field today, so adding it would force a contract re-baseline.
//
// Why this can NEVER strobe (D-04): the pulse is
//   SHIMMER_BASE + amp * shaped,   |shaped| ≤ 1,   0 ≤ amp ≤ AMPLITUDE_MAX,
// so pulse ∈ [SHIMMER_BASE − AMPLITUDE_MAX, SHIMMER_BASE + AMPLITUDE_MAX]. With the
// constants below that is a band whose floor sits far above 0 — the ignite ring
// can never blink off, regardless of conflict, energy, time, or speed. The bound
// is asserted analytically in ignite.test.ts.
//
// Contract discipline (ENG-02): this function takes only plain numbers already on
// the Scene shell (conflict, a frontier-energy scalar) — never a raw DayVector. It
// has NO Phaser, NO DOM, NO randomness; it is a pure function of its four args.
// That purity is exactly why it lives in its own file and can be swept in a unit
// test. All constants are [ASSUMED] / tunable at the visual checkpoint; the bound
// holds for any non-negative values of them.

/** High rest value of the shimmer — there is no "off" state (D-04). */
export const SHIMMER_BASE = 0.78;
/** Hard cap on the pulse swing: |pulse − SHIMMER_BASE| ≤ AMPLITUDE_MAX. */
export const AMPLITUDE_MAX = 0.18;

/** Twinkle rest value — raised so the star breath stays subtle, never blinks. */
export const TWINKLE_BASE = 0.85;
/** Hard cap on the twinkle swing. */
export const TWINKLE_AMPLITUDE_MAX = 0.1;

/** Calm-day floor of the amplitude scaling (a calm day still barely breathes). */
const AMP_CALM_FLOOR = 0.25;
/** Base tempo (rad/ms) the shimmer breathes at; scaled by speed and energy. */
const TEMPO_BASE = 0.0016;
/** Energy floor of the tempo scaling — tempo is never 0 from energy alone. */
const TEMPO_ENERGY_FLOOR = 0.6;
/** How much energy accelerates the tempo above the floor. */
const TEMPO_ENERGY_GAIN = 0.9;
/** Twinkle runs a touch faster than the ignite, for a livelier star breath. */
const TWINKLE_TEMPO_FACTOR = 2.2;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Shape a raw sine into a conflict-hardened edge WITHOUT clipping to a square wave.
 * An odd-power emphasis (preserving sign) sharpens the peaks as conflict rises, so
 * a high-conflict day reads as a harder/sharper pulse while a calm day stays soft —
 * but |shaped| ≤ 1 always, so the no-strobe bound is untouched.
 */
function shapeEdge(raw: number, conflict: number): number {
  const sign = raw < 0 ? -1 : 1;
  const mag = Math.abs(raw);
  // hardness ∈ [1, 3]: calm = linear (soft), conflict = cubic-ish (sharp edge).
  const hardness = 1 + 2 * conflict;
  return sign * Math.pow(mag, hardness);
}

export interface IgniteParams {
  /** Frontier ignite-ring alpha multiplier, bounded away from 0 (no strobe). */
  pulse: number;
  /** Frontier star twinkle multiplier, bounded away from 0. */
  twinkle: number;
}

/**
 * Compute the frontier ignite pulse + star twinkle for the given day metrics.
 *
 * @param conflict day conflict in [0,1] (shell.meta.conflict) → amplitude/hardness
 * @param energy   frontier energy scalar in [0,1] (cached mean) → tempo
 * @param time     elapsed time in ms (Phaser update clock)
 * @param speed    StyleTemplate.motion.speed (≥ 0; 0 ⇒ a static rest frame)
 */
export function igniteParams(
  conflict: number,
  energy: number,
  time: number,
  speed: number,
): IgniteParams {
  const c = clamp01(conflict);
  const e = clamp01(energy);
  const s = Math.max(0, speed);

  // energy → tempo: faster shimmer when the day is energetic; never 0 from energy.
  const tempo = TEMPO_BASE * s * (TEMPO_ENERGY_FLOOR + e * TEMPO_ENERGY_GAIN);

  // conflict → amplitude: calm day barely breathes, conflict day swings to the cap.
  const amp = AMPLITUDE_MAX * (AMP_CALM_FLOOR + c * (1 - AMP_CALM_FLOOR));
  // conflict → edge hardness: sharpen the peaks without becoming an on/off square.
  const shaped = shapeEdge(Math.sin(time * tempo), c);
  const pulse = SHIMMER_BASE + amp * shaped;

  // Twinkle gets the same bounded treatment: raised base, capped swing, energy
  // tempo. Kept subtle — the star breath is secondary to the ignite ring.
  const twinkleAmp = TWINKLE_AMPLITUDE_MAX * (AMP_CALM_FLOOR + c * (1 - AMP_CALM_FLOOR));
  const twinkle = TWINKLE_BASE + twinkleAmp * Math.sin(time * tempo * TWINKLE_TEMPO_FACTOR);

  return { pulse, twinkle };
}

/**
 * The static REST values (zero time-varying term) the reduced-motion / initial /
 * post-nudge frames draw, so the animated baseline and the static frame agree
 * (Pitfall 3: a single non-strobe render under prefers-reduced-motion). Equal to
 * igniteParams at the sine's zero crossing.
 */
export const IGNITE_REST: IgniteParams = { pulse: SHIMMER_BASE, twinkle: TWINKLE_BASE };
