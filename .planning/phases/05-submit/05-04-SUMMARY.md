---
phase: 05-submit
plan: 04
subsystem: client-paint
tags: [perf, aesthetic, paint, rAF, techno, brand]
requires: ["05-03"]
provides:
  - "Mobile perf guards on the post webview mount (frame-skip + visibility rAF idle + DPR cap)"
  - "Bespoke Techno signature: genesis-core long cross-flare + curated cyan<->magenta palette + wide light-sans HUD chrome + SUBCOSM brand mark"
affects:
  - src/client/game.ts
  - src/client/cosmos/paint.ts
  - src/client/cosmos/primitives.ts
  - src/styles/techno.ts
  - src/client/game.css
  - src/client/game.html
tech-stack:
  added: []
  patterns:
    - "Phaser TimeStep frame-skip (fps.limit) + sleep()/wake() on document visibilitychange"
    - "Additive anisotropic light-beam primitive (addBeam) for the deterministic core cross-flare"
    - "Look constants as StyleTemplate DATA (palette ramp curated in techno.ts, never hard-coded in the painter)"
key-files:
  created: []
  modified:
    - src/client/game.ts
    - src/client/cosmos/paint.ts
    - src/client/cosmos/primitives.ts
    - src/styles/techno.ts
    - src/client/game.css
    - src/client/game.html
decisions:
  - "Frame-skip implemented via Phaser's native TimeStep fps.limit (target/min/limit 60/30/60, smoothStep) rather than a hand-rolled accumulator — framework-native, consistent across refresh rates, never chases >60 (RESEARCH Q7)."
  - "Cross-flare GEOMETRY/RATIO constants live as const in paint.ts (precedent: REWARD_HUE); only the flare COLOR is read from the StyleTemplate ramp (coreStop). The StyleTemplate schema is closed, so adding flare-geometry fields would be a contract change (out of scope / Rule 4) — PNT-02's constraint is about colors, not geometry constants."
  - "Curated the palette ramp's cold bridge stop (#6366f1 -> #2b1f6b deep electric-violet) to separate the cyan + magenta signature poles; the three test-asserted signature stops (#46e0d8, #d946ef, #fff7e6) were preserved verbatim so techno.test.ts stays green without re-baselining."
  - "Added the previously-missing production .hud / .nudge / .hud-* chrome styling to game.css (the dev page had it; the post did not) as part of the D-07 typography pass — Rule 2 (missing critical chrome), scoped to the plan's named file."
metrics:
  duration: ~6m
  completed: 2026-06-22
status: complete
---

# Phase 5 Plan 04: Mobile Perf Tuning + Bespoke Techno Aesthetic Summary

Profiling-minded perf guards (frame-skip + visibility rAF idle + confirmed DPR cap) on the post webview mount, plus the self-authored Techno signature (genesis-core long cross-flare from `docs/subcosm.png`, a curated cyan↔magenta palette kept as StyleTemplate data, wide light-sans HUD/chrome typography, and a static SUBCOSM brand mark) — all paint/client-only, engine determinism + purity intact.

## What Was Built

### Task 1 — rAF/visibility + frame-skip perf guards (D-05 / SUB-03) — commit `41e1375`
- **Frame-skip:** `gameConfig()` now sets `fps: { target: 60, min: 30, limit: 60, smoothStep: true }`. Phaser's `TimeStep` skips a step whenever the elapsed delta is below the ~16.67ms target, bounding per-frame cost and pinning cadence to 60 across refresh rates (a 120Hz panel advances at 60, not 120). The shimmer math (`ignite.ts`) is wall-clock-driven (`Math.sin(time * tempo)`), NOT per-frame-increment, so the cap changes cadence, never animation speed.
- **Visibility idle:** a `visibilitychange` listener calls `game.loop.sleep()` when `document.hidden` (zero per-frame work) and `game.loop.wake(true)` (seamless, no time-jump strobe) when visible. Registered in `mountUniverse()` via `startVisibilityIdle()`; removed in `teardown()` via `stopVisibilityIdle()` BEFORE the game is destroyed, so re-mounts never leak a listener (mirrors the existing `disconnectRealtime` teardown discipline).
- **DPR cap:** confirmed/kept at `Math.min(window.devicePixelRatio || 1, 2)` (PNT-03).
- **Static first frame:** unchanged and confirmed — `CosmosScene.layout()` draws one static `IGNITE_REST` frame up front and there is no autoplay intro, so the first impression is the intended static look even under the iOS cross-origin-iframe ~30fps-until-interaction throttle (RESEARCH Pitfall 5). Reduced-motion static gate intact.

