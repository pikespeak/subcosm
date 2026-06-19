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
  type PaintFrame,
  type PaintResult,
} from './paint';
import { prefersReducedMotion, watchReducedMotion } from './reduced-motion';
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

    // PNT-04: only animate when the user has NOT requested reduced motion AND the
    // style says the frontier animates. Otherwise the whole surface is static.
    this.animate = this.style.motion.frontierOnly && !prefersReducedMotion();

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
      this.animate = this.style.motion.frontierOnly && !reduced;
      this.children.removeAll(true);
      this.layout(this.scale.width, this.scale.height);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopWatchingMotion?.());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.stopWatchingMotion?.());
  }

  /** Lay the whole universe into the viewport and draw the initial frame. */
  private layout(width: number, height: number): void {
    this.frame = computeFrame(width, height);
    this.paintResult = paintScene(this, this.cosmos, this.style, this.frame);

    // Always draw one frontier frame up front. Under reduced-motion this is the
    // FINAL frame too: ignite fully on (pulse=1), no twinkle, no further updates
    // (PNT-04 — a static, non-strobe surface).
    this.renderFrontier(0, this.animate ? 0.8 : 1, this.animate ? 1 : 1);
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
    if (!this.animate || !this.paintResult) return;
    const speed = this.style.motion.speed;
    // Pulsing ignite (mock l.227: 0.55 + 0.45*sin) and star twinkle (mock l.234).
    const pulse = 0.55 + 0.45 * Math.sin(time * 0.0022 * speed);
    const twinkle = 0.72 + 0.28 * Math.sin(time * 0.004 * speed);
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
