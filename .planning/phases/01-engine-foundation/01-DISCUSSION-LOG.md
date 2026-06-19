# Phase 1: Engine Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 1-Engine Foundation
**Areas discussed:** Genome Presets, Daily Goal Types, Action Budget, Genome Schema Depth

---

## Genome Presets

| Option | Description | Selected |
|--------|-------------|----------|
| Calm vs Chaotic | Two generic max-contrast poles; subreddit-agnostic; strongest visible proof | |
| Subreddit types | Gaming vs Discussion; closer to real communities, less contrast | |
| Calm/Chaotic + 1 thematic | Three presets: two contrast poles plus one with its own palette/character | ✓ |

**User's choice:** Calm/Chaotic + 1 thematic
**Notes:** Third preset proposed as "Crystalline" (high symmetry/inheritance, cool, faceted — spec §4.4). Final palette deferred to Phase 2 (when visible).

---

## Daily Goal Types

| Option | Description | Selected |
|--------|-------------|----------|
| Form goals | Symmetry / tame conflict / ignite rare gene (qualitative, from synthesis params) | |
| Activity goals | Density / contributor count (quantitative) | |
| Mix of both | Form AND activity goals in the enum | ✓ |

**User's choice:** Mix of both
**Notes:** Phase 1 defines the enum + schema only; scoring logic is Phase 4.

---

## Action Budget

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable, default 3 | `actionCap` as a Genome field, per-community tunable, default 3 | ✓ |
| Fixed small (3) | Hard 3/day, not configurable | |
| Configurable, default 5–8 | More per-user room | |

**User's choice:** Configurable, default 3
**Notes:** Lives on the personal layer; scarcity + room for fair "extra actions" monetization later.

---

## Genome Schema Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Type full §6.3, use lean | Schema covers full §6.3 incl. weights matrix; synthesis uses only mock-heuristic fields now | ✓ |
| Lean | Only the fields Phase 1 uses; add the matrix later | |

**User's choice:** Type full §6.3, use lean
**Notes:** Weights matrix typed-but-unused until Week 2; avoids a later schema break.

---

## Claude's Discretion

- Exact Zod field names/shapes, mulberry32 implementation, genShell port details, ESLint config (Math.random + Devvit/Phaser import ban in `src/engine/`), Scene/Element mapping, test structure — planner's to design, constrained to the decisions above and `z.infer`-only types.

## Deferred Ideas

- Full Signal→Param weight matrix exercised — Week 2.
- Daily guess + streaks, collection, fair/cosmetic monetization — later phases / stretch.
- Connected multiverse outer zoom tier — post-MVP (Phase 1 keeps coordinate model embeddable only).
- Crystalline final palette — Phase 2.
