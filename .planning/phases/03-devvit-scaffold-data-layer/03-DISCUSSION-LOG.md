# Phase 3: Devvit Scaffold + Data Layer - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 3-Devvit Scaffold + Data Layer
**Areas discussed:** Data flow to the post, Conflict composite, Day boundary / freeze, Cold-start + install

**Scout finding (shaped the framing):** a Devvit Web scaffold already exists (devvit.json + Hono server in src/server + Devvit 0.13.4 deps); `src/client/game.ts` is still boilerplate. So this phase wires real data into the existing scaffold rather than scaffolding from zero.

---

## Data flow to the post

| Option | Description | Selected |
|--------|-------------|----------|
| Thin server, client renders | Server returns Ring records (DayVector scalars + seed + genomeVersion) JSON; client calls render() and synthesizes+paints; realtime deferred to Phase 4 | ✓ |
| Server synthesizes Scene | Server computes the Scene, client only paints | |
| Direction now, transport in plan | Deterministic+client-renders locked; transport detail to planner | |

**User's choice:** Thin server, client renders (fetch-on-load this phase)

---

## Conflict composite (DEV-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Reply-depth + comments-per-post rate | Normalized combo at tick; robust vs trivial manipulation | ✓ |
| + Score variance | Add score-snapshot spread (controversial posts) — richer, more tick work | |
| Comments-rate only | Simple comments/posts; coarse | |

**User's choice:** Reply-depth + comments-per-post rate

---

## Day boundary / freeze timing (DEV-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Local midnight (mod picks TZ) | Mod selects community IANA timezone at install; hourly UTC sweeper + hash(subId)%60 jitter fires at local midnight | ✓ |
| UTC midnight for all | One global 00:00 UTC tick; simplest, but fires mid-day for US communities | |
| Auto-TZ from sub data | Derive timezone automatically if Reddit exposes it reliably | |

**User's choice:** Local midnight (mod picks TZ)

---

## Cold-start + install (DEV-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Genesis core + mod picks Genome+Style | Install settings: genome preset + style; day-1 = glowing core (+ first star on first activity), reads intentional | ✓ |
| Mod picks Genome only (style fixed) | One axis of choice; style stays Techno | |
| Auto-default (no mod choice) | Default Calm/Techno, zero setup | |

**User's choice:** Genesis core + mod picks Genome + Style

## Claude's Discretion
- Exact conflict normalization formula/weights
- Redis key schema beyond the locked organism:{sub}/ringCount + SET/ZSET shapes
- Fetch route shape

## Deferred Ideas
- Live realtime frontier fill + nudges → Phase 4
- Auto-detect community timezone → deferred to mod-choice unless research proves reliable
- Richer genome evolution at tick → later phase
