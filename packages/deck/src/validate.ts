// validateDeck checks a model-written deck against deck.schema.json and the rules a schema can't
// express, and says what's wrong in plain sentences the model can act on. It never runs deck text.
// The schema validator interprets the schema (no generated code), so this also runs in a Worker.
import { Validator, type OutputUnit } from '@cfworker/json-schema';
import schema from '../deck.schema.json' with { type: 'json' };

export const MAX_DECK_BYTES = 64 * 1024;

export type SkippedCard = { world: number; card: number; type?: string; h?: string; errors: string[] };
export type DeckResult = { ok: boolean; errors: string[]; deck: Deck | null; skipped: SkippedCard[] };

// The shape after validation; the schema is the full contract.
export type Card = { type: string; h: string; kind?: string; from?: [string, number][]; [field: string]: unknown };
export type World = { id: string; cards: Card[]; [field: string]: unknown };
export type Deck = { lang: string; ui?: Record<string, unknown>; worlds: World[] };

type Node = { description?: string; $ref?: string; properties?: Record<string, Node>; [k: string]: unknown };
const defs = schema.$defs as unknown as Record<string, Node>;

// The deck, world and ui shapes come from a copy of the schema whose cards are left open; each
// card is then checked on its own, so a broken card is named and dropped instead of failing all.
const outline = structuredClone(schema) as unknown as Node & { $defs: Record<string, Node> };
outline.$id = schema.$id.replace(/\.json$/, '.outline.json');
outline.$defs.world.properties!.cards = { type: 'array', minItems: 1, items: {} };
const deckValidator = new Validator(outline as never, '2020-12', false);
const cardValidator = new Validator({ $ref: `${schema.$id}#/$defs/card` }, '2020-12', false);
cardValidator.addSchema(schema as never);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const describe = (node: Node | undefined): string | undefined => {
  if (!node) return undefined;
  if (node.description) return node.description;
  return node.$ref ? describe(defs[node.$ref.replace('#/$defs/', '')]) : undefined;
};

// Where a schema error points, in words: the place ("world 2, card 3"), the field, what it must be.
type Place = { where: string; field: string; desc?: string; depth: number; unknown: string };

function placeInDeck(path: string[]): Place | { world: number; rest: string[] } {
  const [head, key, sub] = path;
  if (head === 'worlds' && path.length > 1) return { world: Number(key), rest: path.slice(2) };
  if (head === 'ui' && path.length > 1) {
    const ui = defs.ui.properties!;
    if (key === 'tags' && path.length > 2)
      return { where: 'deck', field: `ui.tags.${sub}`, desc: describe(ui.tags.properties![sub]), depth: 3, unknown: "isn't one of the engine's strings" };
    return { where: 'deck', field: `ui.${key}`, desc: describe(ui[key]), depth: 2, unknown: "isn't one of the engine's strings" };
  }
  return { where: 'deck', field: head, desc: describe(schema.properties[head as keyof typeof schema.properties] as Node), depth: 1, unknown: "isn't a deck field" };
}

const placeInWorld = (w: number, path: string[]): Place =>
  ({ where: `world ${w + 1}`, field: path[0], desc: describe(defs.world.properties![path[0]]), depth: 1, unknown: "isn't a world field" });

const placeInCard = (where: string, type: string, path: string[]): Place => {
  const field = path[0];
  const node = field === 'type' ? defs.card.properties!.type : defs[type]?.properties?.[field] ?? defs.cardBase.properties![field];
  return { where, field, desc: describe(node), depth: 1, unknown: `isn't a field of a ${type} card` };
};

