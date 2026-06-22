// menuActions — boundary schema tests for the mod-menu action request payload
// (D-01 backfill + D-08 force-tick). T-05-07 mitigation.
//
// A mod clicking a menu item POSTs a request to the endpoint. We DO NOT trust any
// sub/day from that body — the handler uses context.subredditId (V4) + frontierDay
// server-side. The schema's job is purely to REJECT a malformed (non-object)
// payload at the boundary so the handler can return a UiResponse toast instead of
// throwing/500ing (mirrors scheduler.ts return-discipline, V5). These tests lock
// the accept/reject behaviour and the i18n error key (CLAUDE.md §7).
import { describe, expect, test } from 'vitest';
import { MenuActionRequestSchema, type MenuActionRequest } from './menuActions';

describe('MenuActionRequestSchema', () => {
  test('accepts an empty object (the menu request carries no trusted fields)', () => {
    const parsed: MenuActionRequest = MenuActionRequestSchema.parse({});
    expect(parsed).toBeDefined();
  });

  test('accepts an object with extra Devvit-supplied fields (ignored, not trusted)', () => {
    // Devvit may send envelope fields; we parse the object and IGNORE the rest —
    // we never read a sub/day from here. Parse must not throw on extra keys.
    const parsed = MenuActionRequestSchema.parse({
      subredditId: 't5_attacker',
      day: 9999,
      anything: 'else',
    });
    expect(parsed).toBeDefined();
    // The schema does NOT surface an attacker-supplied subId/day as a trusted field.
    expect((parsed as Record<string, unknown>)['subredditId']).toBeUndefined();
    expect((parsed as Record<string, unknown>)['day']).toBeUndefined();
  });

  test('rejects a null payload', () => {
    expect(() => MenuActionRequestSchema.parse(null)).toThrow();
  });

  test('rejects a non-object payload (string)', () => {
    expect(() => MenuActionRequestSchema.parse('not-an-object')).toThrow();
  });

  test('rejects a non-object payload (number)', () => {
    expect(() => MenuActionRequestSchema.parse(42)).toThrow();
  });

  test('rejects an array payload', () => {
    expect(() => MenuActionRequestSchema.parse([1, 2, 3])).toThrow();
  });

  test('a rejected parse carries the i18n error key', () => {
    const result = MenuActionRequestSchema.safeParse('bad');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('error.menu.payload.invalid');
    }
  });
});
