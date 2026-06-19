// hud — the always-visible cosmos readout (CAM-03, D-02 hard rule).
//
// A DOM panel pinned top-left OVER the canvas that updates as the player scrubs /
// clicks shells. It reads `Scene.shells[focus].meta` — date / era / theme /
// stars(posts) / comments / contributors / conflict — and the frontier day's
// goal line from the active `Genome.dailyGoal` (GAME-01). It is NEVER behind a
// toggle (D-02) and NEVER mutates the Scene (CAM-01 — it only reads).
//
// SECURITY (T-02-11): every string is written via `textContent` — never the
// raw-HTML sink. When Phase-3 real Reddit data (themes/eras authored by users)
// flows into these fields, textContent makes injection impossible by construction.
//
// COLD START (T-02-12, Pitfall 5): the day-1 genesis shell renders the DESIGNED
// "Day 1 — the first post" empty state with a BIG BANG badge — a beautiful
// intentional state, never an error / "no data".
import type { Scene as CosmosSceneData, Genome } from '../../engine/contracts';

/** The DOM nodes the HUD writes into (queried once at build time). */
interface HudElements {
  root: HTMLElement;
  dayLine: HTMLElement;
  badge: HTMLElement;
  date: HTMLElement;
  era: HTMLElement;
  theme: HTMLElement;
  stars: HTMLElement;
  comments: HTMLElement;
  people: HTMLElement;
  conflict: HTMLElement;
  goal: HTMLElement;
  emptyState: HTMLElement;
}

/** A 5-cell conflict meter using block glyphs (mock confBar l.275). */
function conflictBar(conflict: number): string {
  const filled = Math.round(Math.max(0, Math.min(1, conflict)) * 5);
  return '▮'.repeat(filled) + '▯'.repeat(5 - filled);
}

/**
 * Human-readable goal line from the genome's DailyGoal (GAME-01). e.g.
 * "Goal: tame conflict below 0.3". Pure mapping over the typed contract — no
 * raw data, no Scene read. Shown ONLY on the frontier shell.
 */
function goalText(goal: Genome['dailyGoal']): string {
  const dir = goal.direction === 'below' ? 'below' : 'above';
  switch (goal.type) {
    case 'conflictBelow':
      return `Goal: tame conflict ${dir} ${goal.threshold}`;
    case 'reachSymmetry':
      return `Goal: reach ${goal.targetParam} symmetry ${dir} ${goal.threshold}`;
    case 'igniteRareGene':
      return `Goal: ignite a rare ${goal.targetParam}`;
    case 'starThreshold':
      return `Goal: grow stars ${dir} ${goal.threshold}`;
    case 'densityThreshold':
      return `Goal: push density ${dir} ${goal.threshold}`;
    case 'contributorCount':
      return `Goal: gather contributors ${dir} ${goal.threshold}`;
    default:
      return `Goal: ${goal.targetParam} ${dir} ${goal.threshold}`;
  }
}

/**
 * The always-visible HUD. Construct once with the dev page's container, the
 * Scene (read-only), and the active genome (for the frontier goal line). Call
 * `update(focusIndex)` on every scrub/focus to refresh the readout.
 */
export class Hud {
  private readonly el: HudElements;
  private readonly cosmos: CosmosSceneData;
  private readonly genome: Genome;

  constructor(host: HTMLElement, cosmos: CosmosSceneData, genome: Genome) {
    this.cosmos = cosmos;
    this.genome = genome;
    this.el = this.build(host);
  }

