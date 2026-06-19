// camera — the CameraController: independent view state over `this.cameras.main`.
//
// CAM-01 (hard rule): the camera is a SEPARATE concern from synthesis and paint.
// It transforms the VIEW only. It READS the engine `Scene` (each shell's
// normalized `radius`, 0..1, where `shells[0]` is the live frontier) to map a
// focused day to a zoom/center target, but it NEVER writes back into the Scene —
// no Scene field assignment, no re-synthesis call on scrub. Scrubbing is
// camera-only: frozen shells stay baked, nothing is regenerated (PNT-03).
//
// View-state single source of truth: the focused shell INDEX lives here. The DOM
// slider, click-to-focus, wheel, and pinch all funnel through this controller, so
// dragging the slider and clicking a shell stay in sync (CAM-02, D-01) — every
// path calls `scrub`/`focusShell`, and a subscriber (HUD + slider) is notified.
//
// =====================================================================
// CAM-04 DESIGN-REVIEW NOTE — embeddability (multiverse outer zoom tier)
// =====================================================================
// The coordinate model here is deliberately RELATIVE, not absolute:
//   * Shell positions are normalized radii (0..1) scaled by a per-frame `rMax`
//     derived from the viewport — there are NO hard-coded pixel coordinates and
//     NO global camera singleton. The CameraController wraps the Phaser camera it
//     is handed; it does not reach for a process-wide camera.
//   * `zoom` is expressed as a clamped multiplier, and focus is an index into the
//     local Scene's shells — both are self-contained to THIS cosmos instance.
// Consequence: a future outer zoom tier (subreddits-as-galaxies multiverse) can
// nest this whole controller under a parent transform — each community cosmos
// becomes one node in a larger normalized space — WITHOUT touching this file.
// This is a design-review note only; NO multiverse code is built here (it is
// explicitly out of scope / post-MVP per ROADMAP). We just don't design it out.
// =====================================================================
import * as Phaser from 'phaser';
import type { Scene as CosmosSceneData } from '../../engine/contracts';

/** Zoom clamp — frontier reads at 1×, deep shells zoom in up to MAX_ZOOM. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 7;

/** Per-frame easing factor toward the target zoom (mock l.187: `*0.09`). */
const ZOOM_EASE = 0.09;

/** A view-state change listener (the slider + HUD subscribe to stay in sync). */
export type FocusListener = (focusDay: number, focusIndex: number) => void;

/**
 * CameraController — wraps `this.cameras.main` and holds the independent view
 * state (focused shell + target zoom). Reads `Scene.shell.radius` to map a day
 * to a target; never mutates the Scene (CAM-01).
 */
export class CameraController {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  /** READ-ONLY reference to the Scene — used only to read shell radii/days. */
  private readonly cosmos: CosmosSceneData;
  /** The world-space center the universe is laid around (viewport center). */
  private centerX = 0;
  private centerY = 0;

  /** Index into `cosmos.shells` of the currently focused shell (0 = frontier). */
  private focusIndex = 0;
  /** The eased target zoom the camera glides toward each frame. */
  private targetZoom = MIN_ZOOM;

  private readonly listeners = new Set<FocusListener>();

  constructor(camera: Phaser.Cameras.Scene2D.Camera, cosmos: CosmosSceneData) {
    this.camera = camera;
    this.cosmos = cosmos;
  }

  /** Number of shells in the Scene (the scrubber's range). */
  get shellCount(): number {
    return this.cosmos.shells.length;
  }

  /** The currently focused shell index (0 = frontier). */
  get currentIndex(): number {
    return this.focusIndex;
  }

  /** The day number of the currently focused shell (for the HUD / slider sync). */
  get currentDay(): number {
    return this.cosmos.shells[this.focusIndex]?.day ?? 0;
  }

  /** Center the camera on the universe origin (call on create/resize). */
  setCenter(x: number, y: number): void {
    this.centerX = x;
    this.centerY = y;
    this.camera.centerOn(x, y);
  }

  /** Subscribe to focus changes (slider + HUD). Returns an unsubscribe fn. */
  onFocusChange(listener: FocusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const day = this.currentDay;
    for (const l of this.listeners) l(day, this.focusIndex);
  }

  /**
   * Map a shell index to its eased zoom target. The frontier (index 0) reads at
   * 1×; deeper (smaller-radius) shells zoom IN so the focused ring fills the
   * view — mirroring the mock's `min((minD*0.34)/radii[focus], 7)` (l.186).
   * READS `shell.radius` (normalized 0..1); never writes the Scene (CAM-01).
   */
  private zoomTargetFor(index: number): number {
    if (index <= 0) return MIN_ZOOM;
    const radius = this.cosmos.shells[index]?.radius ?? 1;
    if (radius <= 0) return MAX_ZOOM;
    // 0.34 ≈ the fraction of the min-dimension a focused shell should occupy.
    const target = 0.34 / radius;
    return Phaser.Math.Clamp(target, MIN_ZOOM, MAX_ZOOM);
  }

  /**
   * scrub(day) — fly through TIME to the shell whose `day` matches (slider drag).
   * Camera-only: sets the focus + eases the zoom target. NEVER regenerates the
   * geometry and NEVER mutates the Scene (CAM-01). Falls back to nearest index if the day
   * isn't found (defensive — the slider is index-based so this normally hits).
   */
  scrub(day: number): void {
    const idx = this.cosmos.shells.findIndex((s) => s.day === day);
    this.focusTo(idx >= 0 ? idx : Phaser.Math.Clamp(day, 0, this.shellCount - 1));
  }

  /**
   * focusShell(day) — focus + zoom a CLICKED shell, keeping the slider in sync
   * (the listener moves the slider thumb). Same camera-only contract as scrub.
   */
  focusShell(day: number): void {
    this.scrub(day);
  }

  /** Focus a shell by its array index (the shared internal path). */
  focusTo(index: number): void {
    const clamped = Phaser.Math.Clamp(index, 0, Math.max(0, this.shellCount - 1));
    if (clamped === this.focusIndex) return;
    this.focusIndex = clamped;
    this.targetZoom = this.zoomTargetFor(clamped);
    this.camera.centerOn(this.centerX, this.centerY);
    this.emit();
  }

  /**
   * zoom(delta) — nudge the zoom target by a relative delta (wheel + pinch).
   * Clamped to [MIN_ZOOM, MAX_ZOOM]. Pure view state — no Scene write (CAM-02).
   */
  zoom(delta: number): void {
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom + delta, MIN_ZOOM, MAX_ZOOM);
  }

  /** Set an absolute zoom target (used by the hand-rolled pinch). */
  setZoom(value: number): void {
    this.targetZoom = Phaser.Math.Clamp(value, MIN_ZOOM, MAX_ZOOM);
  }

  /** The current eased zoom target (pinch reads this as its baseline). */
  get zoomTarget(): number {
    return this.targetZoom;
  }

  /**
   * update — ease `camera.zoom` toward the target each frame (mock l.187). The
   * camera holds the view state; nothing here touches the Scene. Phaser's own
   * `camera.zoom` is the view transform — we never hand-roll matrix math (CAM-01).
   */
  update(): void {
    const current = this.camera.zoom;
    if (Math.abs(this.targetZoom - current) < 0.0005) {
      this.camera.setZoom(this.targetZoom);
      return;
    }
    this.camera.setZoom(current + (this.targetZoom - current) * ZOOM_EASE);
  }
}
