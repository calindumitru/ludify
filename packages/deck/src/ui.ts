// The engine's own words, in English. A deck written in another language carries a `ui` block with
// the same keys translated; its strings win, key by key. Every one of them is plain text: the
// engine shows it with textContent or escapes it, never as markup.

export const DEFAULT_UI = {
  gistTitle: '⚡ The 60-second version',
  gistOpen: 'open ▾',
  gistClose: 'close ▴',
  left: '{n} cards left · ~{m} min',
  allDoneShort: 'All done',
  worldMeta: 'World {i} · {m} min',
  calmOn: 'Calm mode: hide XP',
  calmOff: 'Show XP again',
  speak: 'Read this card aloud',
  anyOrder: 'Play in any order',
  resume: 'Pick up where you stopped',
  reset: 'Start over',
  resetAsk: 'Tap again to clear your progress',
  map: 'Map',
  mapLabel: 'Back to the map',
  prevLabel: 'Previous card',
  keysHint: '← → keys or swipe',
  progressLabel: 'Cards done',
  tags: {
    info: 'Know this',
    big: 'One number',
    quiz: 'Quick quiz',
    guess: 'Guess',
    order: 'Put in order',
    multi: 'Pick all that apply',
    decide: 'Your call',
    summary: 'Your picks',
  },
  sources: {
    official: 'Official source',
    study: 'Study',
    test: 'Test',
    vendor: 'Vendor claim',
    notes: 'From your notes · unverified',
  },
  grades: {
    strong: 'Strong evidence',
    moderate: 'Moderate evidence',
    weak: 'Weak evidence',
    none: 'No evidence',
    against: 'Evidence against',
  },
  source: 'Source',
  more: 'Tell me more',
  next: 'Next →',
  finishWorld: 'Finish world →',
  lock: 'Lock it in',
  undo: 'Undo last',
  yes: ['Nailed it.', 'Spot on.', 'Yes!', 'Exactly.'],
  no: "Not quite. Here's the answer:",
  close: 'Close. The full answer:',
  orderWas: "Here's the real order:",
  actual: 'The real number: {v}.',
  lean: 'research leans',
  noted: 'Noted.',
  changeAny: 'You can change it any time.',
  skipped: '(skipped)',
  skippedNote: 'These cards had a problem, so they are left out:',
  skippedWhy: 'this card broke a deck rule',
  copy: 'Copy',
  copied: 'Copied ✓',
  whyRight: 'right first try',
  whyTried: 'for trying',
  whyClose: 'close guess',
  whyDecide: 'decision made',
  recapTitle: 'To keep from this world',
  nextWorld: 'Next: {w} →',
};

export type Ui = typeof DEFAULT_UI & Record<string, unknown>;

const isMap = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const MAPS = new Set(['tags', 'sources', 'grades']);

/** The deck's `ui` block over the English defaults; the three label maps merge key by key. */
export function mergeUi(deckUi: unknown): Ui {
  const out: Record<string, unknown> = { ...DEFAULT_UI };
  for (const k of MAPS) out[k] = { ...(out[k] as object) };
  if (!isMap(deckUi)) return out as Ui;
  for (const [k, v] of Object.entries(deckUi)) {
    if (k === '__proto__') continue;
    if (MAPS.has(k)) {
      if (!isMap(v)) continue;
      const map = out[k] as Record<string, unknown>;
      for (const [kk, vv] of Object.entries(v)) if (kk !== '__proto__') map[kk] = vv;
    } else out[k] = v;
  }
  return out as Ui;
}

/** A template with its {name} slots filled; values go in as written, unknown slots stay. */
export const fill = (template: unknown, values: Record<string, unknown>): string =>
  String(template ?? '').replace(/\{(\w+)\}/g, (slot, name: string) => (Object.hasOwn(values, name) ? String(values[name]) : slot));

/** Hyphenated letters and digits: the validator checks a tag's shape; this only keeps an odd one. */
const LANG_TAG = /^[A-Za-z0-9]{1,8}(-[A-Za-z0-9]{1,8})*$/;

/** The deck's language as a canonical BCP 47 tag; a tag Intl can't canonicalize stays as written when it is hyphenated letters and digits, and anything else is English. */
export function deckLang(lang: unknown): string {
  if (typeof lang !== 'string' || !lang) return 'en';
  try {
    return Intl.getCanonicalLocales(lang)[0] ?? 'en';
  } catch {
    return LANG_TAG.test(lang) ? lang : 'en';
  }
}
