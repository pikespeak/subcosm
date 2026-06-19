// Personal layer — per-user action budget (GAME-05, decision D-04).
//
// This is structurally SEPARATE from the community `Scene`. The shared,
// deterministic universe (Scene) must never embed per-user state — that keeps
// fair/cosmetic monetization and ethical retention bolt-on later without
// touching synthesis. `actionCap` (the policy) lives on Genome; per-user
// CONSUMPTION lives here.
//
// Phase 1 is schema-only (no scoring / no enforcement). All types are z.infer
// (ENG-01); error messages use i18n keys (CLAUDE.md §7).
import { z } from 'zod';

export const ActionBudgetSchema = z.object({
  userId: z.string(),
  dayKey: z.string(), // e.g. "{sub}:{day}" — scopes the budget to one day
  cap: z.number().int().positive(), // resolved from Genome.actionCap
  actionsUsed: z.number().int().nonnegative().default(0),
});
export type ActionBudget = z.infer<typeof ActionBudgetSchema>;

// Alias for the broader personal-state concept; for now it is exactly the
// action budget. Kept as a distinct exported name so downstream phases can
// widen PersonalState without churning ActionBudget call sites.
export const PersonalStateSchema = ActionBudgetSchema;
export type PersonalState = z.infer<typeof PersonalStateSchema>;
