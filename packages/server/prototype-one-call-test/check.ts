// PROTOTYPE, removed after the test (ludify#72). Checks a deck (with the real validator) and a brief
// (loosely, against brief-format.ts), and reports sizes and the time since the guide.
import { validateDeck } from '@ludify/deck/validate';

const BLOCKS = new Set(['p', 'lede', 'h', 'list', 'table', 'callout', 'facts', 'steps', 'checklist', 'terms', 'panels', 'tabs', 'compare', 'calc']);
const TONES = new Set(['good', 'caution', 'bad', 'unknown', 'you']);
const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);

// The model may pass a string instead of an object; a string that won't parse is the sign of a
// truncated or broken JSON.
function parse(x: unknown): { value: unknown; asString: boolean; jsonError?: string } {
  if (typeof x !== 'string') return { value: x, asString: false };
  try { return { value: JSON.parse(x), asString: true }; } catch (e) { return { value: null, asString: true, jsonError: (e as Error).message }; }
}

export function checkBrief(brief: unknown) {
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  let sections = 0;
  if (!isObj(brief)) return { errors: ['brief is not an object'], sections, counts };
  if (typeof brief.lang !== 'string') errors.push('lang missing');
  const pills = isObj(brief.pills) ? brief.pills : {};
  if (Object.keys(pills).length > 5) errors.push(`${Object.keys(pills).length} pills (max 5)`);
  for (const [id, p] of Object.entries(pills)) if (!isObj(p) || !TONES.has(p.tone)) errors.push(`pill ${id}: bad tone`);
  if (!isObj(brief.hero)) errors.push('hero missing');
  else {
    for (const f of ['title', 'lead', 'disclaimer']) if (typeof brief.hero[f] !== 'string' || !brief.hero[f]) errors.push(`hero.${f} missing`);
    if (!Array.isArray(brief.hero.facts) || !brief.hero.facts.length) errors.push('hero.facts missing');
  }
  if (!Array.isArray(brief.parts) || !brief.parts.length) return { errors: [...errors, 'parts missing'], sections, counts };
  let limits = false;
  const walk = (blocks: unknown, where: string, inTabs = false) => {
    if (!Array.isArray(blocks)) { errors.push(`${where}: blocks is not a list`); return; }
    blocks.forEach((b, i) => {
      const t = isObj(b) ? b.type : undefined;
      if (typeof t !== 'string' || !BLOCKS.has(t)) { errors.push(`${where} block ${i + 1}: unknown type ${JSON.stringify(t)}`); return; }
      counts[t] = (counts[t] ?? 0) + 1;
      if (t === 'tabs') {
        if (inTabs) errors.push(`${where} block ${i + 1}: tabs inside tabs`);
        (Array.isArray(b.tabs) ? b.tabs : []).forEach((tab: any, j: number) => walk(tab?.blocks, `${where} tab ${j + 1}`, true));
      }
      if (t === 'panels') (Array.isArray(b.items) ? b.items : []).forEach((p: any, j: number) => walk(p?.blocks, `${where} panel ${j + 1}`, inTabs));
      if (t === 'compare') {
        const n = Array.isArray(b.options) ? b.options.length : 0, d = Array.isArray(b.dims) ? b.dims.length : 0;
        if (n < 2 || n > 6 || d < 2 || d > 6) errors.push(`${where} compare: ${n} options × ${d} dims`);
      }
      if (t === 'calc' && (!Array.isArray(b.inputs) || !Array.isArray(b.outputs))) errors.push(`${where} calc: inputs or outputs missing`);
    });
  };
  brief.parts.forEach((p: any, pi: number) => {
    if (!Array.isArray(p?.sections)) { errors.push(`part ${pi + 1}: sections missing`); return; }
    p.sections.forEach((s: any, si: number) => {
      sections++;
      const where = `part ${pi + 1} section ${si + 1}`;
      if (s?.id === 'limits') limits = true;
      else if (!Array.isArray(s?.src) || !s.src.length) errors.push(`${where}: no src`);
      walk(s?.blocks, where);
    });
  });
  if (!limits) errors.push('no limits section');
  return { errors, sections, counts };
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

export function oneCallReport(deckIn: unknown, briefIn: unknown, started: unknown) {
  const now = Date.now();
  const deckP = parse(deckIn), briefP = parse(briefIn);
  const deck = validateDeck(deckP.value);
  const brief = checkBrief(briefP.value);
  const deckBytes = new TextEncoder().encode(typeof deckIn === 'string' ? deckIn : JSON.stringify(deckIn ?? null)).length;
  const briefBytes = new TextEncoder().encode(typeof briefIn === 'string' ? briefIn : JSON.stringify(briefIn ?? null)).length;
  const secs = typeof started === 'number' && started > 0 ? Math.round((now - started) / 1000) : null;
  const cards = deck.deck ? deck.deck.worlds.reduce((n, w) => n + w.cards.length, 0) : null;
  const run = {
    at: new Date(now).toISOString(), secondsSinceGuide: secs,
    deck: { bytes: deckBytes, asString: deckP.asString, jsonError: deckP.jsonError ?? null, valid: deck.ok, worlds: deck.deck?.worlds.length ?? null, cards, errors: deck.errors.length },
    brief: { bytes: briefBytes, asString: briefP.asString, jsonError: briefP.jsonError ?? null, valid: !brief.errors.length && !briefP.jsonError, sections: brief.sections, blocks: brief.counts, errors: brief.errors.length },
  };
  console.log('ONE-CALL RUN ' + JSON.stringify(run));
  const lines = [
    'PROTOTYPE one-call test: received.',
    `Time since the guide: ${secs === null ? 'unknown (no started)' : `${secs} s`}.`,
    `Deck: ${kb(deckBytes)}${deckP.asString ? ' (sent as a string)' : ''}, ${deck.ok ? 'valid' : `${deck.errors.length} problems`}, ${run.deck.worlds ?? '?'} worlds, ${cards ?? '?'} cards.`,
    `Brief: ${kb(briefBytes)}${briefP.asString ? ' (sent as a string)' : ''}, ${run.brief.valid ? 'passes the loose check' : `${brief.errors.length} problems`}, ${brief.sections} sections, blocks ${JSON.stringify(brief.counts)}.`,
    `Together: ${kb(deckBytes + briefBytes)}.`,
  ];
  if (deckP.jsonError) lines.push(`Deck JSON did not parse: ${deckP.jsonError}`);
  if (briefP.jsonError) lines.push(`Brief JSON did not parse: ${briefP.jsonError}`);
  if (deck.errors.length) lines.push('Deck problems (first 10):', ...deck.errors.slice(0, 10).map(e => `- ${e}`));
  if (brief.errors.length) lines.push('Brief problems (first 10):', ...brief.errors.slice(0, 10).map(e => `- ${e}`));
  lines.push('This is a test: do not fix or call again. Show the user these numbers as they are, in a short table, and stop.');
  return lines.join('\n');
}
