---
status: testing
phase: 04-live-game
source: [04-VERIFICATION.md]
started: 2026-06-22T08:45:00Z
updated: 2026-06-22T08:45:00Z
---

## Current Test

number: 1
name: Pinned reveal post appears within ~1 min of the tick, stating the goal and whether it was achieved
expected: |
  After the overnight tick fires (sweeper at local midnight, or a manually triggered tick),
  a pinned "what your universe became overnight" post appears in the subreddit within ~1 minute.
  It states the day's goal and whether it was achieved (✓/✗). No raw user text is echoed.
awaiting: user response

## Tests

These require `devvit playtest` on a real subreddit (`subcosm_test_om` per devvit.json), two clients
with at least one on mobile. They CANNOT be verified from the dev harness or via Playwright on the
built bundle — they exercise the live Devvit runtime (triggers, scheduler, realtime, post creation).
The deterministic substrate of each is already unit-verified in code (246 tests green); these confirm
the on-device runtime behavior.

### 4. Pinned reveal post within ~1 min of the tick
expected: After the tick, a pinned reveal post appears within ~1 minute stating the day's goal and achieved ✓/✗. Exactly one post per tick (revealDone nx-guard). No user-authored free text reflected.
result: [pending]

### 5. Persistent reward glyph on an achieved ring
expected: When the day's goal was achieved, scrubbing to that frozen ring shows a persistent reward glyph/badge; it renders identically on every client from the same Ring record. Driven only by deterministic outcome.achieved geometry.
result: [pending]

### 6. Second-client identical frozen ring (Redis → engine determinism)
expected: Loading the post on a second client (incl. mobile) after the tick renders a byte-identical frozen ring to the first client — determinism holds across the Redis → engine seam.
result: [pending]

## Realtime note (from 04-03, also on-device)

Plan 04-03's D-03a realtime check (a nudge propagating to a second viewer in near-real-time) was
auto-approved/UAT-deferred. Confirm it on-device alongside the above. If realtime misbehaves on the
mobile webview, the locked D-03b reload-reconciliation fallback (via GET /organism) is the safety net —
the feature degrades gracefully with no code change. Record which path is in effect.

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