### Task 2 — bespoke Techno signature (D-07 / SUB-05) — commit `0fb983c`
- **Genesis-core cross-flare** (`paint.ts` `drawCore`/`drawCoreFlare`): a deterministic long 4-point cross-flare matching `docs/subcosm.png` — long vertical+horizontal cross beams (`FLARE_CROSS_LEN` 5.2× core glow R) plus shorter ±45° diagonal accents (`FLARE_DIAG_LEN` 2.6×). Drawn additive, colored from the StyleTemplate warm core stop (`coreStop(ramp)`) — **no hard-coded color literal**, **no rng** (pure function of the core glow radius → identical on every client, LIVE-03), and static (drawn once with the core, reduced-motion safe, reads on the iOS static first frame).
- **`addBeam` primitive** (`primitives.ts`): an anisotropic additive light streak built from the single reused glow texture (stretched `length`×`thickness`, rotated) — the flare-spike primitive, one draw call per beam.
- **Curated palette** (`techno.ts`): the ramp's cold bridge stop changed from a flat indigo `#6366f1` to a deeper electric-violet `#2b1f6b`, so the cyan (`#46e0d8`) and magenta (`#d946ef`) signature poles read as two distinct hues instead of muddying into one blue. Kept as DATA (PNT-02). The three signature stops are preserved verbatim.
- **Typography** (`game.css`): wide, light-tracked Space Grotesk on the HUD + nudge chrome (font-weight 300, uppercase wide-tracked labels) reading as the SUBCOSM wordmark. Also added the production `.hud` / `.nudge-controls` / `.hud-*` panel styling that existed only on the dev page (the post's HUD/nudge panels were previously unstyled).
- **Brand mark** (`game.html` `#brand-mark` + `game.css`): a small static "Subcosm" corner wordmark in low-alpha warm-white core hue, wide letter-spacing (0.42em) from the logo. A fixed brand string (no echoed user text — Devvit-compliant), present from load so it signs the static first frame.

## On-Device Checkpoint Handling (Task 3) — UAT-DEFERRED

Task 3 is a `checkpoint:human-verify` for on-device perf feel (scrub/nudge smoothness, ~60fps on a real mid-range Android) and aesthetic-feel judgment side-by-side vs the mock. Per the executor instruction and the plan's own framing (`<objective>`: "On-device profiling (D-05) is validated in the folded UAT (05-05)"), **on-device verification is deferred to the later Phase-5 demo/UAT session (05-05)** and was NOT performed here.

**Honest status:** the code-level perf guards and the aesthetic are in place and pass all desktop DoD gates; **no on-device fps profiling or on-device aesthetic-feel judgment has been done.** The following are unconfirmed until 05-05 on a real device:
- Actual sustained ~60fps in the post viewport during scrub/nudge on a mid-range Android.
- The bespoke look reading self-authored vs AI-slop on a real mobile screen side-by-side with `docs/subcosm.png` / `docs/subcosm-universe-mock.html`.
- Devvit-rules visual compliance in the live post (geometry deterministic, no echoed user text) — code-verified here (no user text reaches paint/chrome), live-verified in 05-05.

## [ASSUMED] Tuning Constants (confirm on-device in 05-05)
- `FLARE_CROSS_LEN` 5.2, `FLARE_DIAG_LEN` 2.6, `FLARE_THICKNESS` 0.42, `FLARE_CROSS_ALPHA` 0.85, `FLARE_DIAG_ALPHA` 0.5 — flare proportions tuned to the logo on desktop; re-judge scale/intensity on a real mobile screen.
- Palette bridge stop `#2b1f6b` — curated on desktop; confirm the cyan↔magenta separation reads on-device.
- `fps` `{ target 60, min 30, limit 60 }` — confirm the 60fps hold + graceful 30 floor under real-device load.

## Determinism / Snapshot Impact
- **No golden/snapshot tests exist** for paint or palette (verified — no `__snapshots__`, no `toMatchSnapshot`), so nothing required re-baselining.
- `techno.test.ts` asserts the ramp *contains* the three signature stops; all three were preserved, so it stays green with no edit.
- No rng added to paint; no engine (`src/engine/**`) file touched; the palette change is StyleTemplate DATA only. Same `DayVector + seed + genomeVersion` still renders the same Scene geometry — only the look changed (per the determinism + purity contract).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Production HUD/nudge chrome was unstyled**
- **Found during:** Task 2 (game.css typography pass).
- **Issue:** `game.html` references `.hud`, `.hud-line`, `.hud-k`, `.hud-v`, `.hud-track`, `.hud-metric`, `.nudge-controls`, `.nudge-btn`, `.nudge-budget` but these were defined ONLY in the dev page CSS (`cosmos-dev.css`), not in the production `game.css` — the post's HUD readout and steer controls rendered with no panel/positioning/typography.
- **Fix:** added the production `.hud` + nudge chrome to `game.css` as part of the D-07 wide-light-sans typography deliverable (the plan scoped `game.css` to this).
- **Files modified:** `src/client/game.css`.
- **Commit:** `0fb983c`.

No other deviations — the perf + aesthetic tasks were executed as written.

## DoD Verification (all green)
- `npm run type-check` — pass
- `npm run lint` — pass
- `npm test` — 276 passed (28 files), incl. `techno.test.ts` + `ignite.test.ts`
- `npm run build` — complete (pre-existing Vite config warnings only, unrelated to these changes — out of scope)

## Hard Safety
No publish/upload/deploy/post/Devpost/live-platform action taken. Code + unit tests only.

## Self-Check: PASSED
All modified files exist on disk; both task commits (`41e1375`, `0fb983c`) are in the git log.
