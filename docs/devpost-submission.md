# Subcosm — Devpost Submission (DRAFT)

> **Status:** Near-final for "Reddit's Games with a Hook" Hackathon. App `subcosm-universe` v0.0.4 (unlisted) submitted to Reddit app-review on 2026-06-22 — listing https://developers.reddit.com/apps/subcosm-universe. The narrative + build section are final and reconciled with the shipped engine. **Only three things remain, all gated on the approval email → demo pass:** the live "Try it out" links, the gameplay screenshots, and the one measured on-device fps figure. Submission deadline: **July 15, 2026, 6:00 PM PDT.**

---

## About the project

### Inspiration

We kept coming back to one question: *what did our community become overnight?* Subreddits generate an enormous amount of activity every single day, and then it scrolls away forever. We wanted to turn that fleeting activity into something **persistent, legible, and beautiful** — a single shared artifact that a community grows together, the way an agate, a tree ring, or a coral grows: layer by layer, each layer a record of the conditions that made it.

That gave us **Subcosm** — *a universe grown from your community*. r/place energy, but **biographical instead of spatial**: not where everyone clicked, but *who your community was, day after day.*

### What it does

Each subreddit grows **one shared cosmos** from its own daily activity. **Depth is time:** a glowing genesis core (install day) sits at the center, and **each day adds a concentric shell of stars** synthesized from that day's posts, comments, contributors, and conflict. The outermost shell is the live **frontier** that fills during the day and **freezes forever at the daily tick** — so every morning the community wakes up to *what their universe became overnight.*

- **Activity is the texture, not a parameter:** posts → stars, big threads → bright clusters, contributors → density, conflict → red turbulence. A quiet day is sparse; a drama day burns red; an AMA day blooms with a few huge clusters.
- **Travel through time:** a depth scrubber and zoom let you fly inward through every shell back to the genesis core — the community's whole history in one image.
- **Shape today:** players nudge the live frontier (spread / symmetry / hue). Nudges bias the *mean* of a parameter — they never dictate the result, so it stays a shared organism, not a single user's drawing.
- **One engine, many worlds:** behaviour (`Genome`) and look (`StyleTemplate`) are **data, not code**, so the same engine renders provably different cosmoses per community.

**The daily game (the hook).** Every day the community gets a shared **goal** — a "genome quest" like *grow a symmetric spiral*, *tame the conflict-red*, or *ignite a rare twin-star*. Players spend a limited budget of **nudges** to steer the live frontier toward it (and call how the day will go); **overnight the frontier freezes and the reveal resolves the goal** — a success leaves a **permanent reward star** in that ring, visible forever. Steering only biases the odds, never dictates the outcome, so it stays a *shared* organism, not one player's drawing. That loop — *set a goal → shape it together → reveal overnight* — is the retention hook, and it's literally built from the community's own activity.

### How we built it

The heart is a **pure, deterministic rendering engine** with a strict typed seam:

\\( \text{synthesize}(\text{DayVector},\, \text{Genome}) \rightarrow \text{Scene} \quad\text{then}\quad \text{paint}(\text{Scene},\, \text{StyleTemplate}) \rightarrow \text{pixels} \\)

- **Functional core, imperative shell.** Synthesis is style-agnostic; paint never touches raw data; the camera never mutates the scene. Reddit/Devvit code is isolated in its own layer and attaches at a single seam.
- **Determinism by construction.** Every shell is reproducible from its day vector and a seed, with a seeded `mulberry32` PRNG and a fixed value-consumption order. The per-day seed is the FNV-1a hash \\( s = \text{hash}(\text{subId},\, \text{day},\, \text{genomeVersion}) \\) — seeded from the day, never the array index, so it survives out-of-order Redis reads. Shells are laid out with a **clamped minimum-gap** spacing (each shell keeps a guaranteed angular/radial gap from the next) rather than a geometric `0.85^i` falloff, so even the oldest rings stay individually legible toward the core instead of collapsing into a central blob. Same inputs → byte-identical scene on every device.
- **Zod as the single source of truth.** All four contracts (`DayVector`, `Scene`, `Genome`, `StyleTemplate`) are Zod schemas; TypeScript types are inferred from them, and data is validated only at system boundaries.
- **Simulator first.** We built a data simulator that generates realistic `DayVector[]` (growth, busy/quiet days, a drama spike, an AMA day, a cold-start day-1) so we could tune the data→visuals mapping with **zero platform risk** before wiring Reddit. The simulator's schema *is* the contract the real collector fills.
- **Mobile-first rendering with Phaser.** The paint layer is built on **Phaser** (WebGL): frozen shells bake to a `RenderTexture` (only the live frontier re-renders), geometry/textures are reused instead of per-star reallocation, and resolution is capped to hold ~60 fps in the Reddit post viewport. Synthesis stays render-agnostic, so Phaser is a swappable paint adapter behind the `Scene` seam.

