---
phase: 04-live-game
plan: 04
subsystem: live-retention-hook
tags: [reveal-post, reward-glyph, exactly-once, determinism, paint-only, zod-boundary, d-05, d-06]
requires:
  - OutcomeSchema / Outcome + score(day, genome) on the frozen ring (04-01)
  - runTick freeze + writeRing (returns ring index) + lastTickDay guard (03-03 / 04-01)
  - keys.revealDone(sub, day) reveal guard key (added 04-02 schema)
  - reddit.submitCustomPost + Post.sticky + getSubredditInfoById (@devvit/web@0.13.4)
  - synthesize(days, genome) → Scene + render() orchestration seam (02)
  - hueToColor / addGlow paint helpers + bakeShell frozen-shell bake (02-03)
provides:
  - createRevealPost(subredditName, ringIndex) — submitCustomPost(entry:'game', postData) + sticky (LIVE-02)
  - revealDone:{sub}:{day} exactly-once nx-guard + createRevealPost call in runTick (OQ2 / T-04-13)
  - Shell.goalAchieved — per-shell achieved flag (nullable bool) on the Scene contract
  - synthesis surfaces day.outcome.achieved onto each shell as goalAchieved (pure pass-through)
  - paintRewardAccent — deterministic paint-only reward glyph on achieved frozen rings (GAME-04 / D-06)
affects:
  - closes the daily loop (fill → steer → freeze → score → reveal → reward); last plan of phase 04
tech-stack:
  added: []
  patterns:
    - "Exactly-once side effect: atomic redis.set(key,'1',{nx:true}) gate before a non-Redis platform side effect; only the first winner acts (decoupled from the lastTickDay freeze guard)"
    - "Trusted-context name resolution: submitCustomPost's subredditName resolved from the platform-trusted subId via reddit.getSubredditInfoById (V4) — never from a payload"
    - "Best-effort reveal: a reveal failure is caught+logged and never corrupts the already-committed freeze (a missed reveal is tolerable, a double reveal is not)"
    - "Reward glyph is paint-only off a Scene-derived per-shell flag (ENG-02), driven by outcome.achieved with a STABLE element pick and NO rng — pure function of the record, identical on every client (LIVE-03)"
    - "The glyph bakes once with the frozen shell (PNT-03) so it is permanent on scrub-back and static (reduced-motion safe, PNT-04)"
key-files:
  created: []
  modified:
    - src/server/core/post.ts
    - src/server/core/tick.ts
    - src/server/core/tick.test.ts
    - src/engine/contracts/Scene.ts
    - src/engine/synthesis.ts
    - src/engine/synthesis.test.ts
    - src/client/cosmos/paint.ts
    - src/client/game.ts
decisions:
  - "subredditName is resolved INSIDE runTick from the trusted subId (reddit.getSubredditInfoById), not threaded through the scheduler payload — the tick already holds the trusted id (V4), and the reveal must never derive its target sub from untrusted input (T-04-15)"
  - "Per-shell goalAchieved is wired in SYNTHESIS (day.outcome?.achieved → Shell.goalAchieved), not in game.ts directly — synthesis already reads the DayVector and is the only seam paint may read from (ENG-02); game.ts feeds the outcome-carrying RingRecords into render() unchanged, so the flag rides the existing path. game.ts carries a documenting comment, no logic change"
  - "The reward accent reuses hueToColor(ramp, REWARD_HUE=0.92) — a fixed high-stop hue that stays within the techno/crystalline palette while reading distinctly brighter; a constant (not data-derived) so the glyph is a pure function of the record"
  - "The accented element is the max-energy element via reduce (strict >, ties keep the earlier index) — a stable, deterministic pick identical on every client"
  - "Shell.goalAchieved defaults to null (nullable bool) so existing Scene parses + the live frontier / genesis / pre-scoring rings carry no glyph; only a frozen ring whose outcome.achieved===true paints the accent"
metrics:
  duration: ~10min
  completed: 2026-06-22
  tasks: 3
  files: 8
status: complete
---

# Phase 4 Plan 04: Reveal-Post + Reward-Glyph Retention Hook Summary

Closed the daily loop with the retention hook: at the overnight tick, AFTER the ring freezes and scores (plan 01), `runTick` now creates EXACTLY ONE pinned interactive reveal post per community per day — guarded by an atomic `revealDone:{sub}:{day}` nx-set so an at-least-once scheduler double-fire never double-posts — rendering the just-frozen ring via the existing `game.html` entrypoint with a `postData:{ringIndex}` stamp (LIVE-02 / D-05 / OQ2). In parallel, any ring whose goal was achieved now carries a deterministic, paint-only reward glyph: synthesis surfaces each frozen day's `outcome.achieved` onto its `Shell.goalAchieved`, and `paintRewardAccent` bakes a brighter, distinctly-hued accent onto the shell's stable max-energy star — no rng, a pure function of the Ring record, so it renders identically on every client and is permanent when scrubbing to that ring (GAME-04 / D-06 / LIVE-03). The on-device two-client `devvit playtest` verification (Task 3) is **auto-approved under this run's auto-mode and DEFERRED to UAT — it was NOT performed on a device here** (see Checkpoint Handling).

