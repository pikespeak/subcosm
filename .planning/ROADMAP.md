# Roadmap: Subcosm

## Overview

Subcosm ships in five phases across ~26 days: first a pure, platform-agnostic engine that turns any DayVector data into a legible, deterministic universe (Phases 1–2), then Reddit wiring that makes it a live community game (Phases 3–4), then the submission artifacts that make it a hackathon entry (Phase 5). Phase group A (engine + simulator) is built entirely without Devvit. The simulator's output schema IS the DayVector contract the live data collector will later fill — no schema drift possible. The last phase exists to publish and submit; a non-submitted roadmap is a failed roadmap.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Engine Foundation** - Zod contracts, seeded RNG, genome/style-as-data template engine, and deterministic synthesis — the typed core everything else depends on
- [ ] **Phase 2: Visual Engine + Simulator** - Techno Canvas2D paint at mock parity, camera + depth scrubber + legibility readout, steering nudges, data simulator, and the dev harness — the complete standalone visual demo
- [ ] **Phase 3: Devvit Scaffold + Data Layer** - Devvit Web app scaffold, Reddit triggers → Redis aggregation, hourly UTC scheduler tick, genome at install via settings — the Reddit wiring
- [ ] **Phase 4: Live Game** - Live frontier fills during the day, freezes overnight irreversibly, and creates a pinned reveal post — the retention loop
- [ ] **Phase 5: Submit** - Mobile polish, onboarding legibility, published app listing, public playable demo post, Devpost write-up — the submission package

## Phase Details

### Phase 1: Engine Foundation
**Goal**: The four Zod contracts, seeded RNG, genome/style template engine, and deterministic synthesis exist as a pure, testable core — zero Devvit imports, zero paint code, all types derived from schemas
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, TPL-01, TPL-02, TPL-03, TPL-04, SYN-01, SYN-02, SYN-03, SYN-04
**Success Criteria** (what must be TRUE):
  1. `npm test` passes a determinism test: two synthesis calls with identical DayVector + seed + genomeVersion produce a byte-identical Scene
  2. Switching between the "Calm" and "Chaotic" Genome presets (same DayVector[]) produces visibly different Scene output — denser stars, higher volatility, different shell shape — with zero engine code changes
  3. `tsc --noEmit` and `npm run build` pass clean; ESLint reports zero `Math.random` or Devvit import violations in `src/engine/`
  4. Every TypeScript type for the four contracts is `z.infer` of its Zod schema — no hand-written interfaces exist for DayVector, Scene, Genome, or StyleTemplate
**Plans**: TBD

### Phase 2: Visual Engine + Simulator
**Goal**: A standalone Vite dev page renders a simulated Subcosm universe at visual parity with the mock — scrubbing through time, nudging the frontier, switching genome presets, and regenerating from a new seed all work; the engine is provably complete before any Reddit code is written
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PNT-01, PNT-02, PNT-03, PNT-04, CAM-01, CAM-02, CAM-03, CAM-04, STR-01, STR-02, SIM-01, SIM-02, SIM-03, QA-01, QA-02, QA-03
**Success Criteria** (what must be TRUE):
  1. The dev page renders a universe whose genesis core, concentric shells, nebula, frontier ignite, and vignette match the visual reference in `docs/subcosm-universe-mock.html` — a side-by-side comparison is convincing
  2. Dragging the depth scrubber flies through time and the per-shell readout updates to show correct date / era / theme / stars / comments / contributors / conflict for each ring
  3. Clicking "regenerate" (new seed) produces a different universe; re-entering the same seed reproduces the identical universe
  4. The simulator produces a dramatic spike day, an AMA cluster day, a quiet day, and a cold-start day-1 — all render legibly and distinctly
  5. The camera/coordinate model is verified (design review, not implementation) to not preclude an outer zoom tier for a future multiverse — no hardcoded assumptions that would make adding a galaxy-level zoom impossible
  6. `prefers-reduced-motion` produces a static render with no animation or strobe; `npm test` and `npm run build` both pass green
**Plans**: TBD
**UI hint**: yes

### Phase 3: Devvit Scaffold + Data Layer
**Goal**: A Devvit Web app hosts the engine as an interactive post; real Reddit activity flows through triggers into Redis daily counters; the scheduler tick freezes a ring and opens the next frontier; mod configures the genome at install
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: DEV-01, DEV-02, DEV-03, DEV-04, DEV-05, DEV-06
**Success Criteria** (what must be TRUE):
  1. `devvit upload` deploys the app and the interactive post renders the Subcosm universe inside the Reddit post viewport on mobile
  2. Creating a post or comment in the subreddit increments the Redis daily counters; the conflict composite is computed from comment-rate + reply-depth proxies (no vote trigger dependency)
  3. The hourly UTC sweeper fires the daily tick at the correct local day boundary, writes a Ring record with `genomeVersion` and explicit `ringCount`, resets counters, and opens the next frontier — verified in a test subreddit
  4. A mod installing the app sees a settings page to choose genome preset + style; the chosen config drives that community's universe with no code changes
**Plans**: TBD

### Phase 4: Live Game
**Goal**: The community's live frontier fills with activity during the day, nudges steer it in near-real-time, the overnight tick freezes it irreversibly, and a pinned reveal post tells the community what their universe became — the full retention loop works end-to-end
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: LIVE-01, LIVE-02, LIVE-03
**Success Criteria** (what must be TRUE):
  1. Nudge controls (branch / symmetry / hue) re-synthesize the live frontier visibly within a few seconds of being pressed; nudges aggregate into the Redis steer hash without overwriting each other
  2. At the daily tick the frontier shell freezes — further nudges have no effect on it — and a new empty frontier opens
  3. A pinned "what your universe became overnight" post appears in the subreddit within a minute of the tick
  4. Loading the post on a second client after the tick renders an identical frozen ring to the first client, confirming determinism holds across the Redis → engine seam
**Plans**: TBD

### Phase 5: Submit
**Goal**: The app is published on developer.reddit.com, a public demo post runs the full game on a real subreddit, the experience is polished on mobile, and the Devpost submission is complete — every mandatory artifact for the hackathon exists before the 2026-07-15 18:00 PDT deadline
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06
**Success Criteria** (what must be TRUE):
  1. The app listing is published on developer.reddit.com and accessible via a public URL
  2. A public demo post on a live subreddit runs the game; a new visitor can understand the loop (community grows a cosmos, one shell per day) without any external explanation
  3. The experience runs at approximately 60fps in the Reddit post viewport on a mid-range Android; no visible jank during scrub or frontier nudge
  4. Cold-start day-1 (one ring, maybe one star) looks intentional and beautiful — not broken or empty
  5. The Devpost write-up at `docs/devpost-submission.md` is complete with media gallery, demo link, and the correct contest category tags; the submission is submitted before the deadline
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine Foundation | 0/TBD | Not started | - |
| 2. Visual Engine + Simulator | 0/TBD | Not started | - |
| 3. Devvit Scaffold + Data Layer | 0/TBD | Not started | - |
| 4. Live Game | 0/TBD | Not started | - |
| 5. Submit | 0/TBD | Not started | - |
