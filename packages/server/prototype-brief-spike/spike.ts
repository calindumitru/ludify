// PROTOTYPE, never merge (ticket: "Prototype: a brief and its deck in Claude", calindumitru/ludify#64).
// One page, two views. `ludify_brief_spike` is called twice: view "brief" then view "deck", so the
// chat holds two messages like the real thing would. A floating bar switches:
//   Home:     door (inline door, brief read fullscreen) · tab (Brief tab inside the deck) · inline (whole brief scrolling)
//   Pointers: card ("more in the brief" per card, a hero door to the deck) · doors (a few fixed doors) · message (none but the decided one)
//   Mention:  whether Send to chat's message mentions the brief
// The choice lives in localStorage, which both iframes in one Claude chat share, so flipping it in
// one updates the other through the `storage` event.
import { App } from '@modelcontextprotocol/ext-apps/app-with-deps';
import { escapeHtml as esc, httpsUrl, linkHtml, renderMarkdown as md } from '../../deck/src/markdown.ts';
import { fillsComposer } from '../src/host.ts';

declare global {
  interface Window {
    ludifyBoot?: () => void;
    ludifyHost?: { openLink(url: string): unknown; sendMessage(text: string): Promise<unknown>; composer: boolean };
    spikeLocal?: { view: string; brief: any; deck: any; links: any };
  }
}

type V = { home: 'door' | 'tab' | 'inline'; ptr: 'return' | 'sheet' | 'inline'; mention: boolean };
const HOMES = ['door', 'tab', 'inline'] as const;
const PTRS = ['return', 'sheet', 'inline'] as const;
const HOME_NAME = { door: 'A · Door + fullscreen', tab: 'B · Tab in the deck', inline: 'C · Inline, scrolling' };
const PTR_NAME = { return: '1 · Return bar', sheet: '2 · Sheet over the card', inline: '3 · Inside the card' };
const VKEY = 'spike:variant2';
const readV = (): V => {
  try { const v = JSON.parse(localStorage.getItem(VKEY) || ''); if (HOMES.includes(v.home) && PTRS.includes(v.ptr)) return v; } catch {}
  return { home: 'tab', ptr: 'return', mention: true };
};
const writeV = (v: V) => { try { localStorage.setItem(VKEY, JSON.stringify(v)); } catch {} };

let V = readV();
let view = 'brief';
let B: any, D: any, LINKS: Record<string, string> = {};
let app: App | null = null;
let fullscreen = false;

const $ = (s: string, r: ParentNode = document) => r.querySelector(s) as HTMLElement | null;
const list = (x: any) => (Array.isArray(x) ? x : x == null ? [] : [x]);

// ---------- brief rendering (data → markup; every string through md/esc) ----------
const TONES: Record<string, string> = { good: 'good', caution: 'caution', bad: 'bad', unknown: 'unknown', you: 'you' };
const pill = (k: string) => {
  const p = B.pills?.[k];
  return p ? `<span class="pill t-${TONES[p.tone] || 'unknown'}">${esc(p.label)}</span>` : '';
};
const PILL_RE = /\{\{([a-z]+)\}\}/g;
const txt = (s: string) => md(String(s ?? '')).replace(PILL_RE, (_, k) => pill(k));
function titleHtml(t: string) {
  const m = /^([\s\S]*?)\{([^{}]+?)\}([\s\S]*)$/.exec(String(t ?? ''));
  return m ? `${txt(m[1])}<em>${txt(m[2])}</em>${txt(m[3])}` : txt(t);
}
const fmt = (f: string | undefined, v: number) => (v < 0 ? '−' : '') + (f || '{v}').replace(/\{v(?::(\d))?\}/, (_, d) => Math.abs(v).toLocaleString('en', { minimumFractionDigits: +(d || 0), maximumFractionDigits: +(d || 0) }));

// A closed arithmetic language: numbers, names, + - * / ( ), min(), max(), round(). Never eval.
function evalFormula(src: string, env: Record<string, number>): number {
  const toks = src.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|[-+*/(),]/g) || [];
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const expr = (): number => { let v = term(); while (peek() === '+' || peek() === '-') v = next() === '+' ? v + term() : v - term(); return v; };
  const term = (): number => { let v = factor(); while (peek() === '*' || peek() === '/') v = next() === '*' ? v * factor() : v / factor(); return v; };
  const factor = (): number => {
    const t = next();
    if (t === '-') return -factor();
    if (t === '(') { const v = expr(); next(); return v; }
    if (/^\d/.test(t)) return +t;
    if (t === 'min' || t === 'max' || t === 'round') {
      next(); const args = [expr()]; while (peek() === ',') { next(); args.push(expr()); } next();
      return t === 'round' ? Math.round(args[0]) : (Math as any)[t](...args);
    }
    if (t in env) return env[t];
    throw new Error(`unknown name ${t}`);
  };
  return expr();
}

