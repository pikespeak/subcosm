// main — the standalone Cosmos dev-page bootstrap (the COMPLETE demo slice).
//
// Wiring (ENG-04): simulator generateDayVectors({ seed }) → engine
// render(days, genome, style, painter) → PhaserPainter.mount → CosmosScene paints
// the genesis core + frozen shells + live frontier on a Phaser WebGL canvas. The
// dev page goes through the engine `render()` entry — it NEVER calls synthesis
// directly (render is the single orchestration seam).
//
// The single DayVectorSchema validation boundary lives INSIDE the simulator
// (src/sim/generator.ts) — main.ts must NOT re-validate the sim output (QA-03).
// The throwaway dev-fixture is gone: the 30-day simulator is the canonical source.
//
// Control harness (QA-01): the depth scrubber + the three steering nudges
// (Scatter→branch, Arms→symmetry, Hue→hue), Regenerate (new seed), the Seed field
// (re-entering a seed reproduces the IDENTICAL universe — SIM-03/SC-3), and the
// Calm/Chaotic/Crystalline genome-preset selector (TPL-03/D-05). Nudges re-synth
// only the live frontier and bias the MEAN (STR-01/STR-02); Regenerate persists
// nothing (no stored state in Phase 2 → no confirmation dialog).
//
// This page is a SEPARATE plain-vite entry (npm run cosmos), NOT a devvit.json
// entrypoint — it must not enter the shipped Devvit bundle (Pitfall 1).
import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { render, type RenderHandle } from '../../engine/render';
import { calm, chaotic, crystalline } from '../../engine/genomes';
import type { Genome, StyleTemplate, DayVector } from '../../engine/contracts';
import { techno } from '../../styles/techno';
import { crystalline as crystallineStyle } from '../../styles/crystalline';
import { generateDayVectors } from '../../sim';
import { PhaserPainter } from '../cosmos/PhaserPainter';
import { Hud } from './hud';

const PARENT = 'cosmos-stage';

/** A genome-preset option: the behaviour genome + the look it pairs with. */
type PresetId = 'calm' | 'chaotic' | 'crystalline';
const PRESETS: Record<PresetId, { genome: Genome; style: StyleTemplate }> = {
  // Calm / Chaotic are genome BEHAVIOUR on the Techno look; Crystalline pairs the
  // crystalline genome with the ice-blue faceted crystalline STYLE (D-05). The
  // axis each preset changes stays honest — genome vs style — with no engine
  // branch on the preset name (the template-engine bet).
  calm: { genome: calm, style: techno },
  chaotic: { genome: chaotic, style: techno },
  crystalline: { genome: crystalline, style: crystallineStyle },
};

/** Nudge param mapping (UI label → DayVector.steering field). UI-SPEC copy. */
const NUDGE_AMOUNT = { branch: 0.16, symmetry: 1, hue: 24 } as const;

/** Coerce the seed field to a valid integer; on bad input → a random valid seed (V5). */
function coerceSeed(raw: string): { seed: number; fellBack: boolean } {
  const trimmed = raw.trim();
  const n = Number(trimmed);
  if (trimmed !== '' && Number.isFinite(n)) {
    return { seed: Math.trunc(n) | 0, fellBack: false };
  }
  // Non-parseable → a random valid 32-bit seed (never a broken canvas — V5).
  return { seed: (Math.floor(Math.random() * 0xffffffff) | 0), fellBack: true };
}

/** A fresh random valid seed (Regenerate's "new seed"). */
function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) | 0;
}

/** The simulator emits oldest-first (day 1 at index 0). Synthesis wants the live
 * frontier (newest day) at index 0 (radius pow(0.85,0)=1). Reverse once here. */
function frontierFirst(seed: number): DayVector[] {
  return [...generateDayVectors({ seed })].reverse();
}

