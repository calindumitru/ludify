import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import schema from '../deck.schema.json' with { type: 'json' };
import quick from '../fixtures/quick-deck.json' with { type: 'json' };
import thorough from '../fixtures/thorough-deck.json' with { type: 'json' };
import { MAX_DECK_BYTES, validateDeck } from './validate.ts';

type Json = any; // fixtures are edited freely to break them

// A failing fixture: a copy of a valid deck with one thing broken.
const broken = (base: Json, edit: (deck: Json) => void): Json => {
  const deck = structuredClone(base);
  edit(deck);
  return deck;
};
const errorsOf = (deck: unknown) => validateDeck(deck).errors;

const SRC = 'the source: an https URL, or {"notes": true} for a fact from the user\'s notes';
const TAG = 'the source tag: {"source": one of official, study, test, vendor, notes}, plus "grade" (strong, moderate, weak, none, against) when the card claims an effect';

describe('valid decks', () => {
  it('accepts a quick deck (2 worlds) as it is', () => {
    expect(validateDeck(quick)).toEqual({ ok: true, errors: [], deck: quick, skipped: [] });
  });

  it('accepts a thorough deck (4 worlds) as it is', () => {
    expect(validateDeck(thorough)).toEqual({ ok: true, errors: [], deck: thorough, skipped: [] });
  });

  it('reads a deck given as JSON text', () => {
    expect(validateDeck(JSON.stringify(quick)).deck).toEqual(quick);
  });

  it('is a valid draft 2020-12 schema that another validator agrees with', () => {
    const ajv = new Ajv2020({ allErrors: true });
    const check = ajv.compile(schema);
    expect(check(quick)).toBe(true);
    expect(check(thorough)).toBe(true);
    expect(check(broken(quick, d => { d.worlds[0].cards[1].right = 'one'; }))).toBe(false);
  });
});

