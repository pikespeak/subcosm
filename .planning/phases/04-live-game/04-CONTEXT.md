# Phase 4: Live Game - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

The full live retention loop with daily stakes, built on the Phase-3 data layer
(triggers → counters → tick → ring → `/api/organism` → render, verified). This phase:
- makes the **live frontier** fill during the day and render **nudges** in near-real-time;
- enforces the per-user **ActionBudget** on nudges (GAME-05 contract already exists);
- scores the frozen shell **against its goal** deterministically at the tick (GAME-02);
- creates a pinned **reveal post** "what your universe became overnight" (LIVE-02);
- leaves a **persistent visual reward** on an achieved ring (GAME-04);
- holds **cross-client determinism** across the Redis→engine seam (LIVE-03).

Requirements: LIVE-01, LIVE-02, LIVE-03, GAME-02, GAME-03, GAME-04. (GAME-05 / ActionBudget
schema is already shipped from Phase 1 — Phase 4 ENFORCES it.) Mode: **mvp**.

NOT in this phase: variable-per-day goals, guesses as a second action, monetization,
the connected multiverse. See Deferred Ideas.

</domain>

<decisions>
## Implementation Decisions

### Daily goal (how the goal is defined)
- **D-01 (LOCKED):** The daily goal is **fixed per genome** — each genome's single
  `dailyGoal` (already on `Genome.DailyGoalSchema`) IS the goal, the same every day.
  Authored values: Calm = `conflict below 0.4`; Chaotic = `density above 0.7`;
  Crystalline = `symmetry above 5`. Rationale: learnable, legible, already in the
  contract, deterministic with no new generation mechanic (MVP). Variable-per-day is
  a later hook (Deferred).
- **D-01a (scoring derivation — research/planner must firm):** `conflict` is a direct
  `DayVector` field; `density` and `symmetry` are genome knobs / synthesis outputs, NOT
  direct DayVector fields. The scored metric for each `targetParam` MUST be a **pure,
  deterministic derivation from the frozen DayVector** (or the synthesized Scene from it).
  Define that derivation per goal type; it must be reproducible byte-identically on any
  client (LIVE-03).

### Outcome / scoring shape (firms the Phase-1 placeholder)
- **D-02 (LOCKED intent; exact fields = Claude's discretion):** `DayVector.outcome`
  (currently `z.unknown().optional()`, explicitly "firmed in Phase 4") becomes a typed
  Zod schema carrying: the resolved goal (`type`/`targetParam`/`threshold`/`direction`),
  the **actual measured value** at freeze, `achieved: boolean`, and a normalized
  **`degree` (0..1)** = how far past (achieved) or short (missed) of the threshold. It is
  written into the Ring record at the tick (GAME-02) and `Scene.goalAchieved` mirrors
  `outcome.achieved`. Scoring is a **pure function** of the frozen DayVector + the
  community's genome `dailyGoal` — no I/O, no rng, no Devvit (lives engine-side or a pure
  server core that the client can reproduce).

### Live frontier + realtime propagation
- **D-03 (LOCKED):** Use a **Devvit realtime channel per community** that broadcasts the
  **aggregated steer-hash state** (NOT each raw nudge action) — all open viewers
  re-synthesize the frontier near-real-time on a channel message. The acting user ALSO
  re-synthesizes locally immediately (no wait for the round-trip). Channel names use `-`,
  **no colons** (LIVE-01 hard constraint).
