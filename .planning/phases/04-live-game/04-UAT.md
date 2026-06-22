---
status: deferred
phase: 04-live-game
source: [04-VERIFICATION.md]
started: 2026-06-22T08:45:00Z
updated: 2026-06-22T09:00:00Z
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
