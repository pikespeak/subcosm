// render — the single orchestration entry: synthesis → paint → camera (ENG-04).
//
// PHASE-1 STUB (RESEARCH Open Question 1 / Assumption A4 — RESOLVED): the typed
// signature is final and synthesis is wired NOW, so Phase 2 paint + camera bolt
// on behind the `Scene` seam with zero synthesis rework. The interactive handle
// methods (`scrub`/`nudge`/`regenerate`/`destroy`) are DECLARED with their final
// shape but throw `error.engine.render.notImplemented` — their bodies land in
// Phase 2 alongside paint + camera. This is the agreed Phase-1 Definition of Done
// for ENG-04 (not the full live render loop).
//
// Imports ONLY synthesis + contracts — no paint/style/Devvit code yet (ENG-02/03).
import { synthesize } from './synthesis';
import type { DayVector, Genome, Scene, StyleTemplate } from './contracts';

/**
 * The handle returned by `render()`. In Phase 1 it exposes the synthesized
 * `Scene`; the interactive methods are typed stubs filled in Phase 2.
 */
export interface RenderHandle {
  /** The deterministic, style-agnostic Scene produced by synthesis. */
  readonly scene: Scene;
  /** The StyleTemplate paint will use (held now, consumed in Phase 2). */
  readonly style: StyleTemplate;

  /** Phase 2: move the camera focus to a given shell/day. */
  scrub(day: number): void;
  /** Phase 2: apply a steering nudge at the frontier. */
  nudge(param: string, amount: number): void;
  /** Phase 2: re-synthesize after new data / a genome change. */
  regenerate(days: DayVector[], genome: Genome): void;
  /** Phase 2: tear down the paint/camera resources. */
  destroy(): void;
}

const NOT_IMPLEMENTED = 'error.engine.render.notImplemented';

/**
 * render — orchestrate a universe from community data, a Genome, and a Style.
 *
 * Phase 1: synthesizes the Scene and returns a handle holding it; paint + camera
 * are deferred to Phase 2 (the methods throw until then).
 *
 * @param days   validated DayVector[] (newest first).
 * @param genome per-community behaviour knobs (data).
 * @param style  the StyleTemplate (held for Phase-2 paint; synthesis ignores it).
 */
export function render(
  days: DayVector[],
  genome: Genome,
  style: StyleTemplate,
): RenderHandle {
  const scene = synthesize(days, genome);

  return {
    scene,
    style,
    // --- Phase 2 stubs (ASSUMED Phase-1 DoD per resolved Open Question 1) ---
    scrub(_day: number): void {
      throw new Error(NOT_IMPLEMENTED);
    },
    nudge(_param: string, _amount: number): void {
      throw new Error(NOT_IMPLEMENTED);
    },
    regenerate(_days: DayVector[], _genome: Genome): void {
      throw new Error(NOT_IMPLEMENTED);
    },
    destroy(): void {
      throw new Error(NOT_IMPLEMENTED);
    },
  };
}