## What Was Built

**Task 1 — createRevealPost + exactly-once revealDone guard in runTick** (`512f797`)
- `post.ts`: `createRevealPost(subredditName, ringIndex)` calls `reddit.submitCustomPost({ subredditName, title, entry: 'game', postData: { ringIndex } })` then `post.sticky()` — pins within ~1 min, reuses the built `game.html` entrypoint (no new devvit.json entrypoint), stamps which frozen ring to celebrate (≤2KB postData). The post renders only deterministic geometry + the i18n overlay; no user-authored text is echoed (T-04-16).
- `tick.ts`: captured `writeRing`'s returned ring index; after the write, attempts an ATOMIC `redis.set(keys.revealDone(subId, day), '1', { nx: true })` — only the first winner (a non-null return) resolves the subreddit NAME from the trusted `subId` via `reddit.getSubredditInfoById` (V4 / T-04-15) and calls `createRevealPost`. The whole reveal is in its OWN try/catch: a reveal failure logs and continues — the ring is already frozen and `lastTickDay` is set below, so a missed reveal is tolerable while a double reveal is prevented (Pitfall 3 / OQ2 / T-04-13). No devvit.json change.
- `tick.test.ts`: the fake `redis.set` now honours `{ nx: true }` (returns null when the key exists); a `reddit` mock (`getSubredditInfoById` → name, `submitCustomPost` → a `{ sticky() }` post) records reveal calls. Five new tests: exactly-one pinned reveal for the frozen ring, double-fire creates at most one, the nx-guard blocks a second reveal even if the freeze guard is bypassed, a reveal failure never corrupts the freeze, and one reveal per day. **26 tests green.**

**Task 2 — Paint-only deterministic reward glyph on achieved frozen rings** (`4c82059`)
- `Scene.ts`: added `Shell.goalAchieved` (`z.boolean().nullable().default(null)`) — the per-shell achieved flag paint reads (ENG-02: paint reads this Scene-derived flag, never raw data).
- `synthesis.ts`: each shell now carries `goalAchieved: day.outcome?.achieved ?? null` — a PURE pass-through of the frozen ring's verdict; no rng touched, so the element stream (and the Scene for any null-outcome day) stays byte-identical.
- `paint.ts`: `REWARD_HUE = 0.92` constant + `paintRewardAccent(scene, shell, shellR, frame, ramp)` — picks the max-energy element via a stable `reduce` (strict `>`, ties keep the earlier index), paints a wide soft halo + a bright core dot via `hueToColor(ramp, REWARD_HUE)`. Called in `drawShell` only when `shell.goalAchieved === true`, with the accent objects pushed into the SAME list that flows into `bakeShell` — so the glyph bakes ONCE with the frozen shell (permanent on scrub-back, PNT-03) and never animates (reduced-motion safe, PNT-04). No `Math.random` in the reward path.
- `game.ts`: a documenting comment at the `render()` call records the wiring path (RingRecord.outcome → synthesis goalAchieved → paint glyph); the outcome-carrying rings already flow into `render()` unchanged, so no logic change was needed.
- `synthesis.test.ts`: three new tests — achieved→true / missed→false / no-outcome→null per shell, byte-identical determinism of the flag, and the fixtures (no outcome) all-null. **231 tests green (full suite).**

**Task 3 — Reveal-post + reward-glyph + cross-client determinism check** — checkpoint, see below.

## Checkpoint Handling (Task 3 — human-verify, on-device `devvit playtest`)

Task 3 is a `checkpoint:human-verify` (gate `blocking`) for on-device verification: a pinned reveal post within ~1 min of the tick, a persistent reward glyph on achieved rings, and identical frozen-ring render across two clients (one mobile). **Under this run's auto-mode it was AUTO-APPROVED — the real on-device verification was NOT performed here.** Honest status:

- **Verified deterministically here (HIGH confidence):**
  - The reveal-post payload SHAPE and exactly-once behaviour: 5 `tick.test.ts` tests assert one pinned reveal for the just-frozen ring, double-fire / bypassed-guard creating at most one, failure tolerance, and one-per-day.
  - The reward glyph is driven ONLY by deterministic `outcome.achieved` geometry — `grep` confirms no `Math.random` in `paint.ts`; the element pick is a stable reduce; the accent hue is a constant. Synthesis tests assert achieved/missed/null wiring and byte-identical determinism. The Scene determinism tests (toEqual + JSON.stringify equality) confirm two renders of the same record are byte-identical (the basis for cross-client parity).
  - The Devvit API shapes are verified against `node_modules/@devvit/reddit/**/*.d.ts`: `submitCustomPost(SubredditOptions & SubmitCustomPostOptions)` accepts `subredditName`/`entry`/`postData`; `Post.sticky(position?)`; `getSubredditInfoById(id: T5) → SubredditInfo` (`name?: string`); `redis.set(key, value, { nx, expiration })` returns the value or null.
