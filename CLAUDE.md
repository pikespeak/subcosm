<!--
  Subcosm — CLAUDE.md  (agents.md is a symlink to this file)
  Priority order (intentional): the Zod + Plan-Mode Standard is the highest-priority,
  repo-wide instruction and comes first. Then the Context-OS v4 operating rules,
  then project identity, then the verification checklist (read last).
  GSD owns .planning/ ; this file is owned by the Context-OS + Zod standard, not GSD.
-->

# 🧱 Mandatory Zod + Plan-Mode Standard (Repo-Wide)

This document defines **non-negotiable rules** for all AI-assisted work (Codex, Claude Code, Cursor agents, etc.) in this repository. It is the **highest priority instruction** for any agent operating on this codebase.

## 0) Absolute Rule: Plan Mode First (No Changes Before Plan)

**The agent MUST NOT modify any code** until it has completed a full repository scan and presented a plan.

**Required steps (in this exact order):**
1. **Scan** the entire repository (code + configs + scripts).
2. **Find** all relevant use cases and boundaries (see sections below).
3. **Present** a structured plan containing findings, proposals, risks, and phases.
4. **STOP** and wait for explicit approval to execute.

✅ Execution is allowed ONLY after approval.

## 1) Zod is the Single Source of Truth (Schema First)

Zod schemas define: runtime validation · TypeScript types (via inference) · API contracts · form validation · environment validation · DB input validation · webhook / queue / cron payload validation.

**Forbidden:** duplicate `type`/`interface` declarations for shapes covered by schemas · trusting TypeScript types without runtime validation at boundaries · `as` casting to silence problems.

**Required:** infer all types from schemas — `export type X = z.infer<typeof XSchema>`.

## 2) Mandatory Repository-Wide Detection (Before Any Migration)

Scan and inventory all occurrences of:
- **A) External / Unsafe Input Boundaries:** API routes/handlers (REST, tRPC, Hono), server actions, webhooks (Stripe, GitHub, Shopify…), queue consumers / message handlers, cron jobs / scheduled tasks, CLI inputs, URL/search params, cookies/headers, localStorage/AsyncStorage hydration, third-party SDK responses, CMS content, file uploads / payload parsing, any DB insert/update write paths.
- **B) Existing Validation Systems:** manual validation code, yup/joi/class-validator/zod alternatives, custom guards and DTO mappers → mark as migration candidates.
- **C) Type Duplication:** duplicated DTOs / parallel type definitions across web app, mobile app(s), backend/server, packages.
- **D) Env Variable Usage:** all `process.env` usage, grouped by app/package.
- **E) Form Validation:** RHF/Formik/custom hooks; schema-driven vs ad-hoc.
- **F) Database Layer:** Supabase queries, ORM usage, raw SQL; all write-paths lacking validation.

## 3) Output Format: Mandatory Plan Report

Before any changes, produce a plan report in this order:
1. **Executive Summary** — current type-safety level (low/med/high), biggest risks, quick wins, estimated duplication reduction, likely bundle-size / client-import risks.
2. **Use Case Inventory (Repo Map)** — grouped by API / Forms / DB / ENV / Cross-app shared models / External integrations. Each entry: file path(s), what crosses the boundary, current validation status, risk level, proposed Zod schema(s).
3. **Shared Schema Package Proposal** — target structure (e.g. `packages/shared/{schemas,env,dto,index.ts}`), planned modules + naming.
4. **Migration Phases** — each with scope, risk, effort, expected payoff, required tests + expected impact.
5. **Quick Wins (High ROI)** — small steps, high safety improvement.
6. **Bundle Safety Plan** — classify schemas server-only / client-safe / shared; prevent importing heavy schemas into client bundles.
7. **CI / Enforcement Plan** — rules to prevent regression (see Testing & CI).
8. **Open Questions** — only if human decisions are required.

➡️ After presenting the plan, the agent MUST STOP and ask for approval.

## 4) Execution Mode (Only After Approval)

Migrate **phase-by-phase**; keep diffs small and reviewable; provide a short change summary after each phase; remove duplicated types as schemas take over (when safe).

**Migration Priority Order:** 1. ENV validation → 2. API inputs → 3. DB writes → 4. shared cross-app models → 5. forms → 6. API responses → 7. internal domain models.

## 5) Testing & Build Must Always Be Green (Non-Negotiable)

