import { describe, expect, it } from 'vitest';
import { formatValue } from './format.ts';

describe('formatValue', () => {
  it('fills {v} with the number as written', () => {
    expect(formatValue('{v} min', 12)).toBe('12 min');
    expect(formatValue('€{v}', 0.5)).toBe('€0.5');
  });

  it('fills {v:N} with N decimals', () => {
    expect(formatValue('g = {v:2}', 0.65)).toBe('g = 0.65');
    expect(formatValue('{v:1}%', 3)).toBe('3.0%');
    expect(formatValue('{v:0} years', 2026.4)).toBe('2026 years');
  });

  it('fills every placeholder in the template', () => {
    expect(formatValue('{v} to {v:1}', 2)).toBe('2 to 2.0');
  });

  it('shows the bare number when there is no template', () => {
    expect(formatValue(undefined, 7)).toBe('7');
  });

  it('treats the template as text, never as code', () => {
    const globals = globalThis as Record<string, unknown>;
    const template = '${globalThis.pwned = 1}{v} (v) => v; alert(1)';
    expect(formatValue(template, 3)).toBe('${globalThis.pwned = 1}3 (v) => v; alert(1)');
    expect(globals.pwned).toBeUndefined();
  });

  it('leaves unknown placeholders as they are', () => {
    expect(formatValue('{x} {v:99}', 1)).toBe('{x} {v:99}');
  });
});
