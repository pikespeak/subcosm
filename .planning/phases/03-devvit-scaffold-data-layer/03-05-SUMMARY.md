---
phase: 03-devvit-scaffold-data-layer
plan: 05
subsystem: client
tags: [devvit, fetch, zod, safeparse, render, cold-start, determinism, bundle-safety, vitest]

# Dependency graph
requires:
  - phase: 03-03
    provides: "readAllRings(sub) single Redis-read boundary parse + RingRecordSchema (DayVector + genomeVersion) engine contract"
  - phase: 03-04
    provides: "readConfig() single settings boundary (genome/style/timezone) for the install context"
  - phase: 03-01
    provides: "render()-backed game.ts mount stub (fixed fixture) + confirmed same-origin fetch webview model (no postMessage)"
provides:
  - "OrganismResponseSchema (z.object: type literal + rings: RingRecord[] + genome/style enum ids) + z.infer OrganismResponse — the shared, client-safe fetch contract"
  - "GET /api/organism: context-sub guard (V4) -> readAllRings + readConfig -> OrganismResponseSchema.parse envelope; empty community -> rings:[] 200 (cold-start, not error)"
  - "data-driven src/client/game.ts: fetch('/api/organism') -> safeParse -> loading/cold-start/error/render branch -> render(frontierFirst(rings), genome, style, PhaserPainter)"
  - "game.html S3 overlay scaffolding (loading/cold-start/error, i18n-keyed) + game.css .hud-style overlay chrome (muted-ink error, gold genesis, reduced-motion)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OrganismResponse = z.infer of a schema whose rings reuse RingRecordSchema — server response cannot drift from what render() consumes (one contract spans server .parse and client safeParse)"
    - "Client-safe shared contract: src/shared/api.ts imports ONLY engine contracts + zod (no server/Devvit module) so it stays in the webview bundle without dragging server code (CLAUDE.md §6 bundle safety)"
    - "UI never throws: OrganismResponseSchema.safeParse at the client boundary routes a malformed/hostile payload OR a network failure to the error overlay, never a broken canvas (T-03-12)"
    - "render() is the single client mount seam — fetch feeds Ring records straight into the UNCHANGED engine render(); the client never calls synthesize() and never re-parses on the hot path (Pitfall 6)"
    - "Cold-start (rings.length === 0) renders genesis-core-only via render() + a Genesis overlay — intentional, never empty/broken (D-04)"
    - "Shared source/tests tsconfig split (tsconfig.shared.json excludes *.test.ts + references engine; new tsconfig.shared-tests.json owns the tests) mirroring the server/engine pairing"

key-files:
  created:
    - src/shared/api.test.ts
    - tools/tsconfig.shared-tests.json
  modified:
    - src/shared/api.ts
    - src/server/routes/api.ts
    - src/client/game.ts
    - src/client/game.html
    - src/client/game.css
    - tools/tsconfig.shared.json
    - tsconfig.json
    - vitest.config.ts
    - eslint.config.js

key-decisions:
  - "GenomeIdEnum declared in src/shared/api.ts (mirrors the server's GENOME_IDS) rather than imported from src/server/contracts/settings — importing a server module into the client-safe shared contract would break bundle safety (CLAUDE.md §6)"
  - "GET /api/organism uses readConfig() (no sub arg, context-scoped) NOT readConfig(sub) as the plan text said — the 03-04 SDK correction: settings.get is scoped to the current install context, and the post request IS that community's context (V4)"
  - "Style id from config wins for paint (STYLES[data.style] ?? techno); unimplemented comic/pixel ids fall back to techno rather than ever yielding a broken canvas (V5)"
  - "Envelope parsed on the way OUT server-side (OrganismResponseSchema.parse) so the server stays honest to the contract the client safeParses; rings re-validate against RingRecordSchema there"
  - "Overlays are pure [hidden]-attribute toggles over i18n-keyed HTML copy — game.ts injects NO language text (i18n, CLAUDE.md §7); errors spend muted ink only, never the reserved conflict-red"

