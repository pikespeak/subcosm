// render — the single orchestration entry: synthesis → paint → camera (ENG-04).
//
// PHASE-2 PAINT SEAM: synthesis is wired and a `Painter` seam is now declared so
// paint bolts on behind the `Scene` contract with zero synthesis rework. The
// `Painter` is an INTERFACE declared here (types only) and injected by the
// caller — the engine NEVER imports `phaser` or anything under `*/client/*`
// (lint-enforced: eslint.config.js `no-restricted-imports`, QA-03/ENG-03). The
// concrete Phaser implementation lives in `src/client/cosmos/PhaserPainter.ts`.
//
// The interactive handle methods delegate to the injected Painter when present;
// their full camera/steering behaviour lands in plans 04/05. When no Painter is
// injected (e.g. headless engine tests), they throw `notImplemented`.
//
// Imports ONLY synthesis + contracts — no paint/style/Devvit code (ENG-02/03).
import { synthesize } from './synthesis';
import type { DayVector, Genome, Scene, StyleTemplate } from './contracts';

// A nudge maps a UI param to the frontier day's `steering` field. Scatter→branch,
// Arms→symmetry, Hue→hue. `steerKnob` selects the matching `genome.steerGain`
// entry (the ParamEnum has no `hue`, so a hue nudge uses a fixed unit gain — it
// only shifts the mean of the deterministic hue hint, never the diced positions).
type SteeringParam = 'branch' | 'symmetry' | 'hue';
const STEER_KNOB: Record<SteeringParam, 'branch' | 'symmetry' | null> = {
  branch: 'branch',
  symmetry: 'symmetry',
  hue: null,
};

/**
 * Painter — the engine↔paint seam (types only; no rendering tech leaks here).
 *
 * The engine hands a style-agnostic `Scene` + the chosen `StyleTemplate` to a
 * Painter and never reaches back into raw data. A Painter is injected into
 * `render()`; the only concrete implementation is the Phaser one under
 * `src/client/cosmos/`. Methods beyond `mount` are filled in plans 03–05.
 */
export interface Painter {
  /** Paint a freshly synthesized Scene with the given style. */
  mount(scene: Scene, style: StyleTemplate): void;
  /** Plan 03: repaint only the live frontier shell (PNT-03 — everything else baked). */
  repaintFrontier(frontier: Scene['shells'][number]): void;
  /** Plan 04: move the camera focus to a given shell/day (CAM-01). */
  focus(day: number): void;
  /** Plan 05: re-mount after a re-synthesis (new data / genome / steering). */
  remount(scene: Scene, style: StyleTemplate): void;
  /** Tear down all paint/camera resources. */
  destroy(): void;
}

/**
 * The handle returned by `render()`. Exposes the synthesized `Scene` + the
 * `StyleTemplate` paint uses, plus the interactive methods that delegate to the
 * injected Painter.
 */
export interface RenderHandle {
  /** The deterministic, style-agnostic Scene produced by synthesis. */
  readonly scene: Scene;
  /** The StyleTemplate paint uses. */
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
 * render — orchestrate a universe from community data, a Genome, a Style, and an
 * (optional) Painter.
 *
 * Synthesizes the Scene, and — when a Painter is injected — mounts it for paint.
 * The returned handle's camera/steering methods delegate to that Painter
 * (filled in plans 04/05); without a Painter (headless engine tests) they throw.
 *
 * @param days    validated DayVector[] (newest first).
 * @param genome  per-community behaviour knobs (data).
 * @param style   the StyleTemplate paint maps Scene hues through.
 * @param painter optional paint seam; when present, mount() is called with the
 *                synthesized Scene. The engine never knows its concrete type.
 */
export function render(
  days: DayVector[],
  genome: Genome,
  style: StyleTemplate,
  painter?: Painter,
): RenderHandle {
  // The live render state: the day array (index 0 = frontier), the active genome,
  // and the synthesized Scene. A nudge re-synthesizes ONLY the frontier from this
  // state; a regenerate replaces the whole lot. The engine never re-parses — the
  // single DayVectorSchema boundary already ran at the sim handoff (QA-03).
  let currentDays = days;
  let currentGenome = genome;
  let scene = synthesize(currentDays, currentGenome);

  if (painter) painter.mount(scene, style);

  return {
    get scene(): Scene {
      return scene;
    },
    style,

    scrub(day: number): void {
      if (!painter) throw new Error(NOT_IMPLEMENTED);
      painter.focus(day);
    },

    /**
     * Steering nudge (STR-01/STR-02): bias the LIVE frontier day's steering MEAN
     * (scaled by the genome's steerGain), re-synthesize ONLY shells[0], and
     * repaint just that frontier layer — the frozen history is never re-baked
     * (RESEARCH Pattern 5). The nudge shifts the mean; synthesis's seeded RNG
     * still dices the actual element positions around it, so the outcome is
     * BIASED, never DICTATED (STR-02 invariant).
     */
    nudge(param: string, amount: number): void {
      if (!painter) throw new Error(NOT_IMPLEMENTED);
      const frontier = currentDays[0];
      if (!frontier) return;
      if (param !== 'branch' && param !== 'symmetry' && param !== 'hue') return;
      const key = param as SteeringParam;

      // steerGain scales the nudge per-genome (Calm/Chaotic/Crystalline differ).
      // ParamEnum has no `hue`, so a hue nudge uses a fixed unit gain.
      const knob = STEER_KNOB[key];
      const gain = knob ? (currentGenome.steerGain[knob] ?? 1) : 1;

      // Shift the frontier day's steering mean only — never dictate the outcome.
      // hue wraps at the schema's unbounded number; branch/symmetry accumulate.
      const nudged: DayVector = {
        ...frontier,
        steering: {
          ...frontier.steering,
          [key]: frontier.steering[key] + amount * gain,
        },
      };
      currentDays = [nudged, ...currentDays.slice(1)];

      // Re-synthesize ONLY the frontier day. synthesize maps index 0 → radius
      // pow(0.85,0)=1 — identical geometry to the live frontier shell, so the
      // result drops straight back into scene.shells[0] (frozen shells untouched).
      const frontierScene = synthesize([nudged], currentGenome);
      const newFrontier = frontierScene.shells[0];
      if (!newFrontier) return;
      scene = { ...scene, shells: [newFrontier, ...scene.shells.slice(1)] };
      painter.repaintFrontier(newFrontier);
    },

    regenerate(nextDays: DayVector[], nextGenome: Genome): void {
      if (!painter) throw new Error(NOT_IMPLEMENTED);
      currentDays = nextDays;
      currentGenome = nextGenome;
      scene = synthesize(currentDays, currentGenome);
      painter.remount(scene, style);
    },

    destroy(): void {
      if (!painter) throw new Error(NOT_IMPLEMENTED);
      painter.destroy();
    },
  };
}
