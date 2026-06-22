# Phase 5: Submit - Research

**Researched:** 2026-06-22
**Domain:** Devvit app publishing & app-listing flow · Devvit rules/compliance · Devpost hackathon submission · demo-post seeding · on-demand tick · Devvit webview mobile perf
**Confidence:** MEDIUM-HIGH (platform limits + Devpost rules VERIFIED/CITED; the publish *review timeline* is the one LOW-confidence unknown and is flagged)

This research deliberately covers only the EXTERNAL / changing unknowns and the feasibility of the locked decisions (D-01..D-09). It does NOT re-explain the codebase — the relevant code paths (`menu.ts`, `tick.ts`, `ring.ts`, `post.ts`, `scheduler.ts`, `schedule.ts`) were read and are referenced inline where a decision attaches to them.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Backfill the demo subreddit's history via a **moderator menu action** (extend `src/server/routes/menu.ts`). Writes the deterministic 30-day simulator arc (`src/sim/beats.ts` → `generateDayVectors`) as historical Ring records through the **same synthesis / ring write path as a real tick** — byte-identical, NO special-case rendering, NO engine special-casing, NO fabricated user text. Default length = full 30-day arc (Claude's discretion to shorten).
- **D-02:** Richer in-feed splash card (one-line pitch) + a **one-time, dismissible first-run coachmark overlay** pointing at genesis core / shells / live frontier / goal line / nudge control / "freezes & reveals overnight." One-shot (persist "seen"); MUST respect `prefers-reduced-motion`. Reuses existing HUD.
- **D-03:** Devpost narrative leads with the **emotional hook** ("a universe grown from your community"), then substantiates with architecture (one pure engine, two typed contracts, determinism, no stored images).
- **D-04:** Target prize categories: **Best App with a Hook (PRIMARY) + Best User Contributions.** NOT Best Use of Phaser, NOT Best Retention as targeted categories. Media gallery captured from the demo-sub session.
- **D-05:** **Performance first** — profile/optimize the frontier animation + rAF loop on a real mid-range Android to ~60fps in the post viewport. Then touch targets (scrub + nudge) and post-viewport layout/clipping.
- **D-06:** The deferred Phase-4 on-device UAT items are folded into ONE on-device validation pass on the demo subreddit, using the backfill seed (D-01) + a triggered tick (D-08). See `.planning/phases/04-live-game/04-UAT.md`.
- **D-07:** Sharpen the bespoke Techno signature (genesis-core long cross-flare from `docs/subcosm.png`, curated cyan↔magenta palette, wide light-sans typography, SUBCOSM logo as brand mark). Devvit-rules compliance is a verification check.
- **D-08:** Add a **mod-only menu action "Advance day / trigger tick"** to fire a tick/reveal on demand. Real, mod-gated, KEPT after judging.
- **D-09:** In-feed splash card = one-line pitch hook + static teaser visual of the cosmos + clear "open/play" CTA (reliable, fast-loading). NOT a live mini-render.

### Claude's Discretion
- Backfill length (30 days vs shorter); exact coachmark copy/sequence; splash teaser image source; plan-wave ordering.

### Deferred Ideas (OUT OF SCOPE)
- Best Use of Phaser push (fbm/WebGL shader layer).
- Best Retention as a targeted category; guess loop + streaks.
- Connected multiverse; Devvit Payments monetization.
- Mode B real community theme extraction; Comic/Pixel StyleTemplates.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-01 | App **published** with an app listing on developer.reddit.com | Q1: `devvit publish` flow + review process + timeline risk (the deadline-critical item) |
| SUB-02 | **Public demo post** runs the game, self-explanatory, playable | Q4 (demo post creation/pinning) + D-01 backfill (Q5) + D-08 force-tick (Q6) |
| SUB-03 | Mobile polished (~60fps in post viewport) | Q7 (webview perf constraints + iOS cross-origin rAF throttle) |
| SUB-04 | Onboarding legible (cosmos loop + goal→steer→reveal); cold-start looks intentional | D-01 backfill removes the empty day-1; D-02 coachmark (codebase work, not external research) |
| SUB-05 | Compliant with Devvit Rules; aesthetics read self-authored | Q2 (Devvit rules/compliance checklist + AI-slop angle) |
| SUB-06 | Devpost write-up complete, media gallery + links filled | Q3 (Devpost requirements, deadline, judging) |
</phase_requirements>

## Summary

Phase 5 is a *submission/packaging* phase, not a feature phase: no new gameplay, no new external packages. The dominant external risk is **timing**, not difficulty. Two facts dominate planning:

