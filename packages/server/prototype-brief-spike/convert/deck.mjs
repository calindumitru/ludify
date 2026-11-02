import { readFileSync, writeFileSync } from 'node:fs';
const Q = JSON.parse(readFileSync(new URL('quest.json', import.meta.url), 'utf8'));
const ROOT = 'https://github.com/calindumitru/funvenio/blob/research/audiences-event-needs-2026-10-13/research/audiences-event-needs-2026-10-13/';
const url = s => (typeof s === 'string' ? (/\((https:[^)]+)\)/.exec(s)?.[1] || (/^https:/.test(s) ? s : null)) : null);
const keep = (o, ks) => Object.fromEntries(ks.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
const base = ['type', 'h', 'p', 'ul', 'more'];
const T = {
  info: [...base, 'tag', 'src', 'kind'], big: [...base, 'tag', 'big', 'src'], quiz: [...base, 'opts', 'right', 'why', 'src'],
  guess: [...base, 'min', 'max', 'step', 'start', 'answer', 'tol', 'fmt', 'why', 'src'], order: [...base, 'items', 'shown', 'why', 'src'],
  multi: [...base, 'opts', 'right', 'why', 'src'], decide: [...base, 'opts', 'lean', 'after', 'short', 'src'], summary: [...base, 'from'],
};
const worlds = Q.worlds.map((w, wi) => {
  let last = url(w.cards.find(c => url(c.src))?.src) || ROOT + 'README.md';
  const cards = w.cards.map(c0 => {
    let c = { ...c0 };
    if (c.type === 'challenge') c = { type: 'guess', h: 'How many intentional stay clicks a month for stay links to break even (middle case)?', p: 'Fixed costs are €100 a month.', min: 0, max: 1500, step: 5, start: 100, answer: 465, tol: 60, fmt: '{v} clicks', why: c.why, src: c.src };
    const u = url(c.src); if (u) last = u;
    if (c.type !== 'summary' && c.type !== 'decide') c.src = u || last;
    if (c.type === 'decide') { const u2 = url(c.src) || url(c.more) || c0.ticket; if (u2) c.src = u2; else delete c.src;
      if (!Array.isArray(c.after) || c.after.length !== c.opts.length) c.after = c.opts.map((_, i) => (c.after?.[i]) || 'Noted: the grilling ticket takes it from here.'); }
    if (c.type === 'info' && !c.kind) c.tag = { source: 'study' };
    if (c.type === 'info' && c.kind) delete c.src;
    return keep(c, T[c.type]);
  });
  return { ...keep(w, ['id', 'title', 'mins', 'tease', 'recap']), c: `w${wi + 1}`, cards };
});
const ui = keep(Q.ui, ['kicker', 'title', 'lead', 'gistTitle', 'gist']);
ui.key = 'ludify:spike:audience';
writeFileSync(new URL('../deck.json', import.meta.url), JSON.stringify({ lang: 'en', ui, worlds }, null, 1));
