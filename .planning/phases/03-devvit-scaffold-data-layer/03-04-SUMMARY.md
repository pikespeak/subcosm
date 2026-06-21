---
phase: 03-devvit-scaffold-data-layer
plan: 04
subsystem: server
tags: [devvit, settings, zod, scheduler, cron, sweeper, dst, intl, i18n, determinism, vitest]

# Dependency graph
requires:
  - phase: 03-01
    provides: "central redisKeys.ts key-builder (registry/config) + StyleIdEnum contract"
  - phase: 03-02
    provides: "frontierDay(sub) day-index helper + ZSET-as-set pattern (SDK has no set ops)"
  - phase: 03-03
    provides: "TickJobSchema + POST /internal/scheduler/tick + scheduler.tasks.tick (the one-off tick the sweeper runJob-fires)"
provides:
  - "SettingsSchema (genome enum / style via canonical StyleIdEnum / timezone via runtime Intl IANA probe) + z.infer Settings — the install-settings boundary (DEV-06)"
  - "isValidIana runtime predicate + pure DST-safe schedule.ts (localHourMinute via Intl.DateTimeFormat, deterministic FNV-1a jitterMinute, isLocalMidnightWithJitter) — no Devvit import, no Math.random (D-03)"
  - "config.ts: readConfig() (current-install settings.get + SettingsSchema.parse — single boundary) + readSnapshot(sub) (per-sub organism:{sub}:config read for the sweeper) + registerCommunity(sub,cfg) (ZSET-as-set subs:registry + config hSet)"
  - "routes/settings.ts: POST /validate-timezone returning i18n error key error.settings.timezone.invalidIana"
  - "scheduler.ts /sweeper: hourly UTC cron enumerating subs:registry, firing each community's tick via runJob ONLY at its local midnight (DST-safe + jitter, DEV-04)"
  - "onAppInstall registers the installed community + snapshots its config"
  - "devvit.json: settings.subreddit (genome/style/timezone w/ validationEndpoint) + scheduler.tasks.sweeper hourly cron"
