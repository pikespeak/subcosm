---
phase: 03-devvit-scaffold-data-layer
plan: 01
status: complete
requirements: [DEV-01, DEV-02]
key_files:
  created:
    - src/server/core/redisKeys.ts
    - src/server/contracts/triggers.ts
  modified:
    - src/client/game.ts
    - src/client/game.html
    - src/client/game.css
    - src/server/routes/triggers.ts
    - devvit.json
  deleted:
    - src/client/scenes/Boot.ts
    - src/client/scenes/Preloader.ts
    - src/client/scenes/MainMenu.ts
    - src/client/scenes/Game.ts
    - src/client/scenes/GameOver.ts
checkpoint: human-verify (device + playtest) — APPROVED
---

# Plan 03-01 Summary — Wave-0 De-risking Spike

The thinnest end-to-end slice that resolved the three Phase-3 pre-work blockers on a real subreddit (`r/subcosm_test_om`, `devvit playtest` v0.0.1.1) + a physical iPhone, BEFORE building the data layer on an unproven render path.

## What was built (code, gates green)
- `src/server/core/redisKeys.ts` — central `organism:{sub}:*` key-builder (counter / contributors / threads / ringCount / ring / config / registry / lastTickDay). The single key seam — no ad-hoc strings, no `redis.keys`/scan.
- `src/server/contracts/triggers.ts` — tolerant `.passthrough()` Zod schemas for the two create-trigger payloads (`z.infer`, no hand interfaces). Kept tolerant by design; 03-02 tightens them with the now-confirmed shapes below.
- `src/client/game.ts` — replaced the boilerplate Phaser demo (Boot/Preloader/MainMenu/Game/GameOver, `#028af8`) with a `render()`-backed cosmos mount STUB (mirrors `cosmos-dev/main.ts`, fixed Scene, no dev harness). The deleted scenes are gone from the shipped bundle.
- `devvit.json` — declared `onPostCreate`/`onCommentCreate`/`onAppInstall` → `/internal/triggers/*`; handlers Zod-parse + log the payload shape.
- Gates: `npm test` 76 passed · `tsc --build` (server+client+tests) exit 0 · `npm run build` ok · `npm run lint` ok.

## The three blocker verdicts — ALL RESOLVED

### Blocker 1 — WebGL/Phaser in the Reddit post iframe on mobile → ✅ WORKS (no fallback needed)
Verified on a physical iPhone via `devvit playtest`: the Subcosm Scene (glowing genesis core + concentric shells + purple nebula + frontier ring on black) renders natively in the post webview. **The Canvas2D fallback is NOT required** — the WebGL render path is confirmed for the post viewport on mobile. This was the single biggest risk of Phase 3 (RESEARCH OQ1/A1) and it is cleared positively. (Splash `game.html` first-frame is still the Devvit boilerplate — splash theming is a later UI surface, out of Wave-0 scope.)

### Blocker 2 — real trigger payload shapes (RESEARCH OQ2/A2) → ✅ CONFIRMED (canonical for 03-02)
Captured live from the playtest log. **03-02 must build its counters + conflict proxies on these exact shapes:**

**`onPostCreate`** — `{ author, post, subreddit, type:"PostCreate" }`
- `post.id` = `t3_…` · `post.subredditId` = `t5_…` · `post.authorId` = `t2_…` · `post.createdAt` (unix ms)
- `subreddit.id` = `t5_…`, `subreddit.name` = `subcosm_test_om` · `author.id` = `t2_…`

**`onCommentCreate`** — `{ author, comment, post, subreddit, type:"CommentCreate" }`
- `comment.id` = `t1_…`
- `comment.postId` = `t3_…` → the **thread root** (use for the top-threads ZSET)
- `comment.author` = `t2_…` (a STRING id; distinct from the nested `author.id`) → use for the unique-contributors SET
- `comment.subredditId` = `t5_…`
- **`comment.parentId`** — the reply-depth discriminator:
  - **top-level comment** → `parentId` is the POST → starts with **`t3_`**
  - **reply** → `parentId` is another COMMENT → starts with **`t1_`**

**→ Reply-depth proxy rule (DEV-03 / D-02):** `comment.parentId.startsWith('t1_')` = a reply (deeper thread = contention signal); `t3_` = a top-level comment. This is the concrete signal the conflict composite normalizes (reply-ratio).

**Edge note for 03-02:** the app's OWN scaffold post fired `onPostCreate` with `author.id = t2_2gtt4hhdg3` (the app account `subcosm-universe`). Consider skipping the app's own auto-created post when counting community activity.

### Blocker 3 — devvit.json conformance on a real deploy → ✅ CLEAN
`devvit playtest` built, uploaded (12 WebView assets), and installed at v0.0.1.1 with **no config errors**. Both triggers fire; `game.html` loads in the post; the modern **fetch-based webview model is confirmed** (the client will call `/api/...` same-origin — NO `postMessage`, per RESEARCH). Only a benign `inlineDynamicImports deprecated` Vite/Rollup build warning (build tooling, not Devvit) — noted, non-blocking.

## Determinism / boundary
- `src/engine/` stays Devvit-free; `game.ts` mounts via the `render()` seam only. Trigger schemas are `z.infer`, parsed at the boundary. Schemas stay tolerant `.passthrough()` until 03-02 tightens them with the confirmed fields above.

## Tooling fix (regression from Phase 2.1, resolved here)
`npm run type-check` (`tsc --build`) was red on master: the Phase-2.1 VIS-DENSITY test made `synthesis.test.ts` import `sim/generator` + the baseline JSON, which `tools/tsconfig.engine-tests.json` didn't reference. Fixed by adding a `tsconfig.sim.json` project reference + an explicit `../tests/**/*.json` include. Full type-check is green again (commit `a4b5215`).

## Commits
`4bd8619` (RED) · `2b18d6e` (keys+schemas) · `c204560`+`db88769` (game.ts mount) · `14b9860` (triggers) · `a4b5215` (tsconfig fix) · `<this>` (summary + tracking).

## Next
03-02 (Wave 2): triggers → Redis daily counters (SET/ZSET) + the pure conflict composite — built directly on the confirmed payload shapes above. The live playtest can be stopped now; 03-02 is server/Redis code + unit tests and does not need a live device until its own verification.
