# Phase 5: Submit - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the hackathon entry: a published app listing on developer.reddit.com, a self-explanatory public demo post that runs the full game on a real subreddit, mobile polish (~60fps in the post viewport), onboarding legibility for both loops, the self-authored Techno aesthetic, and a complete Devpost write-up — every mandatory submission artifact before **2026-07-15 18:00 PDT**. (Requirements SUB-01..SUB-06.)

This phase clarifies HOW to make what is already built submission-ready. New gameplay capabilities (guess loop, collection, streaks, multiverse, monetization) are explicitly out of scope.

</domain>

<decisions>
## Implementation Decisions

### Demo-Post Seeding
- **D-01:** Backfill the demo subreddit's history via a **moderator menu action** (extend `src/server/routes/menu.ts`). It writes the existing deterministic **30-day simulator arc** (`src/sim/beats.ts` → `generateDayVectors`) as historical Ring records through the **same synthesis / ring write path as a real tick** — byte-identical to organically-grown rings: NO special-case rendering, NO engine special-casing, NO fabricated user text. Purpose: judges see the "depth = time" universe immediately instead of an empty day-1. Backfill length defaults to the full 30-day arc (Claude's discretion to shorten if perf/clarity argues for it).

### Onboarding / Legibility
- **D-02:** Richer in-feed splash card (one-line pitch) + a **one-time, dismissible first-run coachmark overlay** inside the game pointing at: genesis core / shells / live frontier (depth = time), the goal line, the nudge/steer control, and "it freezes & reveals overnight." One-shot (persist "seen"); MUST respect `prefers-reduced-motion`. New overlay code; reuses the existing HUD readout.

### Devpost Narrative + Media
- **D-03:** Narrative leads with the **emotional hook** ("a universe grown from your community" / biographical r/place / "what did our universe become overnight?"), then substantiates with the architecture (one pure engine, two typed contracts, determinism, no stored images).
- **D-04:** Target prize categories: **Best App with a Hook (PRIMARY) + Best User Contributions.** NOT Best Use of Phaser (the fbm/WebGL shader layer stays out of scope) and NOT Best Retention as a targeted category. Media gallery (demo video + loop GIFs) is captured from the demo-sub session.

### Mobile Polish + On-Device UAT
- **D-05:** **Performance first** — profile/optimize the frontier animation + rAF loop on a real mid-range Android to ~60fps in the post viewport (only the frontier animates; frozen shells bake-cached; LOD by zoom). Then touch targets (scrub + nudge) and post-viewport layout/clipping.
- **D-06:** The deferred Phase-4 on-device UAT (reveal-post ~1 min timing, persistent reward glyph, two-client/mobile frozen-render parity, realtime nudge propagation / D-03b fallback) is **folded into ONE on-device validation pass** on the demo subreddit, using the backfill seed (D-01) + a triggered tick (D-08). See `.planning/phases/04-live-game/04-UAT.md`.

### Self-authored Aesthetic (SUB-05)
- **D-07:** Sharpen the **bespoke Techno signature** so it reads self-authored (not AI-slop / generic neon fractal): genesis-core with the long cross-flare from the logo (`docs/subcosm.png`), curated cyan↔magenta palette, wide light-sans typography in HUD/splash, and the SUBCOSM logo integrated as a brand mark. Devvit-rules compliance is a verification check (no prohibited content; deterministic geometry only, no echoed user text).

### Demo Control / Force-Tick
- **D-08:** Add a **mod-only menu action "Advance day / trigger tick"** (alongside the seed action) to fire a tick/reveal on demand — enables the demo + the folded UAT. It is a real, mod-gated feature and is **KEPT** after judging (not temporary debug scaffolding).

### Splash Card (In-Feed Preview)
- **D-09:** The in-feed splash card shows a **one-line pitch hook + a static teaser visual of the cosmos + a clear "open/play" CTA** (reliable, fast-loading, high clarity) — not a live mini-render.

### Claude's Discretion
- Backfill length (30 days vs shorter); exact coachmark copy/sequence; splash teaser image source; plan-wave ordering.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 5: Submit" — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` — SUB-01..SUB-06 + invariants
- `.planning/PROJECT.md` — north-star, brand, prize targets, deadline (2026-07-15 18:00 PDT)
- `docs/subcosm-requirements.md` — full hackathon spec

### Submission artifacts
- `docs/devpost-submission.md` — Devpost draft to complete (D-03/D-04)
- `docs/subcosm.png` — logo / Techno brand reference (D-07)
- `docs/subcosm-universe-mock.html` — visual reference for the Techno look

### Code to extend
- `src/sim/beats.ts`, `src/sim/generator.ts` — deterministic 30-day arc (D-01 seed source)
- `src/server/routes/menu.ts` — mod menu infra (D-01 seed + D-08 force-tick)
- `src/server/core/tick.ts` (`runTick`), `src/server/core/ring.ts` (`writeRing`) — the ring write path the backfill reuses byte-identically (D-01)
- `src/server/core/schedule.ts` / scheduler tick endpoint — the path D-08 force-tick invokes
- `src/client/splash.{html,ts,css}` — in-feed card (D-09)
- `src/client/game.ts`, `src/client/cosmos/*` (paint/PhaserPainter/hud) — onboarding overlay + mobile perf + aesthetic (D-02, D-05, D-07)

### Prior on-device UAT
- `.planning/phases/04-live-game/04-UAT.md` — deferred items folded here (D-06)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/sim` (deterministic 30-day arc via `beats.ts` + `generateDayVectors`): seed source for D-01.
- `src/server/routes/menu.ts`: existing mod-menu infra for D-01 (seed) and D-08 (force-tick).
- `runTick` / `writeRing` ring write path: backfill reuses it so seeded rings are byte-identical to real ones (no parallel path).
- HUD readout (built 04-02): base the onboarding overlay on top of it (D-02).
- `PhaserPainter` / `src/client/cosmos/paint.ts`: the mobile-perf + aesthetic surface (D-05, D-07).

### Established Patterns (constraints to honor)
- Engine purity: no `Math.random` / no Devvit imports in `src/engine/`.
- Zod at boundaries: menu/scheduler payloads `.parse()` server-side; UI `.safeParse()`.
- Determinism: rings reproducible from `DayVector + seed + genomeVersion`; identical client/server render.
- Only the frontier animates; frozen shells bake-cached; `prefers-reduced-motion` static gate.

### Integration Points
- Backfill writes rings via `runTick`/`writeRing` (NOT a new write path).
- Force-tick (D-08) invokes the existing scheduler tick logic for a given `{subId, day}`.
- Onboarding overlay (D-02) layers above the existing game canvas/HUD; splash (D-09) is the post's default inline entrypoint.

</code_context>

<specifics>
## Specific Ideas

- `docs/subcosm.png` is the brand/aesthetic anchor (genesis-core long cross-flare, cyan↔magenta nebula, wide light-sans "SUBCOSM").
- Hook line for splash + Devpost open: "a universe grown from your community."

</specifics>

<deferred>
## Deferred Ideas

- Best Use of Phaser push (fbm/WebGL shader layer) — out of scope this phase (would be a dedicated Phaser-prize effort).
- Best Retention as a targeted category; guess loop + streaks (staged loop 2/3) — post-MVP.
- Connected multiverse (subreddits as galaxies); monetization via Devvit Payments — post-MVP / out of scope.
- Mode B real community theme extraction; Comic/Pixel StyleTemplates — stretch only.

</deferred>

---

*Phase: 5-Submit*
*Context gathered: 2026-06-22*
