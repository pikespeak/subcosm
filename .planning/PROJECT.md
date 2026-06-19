# Subcosm

> **Elevator pitch:** Your subreddit grows its own cosmos from its daily activity. Each day adds a shell of stars — zoom in to travel back through your community's whole history, and watch what it becomes overnight.

*(The working spec and renderer mock under `docs/` use the earlier codename "Mandelbrut".)*

## What This Is

Subcosm is a collaborative, persistent Reddit game (Devvit Web) where each community grows **one shared "cosmos"** from its own daily activity. Depth encodes time: a glowing genesis core (install day / first post) sits at the center, and each day adds a concentric **shell of stars** synthesized from that day's posts, comments, contributors, and conflict. The outermost shell is the live **frontier** that fills during the day and freezes forever at the daily tick. It's r/place energy, but biographical instead of spatial — "what did our universe become overnight?"

## Core Value

The community's real activity becomes a beautiful, **legible, deterministic** universe that accumulates daily and reveals overnight — one self-authored artifact per community, rendered by a single engine that produces provably different worlds from different data + genome/style config.

## Business Context

<!-- Hackathon entry — competition-facing, not monetized. -->

- **Customer**: Reddit communities (mods install; members shape the universe). Judges of the Reddit "Games with a Hook" Devvit challenge.
- **Revenue model**: None in scope (payments are post-hackathon).
- **Success metric**: A complete arc (genesis → mature shells) visible in the judging window, running smoothly in the mobile post viewport, looking self-authored (not AI slop).
- **Strategy notes**: Deadline 15 July 2026. Target prizes: Best App with a Hook ($15k), Best Use of Phaser ($5k), Best Retention ($3k), Best User Contributions ($3k). Full spec: `docs/mandelbrut-requirements.md`.

## Requirements

### Validated

(None yet — ship to validate)

### Active

<!-- THIS MILESTONE = Week 1: pure engine + data simulator. NO Devvit/Reddit wiring. -->

- [ ] Typed **Scene seam**: synthesis (`DayVector + Genome → Scene`) fully decoupled from paint (`Scene + StyleTemplate → pixels`); synthesis never knows styles, paint never touches raw data (requirements §6/§7).
- [ ] **Zod schemas are the single source of truth** for all four contracts (DayVector, Scene, Genome, StyleTemplate); types inferred via `z.infer`; `.parse()` at boundaries, `.safeParse()` in UI.
- [ ] **Deterministic seeded synthesis** ported from the mock — same `DayVector + seed + genomeVersion` → identical Scene.
- [ ] **Techno style** paint (Canvas2D) at visual parity with `docs/mandelbrut-universe-mock.html` (genesis core, concentric shells, frontier ignite, nebula, vignette).
- [ ] **Camera**: zoom / depth-scrub / focus view-state.
- [ ] **Depth scrubber + per-shell readout** (date / era / theme / stars / comments / contributors / conflict) — legibility is mandatory.
- [ ] **Front nudges** (branch / symmetry / hue) re-synthesize the live frontier visibly; steering biases the mean only.
- [ ] **Data simulator** generating realistic `DayVector[]` — growth trend, busy/quiet days, one drama spike, one AMA-style few-but-huge-threads day — with a **regenerate** control.
- [ ] **Verify**: changing simulated data visibly changes the universe; same seed → identical render; `prefers-reduced-motion` static; build + tests green.

### Out of Scope

<!-- This milestone's boundaries. Later milestones move these to Active. -->