affects: [03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Install settings boundary = SettingsSchema.parse (z.infer-only); IANA validated by a RUNTIME Intl.DateTimeFormat probe, not a stale allow-list"
    - "DST-safe local midnight via native Intl.DateTimeFormat formatToParts — no manual UTC-offset arithmetic, no hardcoded offsets"
    - "Deterministic per-sub minute jitter via FNV-1a hash(subId)%60 — spreads sweeper load, never Math.random (reproducible)"
    - "subs:registry as a ZSET-as-set (zAdd member-keyed, zRange to enumerate) — the Devvit 0.13.4 SDK has no sAdd/sMembers/sCard"
    - "settings.get is scoped to the CURRENT install context, NOT an arbitrary sub — so the sweeper reads each community's tz from the Redis config snapshot (readSnapshot), not settings.get"
    - "i18n error KEYS at every validation surface (schema message + validationEndpoint error) — never hardcoded language (CLAUDE.md §7)"
    - "Hono router `scheduler` vs the @devvit/web/server `scheduler` capability client — aliased to schedulerClient to avoid the name clash"

key-files:
  created:
    - src/server/contracts/settings.ts
    - src/server/contracts/settings.test.ts
    - src/server/core/schedule.ts
    - src/server/core/schedule.test.ts
    - src/server/core/config.ts
    - src/server/core/config.test.ts
    - src/server/routes/settings.ts
  modified:
    - src/server/routes/scheduler.ts
    - src/server/routes/triggers.ts
    - src/server/index.ts
    - devvit.json
    - vitest.config.ts

key-decisions:
  - "Style enum derives from the canonical StyleIdEnum (['techno','comic','pixel']) — one source of truth, zero drift; a new style id in the contract is auto-accepted. The devvit.json select offers only the implemented `techno` (Crystalline is a techno-id variant, not a StyleId — confirmed in src/styles/crystalline.ts)"
  - "isValidIana is a runtime Intl probe; ICU legitimately accepts legacy abbreviations (PST/EST/GMT) as IANA links — the probe is correctly permissive there and rejects only genuinely-bogus zones (Mars/Olympus)"
  - "readConfig takes NO sub argument — settings.get is context-scoped; the sweeper reads per-sub tz from organism:{sub}:config via readSnapshot (Redis snapshot), the only correct cross-sub path"
  - "subs:registry is a ZSET-as-set (zAdd/zRange) — the 0.13.4 SDK exposes no native set ops (verified by grep: no sAdd/sMembers/sCard in @devvit/redis)"
  - "Sweeper isolates per-sub failures (try/catch per community) and always returns 200 — the hourly cron must never crash; the 03-03 lastTickDay guard makes a late/overlapping fire idempotent"
  - "Jitter is FNV-1a hash(subId)%60 (same hash family as the 03-03 seed) — deterministic, reproducible, no Math.random"

patterns-established:
  - "Runtime-Intl IANA validation (probe, not allow-list) shared by the schema refinement AND the validationEndpoint — one predicate, no drift"
  - "Per-sub config snapshot in Redis decouples the multi-sub sweeper from the context-scoped settings.get"
  - "ZSET-as-set for the installed-community registry (membership via zAdd, enumeration via zRange)"

requirements-completed: [DEV-04, DEV-06]

# Metrics
duration: 13min
completed: 2026-06-21
status: complete
---

# Phase 3 Plan 04: Install settings boundary + hourly DST-safe local-midnight sweeper Summary

**A mod now shapes the community at install — Genome preset + Style + IANA timezone declared in `devvit.json` (with an i18n-keyed `validationEndpoint`), read server-side through `SettingsSchema.parse` and snapshotted to `organism:{sub}:config` (DEV-06) — and an hourly UTC cron sweeper enumerates `subs:registry` and fires each community's plan-03-03 `tick` via `scheduler.runJob` ONLY at its own local midnight, computed DST-safe from the IANA zone via native `Intl.DateTimeFormat` with a deterministic `hash(subId)%60` minute jitter (DEV-04 / D-03).**

## Performance
- **Duration:** ~13 min
- **Started:** 2026-06-21T15:15:41Z
- **Completed:** 2026-06-21T15:28:40Z
- **Tasks:** 3
- **Files:** 12 (7 created, 5 modified)

## Accomplishments
- **Install-settings boundary (DEV-06):** `SettingsSchema` = `{ genome: enum(calm/chaotic/crystalline), style: enum(StyleIdEnum), timezone: string.refine(isValidIana) }`, `z.infer`-only (no hand interface, no `as`). Genome ids are the three Phase-1 presets (the same registry `tick.ts` resolves `genomeVersion` from); the style enum derives from the **canonical `StyleIdEnum`** so it never drifts from the engine contract. Every error message is an **i18n KEY** (`error.settings.{genome.unknown,style.unknown,timezone.invalidIana}`) — never hardcoded language (CLAUDE.md §7).
- **Runtime IANA validation (T-03-09):** `isValidIana(tz)` is a runtime `new Intl.DateTimeFormat('en',{timeZone})` try/catch probe — a real check, not a stale allow-list; ICU legitimately accepts a few legacy abbreviations (PST/EST/GMT) and rejects genuinely-bogus zones (`Mars/Olympus`). The SAME predicate backs both the schema refinement and the `validationEndpoint`, so there is one source of truth.
- **Pure DST-safe schedule helper (D-03):** `localHourMinute(nowUtc, ianaTz)` reads the community-local wall clock via `Intl.DateTimeFormat(...).formatToParts` — **no manual UTC-offset arithmetic**. Proven DST-aware in tests: a fixed `22:00Z` is Berlin local midnight in summer (CEST, UTC+2) but `23:00` in winter (CET, UTC+1). `jitterMinute(subId)` is a deterministic FNV-1a `hash%60` (never `Math.random`); `isLocalMidnightWithJitter(now, tz, sub)` is true only during local `00:xx` at/after the jitter. The module is PURE — no Devvit/Redis import.
- **Config read + community registration (DEV-06):** `readConfig()` reads the current-install `settings.get` triple and `SettingsSchema.parse`s it (the single settings boundary). `readSnapshot(sub)` reads `organism:{sub}:config` and re-parses (the path the sweeper uses, since `settings.get` is context-scoped). `registerCommunity(sub,cfg)` adds `sub` to `subs:registry` (ZSET-as-set `zAdd`, idempotent) and `hSet`s the genome/style/timezone snapshot — all keys via `keys.*`.
- **onAppInstall registry write:** after `createPost()`, `onAppInstall` derives `sub` from `context.subredditId` (V4), `readConfig()` + `registerCommunity(sub,cfg)` — best-effort (a register failure logs and never regresses the post-create). An installed community is now enumerable by the sweeper with its IANA tz.
- **Hourly DST-safe sweeper (DEV-04):** `scheduler.ts` `POST /sweeper` (declared as the hourly cron `0 * * * *`) `zRange`s `subs:registry`, reads each community's snapshot tz (`readSnapshot`), gates on the pure `isLocalMidnightWithJitter`, resolves the freeze day via the SINGLE shared `frontierDay(sub)` (no inline `ringCount+1`), and `schedulerClient.runJob({ name:'tick', data:{ subId, day }, runAt })` — firing the 03-03 tick. Per-sub failures are isolated; the handler always returns 200 (the cron must not crash; the tick's `lastTickDay` guard makes a late/overlapping sweep idempotent).
- **devvit.json (verified 0.13.4 shapes via Context7):** `settings.subreddit` with `genome`/`style` `select`s (i18n helpText, defaults calm/techno) and `timezone` `string` (default UTC, `validationEndpoint: /internal/settings/validate-timezone`), plus `scheduler.tasks.sweeper` hourly cron. `/internal/settings` mounted in `index.ts`.

