# Subcosm — Devpost Submission (DRAFT)

> **Status:** DRAFT for "Reddit's Games with a Hook" Hackathon. Story is written from the vision + research; every `[TODO]` (links, screenshots, final build details, real numbers) is filled in once the app is built and the demo post is live. Submission deadline: **July 15, 2026, 6:00 PM PDT.**

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

### How we built it

The heart is a **pure, deterministic rendering engine** with a strict typed seam:

\\( \text{synthesize}(\text{DayVector},\, \text{Genome}) \rightarrow \text{Scene} \quad\text{then}\quad \text{paint}(\text{Scene},\, \text{StyleTemplate}) \rightarrow \text{pixels} \\)

- **Functional core, imperative shell.** Synthesis is style-agnostic; paint never touches raw data; the camera never mutates the scene. Reddit/Devvit code is isolated in its own layer and attaches at a single seam.
- **Determinism by construction.** Every shell is reproducible from its day vector and a seed, with a seeded `mulberry32` PRNG and a fixed value-consumption order. The per-day seed is \\( s = \text{hash}(\text{subId},\, \text{day},\, \text{genomeVersion}) \\), and shells are laid out at radius
$$ r_i = R_{\max}\cdot 0.85^{\,i} $$
so the same inputs always produce a byte-identical scene on every device.
- **Zod as the single source of truth.** All four contracts (`DayVector`, `Scene`, `Genome`, `StyleTemplate`) are Zod schemas; TypeScript types are inferred from them, and data is validated only at system boundaries.
- **Simulator first.** We built a data simulator that generates realistic `DayVector[]` (growth, busy/quiet days, a drama spike, an AMA day, a cold-start day-1) so we could tune the data→visuals mapping with **zero platform risk** before wiring Reddit. The simulator's schema *is* the contract the real collector fills.
- **Mobile-first rendering.** Canvas 2D with bake-on-freeze caching (only the live frontier animates), pre-cached gradients, and a capped device-pixel-ratio to hold 60 fps in the Reddit post viewport.

`[TODO: replace with the real build narrative + final numbers once implemented — e.g. measured fps on device, ring count, draw-call budget.]`

### Challenges we faced

- **Determinism is fragile.** A single `Math.random()` anywhere in the engine silently breaks reproducibility across clients — we ban it in the engine with ESLint and verify with a snapshot test.
- **Reddit has no vote trigger.** There's no score-delta event, so the "conflict" signal can't be streamed — it's a composite derived from comment events plus a tick-time score snapshot.
- **The scheduler is UTC-only.** Per-community day boundaries are computed in an hourly sweeper using IANA time zones, with deterministic `hash(subId) % 60` minute jitter.
- **Mobile Canvas 2D has performance cliffs.** Per-star gradients and uncapped DPR will tank the frame rate; the cache and DPR cap are part of the first implementation, not a later optimization.
- **Avoiding "AI slop."** The hardest aesthetic goal: look genuinely self-authored, not a generic neon fractal. We anchor the visual grammar to natural references (agate, tree rings, coral).

### What we learned

- A **typed seam** between *what the data means* and *how it looks* is what makes a real template engine — adding a new style or genome becomes one data file, zero engine changes.
- **Parse at the boundary, trust types inside.** Validating once at the edges (and never in the render loop) keeps the hot path allocation-free.
- A lot about the **Devvit platform's real surface** — triggers, UTC scheduling, Redis without key-scan, realtime channel naming — which shaped the architecture before we wrote platform code.

### What's next

- More flagship styles (Comic, Pixel) — each is pure data on the same engine.
- Rare overnight mutations, the full signal→parameter genome matrix, and an fbm/WebGL shader layer (our Phaser target).
- A **connected multiverse**: subreddits as galaxies that owners can opt-in link into shared "quadrants," with graphical travel between them.

---

## Built with

`typescript` · `vite` · `vitest` · `zod` · `canvas-2d` · `devvit` · `reddit-developer-platform` · `redis` · `realtime` · `mulberry32` · `html5` · `phaser` *(planned, shader layer)*

---

## "Try it out" links

- **App listing (developer.reddit.com):** `[TODO — required for submission]`
- **Demo post (public subreddit running the game):** `[TODO — required; judging is primarily based on this]`
- **Source code (optional):** `[TODO — GitHub link if we open-source]`

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
