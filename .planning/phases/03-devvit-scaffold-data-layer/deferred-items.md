# Phase 03 — Deferred / Out-of-Scope Items

Items discovered during execution that are NOT caused by the current plan's
changes and were therefore NOT fixed (executor scope boundary).

## Pre-existing: `npm run type-check` (tsc --build) is red on master

**Discovered during:** 03-01 Task 1 (running the project type gate).

**Symptom:** `tsc --build` fails with TS6307 in the **engine-tests** project:

```
src/engine/synthesis.test.ts(23,36): error TS6307: File '.../src/sim/generator.ts'
  is not listed within the file list of project 'tools/tsconfig.engine-tests.json'.
src/engine/synthesis.test.ts(65,30): error TS6307: File '.../tests/synthesis-elements-baseline.json' ...
src/sim/generator.ts(17,34): error TS6307: File '.../src/sim/beats.ts' ...
```

**Root cause:** `src/engine/synthesis.test.ts` imports `../sim/generator` (which
imports `sim/beats.ts`) and `tests/synthesis-elements-baseline.json`, but
`tools/tsconfig.engine-tests.json` only `include`s `../src/engine/**/*.test.ts`
+ `../tests/**/*` and references only the engine source project — the `sim`
files it transitively pulls in are not part of any listed project, so
`composite` project boundaries reject them.

**Why not fixed here:** This is Phase-2 engine/sim test wiring, entirely
unrelated to the Phase-3 Devvit data-layer slice. It reproduces in isolation
(`tsc --build tools/tsconfig.engine-tests.json`) on the parent commit and is in
files outside this plan's `files_modified`. Fixing it (adding a sim reference /
include to the engine-tests tsconfig, or pointing the import at the `src/sim`
project) is a small, safe change but belongs to a Phase-2 follow-up, not this
Wave-0 spike.

**This plan's own type gate is GREEN in isolation:**
`tsc --build tools/tsconfig.server.json tools/tsconfig.server-tests.json` exits 0,
and `tsc --build tools/tsconfig.client.json` (game.ts stub) exits 0.

**Suggested fix (for a Phase-2 follow-up):** add a `references` entry to
`tools/tsconfig.sim.json` (and the JSON baseline path) in
`tools/tsconfig.engine-tests.json`, or have `synthesis.test.ts` import the sim
barrel that the sim project owns.
