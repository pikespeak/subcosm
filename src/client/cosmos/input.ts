// input — the navigation input layer over the CameraController (CAM-02, D-01).
//
// Three coexisting gestures, all funneled through the ONE CameraController so the
// DOM slider, click-focus, wheel, and pinch never disagree (single source of view
// state — D-01):
//   1. scroll-wheel  → CameraController.zoom(delta)
//   2. two-pointer pinch (HAND-ROLLED) → CameraController.setZoom(...)
//   3. click / tap a shell → hit-test to the nearest shell radius → focusShell(day)
//
// Phaser 4 ships NO built-in pinch gesture (RESEARCH "Don't-Hand-Roll exception"
// l.290-301; Code Example l.369-383). So we hand-roll it: `this.input.addPointer(1)`
// enables a 2nd active pointer, and on each pointermove we read the live distance
// between the two down pointers and map the ratio vs. the pinch-start distance to
// an absolute zoom. ~30 lines, no plugin install (T-02-SC: no new packages).
//
// CAM-01 discipline: input only drives the camera (view state). It reads the
// Scene's shell radii to hit-test a click, but it NEVER mutates the Scene and
// never re-synthesizes — scrub/focus are camera-only.
import * as Phaser from 'phaser';
import type { Scene as CosmosSceneData } from '../../engine/contracts';
import type { CameraController } from './camera';
import type { PaintFrame } from './paint';

/** Wheel deltaY → zoom step (negative deltaY = scroll up = zoom in). */
const WHEEL_ZOOM_STEP = 0.0015;

/**
 * attachInput — wire wheel + hand-rolled pinch + click-to-focus into the Scene,
 * all driving the given CameraController. `frame` gives the px center + rMax so a
 * click position can be hit-tested to the nearest shell radius. Returns nothing;
 * Phaser owns the listener lifetime (cleaned up on scene shutdown).
 */
export function attachInput(
  scene: Phaser.Scene,
  controller: CameraController,
  cosmos: CosmosSceneData,
  getFrame: () => PaintFrame,
): void {
  // --- 1. scroll-wheel zoom (WHEEL event deltaY → camera.zoom) ---------------
  scene.input.on(
    Phaser.Input.Events.POINTER_WHEEL,
    (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => {
      // Scroll up (deltaY < 0) zooms IN → positive zoom delta.
      controller.zoom(-dy * WHEEL_ZOOM_STEP);
    },
  );

  // --- 2. HAND-ROLLED two-pointer pinch -------------------------------------
  // Phaser tracks only 1 active pointer by default; enable a 2nd (D-01).
  scene.input.addPointer(1);
  let pinchStartDist = 0; // pointer-distance when the pinch began (0 = no pinch)
  let pinchStartZoom = 1; // the controller's zoom target when the pinch began

  const activePointers = (): Phaser.Input.Pointer[] =>
    [scene.input.pointer1, scene.input.pointer2].filter((p) => p && p.isDown);

  scene.input.on(Phaser.Input.Events.POINTER_MOVE, () => {
    const pts = activePointers();
    if (pts.length < 2) {
      pinchStartDist = 0; // dropped below two fingers → end the pinch
      return;
    }
    const dist = Phaser.Math.Distance.Between(pts[0]!.x, pts[0]!.y, pts[1]!.x, pts[1]!.y);
    if (pinchStartDist === 0) {
      // Pinch just began: capture the baseline distance + zoom.
      pinchStartDist = dist;
      pinchStartZoom = controller.zoomTarget;
      return;
    }
    // Map the distance RATIO to an absolute zoom (fingers apart → zoom in).
    const ratio = dist / pinchStartDist;
    controller.setZoom(pinchStartZoom * ratio);
  });

  const endPinch = (): void => {
    if (activePointers().length < 2) pinchStartDist = 0;
  };
  scene.input.on(Phaser.Input.Events.POINTER_UP, endPinch);

  // --- 3. click / tap a shell → focus the nearest shell ---------------------
  // A genuine click (not the end of a pinch) hit-tests the pointer's distance
  // from the universe center against each shell's px radius and focuses the
  // nearest one — keeping the slider in sync via the controller's listener.
  scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
    if (activePointers().length >= 1) return; // still pinching / dragging
    const frame = getFrame();
    // Convert the screen point to world space so the hit-test respects the
    // camera zoom (CAM-01: we ask Phaser's camera, never hand-roll the matrix).
    const world = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const clickR = Phaser.Math.Distance.Between(world.x, world.y, frame.cx, frame.cy);

    let bestIndex = 0;
    let bestErr = Infinity;
    cosmos.shells.forEach((shell, i) => {
      const shellR = shell.radius * frame.rMax;
      const err = Math.abs(shellR - clickR);
      if (err < bestErr) {
        bestErr = err;
        bestIndex = i;
      }
    });
    const day = cosmos.shells[bestIndex]?.day;
    if (day !== undefined) controller.focusShell(day);
  });
}
