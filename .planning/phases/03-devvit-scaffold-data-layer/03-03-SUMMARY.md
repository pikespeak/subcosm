---
phase: 03-devvit-scaffold-data-layer
plan: 03
subsystem: database
tags: [devvit, redis, zod, ring-store, freeze-tick, scheduler, determinism, vitest]

# Dependency graph
requires:
  - phase: 03-01
    provides: "central redisKeys.ts key-builder (ring/ringCount/config/lastTickDay), engine contracts barrel"
  - phase: 03-02
    provides: "counters.ts accumulators (posts/comments/replies + contributor ZSET-as-set + threads ZSET), pure conflictComposite, frontierDay day-index helper"
provides:
  - "RingRecordSchema = DayVectorSchema.extend({ genomeVersion }) — the Redis read/write contract (z.infer only, no images, DEV-05)"
  - "ring.ts: writeRing (incrBy ringCount -> hSet scalars) + readAllRings (count -> Promise.all hGetAll -> single RingRecordSchema.parse) — scan-free, single read boundary"
  - "tick.ts runTick: read accumulators -> conflictComposite -> build+parse RingRecord (seed=FNV-1a hash) -> writeRing -> reset day -> lastTickDay idempotency guard (DEV-04 freeze)"
  - "tickJob.ts TickJobSchema ({subId, day}) — the scheduler data boundary shape"
  - "scheduler.ts Hono router: POST /tick boundary-parses TickJobSchema then runTick; mounted at /internal/scheduler; devvit.json scheduler.tasks.tick declared"
