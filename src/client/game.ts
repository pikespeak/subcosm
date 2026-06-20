// game — the Subcosm interactive-post webroot mount (S2, DEV-01).
//
// This REPLACES the Phaser-template boilerplate (Boot/Preloader/MainMenu/Game/
// GameOver + the '#028af8' blue demo). It boots the engine via the single
// orchestration seam `render(days, genome, style, painter)` — it NEVER calls
// synthesis directly (the engine↔paint contract).
//
// WAVE-0 SPIKE STUB (plan 03-01): for THIS plan the day data is a trivial FIXED
// fixture (`generateDayVectors({ seed: SPIKE_SEED })`, reversed frontier-first)
// and the genome/style are the Calm/Techno preset — there is NO `/api/organism`
// fetch yet. The sole purpose of this stub is to prove that Phaser (WebGL,
// Canvas2D fallback via `type: AUTO`) actually boots and paints a real Scene
// inside the Reddit post iframe on a physical phone (RESEARCH A1/OQ1).
//
// The data-driven mount — `fetch('/api/organism')` → `safeParse` envelope →
// cold-start / error overlays → feed Ring records into this same `render()` —
// lands in plan 03-05. The dev control harness (scrubber / nudges / regenerate /
// seed) is intentionally NOT here: the Phase-3 post is a read-only render.
//
// Mirrors src/client/cosmos-dev/main.ts's Phaser config + mount sequence (the
// canonical analog), minus that page's DOM control wiring.
import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { render, type RenderHandle } from '../engine/render';
import { calm } from '../engine/genomes';
import type { DayVector } from '../engine/contracts';
import { techno } from '../styles/techno';
import { generateDayVectors } from '../sim';
import { PhaserPainter } from './cosmos/PhaserPainter';

// The post webroot stage (game.html parent div).
const PARENT = 'game-container';

// A fixed seed → a deterministic, well-told multi-shell universe for the spike.
// Re-using the simulator gives a REAL Scene (genesis core + frozen shells +
// frontier), so the device test exercises the same geometry the production
// mount will, not a throwaway single-ring fixture.
const SPIKE_SEED = 1;

/**
 * The simulator emits oldest-first (day 1 at index 0). Synthesis wants the live
 * frontier (newest day) at index 0 (radius pow(0.85,0)=1). Reverse once here —
 * identical to cosmos-dev/main.ts's `frontierFirst`.
 */
function frontierFirst(seed: number): DayVector[] {
  return [...generateDayVectors({ seed })].reverse();
}

/** Boot Phaser + mount the fixed-fixture Scene through the engine `render()`. */
function boot(): RenderHandle {
  // DPR cap at 2 (PNT-03): never render at more than 2× device pixels — keeps the
  // fill-rate budget sane on high-DPR mobile (the spike's whole point is mobile).
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const config: Phaser.Types.Core.GameConfig = {
    type: AUTO, // WebGL-preferred (PNT-01), Canvas2D fallback — the A1 probe.
    parent: PARENT,
    backgroundColor: '#04030a',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
      zoom: dpr / (window.devicePixelRatio || 1),
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };

  const days = frontierFirst(SPIKE_SEED);

  // render() is the single orchestration seam — never synthesize() here.
  const game = new Game(config);
  const painter = new PhaserPainter(game);
  return render(days, calm, techno, painter);
}

document.addEventListener('DOMContentLoaded', () => {
  boot();
});