- **D-03a (#1 RESEARCH RISK):** Devvit realtime-channel feasibility **inside the post
  webview on mobile** is unproven (the Phase-4 analog of Phase-3's WebGL risk). Research
  MUST verify it early.
- **D-03b (LOCKED fallback):** If realtime proves unreliable on the post webview, degrade
  gracefully to **acting-user-local re-synth + others-on-reload** — LIVE-01's
  "near-real-time" still holds for the acting user, and the steer hash is the source of
  truth either way. Plan so the fallback is a small swap, not a rewrite.

### Nudge mechanics + budget enforcement
- **D-04 (LOCKED):** A nudge is a **same-origin `fetch` POST** to a steer endpoint that
  (1) enforces the per-user **ActionBudget** (`actionsUsed < cap`, default cap 3;
  increment atomically per `{sub}:{day}` dayKey), (2) **aggregates** the nudge into the
  Redis **steer hash** (sum/mean — never overwrite; nudges from different users must not
  clobber each other, LIVE-01), and (3) triggers the realtime broadcast of the new
  aggregate. Re-synthesis biases the frontier steering **MEAN only** (× `steerGain`),
  never dictates positions (invariant **I-5**). NO postMessage (03-01 confirmed
  fetch-based webview).
- **D-04a:** When the budget is exhausted, the UI shows remaining = 0 and disables the
  nudge controls. The endpoint returns remaining budget so the client stays in sync.
- **D-04b:** ActionBudget stays **structurally separate** from the shared `Scene` (no
  per-user state in synthesis) — keeps fair/cosmetic monetization bolt-on later.

### Reveal post (the retention hook)
- **D-05 (LOCKED):** At the tick, AFTER freezing the ring, create a **new pinned Subcosm
  post** (via the existing `createPost` infra) that **renders the just-frozen ring
  universe** with the same `render()` engine, plus an overlay stating: the day's goal,
  **achieved ✓/✗**, and the degree. It is a full **interactive** post (not text-only).
  Cadence: **one reveal post per community per day**, within ~1 min of the tick (LIVE-02).

### Goal-achievement reward
- **D-06 (LOCKED):** An achieved goal leaves a **deterministic special glyph/star** in the
  frozen ring — a brighter, distinctly-hued core/element accent — derived **purely from
  `outcome.achieved` in the Ring record (paint-only, no new rng)**, so it renders
  identically on every client (GAME-04 + LIVE-03). Scrubbing to that ring shows it
  permanently. (Era-badge ring ornament was considered and deferred.)

### Tracking readout (legibility — GAME-03)
- **D-07 (LOCKED default):** The live post HUD shows the **current `targetParam` value vs
  the threshold + an on-track indicator** (e.g. "conflict 0.32 / goal <0.40 ✓ on track"),
  so the steering→outcome link is legible while nudging. After a nudge the readout updates
  with the re-synthesized frontier's metric. Steering still biases the mean only (I-5) —
  the readout makes the contribution→outcome link visible without implying control.

### Freeze + determinism (extend, don't rebuild)
- **D-08 (LOCKED):** The Phase-3 `runTick` already freezes idempotently (`lastTickDay`
  watermark). Phase 4 ADDS scoring (`outcome`) + reveal-post creation + reward into the
  same tick path. Frozen shells never re-bake; a frozen day is immutable — further nudges
  affect only the live frontier, which advances after the tick (LIVE-02).
- **D-09 (LOCKED):** Client and server render identically from the same Ring record;
  scoring + reward glyph are pure functions of the record, so a second client after the
  tick renders an identical frozen ring (LIVE-03 — the Phase-3 guarantee, extended to the
  reward + outcome).

### Claude's Discretion
- Exact `outcome` field names + the `degree` normalization formula.
- The per-`targetParam` deterministic derivation (esp. density/symmetry from the DayVector).
- The realtime channel naming scheme (subject to the `-`/no-colon constraint).
- The reveal-post overlay layout + the glyph's exact visual treatment (within the techno style).
- HUD copy + all i18n keys.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` — Phase 4 section (goal + the 6 success criteria are authoritative)
- `.planning/REQUIREMENTS.md` — LIVE-01/02/03, GAME-02/03/04, GAME-05, and invariant I-5 (steering biases the mean, never dictates)
- `docs/context/subcosm-spec.md` — engineering brief (determinism, contracts, hard rules)
- `docs/subcosm-requirements.md` — §6 contracts, §7 architecture

### Engine contracts to extend (the goal/scoring/personal seams)
- `src/engine/contracts/Genome.ts` — `DailyGoalSchema`, `GoalTypeEnum`, `actionCap` (default 3), `steerGain`
- `src/engine/contracts/DayVector.ts` — `outcome` field to FIRM (currently `z.unknown()`); `steering`
- `src/engine/contracts/Scene.ts` — `goalAchieved` (mirrors `outcome.achieved`)
- `src/engine/contracts/Personal.ts` — `ActionBudgetSchema` ({userId, dayKey, cap, actionsUsed}) to ENFORCE
- `src/engine/genomes/{calm,chaotic,crystalline}.ts` — the authored per-genome `dailyGoal` values
- `src/engine/render.ts` — `render()` seam + `nudge()` (already biases the frontier mean; re-synthesizes only shells[0])

### Phase-3 data layer to build on (verified)
- `src/server/core/tick.ts` — `runTick` (extend with scoring + reveal + reward; keep idempotency)
- `src/server/core/ring.ts` — RingRecord write/read (single boundary)
- `src/server/core/redisKeys.ts` — central `keys.*` builder (add steer-hash key)
- `src/server/routes/api.ts` + `src/shared/api.ts` — `/api/organism` + `OrganismResponse` (extend for live/outcome)
- `src/server/core/post.ts` + `src/server/routes/menu.ts` — `createPost` infra (reveal post)
- `src/client/game.ts` + `src/client/cosmos/{paint,camera,CosmosScene,input}.ts` — render/camera/paint (nudge UI, HUD, reward glyph)
- `devvit.json` — scheduler tick, realtime channel declaration, post entrypoints
- `docs/summaries/handoff-2026-06-21-phase-3-uat-complete.md` — what the verified Phase-3 layer provides

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runTick` (src/server/core/tick.ts): the freeze path — extend in-place with scoring + reveal + reward.
- `render()` + `nudge()` (src/engine/render.ts): nudge already re-synthesizes ONLY the frontier and biases the steering mean (× steerGain) — the live-nudge mechanic is half-built.
- `createPost` (src/server/core/post.ts) + the menu route: reused to create the pinned reveal post.
- CameraController scrub (src/client/cosmos/camera.ts): scrubbing to a ring already works — the reward glyph just needs to render on the frozen shell.
- `/api/organism` read path + OrganismResponse envelope: extend for the live steer state + outcome.

### Established Patterns (MUST follow)
- Zod at boundaries: `.parse()` server (nudge endpoint, tick), `.safeParse()` client UI; `z.infer` only, no duplicate types, no `as`.
- Determinism: FNV-1a deterministic seed; NO `Math.random` / no Devvit imports under `src/engine/`; scoring + reward are pure functions of the Ring record.
- Redis: central `keys.*` builder, ZSET-as-set (SDK 0.13.4 has no set ops), no `redis.keys`/scan.
- Same-origin `fetch` only (no postMessage); i18n error keys; one style/genome per community.

### Integration Points
- Nudge: client → POST steer endpoint → ActionBudget check + steer-hash aggregate → realtime broadcast → all viewers re-synth frontier.
- Tick: read accumulators → freeze ring (03-03) → **score outcome** → write outcome+reward into ring → **create reveal post** → open next frontier.

</code_context>

<specifics>
## Specific Ideas

- Per-genome goals are already authored and distinct (Calm conflict<0.4 / Chaotic density>0.7 / Crystalline symmetry>5) — Phase 4 proves "data → different games" the same way Phase 1 proved "data → different worlds".
- Realtime channel naming is a hard constraint: names use `-`, NO colons (LIVE-01).
- The reveal post is the daily ritual / shareable hook — it should feel like an event, not a log line.

</specifics>

<deferred>
## Deferred Ideas

- **Variable-per-day goals** — chose fixed-per-genome for MVP (D-01); keep a hook for deterministic per-day goal rotation later.
- **Guesses as a second budgeted action** — REQUIREMENTS GAME-05 notes "nudges, and later guesses"; out of Phase-4 scope.
- **Threshold scaling with community size** — offered as a goal variant, not chosen; revisit if small-vs-large sub fairness becomes an issue.
- **Era-badge ring ornament** — chose the per-star glyph (D-06); the whole-shell badge is a later visual-polish option.
- **Per-raw-action realtime broadcast** — chose aggregated-state broadcast (D-03); per-action is higher-fidelity but higher-risk, deferred.

None of these block Phase 4; capture them so they aren't lost.

</deferred>

---

*Phase: 04-Live Game*
*Context gathered: 2026-06-21*
