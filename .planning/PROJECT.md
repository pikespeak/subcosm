# Subcosm

> **Elevator pitch:** Your subreddit grows its own cosmos from its daily activity. Each day adds a shell of stars — zoom in to travel back through your community's whole history, and watch what it becomes overnight.
>
> **Tagline:** *a universe grown from your community.*

**Brand (provisional):** logo at `docs/subcosm.png` — a glowing warm-white genesis star (long cross-flare) over a cyan↔magenta nebula on a black void, with scattered multi-hue stars and "SUBCOSM" in a light, wide sans-serif. Confirms the Techno / bioluminescent style direction; matches the mock's palette and serves as the visual reference for the Techno `StyleTemplate` (genesis-core glow, additive neon, star hues).

## What This Is

Subcosm is a collaborative, persistent Reddit game (Devvit Web) where each community grows **one shared "cosmos"** from its own daily activity. Depth encodes time: a glowing genesis core (install day / first post) sits at the center, and each day adds a concentric **shell of stars** synthesized from that day's posts, comments, contributors, and conflict. The outermost shell is the live **frontier** that fills during the day and freezes forever at the daily tick. It's r/place energy, but biographical instead of spatial — "what did our universe become overnight?"

## Core Value

The community's real activity becomes a beautiful, **legible, deterministic** universe that accumulates daily and reveals overnight — one self-authored artifact per community, rendered by a single engine that produces provably different worlds from different data + genome/style config.

## Business Context

<!-- Hackathon entry — competition-facing, not monetized. -->

- **Customer**: Reddit communities (mods install; members shape the universe). Judges of the Reddit "Games with a Hook" Devvit challenge.
- **Revenue model**: None in scope (payments are post-hackathon).
- **Success metric**: A complete arc (genesis → mature shells) visible in the judging window, running smoothly in the mobile post viewport, looking self-authored (not AI slop).
- **Strategy notes**: Deadline 15 July 2026. Target prizes: Best App with a Hook ($15k), Best Use of Phaser ($5k), Best Retention ($3k), Best User Contributions ($3k). Full spec: `docs/subcosm-requirements.md`.

## Requirements

### Validated

(None yet — ship to validate)

### Active

<!-- Full hackathon submission scope, built in phase-groups. Detailed REQ-IDs in REQUIREMENTS.md. Phase-group A is built first (no Devvit). -->

- [ ] **A — Engine + simulator (built first, no Devvit):** typed Scene seam; Zod-schema contracts (`z.infer`, parse at boundaries); deterministic seeded synthesis at mock parity; Techno Canvas2D paint; camera + depth scrubber + legibility readout; front nudges; data simulator; **≥2 genome presets** proving the config-driven template engine.
- [ ] **B — Devvit integration + live game:** Devvit Web webroot; triggers → redis daily aggregation; conflict composite (no vote trigger); scheduler tick + hourly UTC sweeper; genome transform → frozen ring records; live frontier + nudges + overnight freeze + pinned reveal post; genome/style set at install via settings.
- [ ] **C — Submission + polish (required to enter):** published app listing on developer.reddit.com; public, self-explanatory, playable **demo post**; mobile polish (~60fps); cold-start/onboarding legibility; Devvit-rules + non-AI-slop; Devpost write-up.
- [ ] Throughout: determinism, no stored images, legibility, reduced-motion, steering-biases-mean; build + tests green.

### Out of Scope

<!-- Boundaries for the hackathon submission. Stretch = only if time allows. -->

- **Stretch (only if time):** Comic & Pixel styles, full Signal→Param weight matrix + rare events, Phaser/fbm WebGL shader layer (Best-Use-of-Phaser, gated on WebGL in the webroot iframe), Mode B (real host-community theme extraction). Clearly separated in REQUIREMENTS.md.
- **Connected multiverse / "Reddit universe"** — multiple community universes (each subreddit = a galaxy) linked into a larger navigable cosmos, Star-Trek-quadrant style; **opt-in only, no default link**. A distinct **post-MVP milestone** (see Context "North-star vision" + Key Decisions). Camera/scene contracts must not preclude an outer multiverse zoom tier.
- Post-level zoom (star→real post) — scope + privacy.
- Per-user styling — violates invariant I-4 (one shared organism per community).
- "Top of all time" backfill of ancient shells — stretch.
- Literal infinite-fractal / Mandelbrot deep-zoom — **never** (LOD shells, not unbounded math).

## Context

- **Spec**: `docs/subcosm-requirements.md` (§6 contracts, §7 architecture). **Renderer to port**: `docs/subcosm-universe-mock.html`. Condensed engineering brief preserved at `docs/context/subcosm-spec.md` (was the original root CLAUDE.md).
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
