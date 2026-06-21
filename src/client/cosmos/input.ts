// input — the navigation input layer over the CameraController (CAM-02, D-01).
//
// Coexisting gestures, all funneled through the ONE CameraController so the DOM
// slider, click-focus, wheel, pinch, and drag never disagree (single source of
// view state — D-01):
//   1. scroll-wheel  → CameraController.zoom(delta)
//   2. TRACKPAD pinch (desktop/laptop ctrl+wheel) → CameraController.zoom(delta)
//   3. two-pointer pinch (HAND-ROLLED, touch) → CameraController.setZoom(...)
//   4. one-finger DRAG (touch/mouse) → CameraController.pan(dx, dy)
//   5. click / tap a shell → hit-test to the nearest shell radius → focusShell(day)
//
// A tap and the end of a pinch/drag both surface as POINTER_UP. We track per-gesture
// "moved" + "multi-touch" flags so ONLY a clean tap (no drag, no second finger)
// focuses a shell — otherwise lifting the fingers after a pinch would fire focusShell
// and reset the zoom the user just pinched to.
//
// Browsers deliver a TRACKPAD pinch as a native `wheel` event with `ctrlKey===true`
// (NOT as two pointers). Without explicit handling the browser performs its default
// ctrl+wheel PAGE zoom. So we attach a native `wheel` listener with
// `{ passive: false }` (required so `preventDefault()` works) on the Phaser canvas:
// when `ctrlKey` is set we cancel the page zoom and drive the camera instead. To
// avoid DOUBLE-zoom — Phaser's POINTER_WHEEL fires for the SAME native event — the
// Phaser handler early-returns whenever the originating wheel event had `ctrlKey`,
// so a ctrl+wheel tick is handled in exactly ONE place (the native listener).
//
// Phaser 4 ships NO built-in pinch gesture (RESEARCH "Don't-Hand-Roll exception"
// l.290-301; Code Example l.369-383). So we hand-roll the TOUCH pinch:
// `this.input.addPointer(1)` enables a 2nd active pointer, and on each pointermove
// we read the live distance between the two down pointers and map the ratio vs. the
// pinch-start distance to an absolute zoom. ~30 lines, no plugin install
// (T-02-SC: no new packages).
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
 * Trackpad-pinch (ctrl+wheel) deltaY → zoom step. A trackpad pinch reports a much
 * smaller `deltaY` per gesture tick than a notched mouse wheel, so it needs a
 * larger multiplier than WHEEL_ZOOM_STEP for a comparably smooth feel.
 */
const TRACKPAD_PINCH_STEP = 0.01;

/** True when a Phaser pointer's originating DOM event is a ctrl+wheel (trackpad pinch). */
const isCtrlWheel = (pointer: Phaser.Input.Pointer): boolean => {
  const ev = pointer.event;
  return ev instanceof WheelEvent && ev.ctrlKey;
};

/**
 * attachInput — wire wheel + trackpad-pinch + hand-rolled touch-pinch +
 * click-to-focus into the Scene, all driving the given CameraController. `frame`
 * gives the px center + rMax so a click position can be hit-tested to the nearest
 * shell radius. Phaser owns the POINTER_* listener lifetime; the one raw
 * `addEventListener` (trackpad pinch) is removed on scene SHUTDOWN/DESTROY.
 */