1. **The publish review timeline is the only un-pinned unknown and it is deadline-critical.** Reddit confirms a Developer-Platform review/approval gate exists for `devvit publish --public`, but Reddit does **not** publish a guaranteed turnaround. [ASSUMED] community signal is "hours to a few days." The deadline is **2026-07-15 18:00 PDT** (VERIFIED on the Devpost). Mitigation is concrete: **publish early, unlisted, then request the public listing with several days of buffer** — and note that the hackathon only requires an *app-listing link*, which an **Unlisted** published app already produces, so a pending public-directory review does not block submission.

2. **Both locked demo-control decisions (D-01 backfill, D-08 force-tick) are FEASIBLE within Devvit's hard limits**, but D-01 needs the right pattern. The verified platform limits are: **30 s max request time, 4 MB max request payload, Redis 500 MB storage + 5 MB max request size, scheduler ≤10 live recurring actions, post data ≤2 KB**. Writing 30 ring records (~25 scalars each, two Redis ops per ring via `writeRing`) is trivially under storage/size limits, but 30 sequential `runTick`-equivalent writes each doing several Redis round-trips plus *creating a reveal post per ring* would blow the 30 s budget and spam 30 pinned posts. **The safe pattern: a backfill that writes rings directly (reuse `writeRing` + the same DayVector→RingRecord build, NOT the full `runTick` reveal side-effects), looped server-side, and if it risks the 30 s window, hand off to a self-requeuing scheduler job (the documented "daisy-chain" pattern with a ~20 s self-imposed cutoff).** D-08 force-tick is a thin mod-menu action that calls `runTick(subId, frontierDay)` directly (or enqueues the existing `tick` task) — no new mechanism.

