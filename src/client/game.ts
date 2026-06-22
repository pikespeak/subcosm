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
  SteerResponseSchema,
  SteerMsgSchema,
  type GenomeId,
  type OrganismResponse,
  type SteerParam,
  type SteerMsg,
  type SteerAggregate,
} from '../shared/api';
import { steerChannel } from '../shared/channel';
import { connectRealtime, disconnectRealtime, context } from '@devvit/web/client';
import { PhaserPainter } from './cosmos/PhaserPainter';
import { updateHud } from './cosmos/hud';

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
// The live frontier DayVector + active genome — the HUD scores these (the same
// metric the tick freezes) and the nudge re-synth biases the frontier's mean. Held
// here so the post-nudge HUD refresh and the budget gate share one source of truth.
let frontier: RingRecord | null = null;
let activeGenome: Genome | null = null;
// Whether the acting user still has budget — gates the nudge controls (D-04a).
let nudgesRemaining = Infinity;

// ── Realtime live-steer state (LIVE-01 / D-03) ────────────────────────────────
// The currently-subscribed channel name — held so teardown() can disconnect it.
let steerChannelName: string | null = null;
// The aggregate MEAN already applied to the frontier per param. applyAggregatedSteer
// reconciles to the ABSOLUTE aggregate (mean = sum / count) by nudging the DELTA
// between the new target mean and what is already applied — so a viewer converges
// to the same steered state regardless of how many messages arrived, and the acting
// user does NOT double-apply their own echoed broadcast (reconcile-to-absolute, not
// add-delta — RESEARCH Pattern 1). The three nudgeable params only.
let appliedMean: Record<SteerParam, number> = { branch: 0, symmetry: 0, hue: 0 };

function teardown(): void {
  // Disconnect the live-steer realtime channel BEFORE tearing down the render
  // stack so a late onMessage cannot reach a destroyed handle. disconnectRealtime
  // is the supported teardown (Connection.disconnect() is @deprecated — RESEARCH
  // Pattern 1). Guarded: a disconnect failure must never break teardown.
  if (steerChannelName) {
    try {
      disconnectRealtime(steerChannelName);
    } catch (err) {
      console.error('[teardown] disconnectRealtime failed', err);
    }
    steerChannelName = null;
  }
  // Reset the applied-mean baseline so a fresh mount reconciles from zero.
  appliedMean = { branch: 0, symmetry: 0, hue: 0 };

  // The engine render() destroy handle is the single teardown seam (ENG-04):
  // painter.destroy() → game.destroy() fires the Scene SHUTDOWN/DESTROY events.
  handle?.destroy();
  handle = null;
  game = null;
  frontier = null;
  activeGenome = null;
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
  //
  // GAME-04 / D-06 reward-glyph wiring: each ring in `days` is a full RingRecord
  // carrying its frozen `outcome` (the GAME-02 scoring object, plan 01). Synthesis
  // surfaces every day's `outcome.achieved` onto its Shell as `goalAchieved`, and
  // paint bakes a deterministic reward glyph onto any achieved frozen shell — so the
  // per-shell achieved flag rides this existing render path into the Scene paint,
  // identical on every client (LIVE-03). No raw outcome touches paint (ENG-02): paint
  // reads only the Scene-derived `shell.goalAchieved`.
  game = new Game(gameConfig());
  const painter = new PhaserPainter(game);
  handle = render(days, genome, style, painter);

  // Track the live frontier + genome for the HUD + nudge path. days[0] is the
  // frontier (frontierFirst reversed oldest→newest); on cold start there is no ring.
  frontier = days[0] ?? null;
  activeGenome = genome;

  // Goal-tracking readout from the SAME measure the scorer freezes (GAME-03). Only
  // shown when a frontier exists (a 0-ring genesis renders no readout, never broken).
  updateHud(frontier ?? undefined, genome);

  // The nudge controls are live only once a frontier exists. Seed the budget
  // display with the genome's actionCap as the starting hint (the authoritative
  // per-user remaining arrives on the first nudge response — D-04). nudgesRemaining
  // starts at the cap so the first tap is never wrongly suppressed.
  setNudgeControlsVisible(frontier != null);
  if (frontier != null) setNudgeBudget(genome.actionCap);

  setOverlay(data.rings.length === 0 ? 'coldstart' : 'none');

  // Reconcile the applied-mean baseline to the load-time aggregate (D-03b reload
  // source-of-truth): GET /organism already carries the live steer aggregate, so a
  // viewer that reloads converges to the current steered state and subsequent
  // realtime deltas reconcile from THAT baseline (not double-applying what the
  // load already reflected). The engine renders the served rings as-is; here we
  // only record what mean is "already accounted for" so applyAggregatedSteer nudges
  // only the residual on the next message.
  if (data.steer) {
    appliedMean = aggregateToMean(data.steer);
  }

  // LIVE-01 / D-03: subscribe to the per-post steer channel so OTHER viewers'
  // nudges converge the frontier near-real-time. Subscribe-only (the server is the
  // sole sender, T-04-10). OPTIONAL layer: if context.postId is absent or connect
  // throws, log and continue — the acting-user + reload path (D-03b, plan 02) still
  // works (graceful degrade, the locked fallback).
  if (frontier != null) connectSteerRealtime();
}