## Task Commits
1. **Task 1: SettingsSchema boundary + pure DST-safe local-midnight helper** — `86fbffa` (test, RED) → `4d9e444` (feat, GREEN)
2. **Task 2: config read/register + onAppInstall registry write** — `cffb1ab` (test, RED) → `9d9a6a9` (feat, GREEN)
3. **Task 3: settings validationEndpoint + /sweeper + devvit.json** — `2b4db98` (feat)

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified
- `src/server/contracts/settings.ts` — SettingsSchema + isValidIana + GENOME_IDS; z.infer-only, i18n error keys
- `src/server/contracts/settings.test.ts` — valid/invalid genome/style/IANA, i18n-key assertion, runtime-probe (12 tests)
- `src/server/core/schedule.ts` — pure localHourMinute (Intl) + jitterMinute (FNV-1a) + isLocalMidnightWithJitter
- `src/server/core/schedule.test.ts` — DST summer/winter Berlin + NY, deterministic jitter, midnight+jitter gating (17 tests)
- `src/server/core/config.ts` — readConfig() / readSnapshot(sub) / registerCommunity(sub,cfg) via keys.*; ZSET-as-set registry
- `src/server/core/config.test.ts` — settings boundary parse, per-sub snapshot, idempotent register (9 tests)
- `src/server/routes/settings.ts` — Hono router; POST /validate-timezone → i18n IANA error key
- `src/server/routes/scheduler.ts` — ADDED /sweeper (enumerate registry → local-midnight gate → runJob tick); capability client aliased
- `src/server/routes/triggers.ts` — onAppInstall registers community (readConfig + registerCommunity), best-effort
- `src/server/index.ts` — mount internal.route('/settings', settings)
- `devvit.json` — settings.subreddit (genome/style/timezone + validationEndpoint) + scheduler.tasks.sweeper hourly cron
- `vitest.config.ts` — registered settings/schedule/config suites in the standalone runner

## Decisions Made
- **Style enum from the canonical StyleIdEnum** — the engine contract `StyleIdEnum = ['techno','comic','pixel']` is the single source of truth; `SettingsSchema.style` reuses it (override only the i18n message). `src/styles/crystalline.ts` carries `id:'techno'` (it is a techno-id variant, **not** a StyleId — Open Q2 resolved upstream), so the only implemented style offered in the devvit.json `select` is `techno`. This honours UI-SPEC S4 ("options from registered StyleTemplate ids; currently Techno") while keeping the schema in lockstep with the contract.
- **isValidIana is a permissive runtime probe** — ICU accepts legacy abbreviations (PST/EST/GMT) as IANA links; the probe is correctly permissive there. The RED test that asserted `PST` is invalid was the bug (not the implementation) — fixed to assert only genuinely-bogus zones. This is the intended "no stale allow-list" behaviour.
- **readConfig takes no sub; the sweeper uses readSnapshot** — `@devvit/web/server` `settings.get(name)` is scoped to the CURRENT request's installation context and cannot fetch an arbitrary community's settings. So `readConfig()` runs at onAppInstall (the context IS the installing community) to snapshot config; the multi-sub sweeper reads each community's tz from the Redis snapshot via `readSnapshot(sub)`. This is the load-bearing correction vs. the plan's "sweeper calls readConfig(sub)" wording — see Deviations.
- **subs:registry is a ZSET-as-set** — the 0.13.4 SDK has no `sAdd`/`sMembers`/`sCard` (verified by grep over `@devvit/redis`); the same carry-over the 03-02/03-03 contributor SET hit. `zAdd(member:sub)` is idempotent membership; `zRange(registry,0,-1)` enumerates.
- **Jitter = FNV-1a hash(subId)%60** — same hash family as the 03-03 seed, deterministic and reproducible (no `Math.random`); spreads communities across the hour so they don't all fire at `:00`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan/SDK mismatch] subs:registry uses ZSET-as-set, not sAdd/sMembers**
- **Found during:** Task 2 (config.ts) / Task 3 (sweeper)
- **Issue:** The plan's must_haves/action specify `sAdd subs:registry` and the sweeper `sMembers(registry)`. The Devvit 0.13.4 redis client exposes **no native set operations** — `grep -rln "sAdd\|sMembers\|sCard" @devvit/redis` returns nothing (only ZSET/hash/string ops). This is the same constraint 03-02/03-03 hit for the contributor SET; the `<critical_upstream_context>` explicitly anticipated it ("use ZSET-as-set via zAdd/zCard … for the registry").
- **Fix:** `registerCommunity` uses `zAdd(keys.registry(), { member: sub, score: 1 })` (member-keyed → idempotent membership); the sweeper enumerates with `zRange(keys.registry(), 0, -1)`. Same registry intent, same key namespace (`keys.registry()`), the primitive the SDK ships.
- **Files modified:** src/server/core/config.ts, src/server/routes/scheduler.ts
- **Verification:** config.test.ts asserts idempotent registry cardinality = 1 on re-register; `tsc --build` confirms the API exists; no new package.
- **Committed in:** `9d9a6a9` (Task 2), `2b4db98` (Task 3).