patterns-established:
  - "A shared z.infer fetch envelope whose array element reuses an engine contract schema — server .parse + client safeParse share one surface, zero drift"
  - "Client-boundary safeParse → state-machine overlay (loading/cold-start/error/render) so the UI never throws on a hostile payload or a dead network"
  - "Source/tests composite-project split for src/shared mirroring engine/server (test types never leak into the source emit)"

requirements-completed: [DEV-01, DEV-05]

# Metrics
duration: 6min
completed: 2026-06-21
status: complete
---

# Phase 3 Plan 05: Data-driven read path — fetch /api/organism → safeParse → render the real universe Summary

**A community member opens the post and the webview fetches its real accumulated universe: same-origin `GET /api/organism` returns the Ring records (through the 03-03 `readAllRings` single read boundary) plus the community's genome/style config (through the 03-04 `readConfig` settings boundary) as a shared `z.infer` `OrganismResponse` whose `rings` reuse `RingRecordSchema`; `src/client/game.ts` `safeParse`s that envelope at the UI boundary (never throwing), resolves the genome/style ids to engine presets, and feeds the Ring records into the UNCHANGED engine `render()` — branching to a forming-loading state, the intentional genesis-core-only cold-start (D-04), a muted-ink error overlay with retry, or the rendered universe — replacing the 03-01 fixed-fixture spike.**

## Performance
- **Duration:** ~6 min
- **Started:** 2026-06-21T15:36:32Z
- **Completed:** 2026-06-21T15:43:09Z
- **Tasks:** 2
- **Files:** 11 (2 created, 9 modified)

## Accomplishments
- **Shared OrganismResponse contract (DEV-01 / DEV-05):** `OrganismResponseSchema = z.object({ type: z.literal('organism'), rings: z.array(RingRecordSchema), genome: GenomeIdEnum, style: StyleIdEnum })`, `z.infer`-only — there is NO hand-written `type OrganismResponse`. `rings` **reuse the engine `RingRecordSchema`** (03-03) so the wire shape is exactly what `render()` consumes (zero drift). The module stays **client-safe**: it imports ONLY the Devvit-free engine contracts (`RingRecordSchema`, `StyleIdEnum`) + zod — no server/Redis/Devvit module — so it lives in the webview bundle without dragging server code (CLAUDE.md §6).
- **GET /api/organism handler (DEV-01):** mirrors the `/init` guard + try/catch envelope. `sub` is derived from `context.subredditId` ONLY (V4 / T-03-02) — missing sub → `400 { status:'error', message:'error.api.noSub' }` (i18n key). The body `Promise.all`s `readAllRings(sub)` (the single 03-03 Redis-read boundary parse) + `readConfig()` (the single 03-04 settings boundary), then returns `OrganismResponseSchema.parse({ type:'organism', rings, genome: cfg.genome, style: cfg.style })`, 200 — **parsed on the way out** so the server stays honest to the shared contract. An empty community returns `rings: []` + 200 (the client renders cold-start, NOT an error). The envelope is exactly rings (~25 scalars + seed) + two ids — no PII, no secrets, no images (T-03-13 / DEV-05).
- **Data-driven game.ts mount (DEV-01):** `loadCosmos()` does same-origin `fetch('/api/organism')` (NO postMessage — Pitfall 1), `await res.json()`, `OrganismResponseSchema.safeParse(json)` at the UI boundary — **the client NEVER throws** (CLAUDE.md §6 / T-03-12). On `!parsed.success` OR a fetch/JSON exception → the muted-ink error overlay (with retry). On success → resolve `genome = GENOMES[id]` + `style = STYLES[id] ?? techno`, and `render(frontierFirst(rings), genome, style, new PhaserPainter(game))` — the **single `render()` seam**, never `synthesize()`, never a re-parse on the hot path (rings are already RingRecord-parsed server-side, Pitfall 6). The 03-01 fixed fixture + the `generateDayVectors` import are GONE.
- **Cold-start / error / loading states (D-04 / UI-SPEC S3):** `rings.length === 0` → `render()` produces the genesis-core-only Scene AND the **Genesis** overlay shows — intentional and beautiful, never empty/broken. A parse/fetch failure → the muted-ink error overlay (no alarm-red — the conflict-red token is reserved for data). The loading "forming" state shows until the fetch resolves. All copy is i18n-keyed HTML (`state.loading`, `state.coldstart.heading/body`, `state.error`, `state.error.retry`); `game.ts` only toggles the `[hidden]` attribute — it injects no language text (CLAUDE.md §7). `prefers-reduced-motion` honored (static overlays, blur dropped under reduced).
- **Determinism across the Redis→engine seam:** the same Ring records render identically because `RingRecordSchema` (carrying `seed` + `genomeVersion`) is the one contract on both sides; the client adds no randomness — it reverses to frontier-first and hands the records to the unchanged engine.

