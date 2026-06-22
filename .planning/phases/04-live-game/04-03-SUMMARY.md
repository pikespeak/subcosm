---
phase: 04-live-game
plan: 03
subsystem: live-realtime
tags: [realtime, broadcast, subscribe, channel, zod-boundary, reconcile-to-absolute, d-03]
requires:
  - recordNudge atomic budget gate + readSteerAggregate (steer.ts, 04-02)
  - POST /api/steer route + GET /api/organism steer aggregate (D-03b reload SoT, 04-02)
  - render().nudge(param, amount) live frontier mean re-synth (02-05)
  - SteerAggregateSchema / SteerParamEnum shared client-safe contracts (04-02)
  - @devvit/web realtime (connectRealtime/disconnectRealtime client + realtime.send server, 0.13.4)
provides:
  - steerChannel(postId) — colon-free per-post realtime channel name (shared, client + server)
  - SteerMsgSchema / SteerMsg — the realtime broadcast payload (client-safe, safeParsed on receive)
  - server realtime.send broadcast of the new ABSOLUTE aggregate after each accepted nudge (POST /steer)
  - client connectRealtime subscribe + applyAggregatedSteer (reconcile-to-absolute) + disconnectRealtime teardown
affects:
  - plan 04 (reveal post — unaffected; realtime is a live-frontier enhancement only)
tech-stack:
  added: []
  patterns:
    - "Realtime is best-effort, never fatal: a broadcast/connect failure is logged but the steer hash + D-03b reload remain the source of truth (T-04-12 accept-with-fallback)"
    - "Reconcile-to-absolute, not add-delta: receivers nudge the residual (target mean − appliedMean) so viewers converge identically and the acting user never double-applies its own echo"
    - "Untrusted realtime payload boundary: SteerMsgSchema.safeParse on every onMessage; a malformed message is ignored, never thrown on (T-04-09)"
    - "connectRealtime is SYNCHRONOUS (returns Connection) — subscribe is not awaited; disconnectRealtime(channel) on teardown (Connection.disconnect() deprecated)"
    - "Colon ban applies ONLY to realtime channel names (steerChannel whitelists [A-Za-z0-9_-]); Redis keys keep ':' — two separate namespaces, never confused"
    - "Channel name is the single source of truth in shared/channel.ts — client and server build the byte-identical string"
key-files:
  created:
    - src/shared/channel.ts
    - src/shared/channel.test.ts
  modified:
    - src/shared/api.ts
    - src/server/routes/api.ts
    - src/client/game.ts
    - vitest.config.ts
decisions:
  - "The realtime broadcast call site is the POST /api/steer route (it already holds the trusted context.postId), not steer.ts — steer.ts stays the pure persistence service; the route owns context + broadcast (mirrors how GET /organism reads the aggregate at the route)"
  - "The broadcast payload is the ABSOLUTE aggregate {branch,symmetry,hue,count} (re-read via readSteerAggregate after the accepted hIncrBy), NOT the delta — so a receiver reconciles to mean=sum/count and the acting user's own echo is a ~0 residual, no double-apply"
  - "appliedMean (pre-gain per-param mean already applied) is the client reconcile baseline: seeded from the GET /organism load-time aggregate (D-03b), advanced by the acting user's optimistic local nudge, and set to the absolute target on every echo — drift is corrected exactly by reconcile-to-absolute"
  - "The whole realtime layer is OPTIONAL and guarded: a missing context.postId, a connect throw, or a send failure logs and degrades to the locked D-03b fallback (acting-user-local + others-on-reload from plan 02) with NO rewrite — only the broadcast/subscribe wiring is bypassed"
  - "channel.test.ts added to the vitest include allowlist (the runner uses an explicit include list, not a glob — same convention as 04-02's steer.test.ts)"
metrics:
  duration: ~4min
  completed: 2026-06-22
  tasks: 3
  files: 6
status: complete
---

# Phase 4 Plan 03: Realtime Live-Steer Broadcast/Subscribe Summary

Wired the D-03 live-steer realtime path on top of plan 02's acting-user + reload slice: a colon-free per-post channel helper (`steerChannel`, shared so client and server build the identical name), a server `realtime.send` broadcast of the new ABSOLUTE steer aggregate after each accepted nudge, and a client `connectRealtime` subscribe that reconciles OTHER viewers' frontiers to that absolute mean near-real-time. Every onMessage payload is `safeParse`d + reconciled-to-absolute (never delta-added), so viewers converge identically without the acting user double-applying its own echo. The entire layer is best-effort and guarded — if realtime flakes on mobile, disabling the wiring degrades gracefully to the locked D-03b fallback (others-on-reload via `GET /organism`) with no rewrite. The on-device two-client (incl. mobile) `devvit playtest` verification (research risk D-03a) is **auto-approved under this run's auto-mode and DEFERRED to UAT — it was NOT performed on a device here** (see Checkpoint Handling below).

