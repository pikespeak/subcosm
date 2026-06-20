import { defineConfig } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default defineConfig([
  tseslint.configs.recommended,
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/server/**/*.{ts,tsx,mjs,cjs,js}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: {
        // Server SOURCE project + the server-TESTS project (the latter owns the
        // *.test.ts files, which the source project excludes) — mirrors the
        // engine/styles/sim source+tests pairing.
        project: [
          './tools/tsconfig.server.json',
          './tools/tsconfig.server-tests.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/shared/**/*.{ts,tsx,mjs,cjs,js}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        project: ['./tools/tsconfig.shared.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/client/**/*.{ts,tsx}'],
    ignores: ['src/server/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        project: ['./tools/tsconfig.client.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['off'],
      'no-unused-vars': ['off'],
    },
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'eslint.config.js',
      '**/vite.config.ts',
      'devvit.config.ts',
    ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { js },
    extends: ['js/recommended'],
  },
  // Engine boundary (ENG-03): src/engine/** is a pure, deterministic, Devvit-free core.
  // Placed AFTER the trailing catch-all so its no-restricted-* rules win for src/engine/**.
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/engine/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        // Engine SOURCE project + the engine-TESTS project (the latter owns the
        // *.test.ts files, which the source project excludes).
        project: [
          './tools/tsconfig.engine.json',
          './tools/tsconfig.engine-tests.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@devvit/*', 'phaser', '*/client/*', '*/server/*'],
        },
      ],
      // Ban Math.random ONLY — synthesis legitimately uses Math.imul/max/floor/PI/cos/sin.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'error.engine.determinism.noMathRandom',
        },
      ],
      // Leading-underscore params/vars are intentionally unused (Phase-2 render
      // stub signatures must keep their typed param names for documentation).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Styles + Sim boundary (PNT-02 / SIM-02 / QA-03): src/styles/** holds
  // StyleTemplate DATA and src/sim/** holds the DayVector simulator. Both are
  // pure, Phaser-free, parse-at-boundary modules — like the engine, they may
  // import zod + engine contracts but NEVER phaser/client/server/Devvit.
  // Placed AFTER the trailing catch-all so its no-restricted-imports wins.
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/styles/**/*.{ts,tsx}', 'src/sim/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        project: [
          './tools/tsconfig.styles.json',
          './tools/tsconfig.styles-tests.json',
          './tools/tsconfig.sim.json',
          './tools/tsconfig.sim-tests.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@devvit/*', 'phaser', '*/client/*', '*/server/*'],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]);
