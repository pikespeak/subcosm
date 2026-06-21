---
status: testing
phase: 03-devvit-scaffold-data-layer
source: [03-VERIFICATION.md]
started: "2026-06-21T17:55:00Z"
updated: "2026-06-21T17:55:00Z"
---

## Current Test

number: 1
name: WebGL Scene renders in the post iframe on a physical phone
expected: |
  The cosmos renders in-app (genesis core + shells), NOT the blue counter demo;
  pinch/drag drive the camera (touch-action:none), not the page.
awaiting: user response

## Tests

### 1. WebGL Scene renders in the post iframe on a physical phone
test: Open the Subcosm interactive post on a physical phone via `devvit playtest subcosm_test_om` and confirm the engine renders a real Scene (genesis core + shells) inside the post iframe (WebGL, or documented Canvas2D AUTO fallback) — NOT the blue counter demo.
expected: The cosmos renders in-app; pinch/drag drive the camera (touch-action:none), not the page.
result: [pending]

### 2. Real Reddit triggers move the Redis accumulators
test: In the test sub, create a post and two comments by different users (one a reply with a t1_ parentId). Inspect Redis (debug route/logs).
expected: posts/comments/replies counters increment, the contributor ZSET-as-set cardinality = 2, the threads ZSET reflects the activity, all under day = frontierDay(sub).
result: [pending]

### 3. Visual states — populated / cold-start / error
test: Invoke the tick for the populated sub (runJob or sweeper path), then a fresh sub with 0 rings; force a fetch failure (offline).
expected: Populated → the real accumulated universe renders; empty → genesis-core-only cold-start with Genesis copy (intentional, not broken); offline → muted-ink error overlay + retry (no alarm-red).
result: [pending]

### 4. Install settings validation + registry write
test: Open the install/settings surface; set timezone 'Mars/Olympus' then a valid IANA zone (e.g. Europe/Berlin).
expected: Invalid zone rejected via the validationEndpoint with the i18n key surfaced; valid zone saves; community appears in subs:registry after install.
result: [pending]

### 5. Hourly sweeper fires only at each community's local midnight
test: Let the hourly sweeper run (or trigger it) with two communities in different IANA zones.
expected: A community fires its tick only when its OWN local clock is at 00:xx (past its jitter minute); a non-midnight zone is skipped (verify via logs).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
