// CosmosScene — the Phaser.Scene that paints a synthesized Scene to pixels.
//
// The draw itself lives in paint.ts (full mock parity: nebula, stars, frontier
// ignite, genesis core, vignette — all from StyleTemplate data, PNT-01/PNT-02).
// This Scene owns the lifecycle: lay the universe in on create/resize, then in
// update() animate ONLY the live frontier (shells[0]) — the pulsing ignite ring +
// star twinkle — while every frozen shell stays as its baked Image (PNT-03).
//
// Contract discipline (ENG-02): this Scene reads only the engine `Scene`
// (geometry; hue is a 0..1 hint) + the `StyleTemplate` (look). It NEVER reaches
// back for a raw DayVector. Hue → color is resolved in paint.ts through the ramp.
//
// Accessibility (PNT-04): reduced-motion.ts decides whether the frontier animates
// at all; under prefers-reduced-motion the whole surface is a single static,
// non-strobe frame and the update loop stops.
import * as Phaser from 'phaser';
import type { Scene as CosmosSceneData, StyleTemplate } from '../../engine/contracts';
import {
  SPACE_BG,
  buildRamp,
  computeFrame,
  drawIgniteRing,
  paintScene,
  repaintFrontierLayer,
  type PaintFrame,
  type PaintResult,
} from './paint';
import { prefersReducedMotion, watchReducedMotion } from './reduced-motion';
import { igniteParams, IGNITE_REST } from './ignite';
import { CameraController } from './camera';
import { attachInput } from './input';

export interface CosmosSceneInit {
  scene: CosmosSceneData;
  style: StyleTemplate;
}

export class CosmosScene extends Phaser.Scene {
  private cosmos!: CosmosSceneData;
  private style!: StyleTemplate;
  private ramp: number[] = [];
  private frame!: PaintFrame;
  private paintResult: PaintResult | null = null;
  private animate = true;
  /**
   * Cached mean energy of the live frontier (shells[0]) — feeds igniteParams'
   * tempo (D-03 energy→tempo). Computed ONCE whenever the frontier is
   * (re)established (layout / repaintFrontier), never per frame: a per-frame
   * `reduce()` over the frontier elements would be wasted work in the 60fps hot
   * path (RESEARCH Pitfall 4). 0 when there is no frontier or no elements.
   */
  private frontierEnergy = 0;
  private stopWatchingMotion: (() => void) | null = null;
  /** Independent view-state controller (CAM-01) — created in create(). */
  private controller: CameraController | null = null;

  constructor() {
    super('Cosmos');
  }

  /**
   * The CameraController exposed so the dev-page chrome (slider, HUD) drives the
   * SAME view state the in-canvas gestures do — slider/click stay in sync (D-01).
   * Available after create(); null before the Scene has booted.
   */
  getController(): CameraController | null {
    return this.controller;
  }