**All tests and builds MUST pass at all times.** The agent is not allowed to leave the repo in a failing state — during migration, after migration, and for all future changes.

- Run the standard test suite after each phase (or the closest local equivalent).
- If a change breaks tests, fix them immediately or revert that change. No "temporary broken" states, no skipping tests, no disabling checks, no commenting-out assertions.
- After each phase, deliver: commands executed, test-results summary, brief note of what changed.
- **CI enforcement (propose in plan):** fail PR if tests fail · if env is not validated · if new boundary code lacks Zod validation · optionally grep/lint for direct `process.env` usage outside the env module.

## 6) Zod Boundary Rules

- **Parse at boundaries** with `.parse()`: API routes, server actions, webhook handlers, message/queue consumers, DB write functions.
- **UI must not throw:** in UI layers use `.safeParse()` and return structured errors.

## 7) i18n-Friendly Errors (Required)

Schema errors MUST use i18n keys, not hardcoded language text (e.g. `"error.user.name.tooShort"`).

## 8) Definition of Done (Per Module)

All external inputs validated via Zod · types inferred (no duplicate interfaces) · tests cover valid + invalid payloads · app builds and tests are green · schema modules live in the shared location and are used consistently.

## 9) Anti-Patterns (Forbidden)

Duplicating DTO types instead of inference · validating manually when a schema exists · `as` casts to bypass typing · exposing DB entity schema directly as public API output · deep internal parsing (parsing belongs at boundaries) · importing server-only schemas into client bundles.

## 10) Agent "Stop" Condition

If any instruction conflicts with a request to "just change code quickly": this document wins — enforce Plan Mode first and require approval before execution.

---

# 🧠 Repository Analysis — Mandatory

Before any modification, create a complete inventory of:

**External / Unsafe Data Boundaries** — any point where data enters the system: API endpoints, CLI input, file input, message queues / event consumers, scheduled jobs, environment variables, configuration files, URL/query params, cookies/headers, user input, third-party responses, DB write operations, deserialization points. For each: file location, data shape, current validation status, risk level.

**Validation & Type-Safety Inventory** — manual validation logic, schema validation libraries, ad-hoc parsing, unchecked deserialization, type duplication across layers/services.

**Data Model Reuse** — structures used in multiple layers → mark HIGH VALUE for shared contracts.

**Required Plan Output:** Executive Summary · Boundary Inventory (grouped interface / application / persistence / integration; each: path, problem, proposed solution, impact) · Target Architecture Proposal (where validation lives, how contracts are shared, how duplication is eliminated) · Migration Phases (scope, risk, effort, safety impact) · Quick Wins · Test & Build Safety Strategy · Open Questions. **After presenting the plan the agent MUST STOP.**

**Test & Build Safety — Non-Negotiable:** at all times the project must build and all tests pass; run the standard validation commands after every phase; fix failures immediately or revert; never disable/skip/weaken tests; no temporary broken states.

**Execution Mode (after approval only):** small phases · minimal diffs · remove duplication only when safe · validate all external inputs at boundaries · report after each phase (what changed, safety improvements, removed duplication, test results).

**Forbidden:** large unplanned refactors · hidden architectural changes · weakening test coverage · bypassing validation with casts · introducing parallel data models without a plan.

**Definition of Done (per step):** external inputs validated at boundaries · contracts defined in a single authoritative location · duplication reduced · tests green · system builds.

> **Subcosm application note:** The first real Zod boundary in this project is the **simulator → engine** handoff (`DayVectorSchema.parse()`), plus the four engine contracts (`DayVector`, `Scene`, `Genome`, `StyleTemplate`) as schemas with `z.infer` types. From Phase 3 (Devvit) the boundaries multiply: trigger payloads, Redis reads, scheduler/cron, and settings/genome config. **Parse at boundaries only — never inside synthesis, paint, or the rAF loop** (perf). See `.planning/REQUIREMENTS.md` (ENG/SYN/SIM/DEV) and `docs/context/subcosm-spec.md`.

---

# Context OS v4 — Operating Rules

## Session Start

Read the latest handoff in `docs/summaries/` if one exists, and `.planning/STATE.md` (current GSD phase). Load only the files those reference — not everything. If neither exists, ask: what is the project, what type of work, what is the target deliverable.

Before starting work, state: what you understand the project state to be, what you plan to do this session, and any open questions.