const srcList = (src: any[]) => {
  const items = list(src).filter((x: any) => httpsUrl(x.url));
  if (!items.length) return '';
  const name = (x: any) => x.label || new URL(x.url).hostname.replace(/^www\./, '');
  return `<details class="b-src"><summary>${esc(B.ui.sources)} (${items.length})</summary><ul>${items.map((x: any) =>
    `<li>${linkHtml(httpsUrl(x.url)!, esc(name(x)))}</li>`).join('')}</ul></details>`;
};

function block(b: any, path: string): string {
  switch (b.type) {
    case 'p': return `<p>${txt(b.text)}</p>`;
    case 'lede': return `<p class="b-lede">${txt(b.text)}</p>`;
    case 'h': return `<h4>${txt(b.text)}</h4>`;
    case 'list': return `<ul class="b-list">${list(b.items).map((x: string) => `<li>${txt(x)}</li>`).join('')}</ul>`;
    case 'table': return `<div class="b-table"><table><thead><tr>${b.cols.map((c: string) => `<th>${txt(c)}</th>`).join('')}</tr></thead><tbody>${
      b.rows.map((r: string[]) => `<tr>${r.map(c => `<td>${txt(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${b.note ? `<p class="b-note">${txt(b.note)}</p>` : ''}</div>`;
    case 'callout': return `<div class="b-callout c-${esc(b.tone)}"><p>${b.title ? `<b>${txt(b.title)}.</b> ` : ''}${txt(b.text)}</p></div>`;
    case 'facts': return `<div class="b-facts">${b.items.map((f: any) => `<div><strong>${txt(f.v)}</strong><span>${txt(f.l)}</span>${f.pill ? pill(f.pill) : ''}</div>`).join('')}</div>`;
    case 'steps': return `<ol class="b-steps">${b.items.map((s: any) => `<li><b>${txt(s.t)}</b><span>${txt(s.d)}</span></li>`).join('')}</ol>`;
    case 'checklist': {
      const ticks = loadTicks(b.id);
      return `<ul class="b-check">${b.items.map((x: string, i: number) => `<li><label><input type="checkbox" data-tick="${esc(b.id)}:${i}" ${ticks[i] ? 'checked' : ''}> <span>${txt(x)}</span></label></li>`).join('')}</ul>`;
    }
    case 'tabs': return `<div class="b-tabs" data-tabs="${esc(path)}"><div class="b-tabrow" role="tablist">${b.tabs.map((t: any, i: number) =>
      `<button role="tab" data-tab="${i}" aria-selected="${i === 0}">${txt(t.label)}</button>`).join('')}</div>${b.tabs.map((t: any, i: number) =>
      `<div class="b-tabpane" data-pane="${i}" ${i ? 'hidden' : ''}>${t.blocks.map((x: any, j: number) => block(x, `${path}.${i}.${j}`)).join('')}</div>`).join('')}</div>`;
    case 'panels': return b.items.map((p: any, i: number) => `<details class="b-panel"><summary>${txt(p.title)}</summary>${p.blocks.map((x: any, j: number) => block(x, `${path}.${i}.${j}`)).join('')}</details>`).join('');
    case 'terms': return `<dl class="b-terms">${b.items.map((t: any) => `<dt>${txt(t.t)}</dt><dd>${txt(t.d)}</dd>`).join('')}</dl>`;
    case 'compare': return compareHtml(b, path, 0);
    case 'calc': return calcHtml(b, path);
  }
  return '';
}

function compareHtml(b: any, path: string, sel: number) {
  const o = b.options[sel];
  const confs = [...new Set(b.options.flatMap((x: any) => b.dims.map((d: any) => x.scores[d.id][1])))];
  const one = confs.length === 1;
  return `<div class="b-compare" data-compare="${esc(path)}"><div class="b-opts">${b.options.map((x: any, i: number) =>
    `<button data-opt="${i}" aria-pressed="${i === sel}">${txt(x.name)}</button>`).join('')}</div>
    <div class="b-scores">${b.dims.map((d: any) => { const [sc, c] = o.scores[d.id]; return `<div class="b-score"><span>${txt(d.label)}</span><i style="--s:${(+sc / 5) * 100}%"></i><b>${+sc}</b>${one ? '' : `<em>${esc(c)} ${esc(B.ui.confidence)}</em>`}</div>`; }).join('')}
    ${one ? `<p class="b-note">Out of 5. ${esc(B.ui.judgment)}s, ${esc(confs[0])} ${esc(B.ui.confidence)}.</p>` : ''}</div>
    <p><b>${txt(o.verdict)}</b> ${txt(o.why)}</p>
    <ul class="b-points">${o.points.map(([k, t]: string[]) => `<li>${pill(k)} ${txt(t)}</li>`).join('')}</ul>
    ${o.src && httpsUrl(o.src) ? `<p class="b-note">${linkHtml(httpsUrl(o.src)!, 'Full assessment')}</p>` : ''}</div>`;
}

function calcHtml(b: any, path: string) {
  return `<div class="b-calc" data-calc="${esc(path)}">${b.inputs.map((x: any) => `<label class="b-in"><span>${txt(x.label)}</span>
      <output data-out-in="${esc(x.id)}">${esc(fmt(x.fmt, x.value))}</output>
      <input type="range" data-in="${esc(x.id)}" min="${+x.min}" max="${+x.max}" step="${+x.step}" value="${+x.value}">${x.help ? `<small>${txt(x.help)}</small>` : ''}
      ${x.presets ? `<span class="b-presets">${x.presets.map(([l, v]: [string, number]) => `<button data-preset="${esc(x.id)}" data-v="${+v}">${esc(l)}</button>`).join('')}</span>` : ''}</label>`).join('')}
    <div class="b-outs">${b.outputs.map((o: any) => `<div class="b-out"><span>${txt(o.label)}</span><strong data-out="${esc(o.id)}"></strong>${o.note ? `<em>${txt(o.note)}</em>` : ''}</div>`).join('')}</div>${b.note ? `<p class="b-note">${txt(b.note)}</p>` : ''}</div>`;
}
function runCalc(el: HTMLElement) {
  const b = blockAt(el.dataset.calc!);
  const env: Record<string, number> = {};
  for (const x of b.inputs) env[x.id] = +(el.querySelector(`[data-in="${x.id}"]`) as HTMLInputElement).value;
  for (const x of b.inputs) el.querySelector(`[data-out-in="${x.id}"]`)!.textContent = fmt(x.fmt, env[x.id]);
  for (const o of b.outputs) {
    let v: number; try { v = evalFormula(o.f, env); } catch { v = NaN; }
    env[o.id] = v;
    const out = el.querySelector(`[data-out="${o.id}"]`)!;
    out.textContent = Number.isFinite(v) ? fmt(o.fmt, v) : '?';
    out.classList.toggle('neg', v < 0);
  }
}
function blockAt(path: string) {
  const [p, s, ...rest] = path.split('.').map(Number);
  let b: any = B.parts[p].sections[s].blocks[rest[0]];
  for (let i = 1; i < rest.length; i += 2) b = (b.tabs ? b.tabs[rest[i]].blocks : b.items[rest[i]].blocks)[rest[i + 1]];
  return b;
}

const TKEY = 'spike:ticks';
const loadTicks = (id: string): Record<number, boolean> => { try { return JSON.parse(localStorage.getItem(TKEY) || '{}')[id] || {}; } catch { return {}; } };
function saveTick(id: string, i: number, on: boolean) {
  try { const all = JSON.parse(localStorage.getItem(TKEY) || '{}'); (all[id] ||= {})[i] = on; localStorage.setItem(TKEY, JSON.stringify(all)); } catch {}
}

const sections = () => B.parts.flatMap((p: any, pi: number) => p.sections.map((s: any, si: number) => ({ p, s, pi, si })));
const decideWorld = () => D.worlds.length - 1;

function contentsHtml() {
  return `<nav class="b-contents">${B.parts.map((p: any) => `<div class="b-cpart" style="--pc:var(--${p.c})"><b>${esc(p.title)}</b><ul>${p.sections.map((s: any) =>
    `<li><button data-goto="${esc(s.id)}">${esc(s.title)}</button></li>`).join('')}</ul></div>`).join('')}</nav>`;
}
const gist = () => `<ul class="b-gist">${B.hero.facts.map((f: any) => `<li><b>${txt(f.v)}</b> ${txt(f.l)}</li>`).join('')}</ul>`;
function heroHtml() {
  const h = B.hero;
  const toDeck = false ? `<p><button class="b-link" data-deck="0">▶ Play the deck from the same research (${D.worlds.reduce((n: number, w: any) => n + w.cards.length, 0)} cards)</button></p>` : '';
  return `<header class="b-hero"><div class="b-kicker">${txt(h.kicker)}</div><h1>${titleHtml(h.title)}</h1><p class="lead">${txt(h.lead)}</p>
    ${gist()}<p class="b-disc">${txt(h.disclaimer)}</p>${toDeck}</header>`;
}
function secHtml(s: any, pi: number, si: number) {
  return `<article class="b-sec" id="sec-${esc(s.id)}"><h3>${txt(s.title)}</h3><p class="b-lede">${txt(s.lede)}</p>
      ${s.blocks.map((b: any, bi: number) => block(b, `${pi}.${si}.${bi}`)).join('')}
      ${s.id === 'open' || s.id === 'decisions' ? decisionsPointer() : ''}${srcList(s.src)}</article>`;
}
function sectionById(id: string) { return sections().find((x: any) => x.s.id === id); }
function fullBriefHtml() {
  const body = B.parts.map((p: any, pi: number) => `<section class="b-part" style="--pc:var(--${p.c})"><h2>${esc(p.title)}</h2><p class="b-pintro">${txt(p.intro)}</p>
    ${p.sections.map((s: any, si: number) => `<article class="b-sec" id="sec-${esc(s.id)}"><h3>${txt(s.title)}</h3><p class="b-lede">${txt(s.lede)}</p>
      ${s.blocks.map((b: any, bi: number) => block(b, `${pi}.${si}.${bi}`)).join('')}
      ${s.id === 'open' || s.id === 'decisions' ? decisionsPointer() : ''}${srcList(s.src)}</article>`).join('')}</section>`).join('');
  return `<div class="b-top"><span class="b-ttl">${esc(B.hero.title.replace(/[{}]/g, ''))}</span><details class="b-cdrop"><summary>${esc(B.ui.contents)}</summary>${contentsHtml()}</details>${
    fullscreen ? `<button class="b-close" data-act="close-brief">✕ ${esc(B.ui.close)}</button>` : ''}</div>${heroHtml()}${body}`;
}
// Decided (#63): a goal brief ends with "Decisions for you" and a pointer to the deck. Pointer
// sets 1 and 2 make it a button; set 3 leaves it as words.
function decisionsPointer() {
  const w = D.worlds[decideWorld()];
  return false
    ? `<p class="b-pointer">Make your picks in the deck's last world, “${esc(w.title)}”.</p>`
    : `<button class="b-pointer go" data-deck="${decideWorld()}">Make your picks in the deck: “${esc(w.title)}” →</button>`;
}

function doorHtml() {
  const h = B.hero;
  return `<div class="b-door"><div class="b-kicker">${txt(h.kicker)}</div><h1>${titleHtml(h.title)}</h1>${gist()}
    <details class="b-doorc"><summary>${esc(B.ui.contents)}: ${B.parts.length} parts, ${sections().length} sections</summary>${contentsHtml()}</details>
    <button class="go b-open" data-act="open-brief">${esc(B.ui.open)} ⤢</button></div>`;
}

// ---------- the brief view ----------
function drawBriefView(goto?: string) {
  const root = $('#brief-root')!;
  if (V.home === 'tab') {
    root.innerHTML = `<div class="spike-note"><b>Home B:</b> the brief has no message of its own here: it's the <b>Brief</b> tab of the deck in the next message. In the real build the model would draw only the deck.</div>`;
  } else if (V.home === 'door' && !fullscreen) {
    root.innerHTML = doorHtml();
  } else {
    root.innerHTML = fullBriefHtml();
  }
  afterBrief(root, goto);
}
function afterBrief(root: HTMLElement, goto?: string) {
  root.querySelectorAll<HTMLElement>('[data-calc]').forEach(runCalc);
  if (goto) { const el = root.querySelector(`#sec-${CSS.escape(goto)}`); el?.scrollIntoView({ block: 'start' }); el?.classList.add('flash'); }
}

// ---------- the deck view ----------
let deckBooted = false;
let deckTab: 'deck' | 'brief' = 'deck';
let returnTo: string | null = null; // the card heading a brief link left from (pointer set 1)
let inlineOpen: string | null = null; // the section open inside the card (pointer set 3)
function drawDeckView(goto?: string) {
  document.body.classList.toggle('has-tabs', V.home === 'tab');
  const tabs = $('#spike-tabs')!;
  tabs.hidden = V.home !== 'tab';
  if (V.home !== 'tab') deckTab = 'deck';
  tabs.innerHTML = `<button data-dtab="deck" aria-selected="${deckTab === 'deck'}">Deck</button><button data-dtab="brief" aria-selected="${deckTab === 'brief'}">Brief</button>`;
  const inBrief = V.home === 'tab' && deckTab === 'brief';
  for (const s of ['.bar', '#main', '#nav']) { const el = $(s); if (el) el.style.display = inBrief ? 'none' : ''; }
  const layer = $('#brief-layer')!;
  if (inBrief) { layer.hidden = false; layer.className = 'in-tab'; layer.innerHTML = (returnTo ? `<div class="spike-return"><button data-act="back-to-card">↩ Back to your card: ${esc(returnTo)}</button></div>` : '') + fullBriefHtml(); scrollTo(0, 0); afterBrief(layer, goto); }
  else if (layer.className === 'in-tab') { layer.hidden = true; layer.innerHTML = ''; }
  if (!deckBooted) { deckBooted = true; window.ludifyBoot!(); }
  decorateDeck();
}
// Opens the brief over the deck (homes A and C: the deck's own iframe has the brief data too).
async function briefOverDeck(goto: string) {
  if (V.home === 'tab' && V.ptr === 'sheet') { openSheet(goto); return; }
  if (V.home === 'tab') { returnTo = $('#card h2')?.textContent || 'the deck'; deckTab = 'brief'; drawDeckView(goto); return; }
  await goFull(true);
  const layer = $('#brief-layer')!;
  layer.hidden = false; layer.className = 'over';
  layer.innerHTML = fullBriefHtml();
  afterBrief(layer, goto);
}
// Pointer set 2: only that section, in a sheet over the card; Done closes it.
function openSheet(id: string) {
  const x = sectionById(id); if (!x) return;
  const layer = $('#brief-layer')!;
  layer.hidden = false; layer.className = 'sheet';
  layer.innerHTML = `<div class="spike-sheet"><div class="spike-sheet-top"><span>📖 From the brief</span><button data-act="whole-brief" data-sec="${esc(id)}">Whole brief</button><button class="go" data-act="sheet-done">Done ✓</button></div>${secHtml(x.s, x.pi, x.si)}</div>`;
  afterBrief(layer);
  document.body.classList.add('sheet-open');
}
function closeSheet() { const layer = $('#brief-layer')!; if (layer.className === 'sheet') { layer.hidden = true; layer.innerHTML = ''; layer.className = ''; } document.body.classList.remove('sheet-open'); }
function closeLayer() {
  const layer = $('#brief-layer')!;
  if (layer.className === 'over') { layer.hidden = true; layer.innerHTML = ''; layer.className = ''; }
}

// Adds the brief link to whatever card the engine just drew. Every card that has a matching
// section gets one; the pointer set decides what the link does and how you get back.
function decorateDeck() {
  const main = $('#main');
  if (!main) return;
  main.querySelectorAll('.spike-ptr').forEach(e => e.remove());
  const card = $('#card', main);
  if (!card) return;
  const m = /^(.*) · (\d+)\/\d+$/.exec($('.where .w', main)?.textContent || '');
  if (!m) return;
  const w = D.worlds.findIndex((x: any) => x.title === m[1]);
  const target = LINKS[`${D.worlds[w]?.id}:${+m[2] - 1}`];
  const x = target && sectionById(target);
  if (!x) return;
  if (V.ptr === 'inline') {
    card.insertAdjacentHTML('beforeend', `<details class="spike-ptr spike-inline" data-sec="${esc(target)}" ${inlineOpen === target ? 'open' : ''}><summary>📖 Read the brief on this: ${esc(x.s.short)}</summary><div class="spike-inline-body">${secHtml(x.s, x.pi, x.si)}</div></details>`);
    card.querySelectorAll<HTMLElement>('[data-calc]').forEach(runCalc);
    return;
  }
  card.insertAdjacentHTML('beforeend', `<button class="spike-ptr spike-more" data-brief="${esc(target)}">📖 More in the brief: ${esc(x.s.short)} →</button>`);
}

// ---------- fullscreen ----------
async function goFull(on: boolean) {
  fullscreen = on;
  document.body.classList.toggle('full', on);
  if (!app) return;
  try {
    const modes = app.getHostContext()?.availableDisplayModes;
    if (!modes || modes.includes(on ? 'fullscreen' : 'inline')) await app.requestDisplayMode({ mode: on ? 'fullscreen' : 'inline' });
  } catch {}
}

// ---------- the brief → deck pointer across iframes ----------
// Homes A and C: the brief and the deck are separate messages, so the brief asks the deck through
// shared localStorage; the deck opens the world.
function toDeck(world: number) {
  if (view === 'deck') { deckTab = 'deck'; closeLayer(); goFull(false); drawDeckView(); (document.querySelector(`[data-world="${world}"]`) as HTMLElement | null)?.click(); return; }
  try { localStorage.setItem('spike:goto', JSON.stringify({ world, at: Date.now() })); } catch {}
  if (fullscreen) { goFull(false); drawBriefView(); }
  toast('Opened in the deck, in the next message ↓');
}
function toast(t: string) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = t;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

// ---------- the variant bar ----------
function drawBar() {
  const bar = $('#spike-bar')!;
  bar.innerHTML = `<span class="sb-tag">PROTOTYPE</span>
    <span class="sb-grp"><button data-sb="home:-1">◀</button><span>Home ${esc(HOME_NAME[V.home])}</span><button data-sb="home:1">▶</button></span>
    <span class="sb-grp"><button data-sb="ptr:-1">◀</button><span>Pointers ${esc(PTR_NAME[V.ptr])}</span><button data-sb="ptr:1">▶</button></span>
    <label class="sb-grp"><input type="checkbox" data-sb="mention" ${V.mention ? 'checked' : ''}> Send to chat mentions the brief</label>`;
}
function redrawAll() {
  drawBar();
  if (view === 'brief') drawBriefView(); else { closeLayer(); drawDeckView(); }
}
function setV(nv: V) { V = nv; writeV(V); redrawAll(); }

// ---------- events ----------
document.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const a = t.closest('a[href]') as HTMLAnchorElement | null;
  if (a && t.closest('#brief-root, #brief-layer')) {
    e.preventDefault(); e.stopPropagation();
    if (a.protocol === 'https:') { if (app) app.openLink({ url: a.href }).catch(() => {}); else window.open(a.href, '_blank'); }
    return;
  }
  const el = t.closest('button, input[type=checkbox]') as HTMLElement | null;
  if (!el) return;
  const d = el.dataset;
  if (d.sb) {
    if (d.sb === 'mention') return setV({ ...V, mention: (el as HTMLInputElement).checked });
    const [k, dir] = d.sb.split(':');
    const arr: readonly string[] = k === 'home' ? HOMES : PTRS;
    const cur = arr.indexOf((V as any)[k]);
    if (view === 'brief' && fullscreen) goFull(false);
    return setV({ ...V, [k]: arr[(cur + +dir + arr.length) % arr.length] } as V);
  }
  if (d.tick) { const [id, i] = d.tick.split(':'); saveTick(id, +i, (el as HTMLInputElement).checked); return; }
  if (d.act === 'open-brief') { e.stopPropagation(); goFull(true).then(() => drawBriefView()); return; }
  if (d.act === 'close-brief') {
    e.stopPropagation();
    if (view === 'brief') { goFull(false).then(() => drawBriefView()); } else { closeLayer(); goFull(false); }
    return;
  }
  if (d.goto) {
    e.stopPropagation();
    if (view === 'brief' && V.home === 'door' && !fullscreen) { goFull(true).then(() => drawBriefView(d.goto)); return; }
    $('.b-cdrop[open]')?.removeAttribute('open');
    const box = t.closest('#brief-root, #brief-layer') as HTMLElement;
    t.closest('.b-cdrop')?.removeAttribute('open');
    afterBrief(box, d.goto);
    return;
  }
  if (d.brief) { e.stopPropagation(); briefOverDeck(d.brief); return; }
  if (d.act === 'back-to-card') { e.stopPropagation(); returnTo = null; deckTab = 'deck'; drawDeckView(); scrollTo(0, 0); return; }
  if (d.act === 'sheet-done') { e.stopPropagation(); closeSheet(); return; }
  if (d.act === 'whole-brief') { e.stopPropagation(); closeSheet(); returnTo = $('#card h2')?.textContent || null; deckTab = 'brief'; drawDeckView(d.sec); return; }
  if (d.deck != null) { e.stopPropagation(); toDeck(+d.deck); return; }
  if (d.dtab) { deckTab = d.dtab as 'deck' | 'brief'; if (deckTab === 'deck') returnTo = null; closeSheet(); drawDeckView(); return; }
  if (d.tab != null) {
    const box = el.closest('.b-tabs')!;
    box.querySelectorAll(':scope > .b-tabrow > button').forEach((b, i) => b.setAttribute('aria-selected', String(i === +d.tab!)));
    box.querySelectorAll<HTMLElement>(':scope > .b-tabpane').forEach((p, i) => { p.hidden = i !== +d.tab!; });
    box.querySelectorAll<HTMLElement>('[data-calc]').forEach(runCalc);
    return;
  }
  if (d.opt != null) {
    const box = el.closest('[data-compare]') as HTMLElement;
    box.outerHTML = compareHtml(blockAt(box.dataset.compare!), box.dataset.compare!, +d.opt);
    return;
  }
  if (d.preset) {
    const box = el.closest('[data-calc]') as HTMLElement;
    (box.querySelector(`[data-in="${d.preset}"]`) as HTMLInputElement).value = d.v!;
    runCalc(box);
  }
}, true);
document.addEventListener('toggle', e => {
  const t = e.target as HTMLElement;
  if (t.classList?.contains('spike-inline')) inlineOpen = (t as HTMLDetailsElement).open ? t.dataset.sec! : null;
}, true);
document.addEventListener('input', e => {
  const t = e.target as HTMLElement;
  const box = t.closest('[data-calc]') as HTMLElement | null;
  if (box) runCalc(box);
});
window.addEventListener('storage', e => {
  if (e.key === VKEY) { V = readV(); if (view === 'brief' && fullscreen && V.home !== 'door') goFull(false); redrawAll(); }
  if (e.key === 'spike:goto' && view === 'deck' && e.newValue) {
    const { world } = JSON.parse(e.newValue);
    deckTab = 'deck'; drawDeckView();
    (document.querySelector(`[data-world="${world}"]`) as HTMLElement | null)?.click();
  }
});

