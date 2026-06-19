// main — the standalone Cosmos dev-page bootstrap (the end-to-end render slice).
//
// Wiring (ENG-04): fixture DayVector[] → engine render(days, genome, style,
// painter) → PhaserPainter.mount → CosmosScene paints the genesis core +
// frontier stars on a Phaser WebGL canvas. The dev page goes through the engine
// `render()` entry — it NEVER calls the synthesis function directly (render is
// the single orchestration seam).
//
// Plan 04 adds the navigation chrome around that canvas: the always-visible HUD
// readout (hud.ts) + the depth scrub slider, both driving the SAME
// CameraController the in-canvas gestures use — so the slider, click-focus,
// wheel, and pinch stay in sync (CAM-02, D-01). The HUD reads the Scene + the
// genome's daily goal; scrubbing is camera-only (CAM-01 — no re-synthesis).
//
// This page is a SEPARATE plain-vite entry (npm run cosmos), NOT a devvit.json
// entrypoint — it must not enter the shipped Devvit bundle (Pitfall 1).
import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { render } from '../../engine/render';
import { calm } from '../../engine/genomes';
import { techno } from '../../styles/techno';
import { fixtureDays } from './dev-fixture';
import { PhaserPainter } from '../cosmos/PhaserPainter';
import { Hud } from './hud';

const PARENT = 'cosmos-stage';

function boot(): void {
  // DPR cap at 2 (PNT-03 / mock l.173): never render at more than 2× device
  // pixels — keeps the fill-rate budget sane on high-DPR mobile. Phaser 4 dropped
  // the `resolution` GameConfig field; we cap the effective backing ratio via the
  // Scale Manager's zoom-bound and `autoRound` so the canvas never exceeds 2×.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const config: Phaser.Types.Core.GameConfig = {
    type: AUTO, // WebGL-preferred (PNT-01), Canvas fallback
    parent: PARENT,
    backgroundColor: '#04030a',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
      zoom: dpr / (window.devicePixelRatio || 1), // ≤1 → caps backing store at 2× DPR
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };

  const game = new Game(config);
  const painter = new PhaserPainter(game);

  // The Scene MUST come from the engine render() output — main.ts never calls
  // the synthesis function directly (ENG-04). render() mounts via the painter.
  const handle = render(fixtureDays, calm, techno, painter);

  // --- chrome: always-visible HUD + depth scrub slider ----------------------
  const hudHost = document.getElementById('hud-host');
  const slider = document.getElementById('scrub') as HTMLInputElement | null;
  const scene = handle.scene;

  // Always-visible HUD (D-02): reads Scene.shells[focus].meta + the genome's
  // daily goal for the frontier line. Built once; updated on every scrub/focus.
  const hud = hudHost ? new Hud(hudHost, scene, calm) : null;

  // The slider is INDEX-based (0 = frontier .. last = genesis). Map an index to
  // its shell day so the controller's day-keyed scrub stays the single source of
  // view-state truth.
  const dayForIndex = (index: number): number => scene.shells[index]?.day ?? 0;

  // The CameraController boots with the Scene (async). Wire the chrome to it once
  // it exists: slider drag → scrub; every focus change → HUD update + slider sync.
  const wireChrome = (): boolean => {
    const controller = painter.getController();
    if (!controller) return false;

    if (slider) {
      slider.max = String(Math.max(0, controller.shellCount - 1));
      slider.value = String(controller.currentIndex);
      // Drag the slider → fly through time (camera-only scrub — CAM-01).
      slider.addEventListener('input', () => {
        const index = Number(slider.value);
        handle.scrub(dayForIndex(index));
      });
    }

    // One source of view state: any focus change (slider, click, wheel, pinch)
    // updates the HUD AND moves the slider thumb so they never disagree (D-01).
    controller.onFocusChange((_day, index) => {
      hud?.update(index);
      if (slider) slider.value = String(index);
    });

    // Initial readout for the frontier (index 0).
    hud?.update(controller.currentIndex);
    return true;
  };

  // The Scene's create() runs on the next Phaser tick; poll briefly until the
  // controller is available, then wire the chrome exactly once.
  if (!wireChrome()) {
    const onStep = (): void => {
      if (wireChrome()) game.events.off(Phaser.Core.Events.STEP, onStep);
    };
    game.events.on(Phaser.Core.Events.STEP, onStep);
  }
}

document.addEventListener('DOMContentLoaded', boot);
