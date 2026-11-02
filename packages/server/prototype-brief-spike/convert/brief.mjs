import { readFileSync, writeFileSync } from 'node:fs';
const F = JSON.parse(readFileSync(new URL('fb.json', import.meta.url), 'utf8'));
const DIR = new URL('../', import.meta.url).pathname;
const PK = { OK: 'ok', GATE: 'gate', NO: 'no', UNKNOWN: 'unknown', OPEN: 'open' };
const pills = s => typeof s === 'string' ? s.replace(/\[(OK|GATE|NO|UNKNOWN|OPEN)\]/g, (_, k) => `{{${PK[k]}}}`) : s;
const join = b => Array.isArray(b) ? b.map(pills).join(' ') : pills(b);
const TONE = { key: 'key', tip: 'tip', warn: 'warn', stop: 'stop', note: 'key', info: 'key' };
const typeOf = u => /github\.com\/calindumitru/.test(u) ? 'notes' : /help\.|partners|affiliate|impact|ko-fi|expedia|booking|skiddle|fever/i.test(u) ? 'vendor' : 'official';
const cats = F.data.cats;
const pts = g => { const m = /^\[(OK|GATE|NO|UNKNOWN|OPEN)\]\s*(.*)$/.exec(g); return m ? [PK[m[1]], m[2]] : ['unknown', g]; };
const widgets = {
  scores: () => ({ type: 'compare',
    dims: [{ id: 'benefit', label: 'Benefit to users' }, { id: 'aff', label: 'Affiliates' }, { id: 'paid', label: 'Paid planning' }, { id: 'sup', label: 'Support' }],
    options: cats.map(c => ({ id: c.id, name: c.name + (c.focus ? ' ★' : ''), scores: Object.fromEntries(['benefit', 'aff', 'paid', 'sup'].map((d, i) => [d, [c.s[i], 'low']])),
      verdict: c.rec, why: c.why, points: c.gates.map(pts), src: c.link })) }),
  stay: () => { const u = F.ui.stay; return { type: 'calc',
    inputs: [
      { id: 'N', label: u.N, help: u.NHelp, min: 100, max: 20000, step: 100, value: 1000, fmt: '{v}' },
      { id: 'b', label: u.b, help: u.bHelp, min: 0.5, max: 10, step: 0.5, value: 3, fmt: '{v:1}%', presets: [['Lower', 1], ['Middle', 3], ['Higher', 6]] },
      { id: 'a', label: u.a, help: u.aHelp, min: 10, max: 100, step: 5, value: 70, fmt: '{v}%' },
      { id: 'c', label: u.c, help: u.cHelp, min: 40, max: 100, step: 5, value: 80, fmt: '{v}%' },
      { id: 'V', label: u.V, help: u.VHelp, min: 100, max: 800, step: 25, value: 350, fmt: '€{v}' },
      { id: 'r', label: u.r, help: u.rHelp, min: 1, max: 8, step: 0.5, value: 4, fmt: '{v:1}%' },
      { id: 'fixed', label: u.fixed, help: u.fixedHelp, min: 0, max: 500, step: 10, value: 100, fmt: '€{v}' }],
    outputs: [
      { id: 'bookings', label: u.oBookings, f: 'N * b / 100', fmt: '{v:1}' },
      { id: 'credited', label: u.oAttributed, f: 'bookings * a / 100', fmt: '{v:1}' },
      { id: 'stays', label: u.oStays, f: 'credited * c / 100', fmt: '{v:1}' },
      { id: 'gross', label: u.oGross, f: 'stays * V * r / 100', fmt: '€{v}' },
      { id: 'net', label: u.oNet, f: 'gross - N * 0.02 - fixed', fmt: '€{v}', note: 'Cash arrives 60–150 days after the stay.' }],
    note: u.foot }; },
  tip: () => { const u = F.ui.tip; return { type: 'calc',
    inputs: [
      { id: 'amt', label: u.amt, help: u.amtHelp, min: 1, max: 50, step: 1, value: 5, fmt: '€{v}' },
      { id: 'fee', label: u.mode, help: u.modeHelp, min: 0, max: 5, step: 5, value: 0, fmt: '{v}%' }],
    outputs: [
      { id: 'stripe', label: u.oStripe, f: 'amt * 1.5 / 100 + 0.25', fmt: '€{v:2}' },
      { id: 'kofi', label: u.oKofi, f: 'amt * fee / 100', fmt: '€{v:2}' },
      { id: 'keep', label: u.oKeep, f: 'amt - stripe - kofi', fmt: '€{v:2}' },
      { id: 'share', label: u.oShare, f: '(stripe + kofi) / amt * 100', fmt: '{v}%' }],
    note: u.foot }; },
};
function block(b, sec) {
  if (b.widget) return widgets[b.widget]();
  if (b.call) return { type: 'callout', tone: TONE[b.call.kind] || 'key', title: b.call.title, text: join(b.call.body) };
  if (b.table) return { type: 'table', cols: b.table.head, rows: b.table.rows.map(r => r.map(pills)), note: pills(b.table.note) };
  if (b.cards) return { type: 'terms', items: b.cards.map(c => ({ t: c.h, d: pills(c.b) })) };
  if (b.p) return { type: 'p', text: join(b.p) };
  if (b.sources) { sec.src.push(...b.sources.map(([l, u]) => ({ label: l, url: u, type: typeOf(u) }))); return null; }
  if (b.terms) return { type: 'terms', items: b.terms.map(([t, d]) => ({ t, d: pills(d) })) };
  if (b.tabs) return { type: 'tabs', tabs: b.tabs.tabs.map(t => ({ label: t.label, blocks: t.blocks.map(x => block(x, sec)).filter(Boolean) })) };
  if (b.steps) return { type: 'steps', items: b.steps.map(s => ({ t: s.h, d: pills(s.b) })) };
  if (b.check) return { type: 'checklist', id: b.check.id, items: b.check.items.map(pills) };
  if (b.acc) return { type: 'panels', items: b.acc.map(a => ({ title: a.h, blocks: [{ type: 'p', text: join(a.b) }] })) };
  throw new Error('unknown block ' + JSON.stringify(b).slice(0, 80));
}
const COL = { aud: 'p1', money: 'p2', prod: 'p3', dec: 'p4' };
const parts = F.parts.map(p => ({ id: p.id, title: p.title, c: COL[p.color] || 'p1', intro: pills(p.door),
  sections: p.sections.map(s => { const sec = { id: s.id, title: s.title, short: s.short, lede: pills(s.lede), src: [] };
    // Calm rule: a compare explorer already shows the scores, so a table repeating them goes.
    let blocks = s.blocks.map(b => block(b, sec)).filter(Boolean);
    if (blocks.some(b => b.type === 'compare')) blocks = blocks.filter(b => b.type !== 'table');
    sec.blocks = blocks; return sec; }) }));