**2. [Rule 1 - Plan/SDK mismatch] readConfig takes no sub; the sweeper reads the per-sub Redis snapshot (settings.get is context-scoped)**
- **Found during:** Task 2 (tsc flagged the unused `sub` param) → traced to the SDK semantics
- **Issue:** The plan signs `readConfig(sub)` and has the sweeper do `const cfg = await readConfig(sub)` per enumerated community. But `@devvit/web/server` `settings.get(name)` takes only a name and is scoped to the CURRENT request's installation context — it cannot fetch an arbitrary sub's settings. Calling `readConfig(sub)` per-sub in the sweeper would read the wrong (context) settings for every community, AND `tsc`'s `noUnusedParameters` rejected the dead `sub` param (real exit 2).
- **Fix:** `readConfig()` (no arg) reads the current-context settings and parses them — used at onAppInstall to snapshot. Added `readSnapshot(sub)` that reads `organism:{sub}:config` (the install snapshot) and `SettingsSchema.safeParse`s it (returns null on absent/malformed). The sweeper uses `readSnapshot(sub)` for each community's tz. This realises the plan's OWN must_have ("snapshotted to organism:{sub}:config so the sweeper can read it") and the 03-03 hand-off ("the sweeper reads the snapshot") — the plan's "readConfig(sub)" wording was the inconsistency.
- **Files modified:** src/server/core/config.ts, src/server/core/config.test.ts, src/server/routes/triggers.ts, src/server/routes/scheduler.ts
- **Verification:** config.test.ts covers readConfig() parse + readSnapshot snapshot/null/malformed; tsc + lint + full suite green.
- **Committed in:** `9d9a6a9` (Task 2), `2b4db98` (Task 3).

**3. [Rule 1 - Test assertion bug] isValidIana correctly accepts ICU legacy abbreviations**
- **Found during:** Task 1 GREEN run
- **Issue:** The RED settings.test.ts asserted `isValidIana('PST')` is false. Node's full-ICU `Intl.DateTimeFormat` accepts `PST`/`EST`/`GMT` as valid IANA links — so the implementation (a correct runtime probe) returned true and the test failed. The bug was the test assertion, not the probe (the plan mandates "a runtime check, not a hardcoded allow-list").
- **Fix:** narrowed the rejection assertion to genuinely-bogus zones (`Mars/Olympus`, `Not/A/Zone`, `''`, `foo`, `Europe/Atlantis`) with an explaining comment; kept the permissive-probe behaviour.
- **Files modified:** src/server/contracts/settings.test.ts
- **Verification:** settings suite green (12 tests).
- **Committed in:** `4d9e444` (Task 1 GREEN — the test ships with its implementation).

---

**Total deviations:** 3 auto-fixed (2 plan/SDK mismatches anticipated by the upstream context, 1 test-assertion bug). No scope creep; no architectural change; no new packages.

## Issues Encountered
- `npx tsc --build` returns exit 0 in some shell pipelines even when it reports an error to stdout — the real exit code (`$?` on a bare invocation) is 2. Verified the unused-param error was genuine by running `tsc --build` bare and checking `$?` directly. All final gate checks read the real exit code.