function boot(): void {
  // DPR cap at 2 (PNT-03 / mock l.173): never render at more than 2× device
  // pixels — keeps the fill-rate budget sane on high-DPR mobile.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const config: Phaser.Types.Core.GameConfig = {
    type: AUTO, // WebGL-preferred (PNT-01), Canvas fallback
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

  // ---- DOM controls (queried once) -----------------------------------------
  const hudHost = document.getElementById('hud-host');
  const slider = document.getElementById('scrub') as HTMLInputElement | null;
  const seedField = document.getElementById('seed') as HTMLInputElement | null;
  const genomeSelect = document.getElementById('genome') as HTMLSelectElement | null;
  const regenerateBtn = document.getElementById('regenerate');
  const seedNote = document.getElementById('seed-note');
  const nudgeBtns = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-nudge]'),
  );

  // ---- live render state (rebuilt on regenerate / preset change) -----------
  let game: Phaser.Game | null = null;
  let painter: PhaserPainter | null = null;
  let handle: RenderHandle | null = null;
  let hud: Hud | null = null;
  let preset: PresetId = 'calm';
  let currentSeed = randomSeed();

  // The slider is INDEX-based (0 = frontier .. last = genesis). Map an index to
  // its shell day so the controller's day-keyed scrub stays the source of truth.
  const dayForIndex = (index: number): number =>
    handle?.scene.shells[index]?.day ?? 0;

  // Wire the camera-driven chrome (slider + HUD) once the Scene's controller
  // exists. Re-run after every (re)mount so the new Scene's controller is wired.
  const wireChrome = (): boolean => {
    const controller = painter?.getController();
    if (!controller || !handle) return false;

    if (slider) {
      slider.max = String(Math.max(0, controller.shellCount - 1));
      slider.value = String(controller.currentIndex);
      slider.oninput = (): void => {
        handle?.scrub(dayForIndex(Number(slider.value)));
      };
    }

    controller.onFocusChange((_day, index) => {
      hud?.update(index);
      if (slider) slider.value = String(index);
    });

    hud?.update(controller.currentIndex);
    return true;
  };

  // Tear down the PREVIOUS render stack completely before building a new one.
  // Called on every re-render trigger (preset switch, Regenerate, seed commit).
  // Without this, each rebuild leaked: the old `.hud` DOM panel stacked under a
  // fresh one (three "DAY 30" panels after calm→chaotic→crystalline), and the
  // old Phaser game (its update loop + the native `wheel` listener attached in
  // input.ts + the Phaser POINTER_* handlers) kept running alongside the new one.
  //   - HUD: dev-page chrome → torn down here via Hud.destroy().
  //   - Paint/camera/game/loop/listeners: the engine `render()` destroy handle
  //     (ENG-04) is the single teardown seam → painter.destroy() → game.destroy().
  //     game.destroy fires the Scene SHUTDOWN/DESTROY events that input.ts hooks
  //     to remove its native `wheel` listener (no leaked listeners after teardown).
  // Null the references so a later trigger can't double-destroy a stale handle.
  const teardown = (): void => {
    hud?.destroy();
    hud = null;
    handle?.destroy(); // → PhaserPainter.destroy() → game.destroy(true)
    handle = null;
    painter = null;
    game = null;
  };

  // Build (or rebuild) the whole render stack for the current seed + preset. A
  // preset change can swap the STYLE too, so we tear the game down and re-render
  // rather than threading a style through the (style-fixed) render handle.
  const buildUniverse = (): void => {
    teardown(); // exactly one HUD + one Phaser game/loop survives a rebuild
    const { genome, style } = PRESETS[preset];
    const days = frontierFirst(currentSeed);

    game = new Game(config);
    painter = new PhaserPainter(game);
    // render() is the single orchestration seam (ENG-04) — never synthesize here.
    handle = render(days, genome, style, painter);

    hud = hudHost ? new Hud(hudHost, handle.scene, genome) : null;
    if (seedField) seedField.value = String(currentSeed);

    // The Scene's create() runs on the next Phaser tick; poll until the
    // controller exists, then wire the chrome exactly once.
    if (!wireChrome()) {
      const onStep = (): void => {
        if (wireChrome()) game?.events.off(Phaser.Core.Events.STEP, onStep);
      };
      game.events.on(Phaser.Core.Events.STEP, onStep);
    }
  };

  // Clear any transient seed-note (e.g. the bad-seed fallback message).
  const clearSeedNote = (): void => {
    if (seedNote) {
      seedNote.textContent = '';
      seedNote.hidden = true;
    }
  };

  // ---- controls -------------------------------------------------------------

  // Nudges: bias the live frontier mean + re-synth only shells[0] (STR-01/02).
  for (const btn of nudgeBtns) {
    const param = btn.dataset.nudge as keyof typeof NUDGE_AMOUNT | undefined;
    if (!param || !(param in NUDGE_AMOUNT)) continue;
    btn.addEventListener('click', () => {
      handle?.nudge(param, NUDGE_AMOUNT[param]);
    });
  }

  // Regenerate: a NEW seed → a different (but still well-told) universe; reflect
  // the new seed in the field. Persists nothing (no confirmation — UI-SPEC).
  regenerateBtn?.addEventListener('click', () => {
    currentSeed = randomSeed();
    clearSeedNote();
    buildUniverse();
  });

  // Seed field: re-entering a prior seed reproduces the IDENTICAL universe
  // (SIM-03/SC-3). On a non-parseable seed, fall back to a random valid seed and
  // show the UI-SPEC error copy — never a broken canvas (V5).
  const applySeedField = (): void => {
    if (!seedField) return;
    const { seed, fellBack } = coerceSeed(seedField.value);
    currentSeed = seed;
    if (fellBack && seedNote) {
      seedNote.textContent = "That seed isn't valid — using a random one instead.";
      seedNote.hidden = false;
    } else {
      clearSeedNote();
    }
    buildUniverse();
  };
  seedField?.addEventListener('change', applySeedField);

  // Genome preset: switching regenerates with that genome (same seed), proving
  // TPL-03/D-05 visibly from the same data. Crystalline also swaps the style.
  genomeSelect?.addEventListener('change', () => {
    const next = genomeSelect.value as PresetId;
    if (next in PRESETS) {
      preset = next;
      buildUniverse();
    }
  });

  // ---- first paint ----------------------------------------------------------
  if (seedField && seedField.value.trim() !== '') {
    // Honor a seed pre-filled in the HTML (deterministic first boot).
    const { seed } = coerceSeed(seedField.value);
    currentSeed = seed;
  }
  buildUniverse();
}

document.addEventListener('DOMContentLoaded', boot);
