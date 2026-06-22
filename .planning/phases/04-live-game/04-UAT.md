---
status: reopened-awaiting-approval
phase: 04-live-game
reopened_in: 05-submit
source: [04-VERIFICATION.md]
started: 2026-06-22T08:45:00Z
updated: 2026-06-22T19:30:00Z
decision: "On-device UAT deferred to Phase 5 demo by user (Oliver) on 2026-06-22. These items need a live tick cycle on a real subreddit with two clients (one mobile) — not self-drivable (no on-demand tick trigger; Playwright-on-bundle cannot exercise the Devvit runtime). Phase 5's public demo-post + mobile-polish work exercises tick→reveal→glyph→cross-client→realtime on a real sub, so they are validated there instead of twice. Substrate is unit-verified (246 tests); realtime degrades gracefully via D-03b."
---

## Decision: DEFERRED to Phase 5 demo

All three items below + the 04-03 realtime check are **not failed and not passed** — they are
**deferred to Phase 5** (public demo post on a real subreddit + mobile polish), where the live
Devvit runtime exercises these exact paths for real. Re-open them during Phase 5 UAT.

## Tests (deferred — validate during Phase 5 demo)

### 4. Pinned reveal post within ~1 min of the tick
expected: After the tick, a pinned reveal post appears within ~1 minute stating the day's goal and achieved ✓/✗. Exactly one post per tick (revealDone nx-guard). No user-authored free text reflected.
result: [deferred → Phase 5 demo] — substrate unit-verified (createRevealPost + exactly-once nx-guard, 5 tick tests)

### 5. Persistent reward glyph on an achieved ring
expected: When the day's goal was achieved, scrubbing to that frozen ring shows a persistent reward glyph/badge; renders identically on every client from the same Ring record.
result: [deferred → Phase 5 demo] — substrate unit-verified (glyph driven only by deterministic outcome.achieved geometry, no rng; synthesis tests)

### 6. Second-client identical frozen ring (Redis → engine determinism)
expected: Loading the post on a second client (incl. mobile) after the tick renders a byte-identical frozen ring to the first client.
result: [deferred → Phase 5 demo] — substrate unit-verified (byte-identical Scene determinism tests)

### (04-03) Realtime nudge propagation to a second viewer
expected: A nudge propagates to a second viewer in near-real-time on the mobile webview; if not, the D-03b reload-reconciliation fallback (via GET /organism) keeps clients consistent on load/reconnect.
result: [deferred → Phase 5 demo] — D-03b fallback is the locked safety net; record which path is in effect during the demo

## Summary

total: 4
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 0
deferred: 4

## Gaps

None blocking. The four items are deferred to Phase 5 demo validation by user decision (see frontmatter `decision`).

---

## Phase 5 RE-OPEN — On-device run procedure (2026-06-22)

**Status: reopened, awaiting Reddit app-review approval.** App `subcosm-universe` v0.0.4 (unlisted)
was submitted for review on 2026-06-22 (`devvit publish`). It must be approved (creates custom
posts) before it can be installed on a subreddit. Approval arrives by **email** — no ETA, external
gate. The four items below are runnable ONLY after install on a real sub. Do not mark any item
pass without an actual on-device observation (D-06 — Playwright-on-bundle cannot exercise the
Devvit runtime).

### Preconditions
1. Approval email received.
2. App installed on a subreddit you moderate (the demo sub).
3. Mod-menu visible: **"Seed demo history"** (backfill) + **"Force tick"**.

### Run steps (one on-device pass)
1. **Seed:** mod-menu → *Seed demo history* → confirm the 30-day arc backfilled (open the post,
   scrub to day 1 → day 30, every shell distinct, no central blob). Idempotent (re-run = no-op).
2. **Tick + reveal (item 4):** mod-menu → *Force tick* → start a stopwatch. Expect ONE pinned
   reveal post within ~1 min stating the day's goal + achieved ✓/✗. Re-run force-tick same day →
   NO second post (revealDone nx-guard). Confirm no user-authored free text in the post.
   → record actual time-to-post: ____ s
3. **Reward glyph (item 5):** on a ring whose goal was achieved, scrub to that frozen ring →
   persistent reward glyph/badge visible and stays on re-scrub. → pass/issue: ____
4. **Two-client parity (item 6):** open the same post on a second client incl. **mobile** after the
   tick → frozen ring renders identically (same geometry/colors) to client 1. → pass/issue: ____
5. **Realtime nudge (04-03):** client A nudges the frontier → client B (mobile webview) sees it
   propagate near-real-time. If not, reload client B → D-03b reload-reconciliation (GET /organism)
   converges it. → record which path was in effect: realtime / D-03b-fallback
6. **60fps (D-05, folded from 05-04):** on a real mid-range Android, frontier animation feels smooth
   (~60fps), frozen shells static. → pass/issue: ____

### On completion
- Fill each `____` above with the observed result; flip `status:` to `complete`.
- Update the **Summary** counters (passed/issues) to reflect real outcomes.
- Capture screenshots during this pass for the Devpost media gallery (genesis core, dense vs quiet
  shell, frozen reveal, depth scrubber, two genome presets) — NO user text in any caption (SUB-05).
- Feed the app-listing URL + demo-post URL + media into docs/devpost-submission.md (05-05).
