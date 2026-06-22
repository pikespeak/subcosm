---
phase: 04-live-game
verified: 2026-06-22T04:13:20Z
status: human_needed
score: criteria 1-3 code-verified (incl. GAME-03 closed by 04-05); criteria 4-6 on-device UAT pending
reverified: 2026-06-22T08:45:00Z (GAME-03 gap closed by 04-05; score.test.ts 32/32 green — borderline flip both directions, I-5 bound under extreme steering, determinism)
behavior_unverified: 0
overrides_applied: 0
requirements_coverage:
  LIVE-01: satisfied
  LIVE-02: substrate-verified-ondevice-human-needed
  LIVE-03: substrate-verified-ondevice-human-needed
  GAME-02: satisfied
  GAME-03: satisfied
  GAME-04: substrate-verified-ondevice-human-needed
gaps:
  - truth: "Steering nudges measurably move the day toward/away from the goal — the contribution → outcome link is real, not just a legible readout (GAME-03, phase-goal clause 'nudges steer it toward the day's goal')"
    status: partial
    reason: >
      The scored measure (conflict/density/symmetry) is purely activity-driven and
      does NOT read day.steering. A nudge biases only the VISUAL frontier mean (and
      the hue HINT) via handle.nudge / the tick foldSteering — it never changes the
      conflict/density/arm-count value that score() compares to the goal threshold.
      So a user can spend their whole budget steering and the achieved/degree verdict
      is identical to a no-nudge day. The HUD readout is legible (criterion 1 sub-claim
      met) but the underlying steering→OUTCOME link asserted by GAME-03 is absent. This
      is documented as an explicit design decision in 04-02-SUMMARY ("the scored
      targetParam measure ... does NOT depend on day.steering") and REQUIREMENTS.md
      independently marks GAME-03 as Pending ([ ]). GAME-03 is owned by Phase 4 only —
      not deferred to Phase 5 (which is publishing/onboarding, SUB-01..06).
    artifacts:
      - path: "src/engine/score.ts"
        issue: "measure() reads day.conflict / starCount(day.posts) / deriveArms(day,genome) — none read day.steering, so the scored metric is steering-independent"
      - path: "src/server/core/tick.ts"
        issue: "foldSteering folds the steer mean into DayVector.steering, but steering is consumed only by the visual synthesis (positions/hue hint), never by score()/conflictComposite"
    missing:
      - "Make at least one scored targetParam genuinely move with the aggregated steer (e.g. let the relevant nudge param bias the measured metric within a bounded band, biasing the mean only per I-5), OR re-scope GAME-03 / accept via an override if 'legible readout' is deemed sufficient for the MVP"
      - "If accepted as legible-readout-only, update REQUIREMENTS.md GAME-03 to Complete with the rationale; today it is [ ] Pending, contradicting the phase 'Complete' status"
human_verification:
  - test: "Reveal post appears within ~1 min of the tick, pinned, opening onto the just-frozen ring with a goal/achieved ✓/✗/degree overlay"
    expected: "Exactly one pinned interactive Subcosm post per community per day; survives a scheduler retry as still one"
    why_human: "Requires devvit playtest on real Reddit — post-creation timing, sticky/pin, and webview overlay presentation cannot be observed from code. Deterministic substrate (exactly-once nx-guard, createRevealPost shape, entry:'game' + postData) is unit-verified."
  - test: "On goal achievement the frozen ring shows the persistent reward glyph; scrub away and back, it persists; a MISSED goal shows ✗ and NO glyph"
    expected: "Brighter, distinctly-hued accent star on the achieved frozen shell, permanent and static (reduced-motion safe)"
    why_human: "Visual presence/appearance + scrub permanence require running the rendered app on-device. Deterministic substrate (paintRewardAccent gated on shell.goalAchieved===true, derived from outcome.achieved, stable max-energy reduce, REWARD_HUE constant, no rng, wired CosmosScene→paintScene→drawShell→paintRewardAccent and baked once) is unit-verified."
  - test: "Open the same post on a SECOND client (one mobile) after the tick — the frozen ring geometry AND the reward glyph render identically to the first client"
    expected: "Byte-identical frozen-ring render across clients from the same Ring record (Redis → engine determinism)"
    why_human: "Two-client / mobile render parity requires devvit playtest. Deterministic substrate (pure score(), seed = hash(subId,day,genomeVersion) excluding steering, Scene determinism tests, outcome Redis round-trip) is unit-verified."
  - test: "Realtime: a nudge on client A converges client B's frontier near-real-time WITHOUT a reload; channel connects inside the mobile post webview"
    expected: "Other open viewers' frontiers reconcile to the shared steered mean over the colon-free per-post channel; if unreliable on mobile, the D-03b reload fallback holds"
    why_human: "On-device realtime delivery (research risk D-03a) requires two clients incl. mobile via devvit playtest — explicitly auto-approved and DEFERRED to UAT in 04-03-SUMMARY, NOT performed on a device. Code path (server broadcast + client subscribe + reconcile-to-absolute + guarded degrade) is implemented and unit/grep-verified."
---

# Phase 4: Live Game Verification Report

**Phase Goal:** The community's live frontier fills with activity during the day, nudges steer it toward the day's goal in near-real-time, the overnight tick freezes it irreversibly and scores it against the goal, and a pinned reveal post shows what the community's universe became and whether the goal was achieved — the full retention loop with meaningful daily stakes.

**Verified:** 2026-06-22T04:13:20Z
**Status:** gaps_found
**Re-verification:** No — initial verification
**Mode:** mvp

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Nudge controls (branch/symmetry/hue) re-synthesize the live frontier within seconds; nudges aggregate into the Redis steer hash without overwriting; the readout shows the day tracking against its goal | ✓ VERIFIED (with GAME-03 caveat) | `game.ts` POSTs `/api/steer` then `handle?.nudge(param, NUDGE_AMOUNT)` for immediate acting-user re-synth (game.ts:362,382); `recordNudge` aggregates via `hIncrBy` SUM + count, never `hSet` (steer.ts:79-80; steer.test.ts "two +0.5 branch nudges SUM to branch=1.0, count=2", "the fake redis exposes no hSet"); `hud.ts` recomputes the metric with the EXACT `score.ts measure` and shows `Now {measured}` vs `Goal {threshold}` + on-track glyph (hud.ts:55,65-66; game.html:52-60). **Caveat:** the readout is legible but the scored metric is steering-independent — see GAME-03 gap below. |
| 2   | At the tick the frontier shell freezes (further nudges no-op it); a new empty frontier opens with the next day's goal visible | ✓ VERIFIED | `runTick` idempotency guard `if (last >= day) return` (tick.ts:115); tests "a re-run for the same day is a no-op", "a re-run for an EARLIER day is a no-op", "a later day after a freeze writes a second ring" (tick.test.ts:442,454,461); the steer hash is deleted on freeze so the next frontier starts unsteered (tick.ts:248; test "deletes the steer hash on freeze"). `render().nudge()` re-synthesizes ONLY `shells[0]`; frozen history is never re-baked (render.ts:115-117). The day's goal is the genome's fixed `dailyGoal`, visible via the HUD readout. |
| 3   | The tick scores the frozen shell's DayVector against its dailyGoal DETERMINISTICALLY; achieved ✓/✗ + degree written to the Ring record | ✓ VERIFIED | `score(day, genome)` is pure (no rng/Devvit/I-O; score.ts:17-18,101-123); `runTick` calls it one-shot and writes `outcome` into the parsed RingRecord (tick.ts:186-192); `'outcome'` is in `JSON_FIELDS` so it round-trips (ring.ts:37; ring.test.ts "round-trips a ring carrying an outcome object losslessly (Pitfall 5)"); tests "the frozen ring carries an outcome scored from its DayVector", "the outcome equals score(dayVector, genome) deterministically", "same inputs → deeply equal outcome" (tick.test.ts:224,238; score.test.ts:56). Achievability proven reachable-but-not-automatic per genome (score.test.ts:122-145). |
| 4   | A pinned "what your universe became overnight" post appears within ~1 min of the tick, stating the goal and whether achieved | ⚠️ HUMAN NEEDED (substrate verified) | Substrate: `createRevealPost` does `submitCustomPost({ entry:'game', postData:{ringIndex} })` + `post.sticky()` (post.ts:36-42); `runTick` gates it on atomic `redis.set(revealDone, '1', { nx:true })`, resolves subredditName from trusted subId, wraps in try/catch (tick.ts:212-232). 5 tests: exactly-one reveal, double-fire ≤ one, nx-guard blocks even if freeze guard bypassed, failure doesn't corrupt freeze, one per day (tick.test.ts:472-528). **On-device timing + overlay presentation DEFERRED to UAT** (04-04-SUMMARY checkpoint, honestly recorded as not performed on device). |
| 5   | On goal achievement the frozen ring carries a persistent visual reward, rendering identically on every client from the same Ring record | ⚠️ HUMAN NEEDED (substrate verified) | Substrate: `paintRewardAccent` gated on `shell.goalAchieved===true` (paint.ts:284), flag a pure pass-through `day.outcome?.achieved ?? null` in synthesis (synthesis.ts:321), stable max-energy `reduce`, constant `REWARD_HUE=0.92`, no `Math.random` in the reward path (paint.ts:33,155); wired CosmosScene→paintScene→drawShell→paintRewardAccent and baked once with the frozen shell (CosmosScene.ts:164; paint.ts:25-29,285). Tests: achieved→true/missed→false/no-outcome→null + byte-identical determinism (synthesis.test.ts). **On-device visual presence + scrub permanence DEFERRED to UAT.** |
| 6   | Loading the post on a second client after the tick renders an identical frozen ring (determinism across Redis → engine seam) | ⚠️ HUMAN NEEDED (substrate verified) | Substrate: `score()` pure; `seed = hash(subId, day, genomeVersion)` EXCLUDES steering (tick.ts:154; comment 86-88), so the fold preserves determinism; outcome round-trips losslessly (ring.test.ts Pitfall 5); Scene determinism tests assert two renders of the same record are byte-identical. **Two-client / mobile render parity DEFERRED to UAT.** |

**Score:** 4/6 truths verified (criteria 1, 2, 3 fully code-verified; criteria 4, 5, 6 substrate-verified, on-device behavior routed to human). Criterion 1 carries the GAME-03 caveat (legible readout met; steering→outcome link is a gap).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/engine/contracts/Outcome.ts` | OutcomeSchema + z.infer Outcome | ✓ VERIFIED | `{ goal, measured, achieved, degree∈[0,1] }`, z.infer, i18n keys on bounds, imports DailyGoalSchema (Outcome.ts:20-35) |
| `src/engine/score.ts` | pure score() re-using synthesis derivations | ✓ VERIFIED | exports `score` + `measure`; imports `starCount/deriveArms/STAR_FLOOR` from synthesis; no rng/Devvit/I-O |
| `src/engine/synthesis.ts` | exported starCount + deriveArms (one source) | ✓ VERIFIED | both exported (synthesis.ts:85,103); `synthesize` calls `deriveArms` (line 257) — one implementation |
| `src/server/core/steer.ts` | atomic budget gate + hIncrBy aggregate | ✓ VERIFIED | `recordNudge` (incrBy-then-compare, no aggregate on reject) + `readSteerAggregate`; imports @devvit + keys, ZERO src/engine |
| `src/server/core/post.ts` | createRevealPost (submitCustomPost entry:'game' + sticky) | ✓ VERIFIED | exports `createRevealPost` (post.ts:32-43) |
| `src/server/core/redisKeys.ts` | steer / budget / revealDone builders | ✓ VERIFIED | all three present (redisKeys.ts:76,84,91), colon-namespaced |
| `src/shared/api.ts` | SteerRequest/Response/Aggregate/Msg schemas, client-safe | ✓ VERIFIED | all schemas + z.infer; amount clamped [-1,1]; imports only zod + engine contracts, NO server |
| `src/shared/channel.ts` | steerChannel — colon-free per-post name | ✓ VERIFIED | whitelists `[A-Za-z0-9_-]`, replaces else with `-`; zero deps (channel.ts:28) |
| `src/client/cosmos/hud.ts` | goal-tracking readout via exact score.ts measure | ✓ VERIFIED | imports `score` from engine; textContent only (T-02-11) |
| `src/client/cosmos/paint.ts` | paint-only reward accent, no rng | ✓ VERIFIED | `paintRewardAccent` + `REWARD_HUE`, gated on goalAchieved, baked into frozen shell |
| `src/client/game.ts` | nudge wiring + realtime subscribe + per-shell goalAchieved | ✓ VERIFIED | fetch /api/steer + safeParse + handle.nudge + budget disable; connectRealtime (not awaited) + disconnectRealtime in teardown |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| tick.ts | score.ts | `score(dayVector, genome)` → RingRecord.outcome | ✓ WIRED | tick.ts:186-192 |
| ring.ts | Outcome | `'outcome'` in JSON_FIELDS | ✓ WIRED | ring.ts:37 |
| game.ts | /api/steer | `fetch('/api/steer')` + SteerResponseSchema.safeParse | ✓ WIRED | game.ts:362,368 |
| routes/api.ts | steer.ts | POST /steer → recordNudge | ✓ WIRED | api.ts:126 |
| tick.ts | steer.ts | runTick reads readSteerAggregate, folds mean, deletes hash | ✓ WIRED | tick.ts:161-162,248 |
| steer broadcast | game.ts | `realtime.send(steerChannel(postId), aggregate)` ↔ connectRealtime onMessage | ✓ WIRED | api.ts:152; game.ts:292-305 |
| game.ts | channel.ts | `steerChannel(context.postId)` (client + server identical) | ✓ WIRED | game.ts:290; api.ts:152 |
| tick.ts | post.ts | revealDone nx-guard then createRevealPost after writeRing | ✓ WIRED | tick.ts:213-222 |
| paint.ts | Scene | paint reads shell.goalAchieved (from outcome.achieved), no rng | ✓ WIRED | paint.ts:284; synthesis.ts:321 |
| CosmosScene | paint | paintScene → drawShell → paintRewardAccent (reward reaches screen) | ✓ WIRED | CosmosScene.ts:164; paint.ts:343,285 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite | `npx vitest run` | 25 files, 231 tests passed | ✓ PASS |
| Type-check | `npx tsc --noEmit` | exit 0, clean | ✓ PASS |
| Determinism: same inputs → equal outcome | score.test.ts "same inputs → deeply equal outcome" | green | ✓ PASS |
| Steer SUM no-clobber | steer.test.ts "two +0.5 branch nudges SUM to branch=1.0, count=2" | green | ✓ PASS |
| Freeze idempotency | tick.test.ts "a re-run for the same/EARLIER day is a no-op" | green | ✓ PASS |
| Exactly-once reveal | tick.test.ts "double-fire creates AT MOST one reveal post" | green | ✓ PASS |
| Outcome Redis round-trip | ring.test.ts "round-trips a ring carrying an outcome object (Pitfall 5)" | green | ✓ PASS |

### Architecture / Engine Invariants

| Invariant | Status | Evidence |
| --------- | ------ | -------- |
| No `Math.random` under src/engine/ | ✓ HELD | grep finds only two comment mentions (score.ts:4, rng.ts:5); the seeded RNG uses arithmetic, not Math.random |
| No `@devvit` imports under src/engine/ | ✓ HELD | grep returns nothing |
| src/shared/* client-safe (no server import) | ✓ HELD | grep for server/@devvit-server imports in src/shared returns nothing; shared/api.ts imports only zod + engine contracts |
| Steering biases the frontier mean, never re-bakes frozen shells | ✓ HELD | render().nudge re-synths shells[0] only (render.ts:115-117); foldSteering applies the mean × gain once (tick.ts:90-103) |
| Paint reads only Scene metrics (ENG-02) | ✓ HELD | reward glyph reads shell.goalAchieved (a Scene-derived flag), never raw DayVector (paint.ts:281-284); per-shell flag set purely in synthesis |
| score re-uses synthesis derivations (one source of truth) | ✓ HELD | deriveArms/starCount exported and called by BOTH synthesis and score |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| LIVE-01 | 04-02, 04-03 | Live frontier fills, nudges near-real-time (colon-free channel), aggregate into Redis steer hash | ✓ SATISFIED (realtime on-device → human) | hIncrBy aggregate + colon-free steerChannel + broadcast/subscribe wiring; on-device realtime delivery deferred to UAT (D-03a) |
| LIVE-02 | 04-04 | Tick freezes irreversibly + pinned reveal post | ⚠️ SUBSTRATE / HUMAN | exactly-once reveal substrate unit-verified; on-device post appearance/timing deferred to UAT |
| LIVE-03 | 04-01, 04-04 | Client/server render identically from the same Ring record | ⚠️ SUBSTRATE / HUMAN | pure score + steering-free seed + round-trip + Scene determinism tests; two-client parity deferred to UAT |
| GAME-02 | 04-01 | Tick scores against goal deterministically; achieved+degree on Ring + reveal | ✓ SATISFIED | pure score() wired into runTick; outcome round-trips; achievability proven |
| GAME-03 | 04-02 | Steering nudges measurably move the day toward/away from the goal | ✗ PARTIAL (GAP) | HUD readout legible, BUT scored measure is steering-independent (score.ts reads no day.steering); REQUIREMENTS.md marks GAME-03 [ ] Pending — see Gaps |
| GAME-04 | 04-04 | Achieved goal leaves a persistent reward on the ring | ⚠️ SUBSTRATE / HUMAN | deterministic paint-only glyph substrate unit-verified; on-device visual permanence deferred to UAT |

No ORPHANED requirements: every ID mapped to Phase 4 in REQUIREMENTS.md (LIVE-01/02/03, GAME-02/03/04) is claimed by a plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/client/game.ts | 58 | "not yet implemented" (comic/pixel style ids) | ℹ️ Info | Doc comment about out-of-scope style ids with a graceful fallback; unrelated to Phase 4 scope, not debt |
| src/engine/score.ts | 22,36 | `[ASSUMED]` on DENSITY_NORM_CAP / SYMMETRY_DEGREE_SPAN | ℹ️ Info | Documented tuning constants proven numerically by score.test.ts achievability assertions — not unresolved debt |

No `TBD`/`FIXME`/`XXX` blocker markers in any phase-modified file.

### Human Verification Required

4 on-device items (criteria 4, 5, 6 + realtime) require `devvit playtest` on real Reddit. The implementing plans (04-03, 04-04) auto-approved their human-verify checkpoints and HONESTLY recorded the on-device verification as DEFERRED to UAT — it was NOT performed on a device. The DETERMINISTIC SUBSTRATE for all four is verified in code (see truths 4–6 + the realtime wiring). See the `human_verification` frontmatter for the exact test/expected/why for each.

### Gaps Summary

One real gap blocks a clean pass: **GAME-03** — "steering nudges measurably move the day toward/away from the goal." The phase goal explicitly promises "nudges steer it toward the day's goal," but the scored metric (`score.ts measure()`) is purely activity-driven and reads no `day.steering`. A nudge changes only the VISUAL frontier mean (and the hue hint) — the achieved/degree verdict is identical with or without nudging. This is a documented design decision (04-02-SUMMARY) and REQUIREMENTS.md itself marks GAME-03 as `[ ]` Pending, so the requirement was knowingly left incomplete. It is owned by Phase 4 (not deferred to Phase 5's publishing/onboarding scope), so it stays a real gap rather than a deferred item.

Note the documentation inconsistency: ROADMAP marks Phase 4 "Complete" and the GAME-03 progress row says "Pending" — these contradict and should be reconciled when this gap is resolved or accepted.

**This may be intentional (MVP scoping).** If "a legible goal-tracking readout" is deemed sufficient for GAME-03 at MVP and the steering→outcome mechanism is descoped, accept the deviation by adding to this file's frontmatter:

```yaml
overrides:
  - must_have: "Steering nudges measurably move the day toward/away from the goal (GAME-03)"
    reason: "MVP scope: the legible goal-tracking readout + the visual frontier re-synth deliver the contribution legibility; coupling the scored metric to steering is descoped for the hackathon"
    accepted_by: "Oliver"
    accepted_at: "2026-06-22T..."
```

Then update REQUIREMENTS.md GAME-03 to Complete with that rationale and re-run verification.

Everything else for the phase goal is in place: criteria 1–3 are fully code-verified and green (231/231 tests), and the deterministic substrate for the on-device retention loop (criteria 4–6) is unit-covered, with the genuine on-device behavior honestly routed to human verification rather than claimed.

---

_Verified: 2026-06-22T04:13:20Z_
_Verifier: Claude (gsd-verifier)_
