// Contract schema-inspection tests.
//
// Proves the Phase-1 schema guarantees WITHOUT any synthesis: valid fixtures
// parse, invalid input is rejected, the game-loop hook fields exist, and the
// personal layer is structurally separate from the community Scene (GAME-05).
import { describe, expect, test } from 'vitest';
import {
  DayVectorSchema,
  GenomeSchema,
  StyleTemplateSchema,
  SceneSchema,
  ActionBudgetSchema,
} from './index';

// --- Valid fixtures -------------------------------------------------------

const validDayVector = {
  day: 2,
  date: '2026-06-19',
  posts: 120,
  comments: 340,
  contributors: 45,
  scoreSum: 980,
  topThreads: [88, 41, 12],
  conflict: 0.3,
  momentum: 0.1,
  diversity: 0.6,
  dominantTheme: 'ama',
  steering: { branch: 0.2, symmetry: 0.5, hue: 0.4 },
  seed: 123456789,
};

const validGenome = {
  version: 1,
  style: 'techno',
  palette: { space: 'oklch', ramp: ['#0ff', '#f0f'] },
  weights: { density: { activity: 0.8 } },
  ranges: { density: [0, 1] as [number, number] },
  baseVar: { density: 0.1 },
  volatility: 0.4,
  inheritance: 0.5,
  steerGain: { symmetry: 0.3 },
  rareTable: [{ prob: 0.02, mutation: 'facet' }],
  allowedGenes: ['spike', 'bloom'],
  dayBoundary: { tz: 'UTC', hour: 0, jitterMin: 5 },
  dailyGoal: {
    type: 'reachSymmetry',
    targetParam: 'symmetry',
    threshold: 0.8,
    direction: 'above',
  },
  // actionCap intentionally OMITTED to prove the default applies.
};

const validStyleTemplate = {
  id: 'techno',
  substrate: 'nebula',
  palette: { space: 'oklch', ramp: ['#0ff', '#f0f'] },
  line: { width: 1, join: 'round', alpha: 0.8 },
  fill: { mode: 'add', alpha: 0.5 },
  texture: { kind: 'grain', scale: 1.2 },
  genes: { spike: 'prim.spike', bloom: 'prim.bloom' },
  postFX: { bloom: 0.7, grain: 0.2 },
  motion: { frontierOnly: true, speed: 1 },
  type: { family: 'mono', weight: 600 },
};

const validScene = {
  core: { radius: 10, energy: 1, hue: 0.5 },
  shells: [],
};

// --- Valid parses ---------------------------------------------------------

describe('contracts: valid fixtures parse', () => {
  test('DayVector parses', () => {
    expect(DayVectorSchema.safeParse(validDayVector).success).toBe(true);
  });

  test('Genome parses', () => {
    expect(GenomeSchema.safeParse(validGenome).success).toBe(true);
  });

  test('StyleTemplate parses', () => {
    expect(StyleTemplateSchema.safeParse(validStyleTemplate).success).toBe(true);
  });

  test('Scene parses', () => {
    expect(SceneSchema.safeParse(validScene).success).toBe(true);
  });
});

// --- Invalid rejection ----------------------------------------------------

describe('contracts: invalid input is rejected', () => {
  test('DayVector rejects conflict > 1', () => {
    const bad = { ...validDayVector, conflict: 1.5 };
    expect(DayVectorSchema.safeParse(bad).success).toBe(false);
  });

  test('Genome rejects an unknown dailyGoal type', () => {
    const bad = {
      ...validGenome,
      dailyGoal: { ...validGenome.dailyGoal, type: 'notAGoal' },
    };
    expect(GenomeSchema.safeParse(bad).success).toBe(false);
  });
});

// --- Game-loop hook fields (GAME-01) -------------------------------------

describe('contracts: game-loop hook fields exist', () => {
  test('DayVector accepts an outcome field', () => {
    const withOutcome = { ...validDayVector, outcome: { score: 7 } };
    const parsed = DayVectorSchema.parse(withOutcome);
    expect(parsed.outcome).toEqual({ score: 7 });
    // The field exists on the schema shape even when omitted.
    expect('outcome' in DayVectorSchema.shape).toBe(true);
  });

  test('Scene has a goalAchieved field defaulting to null', () => {
    const parsed = SceneSchema.parse(validScene);
    expect(parsed.goalAchieved).toBeNull();
    expect('goalAchieved' in SceneSchema.shape).toBe(true);
  });

  test('Genome has a dailyGoal field', () => {
    expect('dailyGoal' in GenomeSchema.shape).toBe(true);
    const parsed = GenomeSchema.parse(validGenome);
    expect(parsed.dailyGoal.type).toBe('reachSymmetry');
  });

  test('Genome actionCap defaults to 3 when omitted', () => {
    const parsed = GenomeSchema.parse(validGenome);
    expect(parsed.actionCap).toBe(3);
  });
});

// --- Personal-layer separation (GAME-05) ---------------------------------

describe('contracts: personal layer is separate from the community Scene', () => {
  test('SceneSchema has no actionsUsed / userId field', () => {
    expect('actionsUsed' in SceneSchema.shape).toBe(false);
    expect('userId' in SceneSchema.shape).toBe(false);
  });

  test('ActionBudget is a distinct schema carrying per-user state', () => {
    const budget = ActionBudgetSchema.parse({
      userId: 'u1',
      dayKey: 'sub:2',
      cap: 3,
    });
    expect(budget.actionsUsed).toBe(0); // default
    expect('userId' in ActionBudgetSchema.shape).toBe(true);
    expect('actionsUsed' in ActionBudgetSchema.shape).toBe(true);
  });

  test('ActionBudget contains no community-layer (Scene) field', () => {
    expect('shells' in ActionBudgetSchema.shape).toBe(false);
    expect('core' in ActionBudgetSchema.shape).toBe(false);
  });
});
