// game — the Subcosm interactive-post webroot mount (S2, DEV-01 / DEV-05).
//
// THE DATA-DRIVEN MOUNT (plan 03-05): the post now fetches the community's real
// accumulated universe and renders it. It REPLACES the 03-01 fixed-fixture spike
// stub (which proved Phaser/WebGL boots in the Reddit post iframe) with the
// production read path: same-origin `fetch('/api/organism')` → `safeParse` the
// `OrganismResponse` envelope → branch to loading / cold-start / error / render,
// feeding the server's Ring records into the UNCHANGED engine `render()` seam.
//
// Boundary discipline (CLAUDE.md §6): the client NEVER throws on a bad payload —
// it `safeParse`s at the UI boundary and routes a parse/fetch failure to the
// muted-ink error overlay (T-03-12). It calls `render()` (the single orchestration
// seam) — NEVER `synthesize()` directly. Rings arrive already RingRecord-parsed
// from the server's single read boundary (03-03), so the client does NOT re-parse
// on the hot path (Pitfall 6).
//
// Same-origin only (RESEARCH Pattern 1 / Pitfall 1): the client talks to its own
// server via `fetch('/api/...')` — NO `postMessage`.
//
// Mirrors src/client/cosmos-dev/main.ts's Phaser config + mount sequence (the
// canonical analog), minus that dev page's control harness (scrubber / nudges /
// regenerate / seed) — the Phase-3 post is a READ-ONLY render (UI-SPEC S2).
import * as Phaser from 'phaser';
import { AUTO, Game } from 'phaser';
import { render, type RenderHandle } from '../engine/render';
import { calm, chaotic, crystalline } from '../engine/genomes';
import type { Genome, StyleTemplate, RingRecord } from '../engine/contracts';
import { techno } from '../styles/techno';
import { crystalline as crystallineStyle } from '../styles/crystalline';
import {
  OrganismResponseSchema,
  type GenomeId,
  type OrganismResponse,
} from '../shared/api';
import { PhaserPainter } from './cosmos/PhaserPainter';

// The post webroot stage (game.html parent div).
const PARENT = 'game-container';

/** Resolve a config genome id → its engine genome (behaviour DATA). */
const GENOMES: Record<GenomeId, Genome> = {
  calm,
  chaotic,
  crystalline,
};

/**
 * Resolve a config style id → its engine StyleTemplate (look DATA). Only `techno`
 * is authored this phase (the Crystalline LOOK is a techno-id variant); the
 * contract's `comic`/`pixel` ids are not yet implemented, so they fall back to
 * the techno look rather than ever yielding a broken canvas (V5 / UI-SPEC S4).
 */
const STYLES: Record<string, StyleTemplate> = {
  techno,
  // The crystalline style module carries id:'techno' but a distinct ice-blue look.
  // It is offered only via the genome preset, not the StyleId enum — kept here so
  // a future StyleId can map to it without an engine change.
  crystalline: crystallineStyle,
};

/**
 * The simulator/server emit oldest-first (day 1 / genesis at index 0). Synthesis
 * wants the live frontier (newest day) at index 0 (radius pow(0.85,0)=1). Reverse
 * once here — identical to cosmos-dev/main.ts's `frontierFirst`. RingRecord
 * extends DayVector, so the reversed array drops straight into `render()`.
 */
function frontierFirst(rings: RingRecord[]): RingRecord[] {
  return [...rings].reverse();
}

/** Build the Phaser game config (mirrors cosmos-dev/main.ts; mobile DPR cap 2). */
function gameConfig(): Phaser.Types.Core.GameConfig {
  // DPR cap at 2 (PNT-03): never render at more than 2× device pixels — keeps the
  // fill-rate budget sane on high-DPR mobile.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return {
    type: AUTO, // WebGL-preferred (PNT-01), Canvas2D fallback.
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
}

// ── Overlay state machine (UI-SPEC S3) ───────────────────────────────────────
// Exactly one of loading / cold-start / error is visible at a time (or none, once
// a populated universe is rendered). All copy lives in game.html behind i18n
// keys; we only toggle the [hidden] attribute — never inject language text here.
type OverlayState = 'loading' | 'coldstart' | 'error' | 'none';