const pointer = (location: string) =>
  location.replace(/^#\/?/, '').split('/').filter(Boolean).map(s => decodeURIComponent(s).replace(/~1/g, '/').replace(/~0/g, '~'));

// Turns schema errors into one sentence per field. Errors that only say "a subschema failed"
// are skipped; the leaf errors under them say which field and why.
function sentences(errors: OutputUnit[], place: (path: string[]) => Place | null, whole: string): string[] {
  const out = new Set<string>();
  for (const e of errors) {
    const path = pointer(e.instanceLocation);
    if (e.keyword === 'required') {
      const missing = /required property "(.+)"/.exec(e.error)?.[1];
      const p = missing && place([...path, missing]);
      if (p) out.add(`${p.where}: \`${p.field}\` is missing; add ${p.desc}.`);
    } else if (e.keyword === 'false') {
      const p = place(path);
      if (!p) continue;
      if (path.length > p.depth && p.desc) out.add(`${p.where}: \`${p.field}\` must be ${p.desc}.`);
      else if (!p.desc) out.add(`${p.where}: \`${p.field}\` ${p.unknown}; remove it.`);
    } else if (!['$ref', 'allOf', 'anyOf', 'if', 'then', 'else', 'properties', 'items', 'prefixItems', 'unevaluatedProperties', 'additionalProperties'].includes(e.keyword)) {
      if (path.length === 0) { out.add(whole); continue; }
      const p = place(path);
      if (p) out.add(p.desc ? `${p.where}: \`${p.field}\` must be ${p.desc}.` : `${p.where}: \`${p.field}\` ${p.unknown}; remove it.`);
    }
  }
  return [...out];
}

const list = (n: number) => (n === 1 ? '0' : `0 to ${n - 1}`);

// The schema's pattern only shapes a URL; this parses it.
const isHttpsUrl = (s: string) => {
  try { const u = new URL(s); return u.protocol === 'https:' && u.hostname !== ''; } catch { return false; }
};

// What the lang pattern can't see: a variant or an extension singleton used twice (RFC 5646 §2.2.5).
const langRepeats = (tag: string) => {
  const parts = tag.toLowerCase().split('-');
  const end = parts.indexOf('x');
  const subtags = parts.slice(1, end < 0 ? undefined : end);
  const firstSingleton = subtags.findIndex(p => p.length === 1);
  const variants = (firstSingleton < 0 ? subtags : subtags.slice(0, firstSingleton)).filter(p => p.length >= 5 || /^\d.{3}$/.test(p));
  const singletons = subtags.filter(p => p.length === 1);
  return new Set(variants).size < variants.length || new Set(singletons).size < singletons.length;
};

// Rules inside one card that the schema can't express: indexes that must exist, ranges that
// must hold. Only run on a card that already matches the schema.
function cardRules(c: Card, where: string): string[] {
  const errors: string[] = [];
  if (typeof c.src === 'string' && !isHttpsUrl(c.src)) errors.push(`${where}: \`src\` must be ${describe(defs.src)}.`);
  const opts = c.opts as unknown[] | undefined;
  if (c.type === 'quiz' && (c.right as number) >= opts!.length)
    errors.push(`${where}: \`right\` is ${c.right}, but the card has ${opts!.length} options; use an index from ${list(opts!.length)}.`);
  if (c.type === 'multi') for (const r of c.right as number[]) if (r >= opts!.length)
    errors.push(`${where}: \`right\` has ${r}, but the card has ${opts!.length} options; use indexes from ${list(opts!.length)}.`);
  if (c.type === 'order') {
    const n = (c.items as unknown[]).length, shown = c.shown as number[];
    if (shown.length !== n || [...shown].sort((a, b) => a - b).some((v, i) => v !== i))
      errors.push(`${where}: \`shown\` must list each index of \`items\` (${list(n)}) exactly once.`);
  }
  if (c.type === 'decide') {
    if (c.lean != null && (c.lean as number) >= opts!.length)
      errors.push(`${where}: \`lean\` is ${c.lean}, but the card has ${opts!.length} options; use an index from ${list(opts!.length)}.`);
    const after = (c.after as unknown[]).length;
    if (after !== opts!.length) errors.push(`${where}: \`after\` has ${after} texts for ${opts!.length} options; give one per option.`);
  }
  if (c.type === 'guess') {
    const { min, max, start, answer } = c as unknown as Record<string, number>;
    if (min >= max) errors.push(`${where}: \`min\` (${min}) must be less than \`max\` (${max}).`);
    else for (const [name, v] of [['start', start], ['answer', answer]] as const)
      if (v < min || v > max) errors.push(`${where}: \`${name}\` (${v}) must be between \`min\` and \`max\` (${min} to ${max}).`);
  }
  return errors;
}

// Deck-level rules: 2 or 4 worlds, the decision world last, the limits card right before it,
// and a summary that collects existing decide cards.
function structureRules(worlds: { id?: unknown; cards: Record<string, unknown>[] }[]): string[] {
  const errors: string[] = [];
  const n = worlds.length;
  if (n !== 2 && n !== 4) errors.push(`The deck has ${n} world${n === 1 ? '' : 's'}; it needs 2 (quick) or 4 (thorough).`);

  const seen = new Map<unknown, number>();
  worlds.forEach((w, i) => {
    if (seen.has(w.id)) errors.push(`world ${i + 1}: \`id\` "${w.id}" is already used by world ${seen.get(w.id)! + 1}; give each world its own id.`);
    else seen.set(w.id, i);
  });

  const last = n - 1, lastCards = worlds[last].cards;
  const at = (w: number, c: number) => `world ${w + 1}, card ${c + 1}`;
  if (n < 2) errors.push(`The deck needs a world before the decision world, ending on the limits card.`);
  if (!lastCards.some(c => c.type === 'decide'))
    errors.push(`world ${n}: the last world is the decision world, so it needs \`decide\` cards and then one \`summary\`; it has no \`decide\` card.`);
  const summaries = lastCards.filter(c => c.type === 'summary').length;
  lastCards.forEach((c, i) => {
    if (c.type === 'summary' && summaries > 1 && i !== lastCards.length - 1)
      errors.push(`${at(last, i)}: the decision world has more than one \`summary\` card; keep one, at the end.`);
    else if (c.type === 'summary' && i !== lastCards.length - 1)
      errors.push(`${at(last, i)}: the \`summary\` card must be the decision world's last card; move it to the end.`);
    else if (c.type !== 'decide' && c.type !== 'summary')
      errors.push(`${at(last, i)}: the decision world holds only \`decide\` cards and one \`summary\`; move this \`${c.type}\` card to an earlier world.`);
  });
  if (summaries === 0)
    errors.push(`world ${n}: the decision world must end with one \`summary\` card; add it after the \`decide\` cards.`);
  worlds.forEach((w, wi) => w.cards.forEach((c, ci) => {
    if (c.type === 'summary' && wi !== last) errors.push(`${at(wi, ci)}: a \`summary\` card belongs only at the end of the decision world; move it there.`);
  }));

  const limits: [number, number][] = [];
  worlds.forEach((w, wi) => w.cards.forEach((c, ci) => { if (c.kind === 'limits') limits.push([wi, ci]); }));
  const before = n - 2;
  const isPlace = ([wi, ci]: [number, number]) => n >= 2 && wi === before && ci === worlds[before].cards.length - 1;
  if (limits.length === 0 && n >= 2)
    errors.push(`The deck has no limits card; add an \`info\` card with \`kind: "limits"\` as the last card of world ${n - 1}, right before the decision world.`);
  for (const l of limits) {
    if (limits.length > 1 && !isPlace(l)) errors.push(`${at(...l)}: the deck has more than one limits card; keep one, as the last card of world ${n - 1}.`);
    else if (!isPlace(l) && n >= 2) errors.push(`${at(...l)}: the limits card must be the last card of world ${n - 1}, right before the decision world; move it there.`);
  }

  const summaryAt = lastCards.length - 1, summary = lastCards[summaryAt];
  if (summary?.type === 'summary' && Array.isArray(summary.from)) {
    (summary.from as unknown[]).forEach((entry, k) => {
      if (!Array.isArray(entry)) return;
      const [wid, ci] = entry, target = worlds.find(w => w.id === wid);
      const where = `${at(last, summaryAt)}: \`from\` entry ${k + 1}`;
      if (!target) errors.push(`${where} points at world "${wid}", which doesn't exist; use a world \`id\` from this deck.`);
      else if (target.cards[ci as number]?.type !== 'decide')
        errors.push(`${where} points at card index ${ci} of world "${wid}", which isn't a \`decide\` card; point it at one (card indexes count from 0).`);
    });
  }
  return errors;
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

const fail = (error: string): DeckResult => ({ ok: false, errors: [error], deck: null, skipped: [] });

// Never throws: whatever the input, the caller gets a result to show the model.
export function validateDeck(json: unknown): DeckResult {
  try {
    return check(json);
  } catch (e) {
    return fail(`The deck couldn't be checked (${(e as Error)?.message ?? e}); send it again as a JSON object with \`lang\` and \`worlds\`.`);
  }
}

function check(json: unknown): DeckResult {
  let text: string;
  try { text = typeof json === 'string' ? json : JSON.stringify(json) ?? ''; } catch { return fail('The deck must be JSON data.'); }
  const size = bytes(text);
  if (size > MAX_DECK_BYTES)
    return fail(`The deck is ${size.toLocaleString('en')} bytes; the limit is ${MAX_DECK_BYTES.toLocaleString('en')} (64 KB), so shorten it.`);
  let input: unknown;
  try { input = JSON.parse(text); } catch (e) { return fail(`The deck isn't valid JSON: ${(e as Error).message}.`); }
  if (!isObject(input)) return fail('The deck must be a JSON object with `lang` and `worlds`.');

  // Deck, world and ui fields. Bad ui strings are dropped (the engine's English fills in);
  // anything else wrong at this level leaves no deck to play.
  const deckErrors: string[] = [], uiErrors: string[] = [], badUi = new Set<string>();
  const worldErrors = new Map<number, string[]>();
  for (const e of deckValidator.validate(input).errors) {
    const path = pointer(e.instanceLocation);
    const where = placeInDeck(path);
    const errs = sentences([e], p => {
      const at = placeInDeck(p);
      return 'world' in at ? (at.rest.length ? placeInWorld(at.world, at.rest) : null) : at;
    }, 'The deck must be a JSON object with `lang` and `worlds`.');
    if ('world' in where) {
      if (where.rest[0] === 'cards' && where.rest.length > 1) continue; // checked per card below
      if (where.rest.length === 0 && e.keyword === 'type')
        errs.push(`world ${where.world + 1}: the world must be an object with \`id\`, \`c\`, \`title\`, \`mins\`, \`tease\`, \`recap\` and \`cards\`.`);
      worldErrors.set(where.world, [...(worldErrors.get(where.world) ?? []), ...errs]);
    } else if (path[0] === 'ui' && path.length > 1) {
      if (errs.length === 0) continue;
      uiErrors.push(...errs);
      badUi.add(path[1] === 'tags' && path.length > 2 ? `tags.${path[2]}` : path[1]);
    } else deckErrors.push(...errs);
  }
  for (const errs of [...worldErrors.keys()].sort((a, b) => a - b).map(k => worldErrors.get(k)!)) deckErrors.push(...errs);
  if (typeof input.lang === 'string' && langRepeats(input.lang))
    deckErrors.push(`deck: \`lang\` must be ${describe(schema.properties.lang as Node)}, with no variant or extension used twice.`);
  const ui = input.ui;
  if (isObject(ui) && typeof ui.fullLink === 'string' && !badUi.has('fullLink') && !isHttpsUrl(ui.fullLink)) {
    uiErrors.push(`deck: \`ui.fullLink\` must be ${describe(defs.httpsUrl)}.`);
    badUi.add('fullLink');
  }

  const rawWorlds = Array.isArray(input.worlds) ? input.worlds : [];
  // Structure is checked on every deck with worlds, broken cards and all: a card that isn't an
  // object counts as a card of no type, so it can't hide a missing limits card or summary.
  if (rawWorlds.length > 0) deckErrors.push(...structureRules(rawWorlds.map(w => ({
    id: isObject(w) ? w.id : undefined,
    cards: isObject(w) && Array.isArray(w.cards) ? w.cards.map(c => (isObject(c) ? c : {})) : [],
  }))));

  // Cards: each checked on its own; a broken card is listed in `skipped` and left out.
  const cardErrors: string[] = [], skipped: SkippedCard[] = [];
  const keep: boolean[][] = [];
  rawWorlds.forEach((w, wi) => {
    keep[wi] = [];
    if (!isObject(w) || !Array.isArray(w.cards)) return;
    w.cards.forEach((c: unknown, ci: number) => {
      const where = `world ${wi + 1}, card ${ci + 1}`;
      const card = isObject(c) ? c : {};
      const typeOk = typeof card.type === 'string' && (defs.card.properties!.type.enum as string[]).includes(card.type);
      let errs = sentences(cardValidator.validate(c).errors, p => placeInCard(where, String(card.type), p),
        `${where}: the card must be an object with \`type\` and \`h\`.`);
      if (!typeOk) errs = errs.filter(m => m.startsWith(`${where}: \`type\``) || !isObject(c));
      if (errs.length === 0) errs = cardRules(c as Card, where);
      keep[wi][ci] = errs.length === 0;
      if (errs.length) {
        cardErrors.push(...errs);
        skipped.push({ world: wi + 1, card: ci + 1, ...(typeof card.type === 'string' && { type: card.type }), ...(typeof card.h === 'string' && { h: card.h }), errors: errs });
      }
    });
  });

  const errors = [...new Set([...deckErrors, ...uiErrors]), ...cardErrors];
  if (deckErrors.length) return { ok: false, errors, deck: null, skipped };

  // A broken card is dropped only if what's left still has the structure: the limits card and
  // the summary can't go, the decision world keeps at least one decide card, the summary still
  // collects one, and every world keeps a card to play.
  const worlds = rawWorlds as World[];
  const last = worlds.length - 1, summaryAt = worlds[last].cards.length - 1;
  const late: string[] = [];
  const needed = skipped.some(s => worlds[s.world - 1].cards[s.card - 1]?.kind === 'limits' || (s.world - 1 === last && s.card - 1 === summaryAt));
  for (const wi of worlds.keys()) if (!keep[wi].some(Boolean)) late.push(`world ${wi + 1} has no valid cards left; fix its cards.`);
  if (!needed && !keep[last].some((k, ci) => k && worlds[last].cards[ci].type === 'decide'))
    late.push(`world ${last + 1} has no valid \`decide\` card left; fix its decide cards.`);

  // Drop skipped cards and keep summary.from pointing at the same decide cards.
  const newIndex = worlds.map((_, wi) => { let n = 0; return keep[wi].map(k => (k ? n++ : -1)); });
  const worldIndex = new Map(worlds.map((w, i) => [w.id, i]));
  const from = needed ? [] : worlds[last].cards[summaryAt].from!
    .map(([wid, ci]) => [wid, newIndex[worldIndex.get(wid)!][ci]] as [string, number])
    .filter(([, ci]) => ci >= 0);
  if (!needed && from.length === 0 && late.length === 0)
    late.push(`world ${last + 1}, card ${summaryAt + 1}: every card \`from\` points at was skipped; fix those decide cards.`);
  errors.push(...late);
  if (needed || late.length) return { ok: false, errors, deck: null, skipped };

  const deck = structuredClone(input) as unknown as Deck;
  for (const key of badUi) {
    const [k, sub] = key.split('.');
    if (sub) delete (deck.ui!.tags as Record<string, unknown> | undefined)?.[sub];
    else delete deck.ui![k];
  }
  deck.worlds.forEach((w, wi) => { w.cards = w.cards.filter((_, ci) => keep[wi][ci]); });
  deck.worlds[last].cards.at(-1)!.from = from;

  return { ok: errors.length === 0, errors, deck, skipped };
}