- Devvit/Reddit wiring (event triggers, redis aggregation, scheduler tick + sweeper, realtime, settings/genome install) — **Week 2+**.
- Full Genome **Signal→Param weight matrix** — typed now, exercised Week 2+ (Week 1 ports the mock's heuristics behind the seam).
- **Comic & Pixel** styles — Week 3 (Techno first; skin-as-data already supports them).
- Rare-event mutations, fbm/WebGL shader layer, Phaser — later visual upgrades (Canvas2D ships first).
- Mode B (real host-community theme extraction), post-level zoom (star→real post), "top of all time" backfill — stretch.
- **Connected multiverse / "Reddit universe"** — multiple community universes (each subreddit = a galaxy) linked into a larger navigable cosmos you can graphically travel between, Star-Trek-quadrant style (a quadrant = a curated region spanning a subset of Reddit). **Opt-in only: no default link** — an owner manually establishes a connection, or grants permission for their universe to join another. A distinct **post-MVP milestone**, not this one (see Context "North-star vision" + Key Decisions). Week-1 camera/scene contracts must not preclude an outer multiverse zoom tier.
- Literal infinite-fractal / Mandelbrot deep-zoom — **never** (LOD shells, not unbounded math).

## Context

- **Spec**: `docs/mandelbrut-requirements.md` (§6 contracts, §7 architecture). **Renderer to port**: `docs/mandelbrut-universe-mock.html`. Condensed engineering brief preserved at `docs/context/mandelbrut-spec.md` (was the original root CLAUDE.md).
- **Platform target**: Devvit Web (Reddit Interactive Posts), mobile-first, runs inside the post viewport. Devvit wiring is deliberately deferred — the simulator decouples visual/engine progress from platform risk.
- **Week-1 tooling**: standalone **Vite + TypeScript (strict) + Vitest + Zod** harness. `src/engine/` has **zero Devvit imports** (pure, unit-testable); `src/sim/` generates the `DayVector[]` whose schema IS the real collector's future contract.
- **Working environment**: integrates **Claude Context OS v4** (session/handoff discipline — `templates/`, `docs/context/`, `docs/summaries/`, `.claude/commands/`) and a repo-wide **Zod + Plan-Mode standard** embedded at the top of root `CLAUDE.md` (mirrored to `agents.md` via symlink). GSD owns `.planning/`; context-os owns `CLAUDE.md`.
- **North-star vision (post-MVP)**: beyond a single community's universe, a **connected multiverse** — many subreddit "galaxies" that owners can opt-in link into shared "quadrants" (curated regions of Reddit), with graphical travel between linked universes (Star-Trek-quadrant feel). Each community keeps its own sovereign universe (invariant I-4 holds); linking is a **consent-based meta-layer** on top — no default connection, owner-initiated or owner-permitted only. This shapes the camera/LOD design as an additional **outer zoom tier**: multiverse → galaxy (subreddit) → daily shell → star (post). Not built this milestone, but the Scene/Camera contracts are kept embeddable so it isn't designed out. **Open design questions (deferred to that milestone, to discuss with the user before building it):** (1) is linking bidirectional — both owners consent — or invite-and-join; (2) who defines a "quadrant" — the inviting owner, a curated list, or thematic grouping; (3) free travel between all linked galaxies vs only along established link edges (a star-map graph). General directive: **build everything flexibly now so none of these become blockers later.**

## Constraints

- **Determinism**: every shell reproducible from `DayVector + seed + genomeVersion`; no randomness outside the seeded RNG; identical client/server render.
- **No stored images**: ~25 scalars + seed per ring; regenerate visuals.
- **Mobile perf**: ~60fps target in post viewport; only the live frontier animates, frozen shells cached (bake-on-freeze); LOD by zoom.
- **Legibility**: date + theme + activity stats per shell, depth→date scrubber — present in every style, never removed.
- **One style per community** (set in genome at install), never per user.
- **Accessibility**: respect `prefers-reduced-motion` (static, no strobe).
- **Steering** biases the mean, never dictates the outcome.
- **Zod single source of truth**: no duplicate interfaces, infer types, parse only at boundaries; tests + build always green (no temporary broken states).
- **Timeline**: hackathon deadline 15 July 2026; ~10–15 h/week, solo.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Week 1 = engine + simulator only, no Devvit | Decouple visual/data-mapping progress from platform risk (R-5); prove any data renders | — Pending |
| Zod schemas as single source of truth (contracts as schemas, `z.infer`) | Repo-wide Zod + Plan-Mode standard; runtime validation at the sim→engine boundary; no type duplication | — Pending |
| Faithful port of mock heuristics into synthesis (genome holds constants) | "Visual parity with the mock" + polish-over-ambition; full weight-matrix deferred | — Pending |
| Canvas2D first, Techno style first | D-8 / D-4 — ships fastest, liveliest optic, lightest path; shader is a Week-3 Phaser-prize upgrade | — Pending |
| Genesis = center (inner = older) | D-1 — matches the mock | — Pending |
| Concentric shells as foundation, spiral only as texture | D-2 — legibility first | — Pending |
| One element = thread/post | D-3 — most tangible deep-zoom unit | — Pending |
| GSD owns `.planning/`; Context-OS owns root `CLAUDE.md`; skip GSD's CLAUDE.md generator | User decision — avoid competing instruction files; context-os + Zod standard is the authority | — Pending |
| Keep Scene/Camera contracts embeddable in a future connected multiverse (subreddits as galaxies, opt-in links, ST-quadrant regions) | User's north-star vision; consent-based linking preserves per-community sovereignty (I-4) and avoids a costly later rewrite of camera/scene/coordinate model | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-19 after initialization*