describe('deck-level errors leave no deck', () => {
  it('rejects a deck over 64 KB', () => {
    const big = broken(quick, d => { d.worlds[0].cards[0].more = 'x'.repeat(MAX_DECK_BYTES); });
    const result = validateDeck(big);
    expect(result.deck).toBeNull();
    expect(result.errors).toEqual([`The deck is ${new TextEncoder().encode(JSON.stringify(big)).length.toLocaleString('en')} bytes; the limit is 65,536 (64 KB), so shorten it.`]);
  });

  it('rejects text that is not JSON', () => {
    expect(errorsOf('{"lang": "en",')).toEqual([expect.stringMatching(/^The deck isn't valid JSON: .+\.$/)]);
  });

  it('rejects a deck that is not an object', () => {
    expect(errorsOf([])).toEqual(['The deck must be a JSON object with `lang` and `worlds`.']);
  });

  it('needs lang as a BCP 47 tag', () => {
    expect(errorsOf(broken(quick, d => { delete d.lang; }))).toEqual([
      'deck: `lang` is missing; add the deck\'s language as a BCP 47 tag, such as "en", "ro" or "pt-BR".',
    ]);
    expect(errorsOf(broken(quick, d => { d.lang = 'English'; }))).toEqual([
      'deck: `lang` must be the deck\'s language as a BCP 47 tag, such as "en", "ro" or "pt-BR".',
    ]);
  });

  it('names unknown deck fields', () => {
    expect(errorsOf(broken(quick, d => { d.title = 'x'; }))).toEqual(['deck: `title` isn\'t a deck field; remove it.']);
  });

  it('needs 2 or 4 worlds', () => {
    const three = broken(thorough, d => { d.worlds.splice(1, 1); });
    expect(errorsOf(three)).toEqual(['The deck has 3 worlds; it needs 2 (quick) or 4 (thorough).']);
  });

  it('needs every world field', () => {
    const result = validateDeck(broken(quick, d => { d.worlds[0].c = 'w5'; delete d.worlds[0].badge; }));
    expect(result.deck).toBeNull();
    expect(result.errors).toEqual([
      'world 1: `badge` is missing; add the world\'s badge: {"ico": one emoji, "name": plain text}.',
      'world 1: `c` must be the world\'s colour: one of w1, w2, w3, w4.',
    ]);
  });

  it('needs each world id once', () => {
    expect(errorsOf(broken(quick, d => { d.worlds[1].id = 'costs'; d.worlds[1].cards[2].from = [['costs', 0]]; }))).toEqual([
      'world 2: `id` "costs" is already used by world 1; give each world its own id.',
      'world 2, card 3: `from` entry 1 points at card index 0 of world "costs", which isn\'t a `decide` card; point it at one (card indexes count from 0).',
    ]);
  });

  it('needs a decision world last: decide cards only, then one summary', () => {
    expect(errorsOf(broken(quick, d => { d.worlds[1].cards.splice(0, 2, structuredClone(d.worlds[0].cards[1])); }))).toEqual([
      'world 2: the last world is the decision world, so it needs `decide` cards and then one `summary`; it has no `decide` card.',
      'world 2, card 1: the decision world holds only `decide` cards and one `summary`; move this `quiz` card to an earlier world.',
      'world 2, card 2: `from` entry 1 points at card index 0 of world "decide", which isn\'t a `decide` card; point it at one (card indexes count from 0).',
      'world 2, card 2: `from` entry 2 points at card index 1 of world "decide", which isn\'t a `decide` card; point it at one (card indexes count from 0).',
    ]);
  });

  it('needs the summary as the decision world\'s last card, and only there', () => {
    expect(errorsOf(broken(quick, d => { d.worlds[1].cards.pop(); }))).toEqual([
      'world 2: the decision world must end with one `summary` card; add it after the `decide` cards.',
    ]);
    expect(errorsOf(broken(quick, d => { d.worlds[1].cards.unshift(d.worlds[1].cards.pop()); d.worlds[1].cards[0].from = [['decide', 1]]; }))).toEqual([
      'world 2, card 1: the `summary` card must be the decision world\'s last card; move it to the end.',
    ]);
    expect(errorsOf(broken(quick, d => { d.worlds[0].cards.splice(0, 0, structuredClone(d.worlds[1].cards[2])); }))).toEqual([
      'world 1, card 1: a `summary` card belongs only at the end of the decision world; move it there.',
    ]);
  });

  it('needs exactly one limits card, right before the decision world', () => {
    const limits = (d: Json) => d.worlds[0].cards.pop();
    expect(errorsOf(broken(quick, limits))).toEqual([
      'The deck has no limits card; add an `info` card with `kind: "limits"` as the last card of world 1, right before the decision world.',
    ]);
    expect(errorsOf(broken(quick, d => { d.worlds[0].cards.unshift(structuredClone(d.worlds[0].cards.at(-1))); }))).toEqual([
      'world 1, card 1: the deck has more than one limits card; keep one, as the last card of world 1.',
    ]);
    expect(errorsOf(broken(thorough, d => { d.worlds[0].cards.push(d.worlds[2].cards.pop()); }))).toEqual([
      'world 1, card 4: the limits card must be the last card of world 3, right before the decision world; move it there.',
    ]);
  });

  it('needs summary.from to point at existing decide cards', () => {
    expect(errorsOf(broken(quick, d => { d.worlds[1].cards[2].from = [['decide', 0], ['nowhere', 0], ['costs', 1], ['decide', 9]]; }))).toEqual([
      'world 2, card 3: `from` entry 2 points at world "nowhere", which doesn\'t exist; use a world `id` from this deck.',
      'world 2, card 3: `from` entry 3 points at card index 1 of world "costs", which isn\'t a `decide` card; point it at one (card indexes count from 0).',
      'world 2, card 3: `from` entry 4 points at card index 9 of world "decide", which isn\'t a `decide` card; point it at one (card indexes count from 0).',
    ]);
  });

  it('leaves no deck when a card the structure needs is broken', () => {
    const decide = validateDeck(broken(quick, d => { delete d.worlds[1].cards[0].short; }));
    expect(decide.deck).toBeNull();
    expect(decide.errors).toEqual(['world 2, card 1: `short` is missing; add a short name for the decision, used in the summary.']);
    const limits = validateDeck(broken(quick, d => { d.worlds[0].cards[4].p = 3; }));
    expect(limits.deck).toBeNull();
    expect(limits.errors).toEqual(['world 1, card 5: `p` must be the body: text, or a list of paragraphs.']);
  });

  it('leaves no deck when a world has no valid card left', () => {
    const result = validateDeck(broken(thorough, d => { for (const c of d.worlds[1].cards) delete c.src; }));
    expect(result.deck).toBeNull();
    expect(result.errors).toEqual([
      `world 2, card 1: \`src\` is missing; add ${SRC}.`,
      `world 2, card 2: \`src\` is missing; add ${SRC}.`,
      `world 2, card 3: \`src\` is missing; add ${SRC}.`,
      'world 2 has no valid cards left; fix its cards.',
    ]);
  });
});

describe('card errors drop only that card', () => {
  const one = (edit: (d: Json) => void, base: Json = quick) => validateDeck(broken(base, edit));

  it('plays the rest of the deck and lists the skipped card', () => {
    const result = one(d => { delete d.worlds[0].cards[1].why; });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['world 1, card 2: `why` is missing; add the explanation shown after the play, naming the number, the reason or the source.']);
    expect(result.skipped).toEqual([{ world: 1, card: 2, type: 'quiz', h: 'What drives running costs most?', errors: result.errors }]);
    const expected = broken(quick, d => { d.worlds[0].cards.splice(1, 1); });
    expect(result.deck).toEqual(expected);
  });

  it('keeps summary.from on the same decide cards after a drop', () => {
    const result = one(d => {
      d.worlds[0].cards.splice(2, 0, structuredClone(d.worlds[1].cards[0]));
      d.worlds[1].cards[2].from.push(['costs', 2]);
      d.worlds[0].cards[0].src = 'http://example.org/not-https';
    });
    expect(result.errors).toEqual([`world 1, card 1: \`src\` must be ${SRC}.`]);
    expect(result.deck!.worlds[0].cards[1].type).toBe('decide');
    expect(result.deck!.worlds[1].cards[2].from).toEqual([['decide', 0], ['decide', 1], ['costs', 1]]);
  });

  it('has eight card types and no challenge', () => {
    expect(one(d => { d.worlds[0].cards[1] = { type: 'challenge', h: 'Break even', calc: 'v => v' }; }).errors).toEqual([
      'world 1, card 2: `type` must be the card type: one of info, big, quiz, guess, order, multi, decide, summary.',
    ]);
  });

  it('has no ticket on decide cards', () => {
    expect(one(d => { d.worlds[0].cards.splice(0, 0, { ...structuredClone(d.worlds[1].cards[0]), ticket: 'https://example.org/1' }); d.worlds[1].cards[2].from = [['decide', 0]]; }).errors).toEqual([
      'world 1, card 1: `ticket` isn\'t a field of a decide card; remove it.',
    ]);
  });

  it('needs number formats as templates', () => {
    expect(one(d => { d.worlds[0].cards[2].fmt = "v => v + ' min'"; }).errors).toEqual([
      'world 1, card 3: `fmt` must be a number template with {v} or {v:N} (N decimals, 0 to 20), such as "{v} min" or "g = {v:2}".',
    ]);
    expect(one(d => { d.worlds[0].cards[2].fmt = '{v:21}'; }).errors).toHaveLength(1);
  });

  it('needs src on every factual card: an https URL or {"notes": true}', () => {
    expect(one(d => { delete d.worlds[0].cards[1].src; }).errors).toEqual([`world 1, card 2: \`src\` is missing; add ${SRC}.`]);
    expect(one(d => { d.worlds[0].cards[1].src = 'Smith 2020 · [table](https://example.org)'; }).errors).toEqual([`world 1, card 2: \`src\` must be ${SRC}.`]);
    expect(one(d => { d.worlds[0].cards[1].src = { notes: false }; }).errors).toEqual([`world 1, card 2: \`src\` must be ${SRC}.`]);
    expect(one(d => { d.worlds[0].cards[1].src = 'https://example.org/a b'; }).errors).toEqual([`world 1, card 2: \`src\` must be ${SRC}.`]);
  });

  it('exempts only the limits card from src', () => {
    expect(one(d => { delete d.worlds[0].cards[4].kind; }).errors).toEqual([
      'The deck has no limits card; add an `info` card with `kind: "limits"` as the last card of world 1, right before the decision world.',
      `world 1, card 5: \`tag\` is missing; add ${TAG}.`,
      `world 1, card 5: \`src\` is missing; add ${SRC}.`,
    ]);
    expect(one(d => { d.worlds[0].cards[1].kind = 'limits'; }).errors[0]).toBe(
      'world 1, card 2: the deck has more than one limits card; keep one, as the last card of world 1.');
  });

  it('needs a source tag on info cards, with an optional evidence grade', () => {
    expect(one(d => { delete d.worlds[0].cards[0].tag; }).errors).toEqual([`world 1, card 1: \`tag\` is missing; add ${TAG}.`]);
    expect(one(d => { d.worlds[0].cards[0].tag = 'Strong evidence'; }).errors).toEqual([`world 1, card 1: \`tag\` must be ${TAG}.`]);
    expect(one(d => { d.worlds[0].cards[0].tag = { source: 'blog' }; }).errors).toEqual([`world 1, card 1: \`tag\` must be ${TAG}.`]);
    expect(one(d => { d.worlds[0].cards[0].tag = { source: 'study', grade: 'great' }; }).errors).toEqual([`world 1, card 1: \`tag\` must be ${TAG}.`]);
    expect(one(d => { d.worlds[0].cards[0].tag = { source: 'study', grade: 'strong' }; }).ok).toBe(true);
  });

  it('checks indexes and ranges inside a card', () => {
    expect(one(d => { d.worlds[0].cards[1].right = 3; }).errors).toEqual([
      'world 1, card 2: `right` is 3, but the card has 3 options; use an index from 0 to 2.',
    ]);
    expect(one(d => { d.worlds[2].cards[0].right = [1, 4]; }, thorough).errors).toEqual([
      'world 3, card 1: `right` has 4, but the card has 4 options; use indexes from 0 to 3.',
    ]);
    expect(one(d => { d.worlds[1].cards[1].shown = [2, 0, 0]; }, thorough).errors).toEqual([
      'world 2, card 2: `shown` must list each index of `items` (0 to 2) exactly once.',
    ]);
    expect(one(d => { d.worlds[0].cards[2].start = 7; }).errors).toEqual([
      'world 1, card 3: `start` (7) must be between `min` and `max` (1 to 6).',
    ]);
    expect(one(d => { d.worlds[0].cards[2].min = 6; }).errors).toEqual([
      'world 1, card 3: `min` (6) must be less than `max` (6).',
    ]);
  });

  it('checks decide cards in the decision world the same way, and they leave no deck', () => {
    const result = one(d => { d.worlds[1].cards[0].lean = 3; d.worlds[1].cards[0].after.pop(); });
    expect(result.deck).toBeNull();
    expect(result.errors).toEqual([
      'world 2, card 1: `lean` is 3, but the card has 3 options; use an index from 0 to 2.',
      'world 2, card 1: `after` has 2 texts for 3 options; give one per option.',
    ]);
  });

  it('reports every broken field of a card, once each', () => {
    expect(one(d => { d.worlds[0].cards[1].opts = ['a', 1, 'c', 'd', 'e']; d.worlds[0].cards[1].extra = 1; delete d.worlds[0].cards[1].h; }).errors).toEqual([
      'world 1, card 2: `h` is missing; add the headline, which states the point.',
      'world 1, card 2: `opts` must be 2 to 4 options, each a text.',
      'world 1, card 2: `extra` isn\'t a field of a quiz card; remove it.',
    ]);
  });

  it('names a card that is not an object', () => {
    expect(one(d => { d.worlds[0].cards[1] = 'quiz'; }).errors).toEqual(['world 1, card 2: the card must be an object with `type` and `h`.']);
  });
});

describe('the ui block', () => {
  it('drops a broken string and keeps the deck', () => {
    const result = validateDeck(broken(thorough, d => { d.ui.next = '<b>Next</b>'; d.ui.whyWin = 'won'; d.ui.tags.challenge = 'Challenge'; }));
    expect(result.errors).toEqual([
      'deck: `ui.tags.challenge` isn\'t one of the engine\'s strings; remove it.',
      'deck: `ui.next` must be plain text without HTML tags.',
      'deck: `ui.whyWin` isn\'t one of the engine\'s strings; remove it.',
    ]);
    expect(result.deck).toEqual(broken(thorough, d => { delete d.ui.next; }));
    expect(result.skipped).toEqual([]);
  });

  it('allows text that only mentions < and >', () => {
    expect(validateDeck(broken(thorough, d => { d.ui.lead = 'd < 0.5 is small, > 0.8 large'; })).ok).toBe(true);
  });
});