## Identity

You work with **Oliver**, a solo developer building **Subcosm** (see Project Identity below) for the Reddit "Games with a Hook" hackathon. **Converse in German; write all artifacts in English** (code, comments, commits, planning docs, summaries).

## Rules

1. Do not mix unrelated project contexts in one session.
2. Write state to disk, not conversation. After meaningful work, write a summary to `docs/summaries/` using `templates/claude-templates.md` (decisions + rationale, exact numbers, file paths, open items).
3. Before compaction or session end, write to disk: every number, every decision with rationale, every open question, every file path, exact next action.
4. When switching work types (research → writing → review), write a handoff to `docs/summaries/handoff-[date]-[topic].md` and suggest a new session.
5. Do not silently resolve open questions. Mark them OPEN or ASSUMED.
6. Do not bulk-read documents. Process one at a time: read, summarize to disk, release before reading the next (see `docs/context/processing-protocol.md`).
7. Sub-agent returns must be structured, not free-form prose. Use output contracts from `templates/claude-templates.md`.

## Where Things Live

- `.planning/` — **GSD** planning: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `research/`. Run `/gsd-progress` for current phase.
- `docs/context/subcosm-spec.md` — condensed engineering brief (the original spec / former CLAUDE.md).
- `docs/subcosm-requirements.md` — full requirements spec (§6 contracts, §7 architecture).
- `docs/subcosm-universe-mock.html` — the renderer to port (visual reference).
- `docs/subcosm.png` — logo / Techno style visual reference.
- `docs/devpost-submission.md` — Devpost write-up (draft).
- `templates/claude-templates.md` — summary / handoff / decision / output-contract templates (read on demand).
- `docs/summaries/` — active session state (handoffs, decision records, source summaries).
- `docs/context/` — reusable domain knowledge, loaded only when relevant (processing-protocol, archive-rules, subagent-rules, project-structure).
- `docs/archive/` — processed raw files. Do not read unless told.
- `output/deliverables/` — final outputs.

## Error Recovery

If context degrades or auto-compact fires unexpectedly: write current state to `docs/summaries/recovery-[date].md`, tell the user what may have been lost, suggest a fresh session.

---

# Subcosm — Project Identity

Subcosm is a collaborative, persistent Reddit game (Devvit Web): each community grows **one shared "cosmos"** from its daily activity. Depth = time — a glowing genesis core at the center, one concentric **shell of stars** per day, the outermost **frontier** freezing at the daily tick. *"A universe grown from your community."*

**The architecture bet (most important):** one pure engine, two symmetric typed contracts —
`synthesize(DayVector, Genome) → Scene` then `paint(Scene, StyleTemplate) → pixels`, plus an independent `camera`. **Synthesis must never know about styles; paint must never touch raw data.** Behaviour (`Genome`) and look (`StyleTemplate`) are **data, not code** — it is a config-driven template engine: a new genome/style is a data file, zero engine changes.

**Hard rules** (full list in `docs/context/subcosm-spec.md`): determinism (every shell reproducible from `DayVector + seed + genomeVersion`; no randomness outside the seeded RNG; identical client/server render) · no stored images (~25 scalars + seed per ring) · 60fps mobile (only the frontier animates; frozen shells bake-cached; LOD by zoom) · legibility mandatory in every style · one style per community · respect `prefers-reduced-motion` · steering biases the mean, never dictates.

**State lives in two places:** `.planning/STATE.md` (GSD roadmap/phase state) and `docs/summaries/` (Context-OS handoffs). At session start read the latest handoff + STATE.md.

**Forward constraint:** keep `Scene`/`Camera` contracts embeddable for a future connected-multiverse outer zoom tier (subreddits as galaxies) — see PROJECT.md "North-star vision". Don't build it; don't design it out.

---

# Before Delivering Output (read last)

Verify: exact numbers preserved · open questions marked OPEN · output matches what was requested (not assumed) · claims backed by specific data · consistent with stored decisions · summary written to disk for this session's work.

**Zod Definition of Done** (for any code touched): external inputs validated at boundaries (`.parse()` server-side, `.safeParse()` in UI) · types inferred from schemas, no duplicate interfaces · tests cover valid + invalid payloads · `npm test` + build + `tsc --noEmit` green · no `Math.random()` or Devvit imports inside `src/engine/`.
