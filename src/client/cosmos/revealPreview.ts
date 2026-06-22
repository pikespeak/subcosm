// revealPreview — the in-session goal meter + reveal-preview logic (SUB-02 / SUB-04).
//
// PURE module (mirrors ignite.ts / coachmark.ts discipline): NO Phaser, NO DOM, NO
// timers, NO rng, NO server. It is the honest, unit-testable brain behind two
// client-only demo affordances added so a judge EXPERIENCES the goal→steer→reveal
// loop in one session (the real payoff is otherwise overnight + mod-gated):
//
//   1. goalMeter(frontierDay, genome) — a 0..1 progress model of how the LIVE
//      frontier tracks against the day's goal, for the HUD meter. A nudge that
//      biases the frontier's folded steering moves `measured`/`progress01`
//      (GAME-03 causality, within the I-5 bias cap) because it reads the SAME
//      engine score() the tick freezes.
//   2. revealPreviewSteps(frontierDay, genome) — the deterministic preview outcome
//      (== score(frontierDay, genome), so it is the HONEST verdict the real tick
//      would produce, not a fabricated one — T-05-10) plus an ordered, timer-free
//      list of UI phases the caller plays. The module exposes the END STATE; the
//      caller owns any animation (and renders it statically under reduced motion).
//
// CLIENT-LOCAL ONLY (T-05-09): this never calls /steer, the tick, createRevealPost,
// or any server/Redis path — it only re-reads the pure engine over the in-memory
// frontier. It does NOT advance the real community.
//
// REUSE, never re-implement (prohibition): the measure + verdict come from
// src/engine/score.ts (score/measure) — the determinism spine the tick uses
// (LIVE-03). This module adds only the 0..1 meter normalization + the phase list.
import { score } from '../../engine/score';
import type { DayVector, Genome, Outcome } from '../../engine/contracts';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The live goal-meter model for the HUD (a pure projection of score()). */
export interface GoalMeter {
  /** The scored metric for the frontier (the SAME number score() produces). */
  measured: number;
  /** The goal's locked threshold (genome.dailyGoal.threshold). */
  threshold: number;
  /** Direction-aware goal sense: 'above' = beat it up, 'below' = keep it under. */
  direction: 'above' | 'below';
  /** Whether the goal is currently met (direction-aware against threshold). */
  achieved: boolean;
  /**
   * 0..1 fraction of how close the day is to the goal: 1 once achieved (at/past
   * the threshold), and a monotonic approach-fraction while short of it (a near
   * miss reads close to 1, a blow-out near 0). Clamped — never NaN, never <0/>1.
   */
  progress01: number;
}

/**
 * The per-targetParam normalization span used to turn the signed distance from the
 * threshold into the meter's 0..1 approach fraction. This is the meter's display
 * scale ONLY (the verdict itself is owned by score()); it intentionally mirrors the
 * shape of score()'s own degree normalization so the meter and the frozen verdict
 * agree about "how close" a day is:
 *   - conflict / density live on a 0..1 axis → the distance to either edge is the
 *     larger of (threshold-min) / (max-threshold), i.e. the full 0..1 span.
 *   - symmetry is an integer arm count → a small symmetric arm span keeps the meter
 *     monotonic in the (small) integer distance to the arm threshold.
 */
function approachSpan(targetParam: string, threshold: number): number {
  switch (targetParam) {
    case 'conflict':
    case 'density':
      // The miss side is the larger reach to the far edge of the 0..1 axis.
      return Math.max(threshold, 1 - threshold);
    case 'symmetry':
      // Mirrors score.ts SYMMETRY_DEGREE_SPAN (2 arms) — a one-arm shortfall reads
      // as a half-full meter, keeping it legible on the small integer arm axis.
      return 2;
    default:
      return Math.max(threshold, 1 - threshold);
  }
}

/**
 * goalMeter — the live goal-progress model for the frontier (HUD meter source).
 *
 * Reads the SAME engine score() the overnight tick freezes (LIVE-03), so the meter
 * is the honest current standing — and because score() folds the bounded steering
 * offset (GAME-03, within I-5), a nudge that biases the frontier's steering visibly
 * moves `measured`/`progress01` toward (or, away-nudge, back from) the goal. PURE:
 * no DOM, no rng — a projection of score().
 */
export function goalMeter(frontierDay: DayVector, genome: Genome): GoalMeter {
  const out = score(frontierDay, genome);
  const { goal, measured, achieved } = out;
  const threshold = goal.threshold;

  // Signed distance to the threshold in the goal-FAVORABLE direction: positive once
  // achieved (at/past), negative while short. (The same sign convention score()
  // uses internally; here we only need the short-fall side for the approach meter.)
  const signed = goal.direction === 'above' ? measured - threshold : threshold - measured;

  // Achieved → full meter. Short → a monotonic approach fraction: how far the day
  // has closed the gap from the far edge of its axis to the threshold. We express
  // it as 1 minus the normalized remaining shortfall, so moving toward the goal
  // (shrinking the shortfall) raises the meter.
  let progress01: number;
  if (achieved) {
    progress01 = 1;
  } else {
    const span = approachSpan(goal.targetParam, threshold);
    const shortfall = -signed; // > 0 while missing
    progress01 = span > 0 ? clamp01(1 - shortfall / span) : 0;
  }

  return {
    measured,
    threshold,
    direction: goal.direction,
    achieved,
    progress01,
  };
}

/** The ordered, timer-free UI phases the reveal-preview plays. */
export type RevealPhase = 'freeze' | 'resolve' | 'reward' | 'miss';

/** The deterministic preview result: the honest score() verdict + the phase list. */
export interface RevealPreview {
  /** Whether the goal was met — IDENTICAL to score(frontierDay, genome).achieved. */
  achieved: boolean;
  /** The normalized 0..1 degree — IDENTICAL to score(frontierDay, genome).degree. */
  degree: number;
  /** The resolved daily goal — IDENTICAL to score(frontierDay, genome).goal. */
  goal: Outcome['goal'];
  /**
   * The ordered phases the UI plays: always freeze → resolve, then reward (on an
   * achieved day) or miss. Pure DATA — no DOM, no timers; the caller drives timing
   * and renders the end state statically under prefers-reduced-motion.
   */
  phases: RevealPhase[];
  /** The frontier's measured metric (for the resolve readout). */
  measured: number;
}

/**
 * revealPreviewSteps — the honest, score-backed preview of tonight's reveal.
 *
 * The outcome (achieved / degree / goal) is byte-identical to the engine score()
 * the real overnight tick uses (T-05-10: a preview of the REAL thing, never
 * fabricated). It appends the ordered phase list the UI plays — reward on an
 * achieved frontier, miss otherwise. PURE: deterministic, no rng, no timers, no
 * server (CLIENT-LOCAL, T-05-09). The metric shown at `resolve` is score()'s own
 * `measured` (the engine's measure() derivation, applied inside score()) — so the
 * readout never re-derives the number independently and stays byte-exact with the
 * verdict (LIVE-03).
 */
export function revealPreviewSteps(frontierDay: DayVector, genome: Genome): RevealPreview {
  const out = score(frontierDay, genome);
  const phases: RevealPhase[] = ['freeze', 'resolve', out.achieved ? 'reward' : 'miss'];
  return {
    achieved: out.achieved,
    degree: out.degree,
    goal: out.goal,
    phases,
    measured: out.measured,
  };
}