/**
 * aggregateToMean — collapse an absolute steer aggregate (summed contributions +
 * count) to the per-param MEAN the frontier should reflect. mean = sum / count;
 * an empty aggregate (count 0) is all-zeros (no division by zero). This is the
 * SAME mean the tick folds (sum / count) — the live view and the frozen ring agree.
 */
function aggregateToMean(agg: SteerAggregate | SteerMsg): Record<SteerParam, number> {
  const n = agg.count > 0 ? agg.count : 1;
  return {
    branch: agg.count > 0 ? agg.branch / n : 0,
    symmetry: agg.count > 0 ? agg.symmetry / n : 0,
    hue: agg.count > 0 ? agg.hue / n : 0,
  };
}

/**
 * applyAggregatedSteer — reconcile the frontier to the ABSOLUTE aggregate mean
 * received over realtime (T-04-09 boundary: caller has already safeParse'd). For
 * each param, nudge the frontier by the DELTA between the new target mean and the
 * mean already applied — so the frontier converges to the same steered state every
 * viewer (and the acting user, whose own broadcast echoes back) sees, WITHOUT
 * double-applying (reconcile-to-absolute, never add-delta). Biases the mean only
 * via handle.nudge (I-5 — steering biases, never dictates). A zero delta is a
 * no-op (no needless re-synth).
 */
function applyAggregatedSteer(msg: SteerMsg): void {
  if (!handle) return;
  const target = aggregateToMean(msg);
  const params: SteerParam[] = ['branch', 'symmetry', 'hue'];
  for (const p of params) {
    const delta = target[p] - appliedMean[p];
    if (delta !== 0) handle.nudge(p, delta);
  }
  appliedMean = target;

  // Keep the tracked frontier DayVector honest to the reconciled mean so a HUD
  // refresh stays consistent (the scored metric is activity-driven and stable, but
  // the steering copy must not drift from what the engine now renders).
  if (frontier) {
    frontier = {
      ...frontier,
      steering: { branch: target.branch, symmetry: target.symmetry, hue: target.hue },
    };
  }
}

/**
 * connectSteerRealtime — subscribe (SYNCHRONOUSLY, do NOT await — RESEARCH
 * Pattern 1) to the per-post steer channel. Every onMessage payload is
 * UNTRUSTED-on-the-wire (T-04-09): safeParse with SteerMsgSchema and ignore a
 * malformed message (never throw on it), then reconcile + refresh the HUD. The
 * whole layer is optional: a missing context.postId or a connect throw is logged
 * and swallowed so the acting-user + reload path (D-03b) still holds.
 */
function connectSteerRealtime(): void {
  const postId = context.postId;
  if (!postId) {
    // No post context (e.g. a dev harness) — realtime is simply off; the
    // acting-user + reload fallback covers it.
    console.warn('[realtime] no context.postId — live-steer subscribe skipped');
    return;
  }
  const channel = steerChannel(postId);
  try {
    connectRealtime<SteerMsg>({
      channel,
      onMessage: (raw) => {
        // The realtime wire is untrusted: safeParse + ignore a malformed payload
        // (T-04-09 — never throw on a hostile/garbage message). The schema's plain
        // numbers are the only accepted shape; handle.nudge clamps via the engine.
        const parsed = SteerMsgSchema.safeParse(raw);
        if (!parsed.success) {
          console.error('[realtime] ignoring malformed steer message', {
            issues: parsed.error.issues,
          });
          return;
        }
        applyAggregatedSteer(parsed.data);
        if (activeGenome) updateHud(frontier ?? undefined, activeGenome);
      },
    });
    steerChannelName = channel;
  } catch (err) {
    // Realtime unavailable on this client (D-03a degrade): log and continue. The
    // locked D-03b fallback (acting-user-local + others-on-reload) still works.
    console.error('[realtime] connectRealtime failed — degrading to reload path', err);
    steerChannelName = null;
  }
}

// ── Live-nudge controls (LIVE-01 / GAME-05) ──────────────────────────────────
// On tap: same-origin POST /api/steer (the ONLY client input is {param, amount});
// the response is safeParse'd at the UI boundary (never thrown on), the acting-user
// frontier re-synthesizes immediately (D-04 — no round-trip wait), the budget
// display updates, and the controls disable at remaining 0 (D-04a). A parse/fetch
// failure routes to the existing error overlay.