## Task Commits
1. **Task 1: OrganismResponse shared contract + GET /api/organism** — `f247629` (test RED → schema/route GREEN, contract-first)
2. **Task 2: data-driven game.ts mount + overlays** — `1d0825a` (feat)

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified
- `src/shared/api.ts` — added `GenomeIdEnum` + `OrganismResponseSchema` + `z.infer OrganismResponse`; client-safe (engine contracts + zod only); Init/Increment/Decrement aliases left as-is (counter routes still use them)
- `src/shared/api.test.ts` — 7 tests: accept valid + cold-start envelopes; reject malformed ring / unknown genome / unknown style / wrong type literal; z.infer assertion
- `src/server/routes/api.ts` — added `GET /organism`: context-sub guard → readAllRings + readConfig → OrganismResponseSchema.parse envelope
- `src/client/game.ts` — REPLACED the 03-01 fixed-fixture spike with `loadCosmos()` (fetch → safeParse → cold-start/error/loading/render); GENOMES/STYLES id resolvers; teardown discipline; retry wiring
- `src/client/game.html` — loading/cold-start/error overlay nodes, i18n-keyed copy
- `src/client/game.css` — `.hud`-style translucent-dark overlay chrome, muted-ink error, gold genesis heading, 44px retry target, reduced-motion block
- `tools/tsconfig.shared.json` — references the engine project + excludes `*.test.ts` (source project stays test-free)
- `tools/tsconfig.shared-tests.json` — NEW: type-checks the shared tests (mirrors tsconfig.server-tests.json)
- `tsconfig.json` — registered the shared-tests project
- `vitest.config.ts` — registered `src/shared/api.test.ts` in the Phaser-free runner
- `eslint.config.js` — shared block now lints the source + tests projects

