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
import { score } from '../engine/score';
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
import { showCoachmarkOnce } from './cosmos/coachmark';
import { revealPreviewSteps } from './cosmos/revealPreview';

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

/**
 * The target frame cadence the frontier animation is capped to (D-05 / SUB-03).
 * 60fps == a ~16.67ms target frame duration; Phaser's TimeStep frame-skip honours
 * this by skipping a step whenever the elapsed delta is below the target, so the
 * per-frame paint cost is bounded and the cadence stays consistent across refresh
 * rates (a 120Hz panel still advances at 60, not 120 — RESEARCH Q7: the webview
 * caps at 60, never chase >60). The shimmer math (ignite.ts) is wall-clock-driven
 * (`Math.sin(time * tempo)`), NOT per-frame-increment, so capping the FPS changes
 * the cadence, never the animation speed.
 */
const TARGET_FPS = 60;

/** Build the Phaser game config (mirrors cosmos-dev/main.ts; mobile DPR cap 2). */
function gameConfig(): Phaser.Types.Core.GameConfig {
  // DPR cap at 2 (PNT-03): never render at more than 2× device pixels — keeps the
  // fill-rate budget sane on high-DPR mobile.
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return {
    type: AUTO, // WebGL-preferred (PNT-01), Canvas2D fallback.
    parent: PARENT,
    backgroundColor: '#04030a',
    // Frame-skip guard (D-05): cap the rAF/TimeStep cadence to the 60fps target
    // frame duration so the per-frame cost is bounded and the speed is identical
    // across refresh rates. Phaser skips a step when delta < target (RESEARCH Q7).
    fps: { target: TARGET_FPS, min: 30, limit: TARGET_FPS, smoothStep: true },
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

// ── rAF visibility idle (D-05 / SUB-03) ───────────────────────────────────────
// When the post iframe is hidden (tab switch, scrolled far off-screen, app
// backgrounded) the browser already throttles rAF, but an explicit idle stops the
// frontier loop doing ANY wasted paint work and guarantees no per-frame cost while
// hidden. Registered on mount, REMOVED in teardown() so a re-mount never leaks a
// listener (mirrors the disconnectRealtime teardown discipline). The handler reads
// the live `game` ref so it always targets the current TimeStep.
//
// NOTE on the static first frame (RESEARCH Pitfall 5): iOS throttles rAF in a
// cross-origin iframe to ~30fps until the user interacts, so the FIRST impression
// must look good STATIC. layout() in CosmosScene always draws one static REST frame
// up front (IGNITE_REST — the sine's zero-crossing), and there is no autoplay intro
// animation here, so the first painted frame is already the intended static look;
// the live ignite shimmer is purely additive once the loop runs.
let onVisibilityChange: (() => void) | null = null;

/** Idle the frontier rAF loop while the document is hidden; resume when visible. */
function startVisibilityIdle(): void {
  // Defensive: if a prior listener somehow survived, drop it before adding a new
  // one (single source of truth — never two competing handlers).
  stopVisibilityIdle();
  onVisibilityChange = (): void => {
    const loop = game?.loop;
    if (!loop) return;
    if (document.hidden) {
      // sleep() stops Request Animation Frame and toggles `running` off — zero
      // per-frame work while hidden (Phaser TimeStep.sleep).
      loop.sleep();
    } else {
      // wake(seamless) resumes without a time jump so the wall-clock shimmer
      // continues from where it visually was (no strobe on resume).
      loop.wake(true);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
}

/** Remove the visibilitychange listener (called from teardown — no leak on re-mount). */
function stopVisibilityIdle(): void {
  if (onVisibilityChange) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange = null;
  }
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
// The active style (held so the reveal-preview re-mount uses the same look).
let activeStyle: StyleTemplate | null = null;
// The full frontier-first day array currently rendered — held so the CLIENT-LOCAL
// reveal preview can re-synthesize a frozen-frontier copy (and reset back to the
// live frontier) WITHOUT a server round-trip (T-05-09). Never sent anywhere.
let currentDays: RingRecord[] = [];
// Whether the in-session reveal preview is currently showing its frozen end-state
// (so the toggle button resets back to the live frontier on the next press).
let previewActive = false;
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
  // Remove the rAF visibility-idle listener BEFORE the game is destroyed so a late
  // visibilitychange can never reach a torn-down TimeStep, and a re-mount registers
  // exactly one fresh listener (no leak across re-mounts — D-05).
  stopVisibilityIdle();
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
  activeStyle = null;
  currentDays = [];
  // Drop any preview state + hide its panel so a re-mount starts on the live frontier.
  previewActive = false;
  setPreviewPanel(false);
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
  // Idle the frontier rAF loop while the post iframe is hidden (D-05). Registered
  // here on every mount; teardown() removes it so re-mounts never leak a listener.
  startVisibilityIdle();
  const painter = new PhaserPainter(game);
  handle = render(days, genome, style, painter);

  // Track the live frontier + genome for the HUD + nudge path. days[0] is the
  // frontier (frontierFirst reversed oldest→newest); on cold start there is no ring.
  frontier = days[0] ?? null;
  activeGenome = genome;
  activeStyle = style;
  currentDays = days;

  // Goal-tracking readout from the SAME measure the scorer freezes (GAME-03). Only
  // shown when a frontier exists (a 0-ring genesis renders no readout, never broken).
  updateHud(frontier ?? undefined, genome);

  // The nudge controls are live only once a frontier exists. Seed the budget
  // display with the genome's actionCap as the starting hint (the authoritative
  // per-user remaining arrives on the first nudge response — D-04). nudgesRemaining
  // starts at the cap so the first tap is never wrongly suppressed.
  setNudgeControlsVisible(frontier != null);
  if (frontier != null) setNudgeBudget(genome.actionCap);

  // The reveal-preview trigger is live only once a frontier exists to preview
  // (cold start has nothing to freeze/score). NOT mod-gated — any viewer (D-09 demo).
  setRevealTriggerVisible(frontier != null);

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

  // First-run onboarding (D-02 / SUB-04): show the one-time coachmark ONLY over a
  // populated universe (a frontier exists) — never on cold-start/loading/error, so
  // it overlays a cosmos the explainer can actually point at. showCoachmarkOnce
  // self-gates on the persisted 'seen' flag (re-opens no-op) and respects
  // prefers-reduced-motion internally.
  if (frontier != null) showCoachmarkOnce();
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

// ── In-session reveal preview (SUB-02 demo hook) ──────────────────────────────
// ANY viewer (no mod rights) can press "See tonight's reveal" to play a LOCAL
// freeze → score → reward-glyph sequence on the current frontier, so a judge feels
// the full goal→steer→reveal payoff in one session instead of waiting for the
// overnight, mod-gated tick. It is CLIENT-LOCAL ONLY (T-05-09): it NEVER calls
// /steer, the tick, createRevealPost, or any server/Redis path — it re-synthesizes
// a FROZEN copy of the in-memory frontier (with its honest score() outcome) via the
// existing render handle, surfacing the deterministic reward glyph paint (04-04) on
// an achieved day. It is clearly labelled a preview, and a reset restores the live
// frontier. The shown verdict is score()-backed, so it is the REAL outcome the tick
// would produce — a preview, not a fake (T-05-10).

/** Toggle the labelled preview panel (the "this is a preview" chrome + readout). */
function setPreviewPanel(visible: boolean): void {
  const panel = document.getElementById('reveal-preview');
  if (panel) panel.hidden = !visible;
}

/** Show/hide the reveal-preview trigger button (hidden on cold start). */
function setRevealTriggerVisible(visible: boolean): void {
  const trigger = document.getElementById('reveal-preview-trigger');
  if (trigger) trigger.hidden = !visible;
}

/** Reflect the resolved verdict into the preview panel's value nodes (T-02-11: values only). */
function setPreviewVerdict(achieved: boolean, measured: number, threshold: number): void {
  const result = document.getElementById('reveal-result');
  if (result) {
    // A neutral glyph + a data-state hook the CSS/i18n styles — never language text.
    result.textContent = achieved ? '✓' : '·';
    result.dataset.state = achieved ? 'achieved' : 'missed';
  }
  const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  const m = document.getElementById('reveal-measured');
  if (m) m.textContent = fmt(measured);
  const t = document.getElementById('reveal-threshold');
  if (t) t.textContent = fmt(threshold);
}

/**
 * Play the CLIENT-LOCAL reveal preview on the current frontier. Freezes the live
 * frontier by re-synthesizing a copy that carries its honest score() outcome
 * (so synthesis surfaces goalAchieved → paint bakes the reward glyph on success,
 * 04-04), shows the resolved verdict, and labels it a preview. NO server call. Under
 * prefers-reduced-motion the end-state is applied in one shot (no staged timing,
 * no strobe — PNT-04); otherwise the panel reveals first, then the freeze settles.
 */
function playRevealPreview(): void {
  if (!handle || !activeGenome || !activeStyle || !frontier) return;
  const liveFrontier = currentDays[0];
  if (!liveFrontier) return;

  // The HONEST verdict (the SAME score() the overnight tick freezes — T-05-10).
  const steps = revealPreviewSteps(liveFrontier, activeGenome);
  const outcome = score(liveFrontier, activeGenome);

  // Build the FROZEN frontier copy: identical day, now carrying its outcome so
  // synthesis surfaces goalAchieved (→ the deterministic reward glyph on success).
  // PURELY local — this never leaves the client (T-05-09).
  const frozenFrontier: RingRecord = { ...liveFrontier, outcome };

  // Reflect the resolved verdict + show the labelled preview panel.
  setPreviewVerdict(steps.achieved, steps.measured, outcome.goal.threshold);
  setPreviewPanel(true);
  previewActive = true;

  // Re-synthesize the scene with the frozen frontier (frozen shells + the now-frozen
  // frontier). regenerate() goes through the engine render seam — no server. The
  // reward glyph bakes on an achieved frontier via the unchanged paint path (04-04).
  handle.regenerate([frozenFrontier, ...currentDays.slice(1)], activeGenome);

  // reduced-motion already gets the static end-state above (regenerate paints the
  // resolved frame once; the reward glyph is a static accent — 04-04 PNT-04). No
  // staged timers/strobe are needed; the sequence phases (steps.phases) are reflected
  // by the panel label + the resolved readout, not by any animation here.
}

/** Reset the preview back to the LIVE frontier (re-synthesize without the outcome). */
function resetRevealPreview(): void {
  if (!handle || !activeGenome) return;
  const liveFrontier = currentDays[0];
  if (liveFrontier) {
    // The live frontier carries no frozen outcome → no reward glyph, the live
    // frontier animates again. Purely local (T-05-09).
    handle.regenerate([liveFrontier, ...currentDays.slice(1)], activeGenome);
  }
  setPreviewPanel(false);
  previewActive = false;
}

/** Wire the reveal-preview toggle (NOT mod-gated — any viewer) + its reset. */
function wireRevealPreview(): void {
  const trigger = document.getElementById('reveal-preview-trigger');
  trigger?.addEventListener('click', () => {
    if (previewActive) resetRevealPreview();
    else playRevealPreview();
  });
  const reset = document.getElementById('reveal-preview-reset');
  reset?.addEventListener('click', () => {
    resetRevealPreview();
  });
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

  // Wire the in-session reveal preview (SUB-02) once — NOT mod-gated, any viewer.
  wireRevealPreview();

  void loadCosmos();
});
