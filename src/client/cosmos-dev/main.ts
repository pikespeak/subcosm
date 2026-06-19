// main — the standalone Cosmos dev-page bootstrap (the end-to-end render slice).
//
// Wiring (ENG-04): fixture DayVector[] → engine render(days, genome, style,
// painter) → PhaserPainter.mount → CosmosScene paints the genesis core +
// frontier stars on a Phaser WebGL canvas. The dev page goes through the engine
// `render()` entry — it NEVER calls the synthesis function directly (render is
// the single orchestration seam).
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
  render(fixtureDays, calm, techno, painter);
}

document.addEventListener('DOMContentLoaded', boot);
