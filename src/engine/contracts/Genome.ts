// Genome — contract: per-community config / the "framework" (spec subcosm-requirements.md §6.3).
//
// The Genome carries every per-community knob as DATA (TPL-02). Synthesis reads
// genome fields; it never branches on a preset name. The full §6.3 surface is
// typed here — including the Signal->Param `weights` matrix — but Phase-1
// synthesis only exercises the genShell heuristic fields; `weights` stays
// typed-but-unused until Week 2 (decision D-05), so no later schema break.
//
// All types are z.infer (ENG-01). Error messages use i18n keys (CLAUDE.md §7).
import { z } from 'zod';
import { StyleIdEnum, PaletteSpecSchema } from './StyleTemplate';

// --- Daily goal (GAME-01, decision D-03): mix of form-goals + activity-goals.
// Phase 1 defines the schema + enum only; scoring logic lands in Phase 4.
export const GoalTypeEnum = z.enum([
  'reachSymmetry', // form
  'conflictBelow', // form
  'igniteRareGene', // form
  'starThreshold', // activity
  'densityThreshold', // activity
  'contributorCount', // activity
]);
export type GoalType = z.infer<typeof GoalTypeEnum>;

export const DailyGoalSchema = z.object({
  type: GoalTypeEnum,
  targetParam: z.string(),
  threshold: z.number(),
  direction: z.enum(['above', 'below']),
});
export type DailyGoal = z.infer<typeof DailyGoalSchema>;

// --- Signal -> Param weights matrix (§6.3). Typed-but-unused in Phase 1 (D-05).
// Zod v4: z.partialRecord(keyEnum, valueSchema) yields Partial<Record<K, V>>.
export const ParamEnum = z.enum([
  'density',
  'width',
  'symmetry',
  'branch',
  'twist',
  'sat',
  'lum',
  'spread',
]);
export type Param = z.infer<typeof ParamEnum>;

export const SignalEnum = z.enum([
  'activity',
  'conflict',
  'momentum',
  'diversity',
  'recency',
]);
export type Signal = z.infer<typeof SignalEnum>;

export const WeightsSchema = z.partialRecord(
  ParamEnum,
  z.partialRecord(SignalEnum, z.number()),
); // Partial<Record<Param, Partial<Record<Signal, number>>>>
export type Weights = z.infer<typeof WeightsSchema>;

export const RareEntrySchema = z.object({
  prob: z.number().min(0).max(1),
  mutation: z.string(),
});
export type RareEntry = z.infer<typeof RareEntrySchema>;

export const DayBoundarySchema = z.object({
  tz: z.string(),
  hour: z.number().int().min(0).max(23),
  jitterMin: z.number().nonnegative(),
});
export type DayBoundary = z.infer<typeof DayBoundarySchema>;

// A Param -> [min, max] range tuple.
const RangeTuple = z.tuple([z.number(), z.number()]);

export const GenomeSchema = z.object({
  version: z.number().int().nonnegative(),
  style: StyleIdEnum, // one style per community (TPL-04)
  palette: PaletteSpecSchema,
  weights: WeightsSchema, // typed-but-unused in Phase 1 (D-05)
  ranges: z.partialRecord(ParamEnum, RangeTuple),
  baseVar: z.partialRecord(ParamEnum, z.number()),
  volatility: z.number().min(0).max(1),
  inheritance: z.number().min(0).max(1), // continuity between rings
  steerGain: z.partialRecord(ParamEnum, z.number()),
  rareTable: z.array(RareEntrySchema),
  allowedGenes: z.array(z.string()), // spike|bloom|aura|facet|…
  dayBoundary: DayBoundarySchema,

  // GAME-01: the day's goal as data, legible at dawn.
  dailyGoal: DailyGoalSchema,

  // GAME-05 / decision D-04: per-user daily action cap, default 3. Per-community
  // policy lives here; per-user consumption lives on the personal layer.
  actionCap: z.number().int().positive().default(3),
});
export type Genome = z.infer<typeof GenomeSchema>;
