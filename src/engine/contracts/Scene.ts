// Scene — contract: synthesis -> paint (style-agnostic) (spec subcosm-requirements.md §6.2).
//
// Scene is the ONLY seam between synthesis and paint. It carries geometry only:
// `hue` is a 0..1 HINT, never a color string — paint maps it through the
// StyleTemplate palette in Phase 2 (ENG-02). All types are z.infer (ENG-01).
//
// GAME-05 separation: Scene is the shared COMMUNITY layer. It must contain NO
// per-user fields (actionsUsed/userId) — those live on the personal layer
// (Personal.ts). The contracts test asserts this.
import { z } from 'zod';

export const CoreNodeSchema = z.object({
  radius: z.number(),
  energy: z.number(),
  hue: z.number().min(0).max(1), // 0..1 hint, not a color
});
export type CoreNode = z.infer<typeof CoreNodeSchema>;

export const ElementKindEnum = z.enum(['star', 'cluster', 'filament']);
export type ElementKind = z.infer<typeof ElementKindEnum>;

export const ElementSchema = z.object({
  kind: ElementKindEnum,
  angle: z.number(),
  r: z.number(),
  size: z.number(),
  energy: z.number(),
  hue: z.number().min(0).max(1), // 0..1 hint, NOT a color
  conflict: z.number().min(0).max(1),
  big: z.boolean(),
});
export type Element = z.infer<typeof ElementSchema>;

export const ShellMetaSchema = z.object({
  date: z.string(),
  era: z.string(),
  theme: z.string(),
  posts: z.number().nonnegative(),
  comments: z.number().nonnegative(),
  contributors: z.number().nonnegative(),
  conflict: z.number().min(0).max(1),
});
export type ShellMeta = z.infer<typeof ShellMetaSchema>;

export const ShellSchema = z.object({
  day: z.number().int().positive(),
  radius: z.number(),
  // VIS-DEPTH (D-02): per-shell legibility weight. Older shells fade with age,
  // standout days keep accents, nothing drops below the legibility floor. A
  // bounded 0..1 scalar (CoreNodeSchema precedent); paint multiplies it into
  // per-glow alpha/size. Present on EVERY shell (genesis included) — fixed-key.
  weight: z.number().min(0).max(1),
  meta: ShellMetaSchema,
  elements: z.array(ElementSchema),
});
export type Shell = z.infer<typeof ShellSchema>;

export const SceneSchema = z.object({
  core: CoreNodeSchema,
  shells: z.array(ShellSchema),

  // GAME-01 scoring hook. Loosely typed in Phase 1 (schema-only, no scoring);
  // firmed in Phase 4 (RESEARCH A3).
  goalAchieved: z.boolean().nullable().default(null),
});
export type Scene = z.infer<typeof SceneSchema>;