export function attachInput(
  scene: Phaser.Scene,
  controller: CameraController,
  cosmos: CosmosSceneData,
  getFrame: () => PaintFrame,
): void {
  // --- 1. scroll-wheel zoom (WHEEL event deltaY → camera.zoom) ---------------
  // The Phaser POINTER_WHEEL signature is (pointer, currentlyOver, dx, dy, dz);
  // we read the delta off the pointer itself so the source of truth is explicit.
  scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (pointer: Phaser.Input.Pointer) => {
    // A ctrl+wheel event is a TRACKPAD pinch — handled by the native `wheel`
    // listener below. Early-return here so a single tick = a single zoom step
    // (no double-zoom from both paths firing on the same native event).
    if (isCtrlWheel(pointer)) return;
    // Scroll up (deltaY < 0) zooms IN → positive zoom delta.
    controller.zoom(-pointer.deltaY * WHEEL_ZOOM_STEP);
  });

  // --- 1b. TRACKPAD pinch (native ctrl+wheel) → camera.zoom ------------------
  // Desktop/laptop trackpad pinch arrives as a native `wheel` with ctrlKey set,
  // NOT as two pointers. We must use a raw listener with `{ passive: false }` so
  // `preventDefault()` actually suppresses the browser's default page zoom.
  const canvas = scene.game.canvas;
  const onTrackpadPinch = (e: WheelEvent): void => {
    if (!e.ctrlKey) return; // plain scroll → leave it to the Phaser handler above
    e.preventDefault(); // stop the browser from page-zooming
    // Pinch out (deltaY < 0) zooms IN → positive zoom delta.
    controller.zoom(-e.deltaY * TRACKPAD_PINCH_STEP);
  };
  canvas.addEventListener('wheel', onTrackpadPinch, { passive: false });
  const detachTrackpadPinch = (): void =>
    canvas.removeEventListener('wheel', onTrackpadPinch);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, detachTrackpadPinch);
  scene.events.once(Phaser.Scenes.Events.DESTROY, detachTrackpadPinch);

  // --- 2. TOUCH gestures: one-finger DRAG → pan, two-finger PINCH → zoom -----
  // Phaser tracks only 1 active pointer by default; enable a 2nd for pinch (D-01).
  scene.input.addPointer(1);

  let pinchStartDist = 0; // pointer-distance when the pinch began (0 = no pinch)
  let pinchStartZoom = 1; // the controller's zoom target when the pinch began
  let panLastX = 0; // last screen x of the active one-finger drag
  let panLastY = 0; // last screen y of the active one-finger drag
  let panStartX = 0; // screen x where the current touch first went down
  let panStartY = 0; // screen y where the current touch first went down
  let panPrimed = false; // a single finger is down and panLast is initialized
  let gestureMoved = false; // the gesture dragged/pinched past the slop → not a tap
  let gestureMultiTouch = false; // ≥2 fingers were seen this gesture → a pinch

  // Movement (px) beyond which a touch is a DRAG, not a tap. Below it, a release
  // focuses the nearest shell; at/above it the release is swallowed so a drag (or
  // the tail of a pinch) never snaps the camera back to a shell's zoom.
  const TAP_SLOP = 8;

  const activePointers = (): Phaser.Input.Pointer[] =>
    [scene.input.pointer1, scene.input.pointer2].filter((p) => p && p.isDown);

  scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
    const n = activePointers().length;
    if (n >= 2) {
      // Second finger down → this is a pinch; baseline captured on the next move.
      gestureMultiTouch = true;
      panPrimed = false;
    } else if (n === 1) {
      // First finger of a fresh gesture — prime the pan origin.
      gestureMoved = false;
      gestureMultiTouch = false;
      panStartX = pointer.x;
      panStartY = pointer.y;
      panLastX = pointer.x;
      panLastY = pointer.y;
      panPrimed = true;
    }
  });

  scene.input.on(Phaser.Input.Events.POINTER_MOVE, () => {
    const pts = activePointers();

    if (pts.length >= 2) {
      // two-finger pinch → absolute zoom (hand-rolled; Phaser 4 ships no pinch).
      gestureMultiTouch = true;
      gestureMoved = true;
      panPrimed = false;
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
      return;
    }

    if (pts.length === 1) {
      // one-finger drag → pan. Any single-finger move ends a pinch baseline.
      const p = pts[0]!;
      pinchStartDist = 0;
      if (!panPrimed) {
        panStartX = p.x;
        panStartY = p.y;
        panLastX = p.x;
        panLastY = p.y;
        panPrimed = true;
        return; // first sample only establishes the origin (no jump)
      }
      const dx = p.x - panLastX;
      const dy = p.y - panLastY;
      panLastX = p.x;
      panLastY = p.y;
      if (dx !== 0 || dy !== 0) controller.pan(dx, dy);
      if (Math.hypot(p.x - panStartX, p.y - panStartY) > TAP_SLOP) gestureMoved = true;
      return;
    }

    // 0 active pointers
    pinchStartDist = 0;
    panPrimed = false;
  });

  // --- 3. release: a CLEAN TAP focuses the nearest shell --------------------
  // A pinch or a drag is NOT a tap — swallowing those releases is what stops the
  // end of a pinch from firing focusShell and resetting the just-pinched zoom.
  scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
    if (activePointers().length >= 1) return; // fingers still down → wait
    const wasPinch = gestureMultiTouch;
    const wasDrag = gestureMoved;
    // Reset gesture state for the next touch.
    pinchStartDist = 0;
    panPrimed = false;
    gestureMultiTouch = false;
    gestureMoved = false;
    if (wasPinch || wasDrag) return; // pinch/drag tail → never focus (would reset zoom)

    const frame = getFrame();
    // Convert the screen point to world space so the hit-test respects the camera
    // zoom + pan (CAM-01: we ask Phaser's camera, never hand-roll the matrix).
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