The build is real and green: the engine and contracts ship with a full unit suite (**276 tests**, `tsc --noEmit` + lint + build all clean), the ESLint determinism boundary keeps `Math.random` and Devvit imports out of `src/engine/`, and the live game is wired end-to-end on Devvit — Reddit triggers aggregate into Redis, an hourly UTC sweeper freezes each community's frontier at its local midnight, the tick scores the day against its goal and publishes a pinned reveal post, and a realtime channel propagates live nudges (with a reload-reconciliation fallback). One concentric shell is added per day; only the live frontier animates while every frozen shell is baked once to a Phaser `RenderTexture`, holding the 60 fps target in the post viewport.

`[Pending on-device UAT — fill the one measured number: sustained fps on a mid-range Android during the live demo. Architecture above is verified; the device figure comes from the demo pass.]`

### Challenges we faced

- **Determinism is fragile.** A single `Math.random()` anywhere in the engine silently breaks reproducibility across clients — we ban it in the engine with ESLint and verify with a snapshot test.
- **Reddit has no vote trigger.** There's no score-delta event, so the "conflict" signal can't be streamed — it's a composite derived from comment events plus a tick-time score snapshot.
- **The scheduler is UTC-only.** Per-community day boundaries are computed in an hourly sweeper using IANA time zones, with deterministic `hash(subId) % 60` minute jitter.
- **Mobile WebGL performance.** Re-rendering every star each frame tanks the frame rate; baking frozen shells to a Phaser `RenderTexture` and reusing geometry (so only the live frontier animates) is part of the first implementation, not a later optimization.
- **Avoiding "AI slop."** The hardest aesthetic goal: look genuinely self-authored, not a generic neon fractal. We anchor the visual grammar to natural references (agate, tree rings, coral).

### What we learned

- A **typed seam** between *what the data means* and *how it looks* is what makes a real template engine — adding a new style or genome becomes one data file, zero engine changes.
- **Parse at the boundary, trust types inside.** Validating once at the edges (and never in the render loop) keeps the hot path allocation-free.
- A lot about the **Devvit platform's real surface** — triggers, UTC scheduling, Redis without key-scan, realtime channel naming — which shaped the architecture before we wrote platform code.

### What's next

- Deeper game layers: a daily **prediction + streaks**, and a **collection** of rare overnight mutations.
- More flagship styles (Comic, Pixel) — each is pure data on the same engine.
- Rare overnight mutations, the full signal→parameter genome matrix, and an advanced fbm/WebGL **shader pass** on top of the Phaser renderer.
- Optional, fair **free-to-play** extras via Reddit Gold — cosmetics, collection, supporter badges. Never pay-to-win: the shared community outcome is never for sale.
- A **connected multiverse**: subreddits as galaxies that owners can opt-in link into shared "quadrants," with graphical travel between them.

---

## Built with

`typescript` · `phaser` · `webgl` · `vite` · `vitest` · `zod` · `devvit` · `reddit-developer-platform` · `redis` · `realtime` · `mulberry32` · `html5`

**Did you use Phaser?** → **Yes.** Phaser (WebGL) is the rendering layer that paints the universe; the deterministic synthesis engine is render-agnostic behind the `Scene` seam.

---

## Prize categories

- **Primary — Best App with a Hook.** The daily *set a goal → shape it together → reveal overnight* loop is the hook: a shared genome quest, a limited nudge budget, and an irreversible overnight freeze that leaves a permanent reward star. The artifact is biographical and persistent, so there's a reason to come back every morning.
- **Secondary — Best User Contributions.** The cosmos is built *entirely* from the community's own activity (posts, comments, contributors, conflict) and shaped live by many players' nudges that bias the mean without any single user dictating the outcome — a genuinely collective artifact, not one person's drawing.

*(Phaser is used as the renderer — see "Built with" — but the submission is framed on the hook + collective-contribution categories, not Best Use of Phaser.)*

---

## "Try it out" links

- **App listing (developers.reddit.com):** https://developers.reddit.com/apps/subcosm-universe *(live; goes installable once review is approved)*
- **Demo post (public subreddit running the game):** `[TODO — required; judging is primarily based on this — fill after install on the demo sub]`
- **Source code:** https://github.com/pikespeak/subcosm *(open source, BSD-3-Clause)*

---

## Project media

- **Image gallery (JPG/PNG/GIF, ≤5 MB, 3:2):**
  - `docs/subcosm.png` — logo / key art (2000×1333 = 3:2 ✓)
  - `[TODO: gameplay screenshots — genesis core, a dense vs quiet shell, the frozen-overnight reveal, the depth scrubber, two genome presets side by side]`
- **Video demo:** none (optional; not provided).

---

## Pre-submission checklist (hard requirements)

- [ ] App published + **app listing link** on developer.reddit.com
- [ ] **Public demo post** on a subreddit, game running and self-explanatory (judged primarily on this)
- [ ] Mobile experience polished (bonus points)
- [ ] Not obviously AI-generated; experience sells itself on the demo link
- [ ] Compliant with Devvit Rules
- [ ] (Optional) Developer satisfaction survey → Feedback Award eligibility