## Deferred verification
- The Task-3 `<human-check>` (live `devvit playtest`: set an invalid timezone in the install settings and confirm the i18n-key validation error fires; confirm the community appears in `subs:registry` after install; trigger the hourly sweeper and confirm it fires a tick only when the configured zone is at local midnight, skipping a non-midnight zone) was **DEFERRED to plan 03-05** per the user's explicit auto-approve decision for this run. 03-05 playtests the full accumulate → freeze → sweep → render pipeline end-to-end in one live session. All AUTOMATED gates were run and are green (below); the DST-correctness, jitter-determinism, registry-idempotency, and settings-boundary behaviours are all covered by unit tests against native Intl + an in-memory redis, so the local-midnight logic is provable without a live run.

## Automated gates (all green)
- `npm test` → **159 passed** (20 files; +31 new: settings 12, schedule 17, config 9 — RED→GREEN per TDD task)
- `npm run type-check` (`tsc --build`) → exit 0
- `npm run lint` (`eslint 'src/**/*.{ts,tsx}'`) → exit 0
- `npm run build` (`vite build`) → Build complete (pre-existing benign Rollup `inlineDynamicImports`/`sourcemapFileNames` warnings only — tooling, noted in 03-01/02/03, out of scope)

## CLAUDE.md / determinism compliance
- **Zod at boundaries:** install settings are parsed ONLY through `SettingsSchema.parse` (readConfig, the single settings boundary) and `safeParse` (readSnapshot, the Redis-snapshot boundary). The `validationEndpoint` validates the inbound field value with the shared `isValidIana` predicate. No deep/internal parsing; no `as` casts; types are `z.infer`-only.
- **i18n error keys (§7):** every validation message is a dotted i18n KEY (`error.settings.timezone.invalidIana`, `error.settings.genome.unknown`, `error.settings.style.unknown`) — the schema messages AND the validationEndpoint `error`. devvit.json field labels/helpText carry the human copy (host-localised). Asserted by a test that every issue message matches `^error\.settings\.[a-z.]+$`.
- **Determinism (D-03):** the local-midnight decision is pure native `Intl.DateTimeFormat` (DST rules applied by ICU, no offset math); the minute jitter is a pure FNV-1a `hash(subId)%60` — NO `Math.random` anywhere (verified by grep: matches are comments only). The sweeper is safe to run every hour (idempotent via the 03-03 lastTickDay guard).
- **No set ops / central keys:** `subs:registry` is a ZSET-as-set (the SDK has no `sAdd`); all registry/config keys come from `keys.*` (03-01) — no ad-hoc strings, no `redis.keys`/scan. `src/engine/` untouched (no Devvit import, no Math.random there).
- **No new packages (T-03-SC):** native `Intl` + existing zod/hono only; slopcheck N/A.

## Threat-model dispositions (all addressed)
- **T-03-09** (bad IANA / unknown genome/style) → `validationEndpoint` runtime Intl IANA check + `SettingsSchema.parse` enum-constrains genome/style; i18n error keys; unknown ids rejected (V5).
- **T-03-02** (sub-id source on install/register) → `sub` derived from `context.subredditId` in onAppInstall; never a client-supplied sub (V4).
- **T-03-10** (sweeper fires at wrong day boundary) → local-midnight gating via native `Intl.DateTimeFormat` per the community's IANA zone (DST-safe), never server-UTC `getHours()`; `hash(subId)%60` jitter spreads load.
- **T-03-07** (sweeper double-fire / overlap) → the fired tick is idempotent via the 03-03 `lastTickDay` guard; per-sub try/catch isolates failures.
- **T-03-11** (unbounded registry / per-sweep cost) → accepted this plan; registry is a bounded ZSET-as-set, per-hour enumeration is O(installed subs).
- **T-03-SC** (package installs) → no new packages.

## Next Phase Readiness
- DEV-04/DEV-06 are complete: a mod configures genome/style/IANA-tz at install (validated, i18n errors), the community registers + snapshots its config, and the hourly sweeper freezes each community at its own local midnight. 03-05 wires the client to read the accumulated rings via `readAllRings` and render the universe, and runs the full live `devvit playtest` end-to-end (accumulate → freeze → sweep → render), discharging the deferred human-checks from 03-02/03-03/03-04.
- **Hand-off note for 03-05:** the install snapshot now writes `genome`/`style`/`timezone` to `organism:{sub}:config`, so `runTick`'s `genomeVersion` resolution reads a real configured genome (no longer defaulting to `calm`). The client should read `style` from the same snapshot for paint. The sweeper fires `tick` with `data:{ subId, day }` where `day = frontierDay(sub)`.

## Self-Check: PASSED
All 7 created source/test files exist on disk; all 5 task commits (86fbffa, 4d9e444, cffb1ab, 9d9a6a9, 2b4db98) present in git history.

---
*Phase: 03-devvit-scaffold-data-layer*
*Completed: 2026-06-21*