  /** Phaser passes the data object from `scene.start('Cosmos', data)`. */
  init(data: CosmosSceneInit): void {
    this.cosmos = data.scene;
    this.style = data.style;
    this.ramp = buildRamp(this.style);
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(SPACE_BG);

    // PNT-04: animate whenever motion is enabled (speed > 0) AND the user has NOT
    // requested reduced motion. `frontierOnly` is a SCOPE hint (which shells move,
    // not whether motion runs) — we only ever animate the frontier regardless, per
    // the 60fps perf model, so it must NOT gate animation on/off (WR-02). Otherwise
    // the whole surface is a single static, non-strobe frame.
    this.animate = this.style.motion.speed > 0 && !prefersReducedMotion();

    this.layout(this.scale.width, this.scale.height);

    // CAM-01/CAM-02: build the independent view-state controller over the main
    // camera and wire the input gestures (wheel + hand-rolled pinch + click) to
    // it. The controller reads the Scene's shell radii but never mutates it.
    this.controller = new CameraController(cam, this.cosmos);
    this.controller.setCenter(this.frame.cx, this.frame.cy);
    attachInput(this, this.controller, this.cosmos, () => this.frame);

    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.cameras.resize(size.width, size.height);
      this.children.removeAll(true);
      this.layout(size.width, size.height);
      // Re-center the view state on the new viewport (camera-only — no Scene write).
      this.controller?.setCenter(this.frame.cx, this.frame.cy);
    });

    // React live to a prefers-reduced-motion change (PNT-04): re-decide and
    // re-lay the universe so toggling the OS setting flips between animated and a
    // single static, non-strobe frame without a reload.
    this.stopWatchingMotion = watchReducedMotion((reduced) => {
      this.animate = this.style.motion.speed > 0 && !reduced;
      this.children.removeAll(true);
      this.layout(this.scale.width, this.scale.height);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopWatchingMotion?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.stopWatchingMotion?.());
  }

  /**
   * Repaint ONLY the live frontier shell after a steering nudge (STR-01 / PNT-03).
   * Swaps shells[0] for the freshly re-synthesized frontier, destroys the old
   * frontier star objects, and redraws just that layer — the baked frozen shells
   * and the genesis core are never re-rendered (RESEARCH Pattern 5). The nudge
   * biased the MEAN; synthesis already diced the new positions (STR-02).
   */
  repaintFrontier(frontier: CosmosSceneData['shells'][number]): void {
    if (!this.paintResult) return;
    // Update the stored Scene's frontier so a later resize re-lays the nudged
    // frontier (read-only swap of shells[0]; frozen shells stay identical).
    this.cosmos = { ...this.cosmos, shells: [frontier, ...this.cosmos.shells.slice(1)] };
    // Re-cache the frontier energy for the freshly nudged frontier (once, not per
    // frame — Pitfall 4). The nudge re-diced the elements, so the mean may shift.
    this.frontierEnergy = this.computeFrontierEnergy();

    const newStars = repaintFrontierLayer(
      this,
      frontier,
      this.paintResult.frontierStars,
      this.frame,
      this.style,
    );
    this.paintResult = { ...this.paintResult, frontier, frontierStars: newStars };

    // Draw one frontier frame immediately so the nudge is visible even under
    // reduced-motion (where update() does not run): the static shimmer REST frame
    // (no swing) so the animated baseline and this static frame agree (D-04).
    this.renderFrontier(0, IGNITE_REST.pulse, IGNITE_REST.twinkle);
  }

  /**
   * Mean energy of the live frontier (shells[0]) elements, or 0 when there is no
   * frontier / no elements. Called ONLY when the frontier is (re)established —
   * never per frame (Pitfall 4). A Scene value (Element.energy), never a raw
   * DayVector (ENG-02).
   */
  private computeFrontierEnergy(): number {
    const frontier = this.cosmos.shells[0];
    const els = frontier?.elements ?? [];
    if (els.length === 0) return 0;
    return els.reduce((s, e) => s + e.energy, 0) / els.length;
  }

  /** Lay the whole universe into the viewport and draw the initial frame. */
  private layout(width: number, height: number): void {
    this.frame = computeFrame(width, height);
    this.paintResult = paintScene(this, this.cosmos, this.style, this.frame);
    // Cache the frontier energy ONCE here (Pitfall 4: not per frame in update()).
    this.frontierEnergy = this.computeFrontierEnergy();

    // Always draw one frontier frame up front at the shimmer REST values (the
    // base with no time-varying swing). Under reduced-motion this is also the
    // FINAL frame: a single static, non-strobe surface (PNT-04). The rest values
    // match igniteParams' baseline so the animated loop continues seamlessly.
    this.renderFrontier(0, IGNITE_REST.pulse, IGNITE_REST.twinkle);
  }

  /**
   * update — re-render ONLY the live frontier each frame (PNT-03): the pulsing
   * ignite ring + a gentle star twinkle, scaled by StyleTemplate.motion.speed.
   * Frozen shells are baked Images and are never touched here. Skipped entirely
   * when `this.animate` is false (reduced-motion: the static frame already drawn).
   */
  override update(time: number): void {
    // Ease the camera toward its view-state target EVERY frame, even under
    // reduced-motion: this is user-initiated navigation (scrub/zoom/focus), not
    // ambient cosmos animation, so PNT-04 does not suppress it (CAM-02).
    this.controller?.update();
    // ALL new shimmer math stays BELOW this gate (PNT-04 / Pitfall 3): under
    // prefers-reduced-motion update() never runs, so the only frame is the static
    // REST frame drawn by layout()/repaintFrontier() — no animation leaks through.
    if (!this.animate || !this.paintResult) return;
    // Data-driven ignite (VIS-ANIM D-03/D-04): conflict→amplitude/hardness,
    // energy→tempo, with a mathematically bounded no-strobe pulse (proven in
    // ignite.test.ts). Read the conflict from the frontier shell's Scene meta and
    // the energy from the cached frontier scalar — never a raw DayVector (ENG-02).
    const conflict = this.cosmos.shells[0]?.meta.conflict ?? 0;
    const { pulse, twinkle } = igniteParams(
      conflict,
      this.frontierEnergy,
      time,
      this.style.motion.speed,
    );
    this.renderFrontier(time, pulse, twinkle);
  }

  /**
   * Draw the frontier frame: the ignite ring at the given pulse + the frontier
   * stars at the given twinkle. `pulse`/`twinkle` are 1 for the static
   * reduced-motion frame (no animation).
   */
  private renderFrontier(_time: number, pulse: number, twinkle: number): void {
    const result = this.paintResult;
    if (!result) return;
    drawIgniteRing(result.igniteGraphics, this.style, this.ramp, this.frame, result.frontierRadius, pulse);
    // Star twinkle: a cheap per-frame alpha breath on the live frontier stars
    // only (frozen shells are baked, untouched — PNT-03). Both Image and Star
    // implement the Alpha component, so setAlpha is always present.
    const twinkleAlpha = Math.min(1, this.style.fill.alpha + 0.3) * twinkle;
    for (const obj of result.frontierStars) {
      obj.setAlpha(twinkleAlpha);
    }
  }
}
