---
phase: 05-submit
plan: 02
subsystem: api
tags: [devvit, redis, zod, menu-actions, backfill, force-tick, determinism, hono]

# Dependency graph
requires:
  - phase: 03-devvit-wiring
    provides: writeRing/ringCount ring store, redisKeys, frontierDay, tickJob boundary idiom
  - phase: 04-live-game
    provides: runTick (freeze + reveal post + revealDone nx-guard), score(), genome resolution, steer fold
  - phase: 02-visual-engine-simulator
    provides: generateDayVectors (deterministic ~30-day arc), DayVector/RingRecord contracts
provides:
  - "backfillHistory(subId, opts?) — direct-ring-write demo history seeding (D-01), rings only, idempotent"
  - "Shared seed.ts (hashSeed) + genome.ts (resolveGenome/PRESETS) extracted from tick.ts"
  - "MenuActionRequestSchema boundary contract for mod-menu actions"
  - "/internal/menu/backfill (D-01) + /internal/menu/force-tick (D-08) mod-gated endpoints"
  - "devvit.json menu items: Seed demo history + Advance day / trigger tick (forUserType moderator)"
affects: [05-04-uat, 05-05-uat, demo-post, folded-on-device-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct-ring-write seeding: reuse the tick ring-build (hashSeed + resolveGenome + score + RingRecordSchema.parse + writeRing) while skipping the reveal/reset side-effects"
    - "Shared determinism helpers (seed.ts/genome.ts) so tick + backfill never diverge on seed or genome"
    - "Mod-menu boundary parse that trusts NOTHING from the body — sub/day always from context.subredditId + frontierDay (V4)"

key-files:
  created:
    - src/server/core/backfill.ts
    - src/server/core/backfill.test.ts
    - src/server/core/seed.ts
    - src/server/core/genome.ts
    - src/server/contracts/menuActions.ts
    - src/server/contracts/menuActions.test.ts
  modified:
    - src/server/core/tick.ts
    - src/server/core/ring.ts
    - src/server/routes/menu.ts
    - devvit.json
    - vitest.config.ts
    - tools/tsconfig.server.json
    - tools/tsconfig.server-tests.json

key-decisions:
  - "DEMO_SEED = 0x535542 (5461314, ASCII 'SUB') — a fixed, frozen master seed so the demo universe is the same well-told story on every install"
  - "Backfill arc length = full simulator arc (30 days, contiguous day 1..30 from generateDayVectors); maxDays opt left for future shortening per D-01 discretion but defaults to full"
  - "Idempotency mechanism = ringCount > 0 skip (returns 0, never doubles the index) — chosen over a separate backfillDone nx-flag because ringCount is already the single enumeration index"
  - "Extracted hashSeed -> seed.ts and resolveGenome/PRESETS -> genome.ts from tick.ts so backfill reuses the IDENTICAL helpers (no divergent reimplementation, D-01 / RESEARCH Pitfall 3)"
  - "MenuActionRequestSchema strips client envelope fields (no trusted sub/day leaks) and rejects non-object payloads with i18n key error.menu.payload.invalid"

patterns-established:
  - "Demo seeding writes rings ONLY via writeRing — never runTick/createRevealPost (no ~30-post spam tripwire, RESEARCH Pitfall 2)"
  - "Force-tick is a thin mod action: frontierDay(context.subredditId) -> runTick(subId, day), idempotent + safe to re-fire"

requirements-completed: [SUB-02]

# Metrics
duration: ~10min
completed: 2026-06-22
status: complete
---

# Phase 5 Plan 02: Demo-control server tooling Summary

**Mod-only "Seed demo history" (D-01) backfills the deterministic 30-day simulator arc as frozen rings via writeRing only (zero reveal posts, idempotent), and "Advance day / trigger tick" (D-08) fires runTick on the trusted frontier — both boundary-parsed and reusing the existing tested tick/ring paths.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-22T09:51:23Z
- **Completed:** 2026-06-22T10:01:02Z
- **Tasks:** 3
- **Files modified:** 13 (6 created, 7 modified)

## Accomplishments
- `backfillHistory(subId, opts?)` writes the full 30-day arc (DEMO_SEED) as deterministic, schema-valid, cross-client-identical frozen rings — seed overridden with the shared `hashSeed`, `dominantTheme:'community'`, scored + `RingRecordSchema.parse`'d at the build boundary, then `writeRing` only. ZERO reveal posts; idempotent (no-op when ringCount > 0).
- Two mod-gated menu endpoints: `/backfill` → `backfillHistory(context.subredditId)` and `/force-tick` → `runTick(context.subredditId, frontierDay(subId))` — both boundary-parsed, trust no client sub/day, return `UiResponse` toasts and never throw.
- Two `devvit.json` menu items wired (`forUserType: moderator`, `location: subreddit`).
- Extracted `hashSeed` (seed.ts) and `resolveGenome`/`PRESETS` (genome.ts) from tick.ts into shared modules so the backfill and the live freeze cannot diverge — and exported `deserializeRing` from ring.ts for round-trip-consistent raw reads.

## Demo seed + arc + idempotency (output spec)
- **Demo seed:** `DEMO_SEED = 0x535542` (decimal 5461314; ASCII "SUB" for Subcosm). Fixed and frozen — `generateDayVectors({ seed: DEMO_SEED })` yields the same arc on every install.
- **Backfill arc length:** the full simulator arc — **30 days, contiguous day 1..30** (one ring per `Beat`, oldest→newest, ring index N == day N). `BackfillOptions.maxDays` exists to shorten per D-01 discretion but defaults to the full arc.
- **Idempotency mechanism:** **`ringCount > 0` skip.** `backfillHistory` reads `keys.ringCount(sub)` first and returns `0` (no rings written) when any ring already exists, so a re-run — or a backfill against an organically-grown sub — never doubles the index (RESEARCH Pitfall 4). `frontierDay` after a fresh backfill is `arcLength + 1` (= 31).

## Task Commits

Each task was committed atomically:

1. **Task 1: backfill.ts — direct-ring-write seeding (D-01)** - `6549ab8` (feat, TDD test+impl)
2. **Task 2: menuActions schema + /backfill and /force-tick endpoints (D-01/D-08)** - `17bdca6` (feat, TDD test+impl)
3. **Task 3: wire the two mod-only menu items in devvit.json** - `e4874a7` (feat)

_TDD note: Tasks 1 & 2 were each driven test-first (RED confirmed via missing-module / no-tests failure, then GREEN); the test and implementation for each task are committed together as one atomic task commit._

## Files Created/Modified
- `src/server/core/backfill.ts` - D-01 `backfillHistory` direct-ring-write seeding (rings only, idempotent, deterministic).
- `src/server/core/backfill.test.ts` - 16 tests: arc written, seed=hashSeed, dominantTheme community, schema-valid, idempotent, zero reveal posts, genome resolution.
- `src/server/core/seed.ts` - shared `hashSeed(subId, day, genomeVersion)` FNV-1a helper (extracted from tick.ts).
- `src/server/core/genome.ts` - shared `resolveGenome`/`PRESETS` (extracted from tick.ts).
- `src/server/contracts/menuActions.ts` - `MenuActionRequestSchema` boundary contract (strips client fields, rejects non-objects, i18n key).
- `src/server/contracts/menuActions.test.ts` - 7 tests: accept object/extra-fields, reject null/string/number/array, i18n key.
- `src/server/core/tick.ts` - now imports the shared `hashSeed` + `resolveGenome` (local copies removed; behavior unchanged, 35 tick/ring tests still green).
- `src/server/core/ring.ts` - exported `deserializeRing` (public alias of the deserialize round-trip).
- `src/server/routes/menu.ts` - `/backfill` and `/force-tick` mod handlers (boundary-parse, trusted context, UiResponse toasts, try/catch).
- `devvit.json` - two new mod-only menu items.
- `vitest.config.ts` - include the two new test files (runner uses an explicit allowlist).
- `tools/tsconfig.server.json` / `tools/tsconfig.server-tests.json` - reference `tsconfig.sim.json` so the server can import `src/sim`.

## Decisions Made
See `key-decisions` frontmatter. Summary: fixed `DEMO_SEED` 0x535542; full 30-day arc; `ringCount > 0` idempotency; shared seed/genome helpers to guarantee tick↔backfill determinism parity; permissive-but-validating menu boundary schema that trusts no body field.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the two new test files to the vitest include allowlist**
- **Found during:** Task 1 (first test run)
- **Issue:** `vitest.config.ts` uses an explicit `include` allowlist (no glob auto-discovery); the new `backfill.test.ts` / `menuActions.test.ts` were not found ("No test files found").
- **Fix:** Added both files to the `include` array with explanatory comments.
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run` now discovers and runs both suites (23 new tests).
- **Committed in:** `6549ab8` (Task 1) / `17bdca6` (Task 2)

**2. [Rule 3 - Blocking] Referenced tsconfig.sim.json from the server tsconfig projects**
- **Found during:** Task 1 (type-check)
- **Issue:** `backfill.ts` imports `generateDayVectors` from `src/sim`, but the server projects (`tsconfig.server.json` / `tsconfig.server-tests.json`) did not reference the sim composite project. `tsc --build` raised TS6059/TS6307 (`src/sim` not under the server `rootDir`) AND emitted stray `.js`/`.d.ts` files into `src/sim/` (the project-graph forced them in-tree).
- **Fix:** Added `{ "path": "./tsconfig.sim.json" }` to the `references` of both server tsconfig projects. sim is a pure engine+zod module (no client/Phaser/Devvit import), safe for the server to consume.
- **Files modified:** tools/tsconfig.server.json, tools/tsconfig.server-tests.json
- **Verification:** `npm run type-check` clean; sim declarations now emit correctly to `dist/types/sim/` with NO stray `src/sim` emit (verified after a clean `rm -rf dist/types` rebuild).
- **Committed in:** `6549ab8` (Task 1)

**3. [Rule 1 - Refactor/correctness] Extracted hashSeed + resolveGenome from tick.ts into shared modules**
- **Found during:** Task 1 (implementation)
- **Issue:** The plan explicitly forbids re-implementing a divergent `hashSeed`; backfill needs the IDENTICAL FNV-1a seed + genome resolution as tick.ts to keep rings determinism-consistent (D-01 / RESEARCH Pitfall 3).
- **Fix:** Moved `hashSeed` → `src/server/core/seed.ts` and `resolveGenome`/`PRESETS` → `src/server/core/genome.ts`; tick.ts now imports both. No behavior change (tick.ts logic identical).
- **Files modified:** src/server/core/tick.ts, src/server/core/seed.ts, src/server/core/genome.ts
- **Verification:** Full tick.test.ts (and ring.test.ts) suite still green (35 tests); backfill rings use the same seed function.
- **Committed in:** `6549ab8` (Task 1)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 correctness/shared-helper refactor)
**Impact on plan:** All three were necessary to compile/run the planned code and to satisfy the plan's explicit "share the hashSeed helper, do not re-implement" constraint. No scope creep — the tsconfig fix also removed a latent stray-emit issue.

## Issues Encountered
- Stray `src/sim/*.js` emit appeared during the first type-check; root-caused to the missing sim project reference (deviation 2) rather than a backfill bug. Resolved by the proper composite reference; confirmed clean after a fresh `dist/types` rebuild.

## Known Stubs
None. No placeholder/empty-data stubs introduced. `BackfillOptions.maxDays` is an intentional, documented optional knob (defaults to the full arc), not a stub.

## Threat Flags
None. The two new endpoints are mod-gated (`forUserType: moderator`), boundary-parsed, and use trusted `context.subredditId` + server-side `frontierDay` — all surfaces are covered by the plan's threat register (T-05-04..08). No new untracked trust boundary introduced.

## Hard-safety compliance (SUBMIT phase)
Code + mocked tests ONLY. No `devvit publish/upload`, no real Reddit post, no Devpost action, no live backfill/tick/reveal performed against any subreddit. The backfill + force-tick are code paths a moderator invokes later via the menu; tests mock redis + the reddit post path and assert the backfill never touches the post API.

## DoD Gates (CLAUDE.md non-negotiable)
- `npm test` (vitest run): **269 passed** (27 files; +23 new in this plan)
- `npm run type-check` (tsc --build): **clean**
- `npm run lint` (eslint): **clean**
- `npm run build` (vite): **success** (pre-existing vite config warnings only, unrelated to this plan)

## Next Phase Readiness
- The folded on-device UAT (05-05) now has both triggers it needs: seed the demo universe (D-01) and force a reveal on demand (D-08).
- Both menu actions are real, mod-gated, KEPT features (not scaffolding) per D-08.

## Self-Check: PASSED

All created files exist on disk; all three task commits present in git history (6549ab8, 17bdca6, e4874a7).

---
*Phase: 05-submit*
*Completed: 2026-06-22*