const ui = F.ui;
parts.push({ id: 'limits', title: 'Limits', c: 'p1', intro: 'What this brief can\'t tell you.', sections: [{ id: 'limits', title: 'What this can\'t tell you', short: 'Limits', lede: 'Read the scores and the money as what they are.', src: [], blocks: [{ type: 'list', items: ui.footer.slice().reverse().map(pills) }] }] });
const brief = { lang: 'en',
  ui: { contents: 'Contents', open: 'Open the brief', close: 'Close', sources: 'Sources', judgment: 'Judgment', confidence: 'confidence', verdict: 'Verdict', why: 'Why', pickOption: 'Pick a category to see its scores' },
  pills: { ok: { label: ui.pills.OK, tone: 'good' }, gate: { label: ui.pills.GATE, tone: 'caution' }, no: { label: ui.pills.NO, tone: 'bad' }, unknown: { label: ui.pills.UNKNOWN, tone: 'unknown' }, open: { label: ui.pills.OPEN, tone: 'you' } },
  hero: { kicker: ui.hero.kicker, title: ui.hero.title, lead: ui.hero.lead, facts: ui.hero.facts.map(f => ({ v: f.v, l: pills(f.t) })), disclaimer: ui.hero.disclaimer },
  parts };
writeFileSync(DIR + 'brief.json', JSON.stringify(brief, null, 1));
// deck card → brief section, by shared source file, else by world
const deck = JSON.parse(readFileSync(DIR + 'deck.json', 'utf8'));
const bySrc = {}; for (const p of parts) for (const s of p.sections) for (const x of s.src) bySrc[x.url] ??= s.id;
for (const c of cats) bySrc[c.link] ??= 'five';
const WORLD = { aud: 'five', money: 'shortlist', prod: 'first', call: 'open' };
const links = {};
deck.worlds.forEach(w => w.cards.forEach((c, i) => { links[`${w.id}:${i}`] = c.kind === 'limits' ? 'limits' : (typeof c.src === 'string' && bySrc[c.src]) || WORLD[w.id]; }));
writeFileSync(DIR + 'links.json', JSON.stringify(links, null, 1));
console.log('brief bytes', JSON.stringify(brief).length, 'links', Object.values(links).join(' '));
