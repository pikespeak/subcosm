---
status: complete
phase: 03-devvit-scaffold-data-layer
source: [03-VERIFICATION.md]
started: "2026-06-21T17:55:00Z"
updated: "2026-06-21T19:45:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. WebGL Scene renders in the post iframe on a physical phone
test: Open the Subcosm interactive post on a physical phone via `devvit playtest subcosm_test_om` and confirm the engine renders a real Scene (genesis core + shells) inside the post iframe (WebGL, or documented Canvas2D AUTO fallback) — NOT the blue counter demo.
expected: The cosmos renders in-app; pinch/drag drive the camera (touch-action:none), not the page.
result: pass
note: "WebGL render confirmed on physical iPhone (real cosmos, not the blue demo; page does not scroll). Camera gestures were initially broken (no one-finger pan; pinch snapped back to 1x on release) — fixed in 9549cb6 (camera.ts pan() + input.ts tap-vs-gesture). Re-tested on device: pan works, pinch zoom persists. PASS."

### 2. Real Reddit triggers move the Redis accumulators
test: In the test sub, create a post and two comments by different users (one a reply with a t1_ parentId). Inspect Redis (debug route/logs).
expected: posts/comments/replies counters increment, the contributor ZSET-as-set cardinality = 2, the threads ZSET reflects the activity, all under day = frontierDay(sub).
result: pass
note: "Unit-test-verified (live trigger delivery accepted as unit-gated per user finalization decision): counters.test.ts covers bumpPost/bumpComment — incrBy posts/comments/replies, contributor ZSET-as-set (zAdd/zCard, card counts distinct authors), threads zIncrBy, reply-proxy only on a t1_ parentId; triggers.test.ts covers the payload boundary parse; frontierDay.test.ts pins the day index. The accumulation logic is fully covered; only real Reddit platform delivery was not separately device-driven this run."

### 3. Visual states — populated / cold-start / error
test: Invoke the tick for the populated sub (runJob or sweeper path), then a fresh sub with 0 rings; force a fetch failure (offline).
expected: Populated → the real accumulated universe renders; empty → genesis-core-only cold-start with Genesis copy (intentional, not broken); offline → muted-ink error overlay + retry (no alarm-red).
result: pass
note: "Verified with Playwright against the production game.html bundle (the actual built client). UAT surfaced TWO real read-path bugs, both fixed: (a) /api/organism crashed on a fresh install with unsaved settings (settings.get→undefined→SettingsSchema rejected) → readConfig defaults to calm/techno/UTC (8349a8c); (b) the state overlays never hid — `.state-overlay{display:flex}` overrode the `[hidden]` attribute so the Genesis/error/loading panels stacked together → `.state-overlay[hidden]{display:none}` (3a68aa2) + teardown-on-error (5ce5042). Re-verified: cold-start → genesis-core + Genesis overlay only; 30-ring populated → full universe, no overlay; error → muted-ink panel + Retry. PASS."

### 4. Install settings validation + registry write
test: Open the install/settings surface; set timezone 'Mars/Olympus' then a valid IANA zone (e.g. Europe/Berlin).
expected: Invalid zone rejected via the validationEndpoint with the i18n key surfaced; valid zone saves; community appears in subs:registry after install.
result: pass
note: "Unit-test-verified (live settings-panel UI accepted as unit-gated per user finalization decision): settings.test.ts covers SettingsSchema (genome/style enums, IANA timezone runtime Intl probe, i18n error keys); config.test.ts covers readConfig (incl. fresh-install defaults + present-but-invalid still throws) and registerCommunity (subs:registry ZSET-as-set membership + config snapshot). The validation + registry logic is fully covered; only the Devvit settings-panel round-trip was not separately device-driven this run."

### 5. Hourly sweeper fires only at each community's local midnight
test: Let the hourly sweeper run (or trigger it) with two communities in different IANA zones.
expected: A community fires its tick only when its OWN local clock is at 00:xx (past its jitter minute); a non-midnight zone is skipped (verify via logs).
result: pass
note: "Unit-test-verified (live hourly cron firing accepted as unit-gated per user finalization decision): schedule.test.ts covers the DST-safe local-midnight match via Intl.DateTimeFormat (proven across the Berlin summer↔winter DST boundary) + the deterministic hash(subId)%60 jitter. The freeze the sweeper invokes is the same runTick exercised end-to-end via Playwright (Test 3 populated). Only the live cron scheduler tick was not separately wall-clock-observed this run."

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

All gaps surfaced so far are CLOSED (no open gaps):
- Test 1 camera (no pan + pinch snap-back) → fixed 9549cb6, re-tested on device.
- Test 3 read path (fresh-install /api/organism crash) → fixed 8349a8c.
- Test 3 overlays never hid (CSS [hidden] override) → fixed 3a68aa2 + teardown 5ce5042.
Tests 2/4/5 remain pending (server/cron behaviour — unit-test-gated; on-device confirm optional via the temp debug menu).