/** A single nudge step per tap — biases the frontier mean (clamped server-side to [-1,1]). */
const NUDGE_AMOUNT = 0.5;

const NUDGE_BUTTON_IDS: Record<SteerParam, string> = {
  branch: 'nudge-branch',
  symmetry: 'nudge-symmetry',
  hue: 'nudge-hue',
};

/** Show/hide the nudge panel (hidden on cold start — nothing to steer yet). */
function setNudgeControlsVisible(visible: boolean): void {
  const panel = document.getElementById('nudge-controls');
  if (panel) panel.hidden = !visible;
}

/** Reflect the remaining budget in the display + disable all controls at 0 (D-04a). */
function setNudgeBudget(remaining: number): void {
  nudgesRemaining = remaining;
  const display = document.getElementById('nudge-remaining');
  if (display) display.textContent = String(remaining);
  const disabled = remaining <= 0;
  for (const id of Object.values(NUDGE_BUTTON_IDS)) {
    const btn = document.getElementById(id) as HTMLButtonElement | null;
    if (btn) btn.disabled = disabled;
  }
}

/**
 * Send one nudge for `param`. POSTs the (server-clamped) {param, amount}, safeParses
 * the response at the UI boundary, and on success re-synthesizes the acting user's
 * frontier locally (D-04), refreshes the HUD, and updates the budget. A rejected
 * (over-budget) response still updates the display to disable the controls. A
 * parse/network failure routes to the error overlay — never a throw (CLAUDE.md §6).
 */
async function sendNudge(param: SteerParam): Promise<void> {
  if (nudgesRemaining <= 0) return; // already exhausted — ignore stray taps.
  try {
    const res = await fetch('/api/steer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ param, amount: NUDGE_AMOUNT }),
    });
    const json: unknown = await res.json();
    const parsed = SteerResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error('[sendNudge] /api/steer is not a valid SteerResponse', {
        status: res.status,
        body: json,
        issues: parsed.error.issues,
      });
      setOverlay('error');
      return;
    }

    if (parsed.data.accepted) {
      // Acting-user near-real-time: bias the frontier mean + repaint locally now,
      // no round-trip wait (D-04). The server has already SUMmed the aggregate.
      handle?.nudge(param, NUDGE_AMOUNT);
      // Advance the applied-mean baseline by this optimistic local nudge so that
      // when the server echoes our own broadcast back, applyAggregatedSteer
      // reconciles to the absolute mean WITHOUT double-applying (the echo's delta
      // against this baseline is ~0; any drift from sum/count is then corrected
      // exactly by reconcile-to-absolute — RESEARCH Pattern 1).
      appliedMean = { ...appliedMean, [param]: appliedMean[param] + NUDGE_AMOUNT };
      // Mirror the engine's frontier steering shift onto our tracked DayVector so a
      // subsequent HUD refresh stays consistent (the scored metric is activity-
      // driven, so the value is stable, but keep the copy honest to the re-synth).
      if (frontier) {
        frontier = {
          ...frontier,
          steering: {
            ...frontier.steering,
            [param]: frontier.steering[param] + NUDGE_AMOUNT,
          },
        };
      }
      if (activeGenome) updateHud(frontier ?? undefined, activeGenome);
    }
    // Accepted OR refused: trust the server's remaining (disables at 0, D-04a).
    setNudgeBudget(parsed.data.remaining);
  } catch (err) {
    console.error('[sendNudge] failed', err);
    setOverlay('error');
  }
}

/** Wire each nudge button to its param once (DOMContentLoaded). */
function wireNudgeControls(): void {
  for (const [param, id] of Object.entries(NUDGE_BUTTON_IDS) as Array<
    [SteerParam, string]
  >) {
    const btn = document.getElementById(id);
    btn?.addEventListener('click', () => {
      void sendNudge(param);
    });
  }
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
async function loadCosmos(): Promise<void> {
  setOverlay('loading');
  try {
    const res = await fetch('/api/organism');
    const json: unknown = await res.json();
    const parsed = OrganismResponseSchema.safeParse(json);
    if (!parsed.success) {
      // A bad payload (or a non-ok status body that isn't a valid envelope) is an
      // error state — never a thrown exception, never a broken render.
      console.error('[loadCosmos] /api/organism is not a valid OrganismResponse', {
        status: res.status,
        body: json,
        issues: parsed.error.issues,
      });
      teardown(); // don't leave a stale universe sitting behind the error overlay
      setOverlay('error');
      return;
    }
    mountUniverse(parsed.data);
  } catch (err) {
    // Network/offline/JSON failure OR a synchronous mount/render throw → the
    // muted-ink error overlay (no alarm-red).
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

  // Wire the live-nudge controls once (the buttons persist across re-renders).
  wireNudgeControls();

  void loadCosmos();
});
