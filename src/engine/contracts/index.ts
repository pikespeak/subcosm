// Barrel — single import surface for every engine contract.
//
// Schemas are the source of truth (CLAUDE.md §1); every exported type is
// z.infer of its schema. Downstream code imports from
// `src/engine/contracts` rather than reaching into individual files.
export * from './DayVector';
export * from './Scene';
export * from './Genome';
export * from './StyleTemplate';
export * from './Personal';
