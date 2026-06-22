# Subcosm — *a universe grown from your community*

**What did our community become overnight?**

Subcosm turns a subreddit's everyday activity into one shared, persistent **cosmos** — a single beautiful artifact the whole community grows together, the way a tree ring or an agate grows: layer by layer, each layer a record of the day that made it. It's r/place energy, but **biographical instead of spatial** — not *where* everyone clicked, but *who your community was, day after day.*

## What it does

Each subreddit grows **one shared cosmos** from its own daily activity. **Depth is time:** a glowing genesis core (install day) sits at the center, and **each day adds a concentric shell of stars** synthesized from that day's posts, comments, contributors, and conflict. The outermost shell is the live **frontier** that fills during the day and **freezes forever at the overnight tick** — so every morning the community wakes up to what their universe became.

- **Activity is the texture, not a setting:** posts → stars, big threads → bright clusters, contributors → density, conflict → red turbulence. A quiet day is sparse; a drama day burns red; an AMA day blooms with a few huge clusters.
- **Travel through time:** a depth scrubber and zoom fly you inward through every shell back to the genesis core — the community's whole history in one image.
- **Shape today:** players spend a limited budget of **nudges** to steer the live frontier (spread / symmetry / hue). Steering biases the *odds* — it never dictates the result, so the cosmos stays a shared organism, not one person's drawing.

## The daily game (the hook)

Every day the community gets a shared **goal** — a "genome quest" like *grow a symmetric spiral*, *tame the conflict-red*, or *ignite a rare twin-star*. Players steer the live frontier toward it through the day; **overnight the frontier freezes, the day is scored against the goal, and a pinned reveal post shows what the universe became** and whether the goal was achieved. A success leaves a **permanent reward star** in that ring — visible forever when you scrub back to it.

Set a goal → shape it together → reveal overnight. That loop is the retention hook, and it's literally built from the community's own activity.

## How it's built

The heart is a **pure, deterministic rendering engine** behind a strict typed seam: `synthesize(DayVector, Genome) → Scene`, then `paint(Scene, StyleTemplate) → pixels`, with an independent camera.

- **Deterministic by construction.** Every shell is reproducible from its day's data + a seed (a seeded `mulberry32` PRNG with a fixed consumption order), so the same inputs render an identical cosmos on every device — server and client agree without shipping a single image.
- **No stored images.** A day is persisted as ~25 scalars + a seed per ring; the universe is *recomputed*, never stored as pixels.
- **Behaviour and look are data, not code.** `Genome` (behaviour) and `StyleTemplate` (look) are config, so one engine renders provably different cosmoses per community — a new world is a data file, zero engine changes.
- **Zod as the single source of truth.** The four contracts (`DayVector`, `Scene`, `Genome`, `StyleTemplate`) are Zod schemas; TypeScript types are inferred from them and data is validated only at boundaries.
- **Mobile-first paint.** The paint layer uses Phaser (WebGL): frozen shells bake to a render texture so only the live frontier redraws each frame, geometry is reused instead of reallocated per star, and resolution is capped to hold a smooth frame rate in the Reddit post viewport. Synthesis stays render-agnostic, so paint is a swappable adapter behind the `Scene` seam.

Built on [Devvit](https://developers.reddit.com/) (Reddit's developer platform), with [Vite](https://vite.dev/), [Phaser](https://phaser.io/), [Hono](https://hono.dev/), and TypeScript.

## Commands

- `npm run dev` — develop live on Reddit (`devvit playtest`)
- `npm run build` — build the client + server projects
- `npm run deploy` — type-check + lint, then upload a new version (`devvit upload`)
- `npm run launch` — deploy, then publish for review (`devvit publish`)
- `npm run login` — log the CLI into Reddit
- `npm run type-check` — type-check the workspace
- `npm test` — run the test suite (Vitest)
