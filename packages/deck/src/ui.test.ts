import { describe, expect, it } from 'vitest';
import ro from '../fixtures/ro-deck.json' with { type: 'json' };
import { DEFAULT_UI, deckLang, fill, mergeUi } from './ui.ts';

describe('fill', () => {
  it('puts values into {name} slots', () => {
    expect(fill('{n} cards left · ~{m} min', { n: 3, m: 2 })).toBe('3 cards left · ~2 min');
  });

  it('inserts values literally, whatever characters they hold', () => {
    expect(fill('Plan: {when}.', { when: "$& $' $1 {when}" })).toBe("Plan: $& $' $1 {when}.");
  });

  it('leaves unknown slots as written', () => {
    expect(fill('{n} of {total}', { n: 1 })).toBe('1 of {total}');
  });
});

describe('mergeUi', () => {
  it('is the English defaults when the deck has no ui block', () => {
    expect(mergeUi(undefined)).toEqual(DEFAULT_UI);
  });

  it("takes the deck's strings over the defaults, one key at a time", () => {
    const ui = mergeUi({ next: 'Înainte →', tags: { quiz: 'Test rapid' }, sources: { study: 'Studiu' } });
    expect(ui.next).toBe('Înainte →');
    expect(ui.lock).toBe(DEFAULT_UI.lock);
    expect(ui.tags.quiz).toBe('Test rapid');
    expect(ui.tags.guess).toBe(DEFAULT_UI.tags.guess);
    expect(ui.sources).toEqual({ ...DEFAULT_UI.sources, study: 'Studiu' });
  });

  it('keeps a key named __proto__ as data', () => {
    const ui = mergeUi(JSON.parse('{"__proto__": {"next": "x"}, "tags": {"__proto__": {"quiz": "y"}}}'));
    expect(ui.next).toBe(DEFAULT_UI.next);
    expect(ui.tags.quiz).toBe(DEFAULT_UI.tags.quiz);
    expect(({} as Record<string, unknown>).next).toBeUndefined();
  });

  it('ignores a ui block that is not an object', () => {
    expect(mergeUi('nope')).toEqual(DEFAULT_UI);
    expect(mergeUi(['x'])).toEqual(DEFAULT_UI);
  });
});

describe('deckLang', () => {
  it("is the deck's BCP 47 tag, in canonical form", () => {
    expect(deckLang('ro')).toBe('ro');
    expect(deckLang('pt-br')).toBe('pt-BR');
  });

  it('falls back to English for a missing or broken tag', () => {
    expect(deckLang(undefined)).toBe('en');
    expect(deckLang('')).toBe('en');
    expect(deckLang('"><script>')).toBe('en');
    expect(deckLang(42)).toBe('en');
  });
});

describe('the Romanian fixture deck', () => {
  it('translates every engine string, so autoplay can catch English leaking through', () => {
    const missing = Object.entries(DEFAULT_UI).flatMap(([k, v]) => {
      const theirs = (ro.ui as Record<string, unknown>)[k];
      if (theirs == null) return [k];
      return typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).filter(kk => (theirs as Record<string, unknown>)[kk] == null).map(kk => `${k}.${kk}`) : [];
    });
    expect(missing).toEqual([]);
  });
});
