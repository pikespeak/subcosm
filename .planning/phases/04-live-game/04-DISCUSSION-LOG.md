# Phase 4: Live Game — Discussion Log

**Date:** 2026-06-21
**Mode:** discuss (standard)
*Human reference only — not consumed by downstream agents (they read CONTEXT.md).*

## Areas selected for discussion

Oliver selected all 4 surfaced gray areas.

### 1. Daily goal — fixed per genome vs. variable per day
- Options: fixed per genome (rec) · deterministic variable per day · fixed with activity-scaled threshold
- **Chosen:** Fixed per genome (MVP). Each genome's authored `dailyGoal` is THE goal (Calm conflict<0.4 / Chaotic density>0.7 / Crystalline symmetry>5). Variable-per-day deferred.
- Note surfaced: density/symmetry aren't direct DayVector fields → scoring needs a pure deterministic derivation (research/planner).

### 2. How "live" is live — multi-viewer realtime vs. acting-user only
- Options: realtime broadcast of aggregated steer-state (rec) · acting-user local + others-on-reload · per-action broadcast
- **Chosen:** Devvit realtime channel broadcasting the aggregated steer-hash; acting user also re-synths locally immediately. Channel names use `-`, no colons.
- Locked fallback: degrade to acting-user-local + reload if realtime proves unreliable on the post webview (the #1 research risk, Phase-4 analog of WebGL).

### 3. Reveal post — content + form
- Options: new interactive post with frozen ring (rec) · text post + link · update + pin-comment on existing post
- **Chosen:** New pinned interactive post rendering the just-frozen ring + overlay (goal, achieved ✓/✗, degree). One per community per day, within ~1 min of the tick.

### 4. Goal reward (GAME-04)
- Options: special glyph on the ring (rec) · era-badge ring ornament · both
- **Chosen:** Deterministic special glyph/star in the frozen ring, derived purely from `outcome.achieved` (paint-only, identical on every client). Era-badge deferred.

## Derived decisions captured (not separately asked)
- `outcome` shape firmed (achieved + degree + measured value + resolved goal); pure scoring function; `Scene.goalAchieved` mirrors it.
- Nudge = same-origin fetch enforcing ActionBudget (cap 3/user/day) + aggregating into the steer hash (never overwrite) + broadcasting; biases the mean only (I-5).
- Tracking readout (GAME-03): live HUD shows current targetParam value vs threshold + on-track indicator.
- Tick extended (scoring + reveal + reward) on the existing idempotent freeze; determinism across the seam extended to the reward.

## Deferred ideas
Variable-per-day goals · guesses as a second action · activity-scaled thresholds · era-badge ornament · per-raw-action broadcast.