## What Was Built

**Task 1 — Colon-free channel helper + realtime message schema + server broadcast** (`ff397b3`)
- `src/shared/channel.ts`: `steerChannel(postId)` returns `subcosm-steer-${postId}` with any non-`[A-Za-z0-9_-]` char replaced by `-` — guaranteed colon-free (LIVE-01). Client-safe (pure string math, zero imports), so client + server build the byte-identical name.
- `src/shared/channel.test.ts`: no `:` for a `t3_…` id; the clean-thing-id passthrough name; a stray-colon input rewritten to `-`; deterministic.
- `src/shared/api.ts`: `SteerMsgSchema = z.object({ branch, symmetry, hue, count })` + `SteerMsg` `z.infer` — the realtime payload (absolute sums + count, plain numbers = a valid `JsonValue`), client-safe (zod only).
- `src/server/routes/api.ts`: `POST /steer` now imports `realtime` (`@devvit/web/server`) + `steerChannel`. On an ACCEPTED nudge it re-reads the new aggregate (`readSteerAggregate`) and `realtime.send(steerChannel(postId), aggregate)`. The broadcast is in its OWN guarded `try` so a send error (or absent `postId`) is logged but never bubbles into the route catch — the nudge stays a 200 (T-04-12 best-effort; the steer hash is the source of truth, Pitfall 1). `realtime.send` is server-only (T-04-10); the channel is built from trusted `context.postId` (T-04-11).
- `vitest.config.ts`: registered `src/shared/channel.test.ts` in the include allowlist.

