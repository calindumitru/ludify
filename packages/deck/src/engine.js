// The deck engine, moved from calindumitru/skills @ f308ebc (skills/fun-briefs/assets/deck/index.html).
// The deck is data: JSON read from <script type="application/json" id="deck">, never run as code.
// Deck text reaches the page in one of three ways only: renderMarkdown (md) for model text that may
// carry **bold**, `code` or [links](https://…); escapeHtml (esc) or textContent for plain text; and
// numbers checked with num() before they go into markup or attributes.
import { formatValue } from './format.ts';
import { escapeHtml as esc, httpsUrl, linkHtml, renderMarkdown as md } from './markdown.ts';
import { deckLang, fill, mergeUi } from './ui.ts';
import { pickVoice } from './voice.ts';
import { reward } from './xp.ts';

(() => {
  const Q = JSON.parse(document.getElementById('deck').textContent);
  const U = mergeUi(Q.ui), W = Q.worlds;
  const LANG = deckLang(Q.lang);
  const KEY = typeof U.key === 'string' && U.key ? U.key : 'fq:v1';
  const isMap = x => typeof x === 'object' && x !== null && !Array.isArray(x);
  const num = (x, d = 0) => (Number.isFinite(+x) ? +x : d);
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return isMap(v) ? v : {}; } catch { return {}; } };
  let saved = load();
  // Progress maps are keyed by world ids from the deck, so they have no prototype: an id like
  // "__proto__" is then just a key.
  const dict = m => Object.assign(Object.create(null), isMap(m) ? m : {});
  const fresh = s => ({ calm: !!s.calm, plan: Number.isInteger(s.plan) ? s.plan : null, xp: num(s.xp), done: dict(s.done), ans: dict(s.ans), view: 'home', w: 0, c: 0, dir: 1, tmp: {} });
  const S = fresh(saved);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ calm: S.calm, plan: S.plan, xp: S.xp, done: S.done, ans: S.ans, at: [S.w, S.c] })); } catch {} };
  // Plain text from the ui block, escaped; `vars` fill its {slots} first.
  const T = (key, vars) => esc(vars ? fill(U[key], vars) : U[key]);
  const label = (map, key) => (typeof key === 'string' && Object.hasOwn(map, key) && typeof map[key] === 'string' ? map[key] : typeof key === 'string' ? key : '');
  const list = x => (Array.isArray(x) ? x : x == null ? [] : [x]);
  const show = (c, v) => formatValue(typeof c.fmt === 'string' ? c.fmt : undefined, v);
  const colour = (w, i) => (/^w[1-4]$/.test(w.c) ? w.c : `w${i % 4 + 1}`);
  const id = (w, c) => W[w].id + ':' + c;
  const total = W.reduce((a, w) => a + w.cards.length, 0);
  const doneCount = () => Object.keys(S.done).length;
  const worldDone = w => W[w].cards.every((_, c) => S.done[id(w, c)]);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- the page in the deck's language ----------
  document.documentElement.lang = LANG;
  if (typeof U.docTitle === 'string') document.title = U.docTitle;
  const homeBtn = document.querySelector('.home-btn');
  homeBtn.textContent = `◎ ${U.map}`; homeBtn.setAttribute('aria-label', String(U.mapLabel));
  document.querySelector('[data-act="prev"]').setAttribute('aria-label', String(U.prevLabel));
  document.querySelector('.nav .hint').textContent = U.keysHint;
  document.querySelector('.prog').setAttribute('aria-label', String(U.progressLabel));
  if ('speechSynthesis' in window) speechSynthesis.getVoices(); // starts the voice list loading

  // ---------- XP ----------
  // XP only ever follows an explanation: reward() gives it for an answered play whose card shows
  // why, and nothing for reading a card or finishing a world.
  function award(n, why) {
    S.xp += n; save(); drawBar(true);
    if (S.calm) return;
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = `+${n} XP · ${why}`;
    document.body.appendChild(t); setTimeout(() => t.remove(), 1500);
  }
  function complete(w, c, r) {
    const k = id(w, c);
    if (S.done[k]) return;
    S.done[k] = 1;
    if (r) award(r.xp, U[r.why]); else { save(); drawBar(); }
  }
  function drawBar(pop) {
    document.getElementById('prog').style.width = (doneCount() / total * 100) + '%';
    document.body.classList.toggle('calm', S.calm);
    const left = total - doneCount();
    document.getElementById('left').textContent = left ? fill(U.left, { n: left, m: Math.max(1, Math.round(left * num(U.secsPerCard, 35) / 60)) }) : U.allDoneShort;
    const x = document.getElementById('xp');
    x.innerHTML = `<b>★</b> ${num(S.xp)} XP`;
    if (pop && !reduced) { x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); }
  }

  // ---------- home ----------
  // The title's {braced} words are its accent: "What keeps {ADHD brains} reading".
  function titleHtml(t) {
    const m = /^([\s\S]*?)\{([\s\S]+?)\}([\s\S]*)$/.exec(String(t ?? ''));
    return m ? `${md(m[1])}<em>${md(m[2])}</em>${md(m[3])}` : md(t);
  }
  // A partial deck (ludify_render after a failed retry) names each card it left out, with one
  // reason in the deck's language; the exact errors went to the model.
  function leftOut() {
    const cards = list(Q.skipped).filter(isMap);
    if (!cards.length) return '';
    const name = s => (typeof s.h === 'string' && s.h ? md(s.h) : esc(label(U.tags, s.type) || `${num(s.world)}.${num(s.card)}`));
    return `<div class="left-out" role="note"><p>${T('skippedNote')}</p><ul>${cards.map(s =>
      `<li><strong>${name(s)}</strong>: ${T('skippedWhy')}</li>`).join('')}</ul></div>`;
  }
  function home() {
    S.view = 'home'; document.getElementById('nav').hidden = true;
    document.body.style.removeProperty('--wc');
    const resume = Array.isArray(saved.at) && doneCount() > 0 && doneCount() < total;
    const opts = list(U.planOpts);
    const planned = S.plan != null && opts[S.plan] != null;
    const fullLink = httpsUrl(U.fullLink) && U.fullText ? ` · ${linkHtml(U.fullLink, esc(U.fullText))}` : '';
    document.getElementById('main').innerHTML = `${leftOut()}
      <div class="hello"><div class="kicker">${md(U.kicker)}</div><h1>${titleHtml(U.title)}</h1><p class="lead">${md(U.lead)}</p></div>
      ${U.planQ ? `<div class="plan"><p class="q">${md(U.planQ)}</p><div class="row">${opts.map((o, i) => `<button data-plan="${i}" aria-pressed="${S.plan === i}">${esc(o)}</button>`).join('')}</div>${planned ? `<p class="then">${md(fill(U.planThen, { when: String(opts[S.plan]).toLowerCase() }))}</p>` : ''}</div>` : ''}
      ${U.gist ? `<details class="gist"><summary data-open="${T('gistOpen')}" data-close="${T('gistClose')}">${md(U.gistTitle)}</summary><ol>${list(U.gist).map(g => `<li>${md(g)}</li>`).join('')}</ol></details>` : ''}
      <div class="worlds">${W.map((w, i) => {
        const n = w.cards.filter((_, c) => S.done[id(i, c)]).length, wc = colour(w, i);
        return `<button class="world ${worldDone(i) ? 'done' : ''}" data-world="${i}" style="--wc:var(--${wc});--ws:var(--${wc}s)">
          ${worldDone(i) ? '<span class="tick" aria-hidden="true">✓</span>' : ''}
          <span class="n">${T('worldMeta', { i: i + 1, m: num(w.mins) })}</span><span class="t">${esc(w.title)}</span><span class="d">${md(w.tease)}</span>
          <span class="meta"><i style="--p:${n / w.cards.length * 100}%"></i>${n}/${w.cards.length}</span></button>`;
      }).join('')}</div>
      <div class="shelf">${resume ? `<button data-act="resume" style="font-weight:700;color:var(--ink)">${T('resume')} →</button> · ` : ''}<span>${T('anyOrder')}</span> · <button data-act="calm" aria-pressed="${S.calm}">${S.calm ? T('calmOff') : T('calmOn')}</button>${fullLink} · <button data-act="reset">${T('reset')}</button></div>`;
    drawBar(); scrollTo(0, 0);
  }

  // ---------- card ----------
  const P = {};
  const playable = c => Object.hasOwn(P, c.type);
  // Reading cards (the summary too) never block Next; neither does a card type this engine doesn't play.
  const reading = c => !playable(c) || c.type === 'info' || c.type === 'big' || c.type === 'summary';
  function card() {
    S.view = 'card'; S.tmp = {};
    const w = W[S.w], c = w.cards[S.c], k = id(S.w, S.c), wc = colour(w, S.w);
    document.body.style.setProperty('--wc', `var(--${wc})`); document.body.style.setProperty('--ws', `var(--${wc}s)`);
    document.getElementById('nav').hidden = false;
    const isLast = S.c === w.cards.length - 1;
    const dots = w.cards.map((_, i) => `<i class="${S.done[id(S.w, i)] ? 'seen' : ''} ${i === S.c ? 'now' : ''}"></i>`).join('');
    document.getElementById('main').innerHTML = `
      <div class="where"><span class="w">${esc(w.title)} · ${S.c + 1}/${w.cards.length}</span><span class="dots" aria-hidden="true">${dots}</span>${'speechSynthesis' in window ? `<span class="tools"><button data-act="speak" aria-label="${T('speak')}">🔊</button></span>` : ''}</div>
      <article class="card ${S.dir < 0 ? 'back' : ''}" id="card" aria-live="polite">${play(c, k)}</article>`;
    document.getElementById('next').textContent = isLast ? U.finishWorld : U.next;
    gate();
    if (reading(c)) complete(S.w, S.c, null);
    save(); scrollTo(0, 0);
  }
  const play = (c, k) => (playable(c) ? P[c.type] : P.info)(c, k);
  // Plays must be answered before Next; reading cards never block.
  function gate() {
    const k = id(S.w, S.c), c = W[S.w].cards[S.c];
    document.getElementById('next').disabled = !(S.done[k] || reading(c));
  }
  const isNotes = src => isMap(src) && src.notes === true;
  // An info card's tag names its source type, plus the evidence grade when it claims an effect.
  // Facts from the user's notes always say so. A plain-text tag (older decks) shows as written.
  function tagText(c) {
    if (c.type === 'info' && (isMap(c.tag) || isNotes(c.src))) {
      const t = isMap(c.tag) ? c.tag : {};
      const from = isNotes(c.src) || t.source === 'notes' ? U.sources.notes : label(U.sources, t.source);
      const text = [from, t.grade == null ? '' : label(U.grades, t.grade)].filter(Boolean).join(' · ');
      if (text) return text;
    }
    return typeof c.tag === 'string' && c.tag ? c.tag : label(U.tags, c.type);
  }
  // The source line under a card: a bare https URL shows as a link named by its site; a notes
  // source says it is unverified (on info cards the tag already does); older decks' Markdown renders.
  function srcLine(c) {
    if (c.src == null || c.src === '') return '';
    if (isNotes(c.src)) return c.type === 'info' ? '' : `<div class="src">${T('source')}: ${esc(U.sources.notes)}</div>`;
    const href = httpsUrl(c.src);
    if (href) return `<div class="src">${T('source')}: ${linkHtml(href, esc(new URL(href).hostname.replace(/^www\./, '')))}</div>`;
    return typeof c.src === 'string' ? `<div class="src">${md(c.src)}</div>` : '';
  }
  const head = c => `<span class="tag">${esc(tagText(c))}</span><h2>${md(c.h)}</h2>`;
  const body = c => list(c.p).map(x => `<p>${md(x)}</p>`).join('') + (c.ul ? `<ul>${list(c.ul).map(x => `<li>${md(x)}</li>`).join('')}</ul>` : '');
  const more = c => (c.more ? `<details class="more"><summary>${T('more')}</summary><div>${list(c.more).map(x => `<p>${md(x)}</p>`).join('')}</div></details>` : '') + srcLine(c);
  const fb = (cls, title, text) => `<div class="fb ${cls}"><b>${md(title)}</b><p>${md(text)}</p></div>`;
  const key = i => esc(String.fromCharCode(65 + i));

  P.info = c => head(c) + body(c) + more(c);
  P.big = c => head(c) + `<div class="big">${md(c.big)}</div>` + body(c) + more(c);

  // quiz: one right answer; feedback either way, explanation always.
  P.quiz = (c, k) => {
    const a = S.ans[k];
    const opts = list(c.opts).map((o, i) => {
      let cls = '';
      if (a != null) cls = i === c.right ? 'right' : i === a ? 'wrong' : '';
      return `<button class="opt ${cls}" data-quiz="${i}" ${a != null ? 'disabled' : ''}><span class="k">${key(i)}</span><span>${md(o)}</span></button>`;
    }).join('');
    const f = a == null ? '' : a === c.right ? fb('ok', pick(U.yes), c.why) : fb('no', U.no, c.why);
    return head(c) + body(c) + `<div class="opts">${opts}</div>` + f + (a != null ? more(c) : '');
  };
  // guess: slide to a number, then reveal how close it was.
  P.guess = (c, k) => {
    const min = num(c.min), max = num(c.max, 100), a = S.ans[k] == null ? null : num(S.ans[k]), v = a ?? num(c.start, min);
    let f = '';
    if (a != null) { const close = Math.abs(a - num(c.answer)) <= num(c.tol); f = fb(close ? 'ok' : 'info', (close ? pick(U.yes) + ' ' : '') + fill(U.actual, { v: show(c, num(c.answer)) }), c.why); }
    return head(c) + body(c) + `<div class="slide"><output id="gv">${esc(show(c, v))}</output><input type="range" id="gr" min="${min}" max="${max}" step="${num(c.step, 1)}" value="${v}" ${a != null ? 'disabled' : ''} aria-label="${esc(c.h)}"><div class="scale"><span>${esc(show(c, min))}</span><span>${esc(show(c, max))}</span></div></div>`
      + (a == null ? `<button class="go" data-act="lock">${T('lock')}</button>` : f + more(c));
  };
  // order: tap the items in the right order. `shown` is the display order, as indices.
  P.order = (c, k) => {
    const a = S.ans[k], items = list(c.items);
    const seq = a ? items.map((_, i) => i) : (S.tmp.seq || []);
    const pos = i => seq.indexOf(i);
    const shown = list(c.shown).filter(i => Number.isInteger(i) && i >= 0 && i < items.length);
    const chips = (shown.length === items.length ? shown : items.map((_, i) => i)).map(i => `<button class="chip ${pos(i) >= 0 ? 'placed' : ''}" data-order="${i}" ${a ? 'disabled' : ''}><span class="k">${pos(i) >= 0 ? pos(i) + 1 : '·'}</span><span>${md(items[i])}</span></button>`).join('');
    let f = '';
    if (a) f = fb(a === 'right' ? 'ok' : 'info', a === 'right' ? pick(U.yes) : U.orderWas, c.why);
    return head(c) + body(c) + `<div class="chips">${chips}</div>` + (a ? f + more(c) : `<button class="go" data-act="undo-order" ${seq.length ? '' : 'disabled'}>${T('undo')}</button>`);
  };
  // multi: pick every one that applies.
  P.multi = (c, k) => {
    const a = Array.isArray(S.ans[k]) ? S.ans[k] : null, sel = a || S.tmp.sel || [], right = list(c.right);
    const opts = list(c.opts).map((o, i) => {
      let cls = '';
      if (a) cls = right.includes(i) ? 'right' : sel.includes(i) ? 'wrong' : '';
      return `<button class="opt ${cls}" data-multi="${i}" aria-pressed="${sel.includes(i)}" ${a ? 'disabled' : ''}><span class="k">${a ? (right.includes(i) ? '✓' : '·') : sel.includes(i) ? '✓' : ''}</span><span>${md(o)}</span></button>`;
    }).join('');
    const exact = a && a.length === right.length && a.every(i => right.includes(i));
    return head(c) + body(c) + `<div class="opts">${opts}</div>` + (a ? fb(exact ? 'ok' : 'info', exact ? pick(U.yes) : U.close, c.why) + more(c) : `<button class="go" data-act="lock-multi" ${sel.length ? '' : 'disabled'}>${T('lock')}</button>`);
  };
  // decide: no right answer. Records the pick for the summary card.
  P.decide = (c, k) => {
    const a = S.ans[k];
    const opts = list(c.opts).map((o, i) => `<button class="opt" data-decide="${i}" aria-pressed="${a === i}"><span class="k">${key(i)}</span><span>${md(o)}</span>${i === c.lean ? `<span class="lean">${T('lean')}</span>` : ''}</button>`).join('');
    return head(c) + body(c) + `<div class="opts">${opts}</div>` + (a != null ? fb('info', U.noted, list(c.after)[a] || U.changeAny) : '') + more(c);
  };
  // summary: the picks from the decide cards it names, as plain text.
  P.summary = c => {
    const lines = list(c.from).map(ref => {
      const [wk, ci] = list(ref), wi = W.findIndex(w => w.id === wk), cc = W[wi]?.cards[ci];
      if (!cc) return null;
      const a = S.ans[id(wi, ci)], opt = Number.isInteger(a) ? list(cc.opts)[a] : null;
      return `${cc.short ?? cc.h}: ${opt == null ? U.skipped : String(opt).replace(/\*\*/g, '')}`;
    }).filter(x => x != null).join('\n');
    return head(c) + body(c) + `<div class="picks" id="picks">${esc(lines)}</div><button class="go" data-act="copy">${T('copy')}</button>` + more(c);
  };
  const pick = arr => { const a = list(arr); return a[Math.floor(Math.random() * a.length)]; };

  // ---------- world end ----------
  // The world's key points (its recap, three lines at most), then on to the next world. The deck
  // ends on the summary card, so after the last world there is only the map.
  function worldEnd() {
    S.view = 'end';
    const w = W[S.w], next = W.findIndex((_, i) => !worldDone(i));
    document.getElementById('nav').hidden = true;
    document.getElementById('main').innerHTML = `<article class="card"><div class="kicker">${T('recapTitle')}</div>
      <h2>${esc(w.title)}</h2><ul class="recap">${list(w.recap).slice(0, 3).map(r => `<li>${md(r)}</li>`).join('')}</ul>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">${next >= 0 ? `<button class="go" data-world="${next}">${T('nextWorld', { w: W[next].title })}</button>` : ''}<button class="go" data-act="home" style="background:var(--bg);color:var(--ink);border:1px solid var(--line)">◎ ${T('map')}</button></div></article>`;
    scrollTo(0, 0);
  }

  // ---------- start over ----------
  // confirm() is blocked in both hosts, so the button asks inside the deck: the first tap turns it
  // into the question, a second tap within five seconds clears progress and XP.
  function askReset(el) {
    if (el.dataset.armed) { startOver(); return; }
    el.dataset.armed = '1'; el.textContent = U.resetAsk; el.setAttribute('aria-live', 'polite');
    setTimeout(() => { if (el.isConnected && el.dataset.armed) { delete el.dataset.armed; el.textContent = U.reset; } }, 5000);
  }
  function startOver() {
    try { localStorage.removeItem(KEY); } catch {}
    saved = {}; Object.assign(S, fresh({}));
    home();
  }

  // ---------- links ----------
  // Inside an MCP Apps host the host opens links (the page that embeds the deck sets
  // window.ludifyHost.openLink); in a plain browser they open in a new tab.
  function openLink(e, a) {
    const host = window.ludifyHost;
    if (a.protocol !== 'https:') { e.preventDefault(); return; }
    if (!host || typeof host.openLink !== 'function') return;
    e.preventDefault();
    Promise.resolve().then(() => host.openLink(a.href)).catch(() => {});
  }

  // ---------- moving ----------
  function go(d) {
    if (S.view !== 'card') return;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const w = W[S.w];
    if (d > 0) {
      if (document.getElementById('next').disabled) return;
      if (S.c === w.cards.length - 1) return worldEnd();
      S.c++;
    } else {
      if (S.c === 0) return home();
      S.c--;
    }
    S.dir = d; card();
  }
  function openWorld(i) { S.w = i; const first = W[i].cards.findIndex((_, c) => !S.done[id(i, c)]); S.c = first < 0 ? 0 : first; S.dir = 1; card(); }
  function speak() {
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
    const txt = [...document.getElementById('card').querySelectorAll('h2, p, li, .opt span:last-child, .fb')].map(n => n.textContent).join('. ');
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = LANG;
    const v = pickVoice(speechSynthesis.getVoices(), LANG);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (a) return openLink(e, a);
    const el = e.target.closest('button'); if (!el) return;
    const d = el.dataset, c = S.view === 'card' ? W[S.w].cards[S.c] : null, k = c ? id(S.w, S.c) : null;
    if (d.world != null) return openWorld(+d.world);
    if (d.act === 'home') return home();
    if (d.act === 'next') return go(1);
    if (d.act === 'prev') return go(-1);
    if (d.act === 'calm') { S.calm = !S.calm; save(); return home(); }
    if (d.plan != null) { S.plan = +d.plan; save(); return home(); }
    if (d.act === 'speak') return speak();
    if (d.act === 'resume') {
      const [w, ci] = saved.at;
      if (!(Number.isInteger(w) && W[w] && Number.isInteger(ci) && W[w].cards[ci])) return openWorld(Math.max(0, W.findIndex((_, i) => !worldDone(i))));
      S.w = w; S.c = ci; S.dir = 1; return card();
    }
    if (d.act === 'reset') return askReset(el);
    if (d.quiz != null && S.ans[k] == null) { S.ans[k] = +d.quiz; complete(S.w, S.c, reward(c, S.ans[k])); return redraw(); }
    if (d.act === 'lock') { S.ans[k] = +document.getElementById('gr').value; complete(S.w, S.c, reward(c, S.ans[k])); return redraw(); }
    if (d.order != null && !S.ans[k]) {
      const seq = S.tmp.seq || (S.tmp.seq = []); const i = +d.order;
      if (!seq.includes(i)) seq.push(i);
      if (seq.length === list(c.items).length) { S.ans[k] = seq.every((x, j) => x === j) ? 'right' : 'shown'; complete(S.w, S.c, reward(c, S.ans[k])); }
      return redraw();
    }
    if (d.act === 'undo-order') { (S.tmp.seq || []).pop(); return redraw(); }
    if (d.multi != null && !S.ans[k]) { const sel = S.tmp.sel || (S.tmp.sel = []); const i = +d.multi; sel.includes(i) ? sel.splice(sel.indexOf(i), 1) : sel.push(i); return redraw(); }
    if (d.act === 'lock-multi') { S.ans[k] = S.tmp.sel.slice(); complete(S.w, S.c, reward(c, S.ans[k])); return redraw(); }
    if (d.decide != null) { const first = S.ans[k] == null; S.ans[k] = +d.decide; if (first) complete(S.w, S.c, reward(c, S.ans[k])); else save(); return redraw(); }
    if (d.act === 'copy') {
      const t = document.getElementById('picks').textContent;
      const ok = () => { el.textContent = U.copied; setTimeout(() => el.textContent = U.copy, 1500); };
      try { navigator.clipboard.writeText(t).then(ok, () => {}); } catch {}
    }
  });
  function redraw() {
    const c = W[S.w].cards[S.c], k = id(S.w, S.c);
    const box = document.getElementById('card'); box.classList.remove('back'); box.style.animation = 'none';
    box.innerHTML = play(c, k); gate(); save();
  }
  document.addEventListener('input', e => {
    if (S.view !== 'card' || e.target.id !== 'gr') return;
    document.getElementById('gv').textContent = show(W[S.w].cards[S.c], +e.target.value);
  });
  document.addEventListener('keydown', e => {
    if (S.view !== 'card' || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
    const n = '1234'.indexOf(e.key);
    if (n >= 0) document.querySelectorAll('#card .opt')[n]?.click();
  });
  // swipe between cards
  let sx = null, sy = null;
  document.addEventListener('pointerdown', e => { if (S.view === 'card' && e.pointerType !== 'mouse' && !e.target.closest('input')) { sx = e.clientX; sy = e.clientY; } });
  document.addEventListener('pointerup', e => {
    if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  });

  home();
})();