  /** Build the HUD DOM (always-visible, pointer-events:none — never intercepts gestures). */
  private build(host: HTMLElement): HudElements {
    const root = document.createElement('div');
    root.className = 'hud';

    const mk = (cls: string, parent: HTMLElement): HTMLElement => {
      const node = document.createElement('div');
      node.className = cls;
      parent.appendChild(node);
      return node;
    };
    const span = (cls: string, parent: HTMLElement, key?: string): HTMLElement => {
      if (key) {
        const k = document.createElement('span');
        k.className = 'hud-k';
        k.textContent = key;
        parent.appendChild(k);
      }
      const v = document.createElement('span');
      v.className = cls;
      parent.appendChild(v);
      return v;
    };

    // Primary day line + badge (e.g. "DAY 44  [FRONTIER]").
    const dayRow = mk('hud-day', root);
    const dayLine = document.createElement('span');
    dayLine.className = 'hud-day-num';
    dayRow.appendChild(dayLine);
    const badge = document.createElement('span');
    badge.className = 'hud-badge';
    dayRow.appendChild(badge);

    // date · era
    const metaRow1 = mk('hud-line', root);
    const date = span('hud-v', metaRow1, 'date');
    const era = span('hud-v', metaRow1, 'era');

    // theme (gold accent — the one highlighted field, UI-SPEC).
    const themeRow = mk('hud-line', root);
    const theme = span('hud-theme', themeRow, 'theme');

    // stars · comments · people
    const statRow = mk('hud-line', root);
    const stars = span('hud-v', statRow, 'stars');
    const comments = span('hud-v', statRow, 'comments');
    const people = span('hud-v', statRow, 'people');

    // conflict meter
    const confRow = mk('hud-line', root);
    const conflict = span('hud-conf', confRow, 'conflict');

    // frontier-only gold goal line.
    const goal = mk('hud-goal', root);

    // designed cold-start empty state (hidden unless day-1 focused).
    const emptyState = mk('hud-empty', root);

    host.appendChild(root);
    return { root, dayLine, badge, date, era, theme, stars, comments, people, conflict, goal, emptyState };
  }

  /**
   * Refresh the readout for the focused shell index. Reads
   * `Scene.shells[index].meta` only (CAM-01 — never writes). All strings set via
   * `textContent` (T-02-11). The frontier shows the gold goal line; the genesis
   * day-1 shows the designed empty state + BIG BANG badge (T-02-12).
   */
  update(focusIndex: number): void {
    const shell = this.cosmos.shells[focusIndex];
    if (!shell) return;
    const meta = shell.meta;
    const isFrontier = focusIndex === 0;
    // Genesis = the oldest shell (day 1 / the last in the outer->inner array).
    const isGenesis = shell.day === 1 || focusIndex === this.cosmos.shells.length - 1;

    this.el.dayLine.textContent = `DAY ${shell.day}`;

    // Badge: FRONTIER on the live edge, BIG BANG on the genesis core.
    if (isFrontier) {
      this.el.badge.textContent = 'FRONTIER';
      this.el.badge.dataset.kind = 'frontier';
      this.el.badge.hidden = false;
    } else if (isGenesis) {
      this.el.badge.textContent = 'BIG BANG';
      this.el.badge.dataset.kind = 'bigbang';
      this.el.badge.hidden = false;
    } else {
      this.el.badge.textContent = '';
      this.el.badge.hidden = true;
    }

    // Cold-start day-1: render the DESIGNED empty state, never an error (T-02-12).
    const coldStart = isGenesis && shell.elements.length === 0;
    if (coldStart) {
      this.el.emptyState.textContent =
        'Day 1 — the first post. A universe begins. One post, one spark — scrub outward as the community grows.';
      this.el.emptyState.hidden = false;
    } else {
      this.el.emptyState.textContent = '';
      this.el.emptyState.hidden = true;
    }

    // The meta readout (date / era / theme / stars / comments / contributors / conflict).
    this.el.date.textContent = meta.date;
    this.el.era.textContent = meta.era;
    this.el.theme.textContent = meta.theme;
    this.el.stars.textContent = String(meta.posts);
    this.el.comments.textContent = String(meta.comments);
    this.el.people.textContent = String(meta.contributors);
    this.el.conflict.textContent = conflictBar(meta.conflict);

    // Frontier-only gold goal line (GAME-01, D-02) from the genome's DailyGoal.
    if (isFrontier) {
      this.el.goal.textContent = goalText(this.genome.dailyGoal);
      this.el.goal.hidden = false;
    } else {
      this.el.goal.textContent = '';
      this.el.goal.hidden = true;
    }
  }
}