// ---------- start ----------
function start(spike: any, host: App | null) {
  view = spike.view === 'deck' ? 'deck' : 'brief';
  B = spike.brief; D = spike.deck; LINKS = spike.links || {};
  document.body.classList.add(`view-${view}`);
  drawBar();
  if (view === 'brief') {
    for (const s of ['.bar', '#main', '#nav']) { const el = $(s); if (el) el.style.display = 'none'; }
    drawBriefView();
    return;
  }
  document.getElementById('deck')!.textContent = JSON.stringify(D);
  if (host) {
    window.ludifyHost = {
      openLink: url => host.openLink({ url }),
      // Pointer test: whether the picks message mentions the brief.
      sendMessage: text => host.sendMessage({ role: 'user', content: [{ type: 'text', text: V.mention
        ? `${text}\n\nThe brief in this chat has the detail behind these, under "Decisions for you".` : text }] }),
      composer: fillsComposer(host),
    };
  }
  const obs = new MutationObserver(() => { obs.disconnect(); decorateDeck(); obs.observe($('#main')!, { childList: true, subtree: true }); });
  obs.observe($('#main')!, { childList: true, subtree: true });
  drawDeckView();
}

if (window.spikeLocal) {
  start(window.spikeLocal, null);
} else {
  app = new App({ name: 'ludify-brief-spike', version: '1' });
  let started = false;
  app.ontoolresult = result => {
    const spike = (result._meta as any)?.spike;
    if (started || !spike) return;
    started = true;
    start(spike, app);
  };
  app.onhostcontextchanged = ctx => {
    if (ctx.displayMode && ctx.displayMode !== 'fullscreen' && fullscreen) {
      fullscreen = false; document.body.classList.remove('full');
      if (view === 'brief') drawBriefView(); else closeLayer();
    }
  };
  app.connect().catch(() => {});
}