## Decisions Made
- **GenomeIdEnum lives in shared, not imported from the server** — the three preset ids (`calm`/`chaotic`/`crystalline`) are declared in `src/shared/api.ts` (mirroring the server's `GENOME_IDS`). Importing `GENOME_IDS` from `src/server/contracts/settings` would pull a **server module** (it imports `@devvit/web/server`-adjacent code paths) into the client-safe shared contract and break bundle safety (CLAUDE.md §6). `StyleIdEnum` is safely reused from the engine contract (Devvit-free). A new preset adds an id in both places — a documented, low-cost duplication of a 3-element id list, chosen over a bundle-safety violation.
- **`/api/organism` uses `readConfig()` (no sub), not `readConfig(sub)`** — the plan's Task-1 action text wrote `readConfig(sub)`, but the 03-04 SDK correction established that `settings.get` is scoped to the CURRENT request's install context and `readConfig()` takes no argument. The post request runs IN the viewing community's context, so `readConfig()` returns that community's genome/style. This is the same load-bearing correction 03-04 made for the sweeper (which instead uses `readSnapshot(sub)` because it spans many subs). See Deviations.
- **Config style id wins for paint, with a techno fallback** — `STYLES[data.style] ?? techno`. Only `techno` is authored this phase; the contract's `comic`/`pixel` ids fall back to the techno look rather than ever producing a broken canvas (V5 / UI-SPEC S4).
- **Server parses the envelope on the way OUT** — `OrganismResponseSchema.parse` in the handler (not just the client safeParse) keeps the server honest to the shared contract and re-validates each ring against `RingRecordSchema` at the response boundary; a contract drift fails server-side, not silently on the client.
- **Shared source/tests tsconfig split** — added `tsconfig.shared-tests.json` and excluded `*.test.ts` from `tsconfig.shared.json` (which now also references the engine project for the `RingRecordSchema` import). This mirrors the established engine/server source/tests pairing so vitest types never leak into the shared source emit and the cross-project engine import resolves under `tsc --build`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared tsconfig needed an engine project reference + a source/tests split**
- **Found during:** Task 1 (`src/shared/api.ts` imports `RingRecordSchema`/`StyleIdEnum` from `src/engine/contracts`; `src/shared/api.test.ts` added under the same rootDir)
- **Issue:** `tools/tsconfig.shared.json` (composite, `rootDir: ../src/shared`) had NO `references`, so the cross-project import of the engine contract could not resolve under `tsc --build`. It also `include`d `**/*` with no `*.test.ts` exclude and no sibling tests project, so the new test file would have pulled vitest types into the shared source emit (and there was no lint project for it).
- **Fix:** added `references: [{ path: ./tsconfig.engine.json }]` and `exclude: [**/*.test.ts]` to `tsconfig.shared.json`; created `tools/tsconfig.shared-tests.json` (references shared + engine); registered it in the root `tsconfig.json`, the `vitest.config.ts` include list, and the eslint shared block — mirroring the existing engine/server source/tests pattern exactly.
- **Files modified:** tools/tsconfig.shared.json, tools/tsconfig.shared-tests.json (new), tsconfig.json, vitest.config.ts, eslint.config.js
- **Verification:** `tsc --build` exit 0; `npm run lint` exit 0; `npx vitest run src/shared/api.test.ts` 7 passed.
- **Committed in:** `f247629` (Task 1).

**2. [Rule 1 - Plan/SDK mismatch] GET /api/organism reads config via `readConfig()` (context-scoped), not `readConfig(sub)`**
- **Found during:** Task 1 (wiring the handler body)
- **Issue:** The plan's Task-1 action specifies `readConfig(sub)`. But 03-04 established (and shipped) `readConfig()` with NO sub argument because `@devvit/web/server` `settings.get` is scoped to the current request's installation context — it cannot fetch an arbitrary sub's settings. Calling `readConfig(sub)` would not even type-check (the function takes no argument).
- **Fix:** the handler calls `readConfig()` — correct because the `/api/organism` request runs IN the viewing community's install context, so context-scoped `settings.get` returns that community's genome/style. (The cross-sub path, `readSnapshot(sub)`, is the sweeper's tool, not this handler's.) `sub` is still derived from `context.subredditId` for `readAllRings(sub)` (V4).
- **Files modified:** src/server/routes/api.ts
- **Verification:** `tsc --build` exit 0; the handler compiles against the real 03-04 `readConfig()` signature.
- **Committed in:** `f247629` (Task 1).

---

**Total deviations:** 2 auto-fixed (1 blocking tsconfig wiring, 1 plan/SDK signature mismatch inherited from the 03-04 correction). No scope creep; no architectural change; no new packages.

## Issues Encountered
- The first GREEN run failed because the test's `validRing` fixture was incomplete (it had a non-existent `replies` field and omitted `scoreSum`/`topThreads` required by `DayVectorSchema`). The schema is the source of truth — the fixture was the bug; fixed to match `DayVectorSchema` exactly (no schema change). 7/7 green after.

## Deferred verification — the FULL live-device playtest (now ready)
Per the user's explicit auto-approve decision for this run, ALL live-device `<human-check>`s were deferred — including this plan's real visual end-to-end playtest, which is the phase's payoff verification. Every AUTOMATED gate is green (below); only the physical-device render is owed. The full accumulate → freeze → sweep → render pipeline is now wired end-to-end and **ready to playtest in one manual session** when the user is ready. Concrete step list:

1. `devvit playtest <test-sub>` (the prior spike used `r/subcosm_test_om`).
2. **Cold-start (D-04):** open the post on a fresh/empty community (ringCount 0) → confirm the **genesis-core-only** universe renders with the **Genesis** overlay ("Your cosmos begins here…") — reads intentional, not empty/broken.
3. **Accumulate:** create a few posts + comments **including a reply** (a `t1_` parent — the conflict/reply signal); confirm the day counters accumulate (03-02).
4. **Freeze:** manually fire the tick (`/internal/scheduler/tick` with `{ subId, day: frontierDay(sub) }`) OR wait for the hourly sweeper to hit the community's local midnight (03-03/03-04); confirm a new `organism:{sub}:ring:{n}` hash appears, `ringCount` advances by 1, and the day counters reset. Re-fire the same day → confirm NO second ring (idempotency / `lastTickDay`).
5. **Render the real universe:** reopen the post → confirm the **real accumulated** rings render (the frozen shells + genesis core), NOT the old 03-01 fixed fixture, and identically to a server render (determinism).
6. **Error state:** force a fetch failure (offline) and reopen → confirm the **muted-ink** error overlay + **Retry** shows (no alarm-red); tap Retry online → the universe loads.
7. **Touch:** confirm pinch/drag drive the camera, not the page (`touch-action:none`).

This single session also discharges the deferred human-checks owed from 03-02/03-03/03-04.

## Automated gates (all green)
- `npm test` → **166 passed** (21 files; +7 new: the shared OrganismResponse contract suite)
- `npm run type-check` (`tsc --build`) → exit 0
- `npm run lint` (`eslint 'src/**/*.{ts,tsx}'`) → exit 0
- `npm run build` (`vite build`) → Build complete (pre-existing benign Rollup `inlineDynamicImports`/`sourcemapFileNames` warnings only — tooling, noted in 03-01/02/03/04, out of scope)

## CLAUDE.md / determinism compliance
- **Zod is the source of truth (§1/§9):** `OrganismResponse` is `z.infer` of `OrganismResponseSchema` — no hand-written type, no `as` cast. `rings` reuse `RingRecordSchema` (no parallel DTO).
- **Parse at boundaries (§6):** server `.parse` on the way out of `/api/organism` (and rings already `.parse`d at the single `readAllRings` read boundary); the **client `safeParse`s and NEVER throws** — a bad payload or dead network routes to the error overlay, never a broken canvas.
- **Bundle safety (§6):** `src/shared/api.ts` imports ONLY engine contracts (Devvit-free) + zod — verified no server/Redis/Devvit import; the client bundle does not pull server code.
- **i18n (§7):** every overlay string is an i18n-keyed HTML node (`state.*`); the server error messages are i18n keys (`error.api.noSub`, `error.api.organism.failed`); `game.ts` injects no language text.
- **Determinism:** the client adds no randomness; the same `RingRecord[]` (carrying `seed` + `genomeVersion`) renders identically client and server via the unchanged engine `render()`. `src/engine/` untouched (no Devvit import, no `Math.random` there).

## Threat-model dispositions (all addressed)
- **T-03-02** (sub-id spoofing on /api/organism) → `sub` derived from `context.subredditId` server-side; a client cannot request another community's rings (V4).
- **T-03-12** (malformed/hostile payload → client crash) → UI `OrganismResponseSchema.safeParse` (never `.parse`/throw); a bad payload routes to the error overlay (CLAUDE.md §6).
- **T-03-13** (over-exposure on /api/organism) → the envelope is exactly rings (~25 scalars + seed) + genome/style ids — no secrets, no PII, no images (DEV-05).
- **T-03-08** (partial stored ring rendered raw) → rings come through the single `readAllRings` read-boundary parse (03-03); the client never re-parses in the rAF loop (Pitfall 6).
- **T-03-SC** (package installs) → no new packages (fetch is native; Phaser/Zod pre-existing); slopcheck N/A.

## Phase Readiness
- This is the FINAL plan of phase 03. The phase's payoff vertical slice is complete: real Reddit activity that the triggers accumulated (03-02) and the tick froze into rings (03-03) under the config the mod set (03-04) is now a universe the member actually sees, via the same-origin fetch-on-load read path with the intentional cold-start, muted-ink error, and forming-loading states. Live realtime frontier fill + steering nudges are Phase 4 (CONTEXT deferred). The one owed item is the deferred full live-device playtest (step list above), left for a manual session by user decision.

## Self-Check: PASSED
- `src/shared/api.test.ts` exists; `tools/tsconfig.shared-tests.json` exists (both created).
- Commits `f247629` and `1d0825a` present in git history.

---
*Phase: 03-devvit-scaffold-data-layer*
*Completed: 2026-06-21*
