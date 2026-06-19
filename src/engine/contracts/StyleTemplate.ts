// StyleTemplate — contract: the skin as DATA (spec subcosm-requirements.md §6.4).
//
// The StyleTemplate schema is typed in Phase 1; only the Techno instance is
// authored in Phase 2 (when rendering is visible). Synthesis NEVER reads a
// StyleTemplate — paint does. One style per community, selected via
// `Genome.style` (TPL-04). All types are z.infer (ENG-01).
import { z } from 'zod';

// Open-ended style id; 'techno' ships first, 'comic'/'pixel' are stretch.
export const StyleIdEnum = z.enum(['techno', 'comic', 'pixel']);
export type StyleId = z.infer<typeof StyleIdEnum>;

export const PaletteSpecSchema = z.object({
  space: z.string(),
  ramp: z.array(z.string()),
});
export type PaletteSpec = z.infer<typeof PaletteSpecSchema>;

export const LineSpecSchema = z.object({
  width: z.number().nonnegative(),
  join: z.string(),
  alpha: z.number().min(0).max(1),
});
export type LineSpec = z.infer<typeof LineSpecSchema>;

export const FillSpecSchema = z.object({
  mode: z.string(),
  alpha: z.number().min(0).max(1),
});
export type FillSpec = z.infer<typeof FillSpecSchema>;

export const TextureSpecSchema = z.object({
  kind: z.string(),
  scale: z.number().nonnegative(),
});
export type TextureSpec = z.infer<typeof TextureSpecSchema>;

export const FXSpecSchema = z.object({
  bloom: z.number().min(0).max(1),
  grain: z.number().min(0).max(1),
});
export type FXSpec = z.infer<typeof FXSpecSchema>;

export const MotionSpecSchema = z.object({
  frontierOnly: z.boolean(),
  speed: z.number().nonnegative(),
});
export type MotionSpec = z.infer<typeof MotionSpecSchema>;

export const TypeSpecSchema = z.object({
  family: z.string(),
  weight: z.number(),
});
export type TypeSpec = z.infer<typeof TypeSpecSchema>;

// genes: Gene -> how it is painted (PrimitiveRef). Kept loose (string ref) in
// Phase 1; the primitive registry is authored alongside paint in Phase 2.
export const StyleTemplateSchema = z.object({
  id: StyleIdEnum,
  substrate: z.string(),
  palette: PaletteSpecSchema,
  line: LineSpecSchema,
  fill: FillSpecSchema,
  texture: TextureSpecSchema,
  genes: z.record(z.string(), z.string()), // Gene -> PrimitiveRef
  postFX: FXSpecSchema,
  motion: MotionSpecSchema,
  type: TypeSpecSchema,
});
export type StyleTemplate = z.infer<typeof StyleTemplateSchema>;