affects: [03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RingRecord = DayVectorSchema.extend — the stored ring cannot drift from what render() consumes (one schema spans write + read boundary)"
    - "Explicit ringCount index (incrBy on write, count-then-walk on read) — Devvit Redis has no scan"
    - "Single Redis-read boundary parse in readAllRings (Pitfall 6); single build boundary parse in runTick (mirrors generator.ts sim handoff)"
    - "Deterministic FNV-1a hash(subId, day, genomeVersion) for the seed — no Math.random for game state (CLAUDE.md determinism)"
    - "lastTickDay guard makes the at-least-once scheduler double-fire write at most one ring per local day (idempotent tick)"
    - "Hash field round-trip: composite fields (topThreads/steering) JSON-encoded, primitives stringified, reversed + parsed on read"

key-files:
  created:
    - src/engine/contracts/RingRecord.ts
    - src/engine/contracts/RingRecord.test.ts
    - src/server/contracts/tickJob.ts
    - src/server/contracts/tickJob.test.ts
    - src/server/core/ring.ts
    - src/server/core/ring.test.ts
    - src/server/core/tick.ts
    - src/server/core/tick.test.ts
    - src/server/routes/scheduler.ts
  modified:
    - src/engine/contracts/index.ts
    - src/server/index.ts
    - devvit.json
    - vitest.config.ts
    - tools/tsconfig.server.json

key-decisions:
  - "Unique contributors read via zCard(keys.contributors(sub,day)) — the 03-02 ZSET-as-set, NOT sCard (the Devvit SDK 0.13.4 has no set ops)"
  - "Seed is pure FNV-1a over `${subId}:${day}:${genomeVersion}` returned as signed 32-bit int — deterministic, no Math.random"
  - "genomeVersion resolved from organism:{sub}:config.genome -> preset.version, defaulting to calm.version (read, not literal 1) when config absent/unrecognised"
  - "lastTickDay set AFTER writeRing so a crash mid-write leaves the day re-freezable; day<=lastTickDay short-circuits (no double-freeze)"
  - "Day reset deletes the global posts/comments/replies counters AND the day-scoped contributors/threads ZSETs (bounds per-day growth, T-03-05)"
  - "scheduler.ts router named `scheduler` is the Hono router; it imports no @devvit/web/server scheduler client, so no name clash"
  - "server tsconfig now references the engine project so ring.ts/tick.ts can import the shared RingRecord contract"

patterns-established:
  - "A frozen-record contract that extends the render input schema (RingRecord = DayVector + genomeVersion) — write and read share one parse surface"
  - "Idempotent freeze guarded by a stored lastTickDay watermark"
  - "Deterministic server-side seed via FNV-1a (no engine entropy needed, no Math.random)"

requirements-completed: [DEV-04, DEV-05]

# Metrics
duration: 10min
completed: 2026-06-21
status: complete
---

# Phase 3 Plan 03: Ring store + deterministic freeze tick + scheduler endpoint Summary

**A day's accumulated Redis activity now freezes into a render-shaped Ring record — `DayVector + seed = FNV-1a(subId, day, genomeVersion) + genomeVersion`, ~25 scalars, no images — indexed by an explicit `ringCount`, written via a single build-boundary parse, read back through a single scan-free read-boundary parse, and triggered by an idempotent `/internal/scheduler/tick` endpoint that guards against scheduler double-fire.**

## Performance
- **Duration:** ~10 min
- **Started:** 2026-06-21T14:59:48Z
- **Completed:** 2026-06-21T15:09:44Z
- **Tasks:** 3
- **Files:** 14 (9 created, 5 modified)

## Accomplishments
- **RingRecord contract (DEV-05):** `RingRecordSchema = DayVectorSchema.extend({ genomeVersion: z.number().int().nonnegative() })`, `z.infer`-only, re-exported from the engine contracts barrel. Because it extends the render input schema and `DayVectorSchema` already carries `seed`, the stored ring cannot drift from what `render()` consumes — and there is structurally **no image/pixel field** (no-stored-images is a property of the schema, not a runtime check).
- **Scan-free ring service (DEV-05):** `ring.ts` `writeRing` does `incrBy(ringCount) -> hSet(ring:n, serialized scalars)` returning the new index; `readAllRings` reads the count, `Promise.all`s `hGetAll(ring:1..count)`, and maps each through `RingRecordSchema.parse` — the **single Redis-read boundary** (T-03-08). `[]` when ringCount is 0/absent. Composite fields (`topThreads` array, `steering` object) JSON round-trip losslessly; no `redis.keys`/scan anywhere.
- **Deterministic freeze (DEV-04):** `runTick(subId, day)` reads the 03-02 accumulators (posts/comments/replies counters, **unique contributors via `zCard`** — the ZSET-as-set, NOT `sCard`; top threads via reverse `zRange`), composes `conflict` via `conflictComposite`, builds a DayVector + resolved `genomeVersion`, sets `seed = FNV-1a(subId, day, genomeVersion)`, `RingRecordSchema.parse`s it (single build boundary), and `writeRing`s exactly one ring.
- **Idempotency (DEV-04 / T-03-07):** a stored `lastTickDay` watermark short-circuits `runTick` when `day <= lastTickDay` — an at-least-once scheduler double-fire writes at most one ring per local day, `ringCount` never corrupted. Set after the write so a mid-write crash leaves the day re-freezable.
- **Day reset (T-03-05):** after the freeze, the global posts/comments/replies counters and the day-scoped contributors/threads ZSETs are `del`'d so the next frontier starts clean (bounds unbounded per-day growth).
- **Scheduler endpoint (DEV-04):** `scheduler.ts` Hono router exposes `POST /tick` that boundary-parses `TickJobSchema` on the untrusted scheduler `data` (T-03-06) then calls `runTick`; mounted at `/internal/scheduler` in `index.ts`; `devvit.json` declares the one-off `scheduler.tasks.tick` (no cron — the hourly sweeper that fires it via `runJob` lands in 03-04). No `/sweeper` handler here (reserved for 03-04).

## Task Commits
1. **Task 1: RingRecord + tickJob + ring service** — `02d0704` (test, RED) -> `885e34c` (feat, GREEN)
2. **Task 2: runTick freeze + idempotency** — `693078c` (test, RED) -> `246d882` (feat, GREEN)
3. **Task 3: scheduler /tick + mount + devvit.json** — `c32f157` (feat)

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified
- `src/engine/contracts/RingRecord.ts` — RingRecordSchema (DayVector + genomeVersion), z.infer only
- `src/engine/contracts/RingRecord.test.ts` — accept/reject + no-image structural test (5 tests)
- `src/engine/contracts/index.ts` — re-export RingRecord from the barrel
- `src/server/contracts/tickJob.ts` — TickJobSchema ({subId, day}) with i18n error keys
- `src/server/contracts/tickJob.test.ts` — accept/reject missing subId / non-positive / non-int day (6 tests)
- `src/server/core/ring.ts` — writeRing/readAllRings, scan-free, single read boundary, lossless hash round-trip
- `src/server/core/ring.test.ts` — in-memory redis mock; key calls, round-trip, []-on-0, single-parse, no-scan (8 tests)
- `src/server/core/tick.ts` — runTick: accumulators -> conflict -> FNV-1a seed -> parse -> writeRing -> reset -> lastTickDay guard
- `src/server/core/tick.test.ts` — freeze, genomeVersion resolution (configured/unset/unrecognised), deterministic seed, reset, idempotency (13 tests)
- `src/server/routes/scheduler.ts` — Hono router; POST /tick boundary-parses then runTick
- `src/server/index.ts` — mount internal.route('/scheduler', scheduler)
- `devvit.json` — scheduler.tasks.tick -> /internal/scheduler/tick (one-off, no cron)
- `vitest.config.ts` — registered ring/tick/tickJob suites in the standalone runner
- `tools/tsconfig.server.json` — reference the engine project (ring.ts/tick.ts import the shared contract)

## Decisions Made
- **zCard not sCard** — the single most load-bearing carry-over from 03-02: unique contributors are a ZSET-as-set, so `runTick` reads cardinality via `zCard(keys.contributors(sub,day))`. The plan text said `sCard`; the 03-02 deviation overrides it (the SDK has no set ops).
- **FNV-1a seed** — a small pure 32-bit FNV-1a over `${subId}:${day}:${genomeVersion}` (via `Math.imul`, returned `| 0`). Deterministic, no entropy, no `Math.random` — same inputs always yield the same seed, so a ring regenerates byte-identically. Defined in `tick.ts` (server-side; the engine `mulberry32` is for render entropy, not seed derivation).
- **genomeVersion default tracks the preset** — read `calm.version` (currently 1) rather than hardcoding `1`, so a preset bump moves the default automatically. Resolution: `organism:{sub}:config.genome` -> `PRESETS[id].version`, falling back to `calm` when the config key is absent (03-04 writes it) or the id is unrecognised.
- **momentum/diversity kept simple this phase** — CONTEXT defers day-to-day genome evolution; momentum is 0 (no prev-day delta tracked yet) and diversity is a clamped contributors/(posts+comments+1) proxy. A clean freeze + seed write, not a day-over-day model.
- **lastTickDay set after write** — favours re-freezability over strict at-most-once: a crash between parse and write leaves the day re-freezable; the guard still prevents a *completed* day from re-freezing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Server tsconfig needed an engine project reference**
- **Found during:** Task 1 (ring.ts imports `../../engine/contracts`)
- **Issue:** `tools/tsconfig.server.json` (composite, `rootDir: ../src/server`) referenced only `tsconfig.shared.json`. `ring.ts`/`tick.ts` import the shared `RingRecord` contract from `src/engine/contracts`, which is outside the server rootDir and lives in a separate composite project — `tsc --build` cannot resolve a cross-project import without the reference.
- **Fix:** Added `{ "path": "./tsconfig.engine.json" }` to the server project's `references`. The engine project is already composite (it emits declarations), so the server project consumes its types cleanly.
- **Files modified:** tools/tsconfig.server.json
- **Verification:** `tsc --build` exit 0 (full build green).
- **Committed in:** `885e34c` (Task 1 GREEN).

**2. [Rule 1 - Plan/upstream mismatch] Read unique contributors via zCard, not sCard**
- **Found during:** Task 2 (tick.ts accumulator read-back)
- **Issue:** The plan's Task-2 behavior/action text specifies `sCard(keys.contributors(sub,day))` for unique contributors. The 03-02 deviation established that contributors are a **ZSET-as-set** (`zAdd`/`zCard`) because the Devvit SDK 0.13.4 has no `sAdd`/`sCard`. Using `sCard` would not compile/run.
- **Fix:** `runTick` reads `redis.zCard(keys.contributors(subId, day))`. Same key namespace, same DEV-02 intent (O(1) unique cardinality), the primitive the SDK actually ships. This was explicitly flagged as required by the `<critical_upstream_deviation>` in the execution brief and the 03-02 hand-off note.
- **Files modified:** src/server/core/tick.ts (+ tick.test.ts seeds contributors via zAdd and asserts contributors=3)
- **Verification:** tick.test.ts proves the stored ring's `contributors` equals the `zCard` count; `tsc --build` confirms the API exists.
- **Committed in:** `246d882` (Task 2 GREEN).

---

**Total deviations:** 2 auto-fixed (both blocking/mismatch — necessary to compile against the real SDK and the 03-02 data model). No scope creep; no architectural change.

## Issues Encountered
- None beyond the two deviations above. The in-memory redis mock pattern (`vi.hoisted` + `vi.mock('@devvit/web/server')`) from 03-02 carried over cleanly for ring.ts and tick.ts.

## Deferred verification
- The Task-3 `<human-check>` (live `devvit playtest`: invoke the tick on a test sub carrying accumulated activity, confirm a new `organism:{sub}:ring:{n}` hash appears, `ringCount` advances by 1, the day counters reset, and a same-day re-fire writes NO second ring) was **deferred to plan 03-05** per the user's explicit auto-approve decision for this run. 03-05 playtests the full accumulate -> freeze -> render pipeline end-to-end in one live session. All AUTOMATED gates were run and are green (below); only the live-device idempotency/freeze check is deferred. The idempotency, freeze, reset, and seed-determinism behaviours are all covered by `tick.test.ts` against an in-memory redis.

## Automated gates (all green)
- `npm test` -> **128 passed** (17 files; +32 new: RingRecord 5, tickJob 6, ring 8, tick 13)
- `npm run type-check` (`tsc --build`) -> exit 0
- `npm run lint` (`eslint 'src/**/*.{ts,tsx}'`) -> exit 0
- `npm run build` (`vite build`) -> Build complete (pre-existing benign Rollup `inlineDynamicImports`/`sourcemapFileNames` warnings only — tooling, noted in 03-01/03-02, out of scope)

## CLAUDE.md / determinism compliance
- **Engine boundary:** `RingRecord.ts` is `z.infer`-only (no hand interface, no `as`-to-silence). `src/engine/` has NO Devvit import and NO `Math.random` (verified by grep — only comments mention them).
- **Zod at boundaries:** the scheduler `data` is `TickJobSchema.parse`'d at the /tick boundary (T-03-06); the stored ring is `RingRecordSchema.parse`'d at the single read boundary (`readAllRings`, T-03-08) and at the single build boundary (`runTick`, mirroring generator.ts). No deep/internal parsing.
- **Determinism:** `seed = FNV-1a(subId, day, genomeVersion)` is pure and reproducible — no `Math.random` for game state. `genomeVersion` has a defined source (configured preset version) so the seed is fully determined.
- **No scan / central keys:** all ring/ringCount/config/lastTickDay keys come from the 03-01 `keys.*` builder; no ad-hoc strings, no `redis.keys`/scan.
- **No stored images:** RingRecord carries only scalars + seed + genomeVersion (DEV-05) — structurally guaranteed by the schema.

## Threat-model dispositions (all addressed)
- **T-03-06** (scheduler data tampering) -> `TickJobSchema.parse(req.data)` at the /tick boundary.
- **T-03-07** (tick double-fire -> ringCount) -> `lastTickDay` guard; same/earlier-day re-fire is a no-op (tested).
- **T-03-04** (spam-inflated counters -> conflict) -> conflict via the saturating, volume-normalized `conflictComposite`; contributors via `zCard` cardinality.
- **T-03-05** (unbounded per-day SET/ZSET growth) -> day-scoped contributors/threads + global counters `del`'d after the freeze.
- **T-03-08** (malformed stored ring -> render) -> single `RingRecordSchema.parse` read boundary in `readAllRings`.
- **T-03-SC** (package installs) -> no new packages; slopcheck N/A.

## Next Phase Readiness
- DEV-04/DEV-05 freeze path is in place: 03-04 builds the hourly **sweeper** that enumerates installed subs (`keys.registry()`), resolves each community's local-midnight crossing, writes the `organism:{sub}:config` install snapshot (genome/style/timezone — the source `runTick` reads for `genomeVersion`), and enqueues the `tick` task via `scheduler.runJob({ name: 'tick', data: { subId, day } })`. 03-05 wires the client to read these rings via `readAllRings` and render the universe.
- **Hand-off note for 03-04:** the `/tick` endpoint expects `data: { subId, day }` (TickJobSchema); pass `frontierDay(sub)` as `day`. The install snapshot must store `genome` (a preset id: `calm`/`chaotic`/`crystalline`) in `organism:{sub}:config` so `runTick` resolves the correct `genomeVersion` — until then it defaults to `calm.version`.
- Live-device verification of the full accumulate -> freeze -> render pipeline is owed in 03-05.

## Self-Check: PASSED
All 9 created source/test files exist on disk; all 5 task commits (02d0704, 885e34c, 693078c, 246d882, c32f157) present in git history.

---
*Phase: 03-devvit-scaffold-data-layer*
*Completed: 2026-06-21*
