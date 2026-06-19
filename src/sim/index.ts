// src/sim — the deterministic activity simulator (the ONE Zod boundary that emits
// DayVector[] for Phase 2). Implemented in plan 02-02.
//
// `generateDayVectors(config)` produces the scripted ~30-day story (cold-start ->
// growth -> drama -> AMA -> quiet) seeded deterministically via the engine's
// mulberry32, schema-validated once at its output boundary (SIM-02).
// The beat table is exported as tunable data (D-03).
export { generateDayVectors, type SimConfig } from './generator';
export { beats, type Beat, type BeatKind } from './beats';
