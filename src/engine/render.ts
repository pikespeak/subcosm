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
  let scene = synthesize(days, genome);

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

    nudge(_param: string, _amount: number): void {
      // Plan 05 — steering nudges the frontier mean then re-synthesizes.
      throw new Error(NOT_IMPLEMENTED);
    },

    regenerate(nextDays: DayVector[], nextGenome: Genome): void {
      if (!painter) throw new Error(NOT_IMPLEMENTED);
      scene = synthesize(nextDays, nextGenome);
      painter.remount(scene, style);
    },

    destroy(): void {
      if (!painter) throw new Error(NOT_IMPLEMENTED);
      painter.destroy();
    },
  };
}