**Task 2 — Client realtime subscribe + reconcile-to-absolute apply** (`3aedad1`)
- `src/client/game.ts`: imports `connectRealtime, disconnectRealtime, context` (`@devvit/web/client`), `SteerMsgSchema`, `steerChannel`.
- `connectSteerRealtime()` subscribes SYNCHRONOUSLY (not awaited — `connectRealtime` returns a `Connection`). `onMessage` `SteerMsgSchema.safeParse`s every payload (T-04-09 untrusted boundary); a malformed message is logged and ignored, never thrown on. On a valid message it calls `applyAggregatedSteer` + refreshes the HUD.
- `applyAggregatedSteer(msg)` reconciles the frontier to the ABSOLUTE aggregate mean (`mean = sum/count`, via `aggregateToMean`): for each param it nudges the residual `target − appliedMean` through `handle.nudge` (biases the mean only, I-5), then sets `appliedMean = target`. A zero delta is a no-op. This converges every viewer to the same steered state and means the acting user does NOT double-apply its own echoed broadcast (reconcile-to-absolute, not add-delta).
- `appliedMean` baseline: seeded from the `GET /organism` load-time aggregate (`data.steer`, D-03b reload SoT) so reloads converge; advanced by the acting user's optimistic local nudge in `sendNudge` so its own echo reconciles cleanly; reset on teardown.
- `teardown()` calls `disconnectRealtime(channel)` (guarded) BEFORE destroying the render handle (so a late message can't reach a destroyed handle) and resets the baseline; `Connection.disconnect()` (deprecated) is not used.
- Graceful degrade: a missing `context.postId`, a connect throw, or a send failure logs and continues — the acting-user + reload path (D-03b, plan 02) still holds (the locked fallback, only the wiring bypassed, no rewrite).

**Task 3 — On-device realtime propagation check (D-03a)** — checkpoint, see below.

## Checkpoint Handling (Task 3 — human-verify, D-03a)

This plan's Task 3 is a `checkpoint:human-verify` (gate two-client, one-mobile `devvit playtest` realtime-propagation verification). **Under this run's auto-mode it was AUTO-APPROVED — the real on-device verification was NOT performed here.** Honest status:

- The realtime CODE path (server broadcast + client subscribe + reconcile) is implemented and passes all automated gates (tsc / lint / build / tests).
- The Devvit realtime API existence + shape is verified against `node_modules/@devvit/realtime/{client,server}/*.d.ts` (HIGH confidence): `connectRealtime<Msg extends JsonValue>` is synchronous and returns `Connection`; `disconnectRealtime(channel)`; server `realtime.send<Msg>(channel, msg)`.
- **DEFERRED to UAT (NOT done here):** the actual two-client (at least one a real mobile phone in the Reddit app) `devvit playtest` test that a nudge on client A converges client B's frontier near-real-time WITHOUT a reload, and that the channel connects on mobile inside the post webview. This is research risk D-03a (MEDIUM confidence until verified on-device), the Phase-4 analog of Phase-3's WebGL on-device UAT.
- **Safety net if realtime misbehaves on mobile:** the locked D-03b fallback shipped in plan 02 (acting-user-local re-synth + others-on-reload via the `GET /organism` steer aggregate) is the graceful degrade. If on-device UAT shows realtime is unreliable on the mobile webview, disabling only the broadcast/subscribe wiring (a small swap, not a rewrite) leaves a fully working feature. No claim is made that realtime was verified working on a device.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Registered channel.test.ts in the vitest include allowlist**
- **Found during:** Task 1 (the new test file would be silently skipped — the runner uses an explicit `include` list, not a glob, exactly as encountered in 04-02 for `steer.test.ts`).
- **Issue:** A new `*.test.ts` is invisible to the runner until listed in `vitest.config.ts`.
- **Fix:** Added `'src/shared/channel.test.ts'` to the include array (beside `src/shared/api.test.ts`).
- **Files modified:** `vitest.config.ts`.
- **Commit:** `ff397b3`.

This was directly required to run this plan's own new test (in scope, Rule 3).

No other deviations. Design choices the plan explicitly invited (broadcast at the route since it holds `context.postId`; broadcasting the absolute aggregate; reconcile-to-absolute via an `appliedMean` baseline; seeding that baseline from the D-03b load aggregate) are documented as Decisions above, not deviations.

## Architecture Note — Reconcile-to-Absolute vs Add-Delta

The broadcast carries the ABSOLUTE aggregate (summed contributions + count), so every receiver computes the same `mean = sum/count` and reconciles its frontier to it by nudging only the residual against an `appliedMean` baseline. This is idempotent under message loss/reorder (RESEARCH Pitfall 1: realtime gives low-latency convergence, not guaranteed delivery) — a dropped message just means the next one reconciles to the correct absolute state, and a reload reconciles from `GET /organism`. Crucially, the acting user advances `appliedMean` by its own optimistic local nudge, so its echoed broadcast reconciles to a ~0 residual (no visible double-jump). Steering biases the mean only via `handle.nudge` (STR-02 / I-5: biases, never dictates) — the seeded RNG still dices positions.

## Verification

- `npm test` (full vitest suite) — **223 tests green** (25 files; +4 channel tests over 04-02's 219).
- Targeted: `npx vitest run src/shared` — 11 green (the channel colon-ban + determinism + the OrganismResponse contract).
- `npm run type-check` (tsc --build) — clean.
- `npm run lint` (eslint) — clean (no `Math.random` / Devvit-import violations under `src/engine/`; the realtime wiring lives only in the route + client, never in the engine).
- `npm run build` (vite) — succeeds (the sourcemap / inlineDynamicImports warnings are pre-existing config warnings, not from this plan — same as 04-02).
- grep gates: `grep -rc useChannel src/` is 0 (Blocks API banned); `connectRealtime` present in `game.ts` and NOT awaited; `disconnectRealtime` in `teardown`; `realtime.send(steerChannel(postId), …)` at the route; `SteerMsgSchema.safeParse` at onMessage.
- Bundle safety: `src/shared/channel.ts` and `src/shared/api.ts` import zero server/Devvit-server modules (client-safe, CLAUDE.md §6).

## Known Stubs

None — the broadcast/subscribe path is fully wired end-to-end at the code level (server send + client subscribe + reconcile + teardown). The ONLY deferred item is the on-device D-03a UAT (the human-verify checkpoint), which is verification, not a stub; the D-03b fallback (plan 02) already covers the case where realtime is unreliable on mobile.

## Threat Flags

None — no new security surface beyond the planned threat register. T-04-09 (hostile/garbage realtime message) mitigated: `SteerMsgSchema.safeParse` on every onMessage, ignore malformed, biases the mean only. T-04-10 (client tries to send) mitigated: the SDK split makes `realtime.send` server-only, `connectRealtime` subscribe-only. T-04-11 (channel-name injection) mitigated: `steerChannel` whitelists `[A-Za-z0-9_-]`, no colons, built from trusted `context.postId`. T-04-12 (realtime drops on mobile) accepted-with-fallback: best-effort send + D-03b reload reconciliation (the on-device check is auto-approved/UAT-deferred here, not confirmed on a device). T-04-SC (package legitimacy): zero new packages — realtime ships in the already-installed `@devvit/web@0.13.4`.

## Self-Check: PASSED

- Files created exist: `src/shared/channel.ts`, `src/shared/channel.test.ts` — both FOUND.
- Commits exist: `ff397b3`, `3aedad1` — both FOUND in `git log`.
- All four Definition-of-Done gates green (test 223 / type-check / lint / build).