function setOverlay(state: OverlayState): void {
  const ids: Record<Exclude<OverlayState, 'none'>, string> = {
    loading: 'state-loading',
    coldstart: 'state-coldstart',
    error: 'state-error',
  };
  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.hidden = key !== state;
  }
}

/** Live render stack — torn down before a retry re-render (no leaked game/loop). */
let game: Phaser.Game | null = null;
let handle: RenderHandle | null = null;

function teardown(): void {
  // The engine render() destroy handle is the single teardown seam (ENG-04):
  // painter.destroy() → game.destroy() fires the Scene SHUTDOWN/DESTROY events.
  handle?.destroy();
  handle = null;
  game = null;
}

/**
 * Mount the universe for a parsed envelope. Cold-start (0 rings) renders the
 * genesis-core-only universe AND shows the Genesis overlay — intentional, never
 * empty/broken (D-04). Otherwise the real accumulated rings render frontier-first.
 */
function mountUniverse(data: OrganismResponse): void {
  teardown();

  const genome = GENOMES[data.genome];
  // Config style id wins for paint; fall back to techno for an unimplemented id.
  const style = STYLES[data.style] ?? techno;
  const days = frontierFirst(data.rings);

  // render() is the single orchestration seam — never synthesize() here. With
  // zero rings, render()/synthesis produces the genesis-core-only Scene (D-04).
  game = new Game(gameConfig());
  const painter = new PhaserPainter(game);
  handle = render(days, genome, style, painter);

  setOverlay(data.rings.length === 0 ? 'coldstart' : 'none');
}

/**
 * loadCosmos — fetch the community's universe and render it (RESEARCH Pattern 1).
 *
 * Same-origin `fetch('/api/organism')` (NO postMessage — Pitfall 1); the response
 * is `safeParse`d at the UI boundary so a malformed/hostile payload or a network
 * failure routes to the muted-ink error overlay (with retry) rather than throwing
 * or painting a broken canvas (CLAUDE.md §6 / T-03-12). The loading overlay is
 * shown until the fetch resolves.
 */
/** TEMP (UAT): mirror client render diagnostics to the server/playtest terminal. */
function report(payload: Record<string, unknown>): void {
  void fetch('/api/client-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function loadCosmos(): Promise<void> {
  setOverlay('loading');
  report({ stage: 'start' });
  try {
    const res = await fetch('/api/organism');
    const json: unknown = await res.json();
    const parsed = OrganismResponseSchema.safeParse(json);
    if (!parsed.success) {
      // A bad payload (or a non-ok status body that isn't a valid envelope) is an
      // error state — never a thrown exception, never a broken render. Log the
      // cause (HTTP status + body + parse issues) so a failure is diagnosable.
      report({ stage: 'parse-fail', status: res.status, issues: parsed.error.issues, body: json });
      console.error('[loadCosmos] /api/organism is not a valid OrganismResponse', {
        status: res.status,
        body: json,
        issues: parsed.error.issues,
      });
      teardown(); // don't leave a stale universe sitting behind the error overlay
      setOverlay('error');
      return;
    }
    report({ stage: 'parsed', rings: parsed.data.rings.length, genome: parsed.data.genome, style: parsed.data.style });
    mountUniverse(parsed.data);
    report({ stage: 'mounted', rings: parsed.data.rings.length });
  } catch (err) {
    // Network/offline/JSON failure OR a synchronous mount/render throw → the
    // muted-ink error overlay (no alarm-red). Report the message so we know which.
    report({ stage: 'threw', message: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
    console.error('[loadCosmos] failed', err);
    teardown(); // don't leave a stale universe sitting behind the error overlay
    setOverlay('error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // The retry affordance re-runs the whole fetch→parse→render flow.
  const retry = document.getElementById('state-error-retry');
  retry?.addEventListener('click', () => {
    void loadCosmos();
  });

  void loadCosmos();
});