- **DEFERRED to UAT (NOT done here):** the actual `devvit playtest` run — that the pinned reveal post appears within ~1 min, opens onto the frozen ring with the goal/achieved/degree overlay, exactly one survives a scheduler retry on-device; that an achieved ring's glyph is visible + persists across scrub; that a SECOND client (one mobile) renders the frozen ring + glyph IDENTICALLY; and that a missed goal shows ✗ with no glyph. No claim is made that any of these were verified on a device.
- **Note on the overlay:** the reveal post renders via the same `game.html` webview as the live post; the goal/achieved/degree OVERLAY copy (D-05) lives behind the webview's i18n keys and reads the `postData.ringIndex` + the frozen ring's outcome — the deterministic outcome + ring data needed to drive that overlay are confirmed present and round-tripping (plan 01), but the overlay's on-device visual presentation is part of the deferred UAT.

## Deviations from Plan

### Auto-fixed Issues

None requiring a code fix beyond the planned scope.

The plan named `game.ts` as a modified artifact for the per-shell `goalAchieved` wiring. I wired the per-shell flag in **synthesis** (the only seam paint may read from — ENG-02) rather than mutating the Scene in `game.ts`; `game.ts` already feeds the outcome-carrying RingRecords into `render()` unchanged, so the flag rides the existing path. `game.ts` carries a documenting comment of the wiring (it is still touched, as the plan anticipated), but the actual derivation lives in synthesis. This is the cleanest ENG-02-compliant placement and is recorded as a Decision above, not a deviation.

`keys.revealDone(sub, day)` already existed (added in the 04-02 schema pass), so no key-builder change was needed — the plan anticipated this.

## Determinism / Security Notes

- **Exactly-once (T-04-13):** the `revealDone` nx-set is atomic and decoupled from the `lastTickDay` freeze guard, so the reveal is exactly-once independent of the ring-freeze idempotency — a tick double-fire (caught by lastTickDay) never re-enters the reveal, AND even a hypothetical freeze-guard bypass is caught by the nx-set (covered by the dedicated test).
- **Trusted context (T-04-15):** `subredditName` is resolved from the platform-trusted `subId` inside the tick, never from the scheduler payload.
- **Reward determinism (T-04-14 / LIVE-03):** the glyph is a pure function of the Ring record (stable element pick + constant hue + no rng), so every client computes the identical accent. `npm run lint` confirms no `Math.random`/Devvit imports under `src/engine/`.

## Verification

- `npm test` (full vitest suite) — **231 tests green** (25 files; +5 reveal tests, +3 synthesis goalAchieved tests over 04-03's 223).
- Targeted: `npx vitest run src/server/core/tick.test.ts` — 26 green; `npx vitest run src/engine/synthesis.test.ts` — 21 green.
- `npm run type-check` (tsc --build) — clean.
- `npm run lint` (eslint) — clean (no `Math.random`/Devvit-import violations under `src/engine/`; the reveal lives in `post.ts`/`tick.ts`, the glyph in paint + a pure synthesis pass-through).
- `npm run build` (vite) — succeeds (the sourcemap / inlineDynamicImports warnings are pre-existing config warnings, identical to 04-02/04-03).
- grep gates: `grep -n Math.random src/client/cosmos/paint.ts` → none in the reward path; `entry: 'game'` + `postData` + `post.sticky()` present in `post.ts`; `redis.set(..., { nx: true })` reveal guard present in `tick.ts`; `goalAchieved: day.outcome?.achieved` present in `synthesis.ts`.

## Known Stubs

None at the code level. The ONLY deferred item is the on-device Task-3 UAT (the human-verify checkpoint) — verification, not a stub. The deterministic foundations (reveal payload + exactly-once guard, the pure reward glyph, render determinism) are all unit-covered and green.

## Threat Flags

None — no new security surface beyond the planned threat register. T-04-13 (reveal spam) mitigated by the atomic `revealDone` nx-guard. T-04-14 (glyph divergence) mitigated by the pure-function paint-only glyph (stable index, no rng). T-04-15 (wrong-sub reveal) mitigated by resolving `subredditName` from the trusted `subId`. T-04-16 (raw-text reflection) accept — no user-authored text is echoed. T-04-SC (package legitimacy) — zero new packages; `submitCustomPost`/`sticky`/`getSubredditInfoById` ship in the already-installed `@devvit/web@0.13.4`.

## Self-Check: PASSED

- Files modified exist + carry the new symbols: `createRevealPost` in `post.ts`, `revealDone` nx-guard in `tick.ts`, `paintRewardAccent`/`REWARD_HUE` in `paint.ts`, `goalAchieved` in `Scene.ts` + `synthesis.ts` — all FOUND.
- Commits exist: `512f797`, `4c82059` — both FOUND in `git log`.
- All four Definition-of-Done gates green (test 231 / type-check / lint / build).