**Primary recommendation:** Sequence the phase so the *publish-unlisted* step happens in the first wave (de-risk the timeline immediately), build backfill as a direct-ring-write (bypassing `runTick`'s reveal-post side-effect), add force-tick as a direct `runTick` call, and treat the iOS cross-origin-iframe 30fps rAF throttle as a known SUB-03 constraint to design around (the webview pauses/throttles until user interaction and when off-screen).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Publish app + app listing | Devvit CLI / Reddit platform | — | `devvit publish` is a CLI→platform operation; nothing in-repo controls review |
| Demo-post creation + pin | API / Backend (server) | — | `reddit.submitCustomPost` + `post.sticky()` run server-side (`post.ts`) |
| History backfill (D-01) | API / Backend (server) | Database/Storage (Redis) | A mod-menu endpoint loops `writeRing` into Redis; no client involvement |
| Force-tick (D-08) | API / Backend (server) | Scheduler | Mod-menu endpoint invokes `runTick` (or enqueues the `tick` task) |
| Onboarding coachmark (D-02) | Browser / Client (webview) | — | Pure client overlay above the existing canvas/HUD; persists "seen" client-side |
| Mobile 60fps polish (D-05) | Browser / Client (webview) | — | rAF loop + Phaser render are entirely in the post webview iframe |
| Splash card (D-09) | Browser / Client (webview) | — | Inline `splash.html` entrypoint; static teaser, no server call |
| Devpost write-up (D-03/D-06) | Off-platform (Devpost) | — | Document deliverable; no code |

## Standard Stack

No new libraries are introduced in Phase 5. The existing stack is current as of 2026-06-22.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `devvit` (CLI) | 0.13.4 | `upload` / `publish` the app | Current `latest` dist-tag [VERIFIED: npm registry — `npm view devvit dist-tags` → latest 0.13.4] |
| `@devvit/web` | 0.13.4 | Devvit Web server + client primitives (Redis, scheduler, reddit, realtime) | Matches installed version [VERIFIED: npm registry] |
| `@devvit/start` | 0.13.4 | Dev/runtime entry | Matches installed [VERIFIED: npm registry] |
| `phaser` | 4.2.0 | WebGL paint layer (mobile perf surface for SUB-03) | Current `latest` [VERIFIED: npm registry — `npm view phaser version` → 4.2.0] |
| `zod` | 4.4.3 | Boundary validation (menu/scheduler payloads) | Installed; CLAUDE.md mandates `.parse()` at new boundaries |

**Installation:** none — no `npm install` in this phase.

**Note on version drift:** `devvit@next` is `0.13.5-next-...` (2026-06-18) and `devvit@0.13-next` exists. Stay on the pinned `0.13.4` stable for the submission — do NOT bump to a `-next` prerelease (and note: `devvit publish --version` explicitly rejects prerelease versions, see Q1). [VERIFIED: npm registry]

## Package Legitimacy Audit

No external packages are added in Phase 5. The phase is config (`devvit.json` menu items), server endpoints reusing existing modules, client overlay code, and documentation. The installed Devvit stack (`devvit`, `@devvit/web`, `@devvit/start` all 0.13.4) and `phaser` 4.2.0 were re-verified against the npm registry and are the current `latest` releases from Reddit's official scope.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| devvit / @devvit/* 0.13.4 | npm (official `@devvit` / `reddit` scope) | OK (already installed, current latest) | No change |
| phaser 4.2.0 | npm | OK (already installed, current latest) | No change |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Per-Question Findings

### Q1 — Publish / app listing (SUB-01)

**Answer (the flow):**
- `devvit upload` uploads a (by default **private/Unlisted**) build to the App directory; supports `--bump major|minor|patch|prerelease` and `--copyPaste`. [CITED: developers.reddit.com/docs/llms-full.txt]
- `devvit publish` initiates publishing and **prompts for visibility** — choose **Unlisted** (visible only to you / installable by you) or **Public** (visible to all, listed in the App Directory). [CITED: developers.reddit.com/docs/earn-money/.../payments_publish ; developers.reddit.com/docs/llms-full.txt]
- `devvit publish --public` requests a **public App-Directory listing** and **requires a detailed `README.md`** (the README becomes the listing's content). [CITED: developers.reddit.com/docs/guides/launch/launch-guide]
- `devvit publish --version 1.0.1` sets a specific stable version; **prerelease versions are NOT allowed** and `--version` cannot be combined with `--bump`. [CITED: launch-guide]
- The repo's `npm run launch` = `npm run deploy && devvit publish`, where `deploy` = `tsc --build && eslint && devvit upload`. So `launch` already does the type-check + lint + upload + publish chain. [VERIFIED: package.json read]

**Review process:** "Before publishing your app … they undergo a **review and approval process by the Developer Platform team**." Apps must comply with Devvit Guidelines (and the Earn Policy if using payments — not us). [CITED: developers.reddit.com/docs/llms-full.txt]

**App-listing requirements:** a detailed `README.md` (the listing body), plus the app's name/slug (`subcosm-universe`, already created), and — per the App Directory UI — a description, icon/media, and category. The README is the load-bearing required artifact for `--public`. [CITED: launch-guide]

**Timeline (the deadline-critical unknown):** Reddit documents that review *exists* but does **NOT** publish a guaranteed turnaround time. [ASSUMED] from community signal: typically hours to a few days; can be longer near hackathon deadlines when the queue is busy. **Treat as unknown and buffer.**

**PITFALLS / ANTI-PATTERNS:**
- ANTI-PATTERN: leaving the public publish to the final days. If the review queue is slow near the deadline you can miss SUB-01. **Publish early.**
- The hackathon requires an *app-listing link*. An **Unlisted published app still has a listing/link**, and **submission does not require the app to be Public in the directory** — so publish-unlisted first to guarantee you have a valid link, then pursue `--public` with buffer. [ASSUMED — verify: one Devvit hackathon FAQ stated "you do not need to publish to submit," which conflicts with this hackathon's explicit app-listing-link requirement; confirm what link the Games-with-a-Hook judges expect.]
- Do NOT publish a `-next` prerelease version (rejected by `--version`; also unstable for judging).
- The `README.md` must be detailed for `--public` — a stub README can bounce the public listing.

### Q2 — Devvit rules / compliance (SUB-05)

**Answer:** Devvit apps must comply with Reddit's **Developer Terms** and pass **App Review**. Apps must NOT: include explicit/defamatory/hateful/obscene/disparaging/unlawful content; break the law or infringe Reddit's or third parties' IP/privacy rights; violate the User Agreement, Developer Terms, Earn Terms, sitewide rules, Earn Policy, or Reddiquette. **Data restrictions:** must not sell/license/share/commercialize Reddit data, must not use Reddit data to **train ML/AI models**, must not spam (identical/substantially-similar automated posts across subreddits). [CITED: support.reddithelp.com — Developer Platform & Accessing Reddit Data] There is also a **Responsible Builder Policy**. [CITED: support.reddithelp.com/.../Responsible-Builder-Policy]

**Compliance verdict for Subcosm — COMPLIANT:**
- Renders only **deterministic geometry** from ~25 numeric scalars + seed per ring; **no user text is echoed** (the reveal post renders ring geometry + an i18n goal/achieved overlay only — confirmed in `post.ts` / `tick.ts` comments). No content-policy surface.
- Stores **no images**, no PII, does not train models on Reddit data, does not commercialize Reddit data.
- Posts created by the app: the **reveal post is one pinned post per community per day** (gated exactly-once via `revealDone` nx-flag) — not cross-sub spam. The demo backfill (D-01) creates **rings in Redis, not posts**, and the demo/reveal posts are single, intentional posts → not spammy.
- Future monetization is cosmetic-only and out of scope this phase → no Earn Policy surface now.

**PITFALLS / ANTI-PATTERNS:**
- ANTI-PATTERN (spam tripwire): a backfill or force-tick that creates **one reveal post per backfilled day** would generate ~30 pinned posts → reads as spam and clutters the sub. **Backfill must NOT create posts** (rings only); D-08 force-tick creates at most the single normal reveal post. This is also why D-01 must bypass `runTick`'s reveal side-effect (see Q5).
- AI-slop angle (judging, not a hard rule): the rules don't ban AI assistance, but the hackathon explicitly discourages output where "it's obvious the moment we open your app." D-07's bespoke Techno signature (logo cross-flare, curated palette, wide light-sans, SUBCOSM brand mark) is the mitigation — make the look read self-authored. [CITED: Devpost rules]

### Q3 — Devpost submission (SUB-06)

**Answer (VERIFIED from the Devpost):**
- **Deadline: 2026-07-15, 18:00 PDT** (= 21:00 EDT). CONFIRMED — matches the project deadline. [VERIFIED: redditgameswithahook.devpost.com]
- Hackathon window: **June 17 → July 15, 2026.** [VERIFIED]
- **Required submission fields:** (1) **App listing** — link to your app on developer.reddit.com; (2) **Demo post** — link to a subreddit + a public post running your game; (3) *optional* Developer Platform feedback survey (Feedback Award eligibility). [VERIFIED]
- **Prize categories (full pool $40,000):** Best App with a Hook **$15,000**; Best Use of Phaser **$5,000**; Best Use of Retention Mechanics **$3,000**; Best Use of User Contributions **$3,000**; Honorable Mentions $1,000 ×10; Devvit Helper Award $500 ×6; Feedback Awards $200 ×5. [VERIFIED]
- **Judging criteria:** Delightful UX · Polish · Reddit-y (community identity/freshness) · Hook-y (recurring engagement) · Phaser Innovation (Phaser category only). **Judging is primarily based on community play via the demo link** → make the demo self-explanatory. [VERIFIED]
- **Eligibility:** legal age of majority; all countries except standard exceptions. [VERIFIED]
- **Existing projects:** allowed if **significantly updated during the hackathon period.** [VERIFIED]
- **Video:** NOT required. [VERIFIED]
- **Media gallery:** standard Devpost image-gallery rules apply (the draft already notes JPG/PNG/GIF, ≤5 MB, 3:2 — `docs/subcosm.png` is 2000×1333 = 3:2 ✓). [CITED: docs/devpost-submission.md; general Devpost gallery norms — confirm exact constraints in the submission form, ASSUMED on the ≤5 MB/3:2 specifics for THIS hackathon]

**Mapping to D-04 prize targeting:** D-04 targets Best App with a Hook (primary) + Best User Contributions. The "Hook-y" and "Reddit-y" criteria map directly; "Phaser Innovation" only matters for the Phaser category (deferred per D-04). The existing `docs/devpost-submission.md` draft already leads with the emotional hook (D-03) and lists the criteria checklist — it needs the `[TODO]` links/media/numbers filled from the live demo session.

**PITFALLS:**
- The single most-weighted thing is the **demo post itself** ("judging primarily on the demo link") → invest in making the demo self-explanatory (ties to D-01 seed + D-02 onboarding), not in the write-up prose.
- Don't target Best Use of Phaser in the write-up framing (D-04 deferred the shader push); over-claiming Phaser innovation against a strong field is wasted positioning.

### Q4 — Demo post + pinning (SUB-02)

**Answer:** Posts are created server-side via `reddit.submitCustomPost({ subredditName, title, entry, postData })` and pinned via `post.sticky()` — both already implemented in `src/server/core/post.ts` (`createPost` for a fresh post, `createRevealPost` for the pinned reveal). The existing mod-menu `post-create` action (`menu.ts` → `/internal/menu/post-create`) already creates a post and returns a `navigateTo`. `postData` is capped at **2 KB** [VERIFIED limit] — the reveal uses `{ ringIndex }`, well under.

**Best-practice for a self-explanatory demo post:**
- Create the demo post on `subcosm_test_om` (dev sub) for iteration; for the *public submission* demo post, create it on a real public subreddit you moderate.
- Seed history first (D-01 backfill) so the post opens onto a deep, populated universe instead of an empty day-1 (directly serves SUB-04 "cold-start looks intentional").
- The inline splash card (D-09) is the post's default entrypoint (`devvit.json` post.entrypoints.default = `splash.html`, inline) — keep it a fast static teaser + clear "open/play" CTA into `game.html`.

**PITFALLS:**
- The default inline entrypoint is `splash.html` — the splash must be reliable/fast (D-09 forbids a live mini-render there); a heavy inline render would hurt the first impression judges see.
- Pinning: `post.sticky()` pins at position 1; pinning multiple demo/reveal posts competes for the single sticky slot — keep one canonical demo post pinned.

### Q5 — Backfill feasibility (D-01) — FEASIBILITY VERDICT

**Verdict: FEASIBLE, but D-01 must write rings DIRECTLY, not via full `runTick`.**

**Why the limits allow it:** Verified Devvit limits — Redis **500 MB storage** per installation, **5 MB max Redis request size**, Devvit Web **30 s max request time** + **4 MB max payload**. [VERIFIED: developers.reddit.com/docs/llms-full.txt "Limits and Policies"] A ring is ~25 scalars + seed + a small `topThreads` array + `steering`/`outcome` objects, JSON-encoded into a Redis HASH — on the order of a few hundred bytes each. 30 rings ≈ a few KB of storage and far under every size cap. Storage/payload are NOT the constraint.

**The real constraint is the 30 s request budget + side-effects.** `writeRing` does 2 Redis ops per ring (`incrBy` ringCount + `hSet`). Building each DayVector the "real" way (`runTick`) additionally reads ~5 accumulator keys, reads steer aggregate, scores, AND **creates + pins a reveal post per day** — running the full `runTick` 30× would (a) approach/exceed 30 s with ~30×(8+ Redis round-trips + a post-submit API call), and (b) create **30 pinned reveal posts** (spam — see Q2). So the backfill must reuse the *ring build + write* but **skip the reveal side-effect and the accumulator-reset/idempotency dance**.

**Concrete safe pattern (recommended):**
1. New mod-only menu action (`forUserType: "moderator"`) → `/internal/menu/backfill` in `menu.ts`.
2. Server handler: `generateDayVectors(config)` (from `src/sim`) → for each day, build the `RingRecord` exactly as `tick.ts` does (resolve genome, `hashSeed(subId, day, genomeVersion)`, `score(dayVector, genome)`, `RingRecordSchema.parse({...dayVector, outcome, genomeVersion})`) and call `writeRing(subId, record)`. **No reveal post, no counter reset.** This keeps rings **byte-identical** to organically-grown rings (D-01's hard requirement) because they go through the same `RingRecordSchema.parse` + `writeRing` serialization — only the *triggering side-effects* differ, not the stored data.
3. Boundary discipline (CLAUDE.md): `.parse()` the menu request payload (target sub id is the platform-trusted `context.subredditId` — never client-supplied); each ring is parsed via `RingRecordSchema.parse` at the build boundary, matching `tick.ts`/`generator.ts`.
4. **Guard against the 30 s window.** 30 direct `writeRing` calls (60 Redis ops, no post API) should fit comfortably in 30 s, but to be safe: batch the `hSet`s, advance `ringCount` once with a single `incrBy(count, 30)` instead of 30 separate increments, and parallelize with `Promise.all` in chunks. **If profiling shows risk, fall back to the documented self-requeuing scheduler pattern**: the menu action enqueues a one-off `backfill` scheduler job that processes a chunk, checks `Date.now() - start > 20000`, and `scheduler.runJob`s itself with the next cursor ("daisy-chaining"). [CITED: developers.reddit.com migration example — `if (Date.now() - startTime > 20000) … scheduler.runJob({ runAt: new Date(), data: { cursor }})`]
5. Idempotency: a second backfill run would duplicate rings (advancing `ringCount` again). Guard with a `backfillDone:{sub}` nx-flag (mirror the `revealDone` nx pattern in `tick.ts`) or only backfill when `ringCount === 0`.

**PITFALLS / ANTI-PATTERNS:**
- ANTI-PATTERN: looping the full `runTick` 30× → 30 pinned posts (spam) + likely 30 s timeout. **Reuse the ring-build + `writeRing`, not the whole tick.**
- ANTI-PATTERN: 30 separate `incrBy(ringCount,1)` interleaved with reads — wasteful round-trips. Pre-increment once or write rings then set `ringCount` last.
- Determinism trap: the backfill MUST use the same `hashSeed(subId, day, genomeVersion)` and the community's resolved genome so seeded rings reproduce byte-identically (D-01). Do not invent a separate seed.
- Re-run safety: without a guard, re-running doubles `ringCount` and corrupts the index. Add the nx-guard / `ringCount===0` check.

### Q6 — Force-tick (D-08) — FEASIBILITY VERDICT

**Verdict: FEASIBLE and trivial. Call `runTick(subId, day)` directly from the mod-menu action.**

**Two valid invocation paths:**
1. **Direct (recommended for the demo):** mod-menu action → resolve `day = await frontierDay(subId)` (the single day-index source used by the sweeper) → `await runTick(subId, day)`. This synchronously freezes the frontier, writes the ring, AND creates the single pinned reveal post (exactly-once via the existing `revealDone` nx-guard). Returns a toast/`navigateTo`. This is the cleanest "Advance day / trigger tick" button and it exercises the real reveal path for the folded UAT (D-06).
2. **Enqueue the existing task:** mod-menu action → `scheduler.runJob({ name: 'tick', data: { subId, day }, runAt: new Date() })` (matches `devvit.json scheduler.tasks.tick` and the sweeper's own call in `scheduler.ts`). Fire-and-forget; the tick runs out-of-band.

**Recommendation:** use **Direct `runTick`** for the demo control — it's synchronous (immediate visible reveal for the demo), reuses the fully-tested idempotent path, and the existing `revealDone` nx-guard already prevents a double reveal if a real scheduler tick also fires the same day. The scheduler-enqueue path is the right choice only if you need the menu action to return instantly without waiting (not needed at the demo's scale).

**Limits check:** one `runTick` = a handful of Redis ops + one `submitCustomPost` + `sticky()` → well under 30 s. Scheduler "≤10 live recurring actions per installation" [VERIFIED] does NOT constrain this — that cap is for *recurring* tasks; a one-off `runJob` and a direct call are unaffected.

**PITFALLS / ANTI-PATTERNS:**
- Pass the trusted `context.subredditId` as `subId` and resolve `day` via `frontierDay` server-side — never accept a client-supplied day/sub (V4; matches existing boundary discipline).
- `runTick` is idempotent on `lastTickDay` — firing force-tick twice for the same day is a no-op for the ring, and `revealDone` prevents a double reveal. Good: the demo button is safe to mash.
- After a forced tick, the frontier day advances; a subsequent backfill or organic activity must target the new frontier day (don't hardcode a day index in the menu action).

### Q7 — Mobile ~60fps in the post webview (SUB-03)

**Answer / known constraints:**
- The Devvit post webview is a **cross-origin iframe**. The most important external gotcha: **iOS throttles `requestAnimationFrame` to ~30fps in cross-origin iframes** (and in Low Power Mode), and the throttle is **cleared once the user interacts with the iframe.** Browsers also throttle/pause rAF for **off-screen / non-visible** iframes. [CITED: popmotion.io "When iOS throttles requestAnimationFrame to 30fps"; motion.dev "When browsers throttle requestAnimationFrame"]
- Webviews can also **cap at 60fps** even where the same code runs faster in a top-level browser tab — so 60fps is the realistic ceiling, not a floor, on mobile. [CITED: github.com/webview/webview #528]
- Frame-rate stability technique: cap to a target frame duration (≈16.67 ms for 60fps) and skip frames when `delta < target` so animation speed is consistent across device refresh rates. [CITED: motion.dev; xjavascript.com]

**What the codebase already does right (confirmed in PROJECT/REQUIREMENTS, do NOT re-architect):** only the frontier animates; frozen shells bake to a Phaser `RenderTexture`; reused geometry/textures (no per-star realloc); capped resolution/DPR; `prefers-reduced-motion` → static frame. These are exactly the right mitigations (PNT-03/04 complete). Phase 5's D-05 is *profiling + tuning on a real mid-range Android*, not new architecture.

**Concrete SUB-03 guidance for the planner:**
- Design for the **30fps-until-interaction** reality: the splash/first-frame must look good static (it does — D-09 static teaser); don't rely on an entrance animation that the iOS iframe will throttle before the user taps.
- Add a **DPR cap** (e.g. clamp `devicePixelRatio` to ≤2) and a frame-skip guard if not already present, to keep the per-frame cost bounded on mid-range Android.
- Pause/idle the rAF loop when the document is hidden (`visibilitychange`) — the browser will throttle it anyway, but explicit pausing avoids wasted work and saves battery.
- Touch targets (D-05 second priority): scrub + nudge controls need ≥44 px hit areas in the post viewport; verify no clipping at the post-viewport size.

**PITFALLS / ANTI-PATTERNS:**
- ANTI-PATTERN: measuring fps in a desktop browser tab and assuming it holds — the cross-origin iframe + mobile GPU is a different regime. **Profile on the real device** (D-05 mandates this; the deferred UAT D-06 is the vehicle).
- ANTI-PATTERN: an autoplay intro animation as the first thing judges see on iOS — it'll run at 30fps until they tap, reading as janky. Lead with the static teaser.
- Don't fight the 60fps webview cap by uncapping rAF — target a stable 60 (or graceful 30), not a higher number.

## Decisions Feasibility (summary)

| Decision | Verdict | Concrete safe pattern |
|----------|---------|------------------------|
| **D-01 backfill** | ✅ FEASIBLE | Mod-menu `/internal/menu/backfill` → `generateDayVectors` → per-day build RingRecord exactly like `tick.ts` (same `hashSeed` + genome + `RingRecordSchema.parse`) → `writeRing`. **Skip reveal-post + counter-reset** (no spam, fits 30 s). Pre-increment `ringCount` once or write-then-set. Add nx-guard / `ringCount===0` re-run guard. If 30 s at risk, daisy-chain via a self-requeuing scheduler job (20 s cutoff). |
| **D-08 force-tick** | ✅ FEASIBLE (trivial) | Mod-menu `/internal/menu/force-tick` → `day = frontierDay(subId)` → `runTick(context.subredditId, day)` directly (synchronous, single reveal via existing `revealDone` nx-guard). Idempotent; safe to re-fire. Scheduler-enqueue path is the alt only if instant return is needed. |

Neither decision needs to change. Both reuse existing, tested code paths; the only nuance is D-01 must bypass `runTick`'s reveal side-effect.

## Common Pitfalls (consolidated for the planner's verification steps)

### Pitfall 1: Publish-review timeline missed near the deadline
**What goes wrong:** `devvit publish --public` sits in review past 2026-07-15. **Avoid:** publish *Unlisted* early (first wave), confirm the listing link works, then request `--public` with multi-day buffer. **Warning sign:** no listing link by the second-to-last week.

### Pitfall 2: Backfill or force-tick spams pinned posts
**What goes wrong:** reusing full `runTick` per backfilled day creates ~30 pinned reveal posts → spam (Q2 content-policy tripwire) + 30 s timeout. **Avoid:** backfill writes rings only; force-tick creates exactly one reveal (existing nx-guard).

### Pitfall 3: Non-deterministic / non-byte-identical seeded rings
**What goes wrong:** backfill invents its own seed or skips genome resolution → rings differ from organic ones, violating D-01. **Avoid:** identical `hashSeed(subId, day, genomeVersion)` + community genome + `RingRecordSchema.parse`.

### Pitfall 4: Re-running backfill corrupts `ringCount`
**What goes wrong:** second backfill doubles `ringCount`, rings mis-indexed. **Avoid:** nx-guard / `ringCount===0` check before backfilling.

### Pitfall 5: iOS iframe throttles the first impression to 30fps
**What goes wrong:** an autoplay intro animation judges see on iOS runs at 30fps until they tap. **Avoid:** static teaser first (D-09); design entrance for post-interaction.

### Pitfall 6: Heavy inline splash
**What goes wrong:** the default inline `splash.html` entrypoint does a live render → slow first paint. **Avoid:** static teaser + CTA only (D-09).

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `devvit upload` then separate publish flow | `devvit publish` (interactive visibility) / `devvit publish --public --version X.Y.Z` | Current CLI; prerelease versions rejected for `--version` [CITED: launch-guide] |
| Long-running menu action does all work inline | Self-requeuing scheduler "daisy-chain" with ~20 s cutoff for >30 s work | Documented Devvit migration pattern [CITED] |

**Deprecated/outdated:** none relevant to this phase; the repo is on current `0.13.4`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Public-listing review for `devvit publish --public` typically takes hours-to-days, no guaranteed SLA | Q1 | HIGH — if review is slow near the deadline, SUB-01 at risk. Mitigation: publish Unlisted early. |
| A2 | An **Unlisted** published app produces a valid app-listing link that satisfies the hackathon's "app listing" requirement | Q1 | MEDIUM — if judges require a Public-directory listing, must finish public review in time. **Verify in the Devpost rules / r/devvit.** |
| A3 | One Devvit-hackathon FAQ ("don't need to publish to submit") may not apply to Games-with-a-Hook (which explicitly requires an app-listing link) | Q1 | MEDIUM — clarify which link this hackathon expects. |
| A4 | Devpost media-gallery specifics (≤5 MB, 3:2) apply to THIS hackathon | Q3 | LOW — cosmetic; confirm in the submission form. |
| A5 | 30 direct `writeRing` calls fit within the 30 s request budget (no post side-effects) | Q5 | LOW-MEDIUM — profile; daisy-chain fallback documented if not. |
| A6 | App-listing UI requires description + icon/media + category beyond the README | Q1 | LOW — standard App Directory fields; confirm at publish time. |

## Open Questions

1. **Does the hackathon accept an Unlisted app's listing link, or must the app be Public in the directory?**
   - Known: submission requires "a link to your app on developer.reddit.com"; Unlisted apps have a listing/link.
   - Unclear: whether judges require Public directory status.
   - Recommendation: publish Unlisted early to guarantee a link; pursue `--public` with buffer; confirm via the Devpost rules / r/devvit.
2. **Actual public-review turnaround in July 2026 (queue load near deadline).**
   - Recommendation: publish at the start of the phase; if review stalls, the Unlisted link is the fallback for submission.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `devvit` CLI | `upload` / `publish` (SUB-01) | ✓ (devDep + installed `devvit@0.13.4`) | 0.13.4 | — |
| Logged-in Reddit dev account | publish + demo post | ✓ u/Aware_Picture1973 | — | `devvit login` |
| A real **public** subreddit you moderate | public demo post (SUB-02) | ✗ (only `subcosm_test_om` test sub confirmed) | — | Create/own a public sub for the submission demo |
| Real **mid-range Android device** | SUB-03 on-device perf profiling (D-05) + folded UAT (D-06) | ✗ (not confirmed) | — | A second mobile client at minimum; physical device strongly preferred |

**Missing dependencies with no fallback:** none hard-blocking, but **a public subreddit + a real mid-range Android** are needed to fully satisfy SUB-02/SUB-03/D-05/D-06 — the planner should make acquiring these explicit early tasks (and possibly `checkpoint:human-verify`).

## Security Domain

Security enforcement is enabled (`security_enforcement: true`, ASVS L1). Phase 5 adds two mod-only server endpoints (backfill, force-tick) and a client overlay — the boundary surface is small and mirrors existing patterns.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Reddit handles auth; mod-gating is via `forUserType: "moderator"` in `devvit.json` |
| V4 Access Control | **yes** | New menu actions MUST be `forUserType: "moderator"` (backfill + force-tick are mod-only, D-01/D-08). Server uses trusted `context.subredditId`, never client-supplied sub/day. |
| V5 Input Validation | **yes** | `zod` `.parse()` the menu/scheduler request payloads server-side (CLAUDE.md mandate). `day` resolved server-side via `frontierDay`. |
| V6 Cryptography | no | Seed is FNV-1a determinism hash, not security crypto — no change |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-mod triggers backfill/force-tick | Elevation of Privilege | `forUserType: "moderator"` on the menu item; do not expose these as public API routes |
| Client supplies arbitrary sub/day to force-tick | Tampering | Use `context.subredditId` + `frontierDay(subId)` server-side; never trust client `day`/`subId` |
| Malformed scheduler/menu payload crashes handler | Denial of Service | `TickJobSchema`/new schema `.parse()` in try/catch, return 200, idempotent (existing pattern in `scheduler.ts`) |
| Echoing user text into a post (content policy) | Information Disclosure / policy | Posts render only deterministic geometry + i18n overlay — no user text echoed (already enforced; keep it so) |

## Sources

### Primary (HIGH confidence)
- Devpost — Reddit's Games with a Hook (deadline, required fields, prizes, judging, eligibility, video-not-required) — https://redditgameswithahook.devpost.com/ [VERIFIED]
- Reddit Developer docs (Context7 `/websites/developers_reddit`) — `devvit upload` / `devvit publish` / `--public` / `--version` / review-process / Limits & Policies (30 s, 4 MB, Redis 500 MB / 5 MB, scheduler ≤10, postData 2 KB) / batch Redis / scheduler daisy-chain [CITED]
- npm registry — `devvit` 0.13.4 (latest), `@devvit/web` 0.13.4, `phaser` 4.2.0 (`npm view`) [VERIFIED]

### Secondary (MEDIUM confidence)
- support.reddithelp.com — Developer Platform & Accessing Reddit Data; Responsible Builder Policy (content/data rules) [CITED]

### Tertiary (LOW confidence — flagged in Assumptions Log)
- WebSearch — iOS cross-origin-iframe rAF 30fps throttle (popmotion.io, motion.dev, github.com/webview/webview#528) [CITED, third-party]
- WebSearch — publish-review timeline (no authoritative SLA found) [ASSUMED]
- WebSearch — "don't need to publish to submit" appeared in a *different* hackathon's FAQ; conflicts with this hackathon's app-listing-link requirement [ASSUMED — verify]

## Metadata

**Confidence breakdown:**
- Devvit platform limits (backfill/force-tick feasibility): HIGH — VERIFIED limits + existing tested code paths.
- Devpost requirements & deadline: HIGH — VERIFIED on the live Devpost.
- Devvit publish flow + rules: MEDIUM-HIGH — CITED from official docs; review *timeline* is the one LOW item.
- Mobile 60fps webview constraints: MEDIUM — CITED third-party (the iOS-iframe behavior is well-documented but not Devvit-specific); D-05 mandates real-device profiling.

**Research date:** 2026-06-22
**Valid until:** ~2026-07-15 (the hackathon deadline; Devpost rules + Devvit 0.13.x stable through the submission window — re-check the publish review timeline if not published by early July).
