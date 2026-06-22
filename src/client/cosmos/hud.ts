// hud — the live goal-tracking readout for the interactive post (GAME-03, D-07).
//
// A DOM updater (mirrors game.ts's setOverlay DOM-toggle discipline) that writes
// the live frontier's GOAL TRACKING into the HUD container: the day's targetParam
// metric vs its threshold + an on-track indicator. It recomputes that metric with
// the SAME measure `score.ts` uses (imported from the engine) — the contribution→
// outcome link the player chases must be the EXACT metric the scorer chases
// (LIVE-03 — one source of truth, no drift). It reads the frontier DayVector +
// the genome and calls the pure engine; it NEVER re-implements the measure or
// touches the Scene / rAF loop (CAM-01 — read-only, no synthesis).
//
// SECURITY (T-02-11): every string is written via `textContent` / value
// substitution on i18n-keyed nodes — never the raw-HTML sink. The HUD copy lives
// behind `data-i18n` keys in game.html; this module only substitutes the numeric
// VALUES (the metric, threshold, on-track glyph) — it never injects language text.
//
// The scored `measured`/`achieved` are driven by the day's underlying activity
// (conflict / density / arms) — a nudge biases the VISUAL frontier mean (the
// acting-user re-synth) while this readout tracks the day vs its goal, so the
// player sees BOTH their immediate contribution and where the day stands (GAME-03).
import { score } from '../../engine/score';
import type { DayVector, Genome } from '../../engine/contracts';

/** The HUD container + the value nodes it substitutes into (queried once). */
const HUD_ROOT = 'hud-readout';
const HUD_PARAM = 'hud-param'; // the targetParam noun (e.g. "conflict")
const HUD_MEASURED = 'hud-measured'; // the current metric value
const HUD_GOAL = 'hud-goal'; // the threshold + direction (e.g. "< 0.40")
const HUD_TRACK = 'hud-track'; // the on-track indicator glyph + state

/** Format a metric to a stable, legible precision (integers stay integers). */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * updateHud — refresh the goal-tracking readout for the live frontier.
 *
 * Scores the frontier DayVector under the genome's fixed daily goal (the one-shot
 * pure engine call — never per-frame) and substitutes the metric / threshold /
 * on-track VALUES into the HUD container's i18n-keyed value nodes. Toggles the
 * container visible once a frontier exists. No-ops safely when the container or
 * the frontier is absent (cold start renders no readout, never an error).
 */
export function updateHud(frontier: DayVector | undefined, genome: Genome): void {
  const root = document.getElementById(HUD_ROOT);
  if (!root) return;
  if (!frontier) {
    root.hidden = true;
    return;
  }

  // Single source of truth: the SAME verdict the scorer freezes at the tick. The
  // value the player chases is byte-identical to what any client re-derives (LIVE-03).
  const outcome = score(frontier, genome);
  const { goal, measured, achieved } = outcome;
  const dirGlyph = goal.direction === 'below' ? '<' : '>';

  const set = (id: string, text: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = text; // textContent only (T-02-11) — values, not copy.
  };

  set(HUD_PARAM, goal.targetParam);
  set(HUD_MEASURED, fmt(measured));
  set(HUD_GOAL, `${dirGlyph} ${fmt(goal.threshold)}`);

  // On-track indicator: a glyph + a data-state hook the CSS / i18n can style. The
  // visible glyph is a neutral symbol (no language); the state drives the data-i18n
  // label already present in the markup.
  const track = document.getElementById(HUD_TRACK);
  if (track) {
    track.textContent = achieved ? '✓' : '·';
    track.dataset.state = achieved ? 'ontrack' : 'offtrack';
  }

  root.hidden = false;
}
