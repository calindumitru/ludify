// The deck engine, moved from calindumitru/skills @ f308ebc (skills/fun-briefs/assets/deck/index.html).
// The deck is data: JSON read from <script type="application/json" id="deck">, never run as code.
import { formatValue } from './format.ts';

(() => {
  const Q = JSON.parse(document.getElementById('deck').textContent);
  const KEY = Q.ui.key || 'fq:v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const saved = load();
  const S = { calm: !!saved.calm, plan: saved.plan ?? null, xp: saved.xp || 0, done: saved.done || {}, ans: saved.ans || {}, badges: saved.badges || {}, start: saved.start || Date.now(), view: 'home', w: 0, c: 0, dir: 1, tmp: {} };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ calm: S.calm, plan: S.plan, xp: S.xp, done: S.done, ans: S.ans, badges: S.badges, start: S.start, at: [S.w, S.c] })); } catch {} };
  const W = Q.worlds, U = Q.ui;
  if (U.docTitle) document.title = U.docTitle;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const num = (c, v) => formatValue(c.fmt, v);
  const id = (w, c) => W[w].id + ':' + c;
  const total = W.reduce((a, w) => a + w.cards.length, 0);
  const doneCount = () => Object.keys(S.done).length;
  const worldDone = w => W[w].cards.every((_, c) => S.done[id(w, c)]);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- rewards ----------
  function award(n, why) {
    S.xp += n; save(); drawBar(true);
    if (S.calm) return;
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = `+${n} XP · ${why}`;
    document.body.appendChild(t); setTimeout(() => t.remove(), 1500);
  }
  function confetti() {
    if (reduced || S.calm) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['var(--w1)', 'var(--w2)', 'var(--w3)', 'var(--w4)', 'var(--gold)'];
    for (let i = 0; i < 70; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = cols[i % 5]; p.style.animationDelay = Math.random() * .4 + 's'; p.style.transform = `rotate(${Math.random() * 180}deg)`; box.appendChild(p); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2300);
  }
  function complete(w, c, xp, why) {
    const k = id(w, c);
    if (S.done[k]) return;
    S.done[k] = 1;
    if (xp) award(xp, why); else { save(); drawBar(); }
  }
  function drawBar(pop) {
    document.getElementById('prog').style.width = (doneCount() / total * 100) + '%';
    document.body.classList.toggle('calm', S.calm);
    const left = total - doneCount();
    document.getElementById('left').textContent = left ? U.left.replace('{n}', left).replace('{m}', Math.max(1, Math.round(left * (U.secsPerCard || 30) / 60))) : U.allDoneShort;
    const x = document.getElementById('xp');
    x.innerHTML = `<b>★</b> ${S.xp} XP`;
    if (pop && !reduced) { x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); }
  }

  // ---------- home ----------
  function home() {
    S.view = 'home'; document.getElementById('nav').hidden = true;
    document.body.style.removeProperty('--wc');
    const resume = saved.at && doneCount() > 0 && doneCount() < total;
    const allDone = W.every((_, w) => worldDone(w));
    document.getElementById('main').innerHTML = `
      <div class="hello"><div class="kicker">${md(U.kicker)}</div><h1>${md(U.title).replace(/\{(.+?)\}/, '<em>$1</em>')}</h1><p class="lead">${md(U.lead)}</p></div>
      ${U.planQ ? `<div class="plan"><p class="q">${md(U.planQ)}</p><div class="row">${U.planOpts.map((o, i) => `<button data-plan="${i}" aria-pressed="${S.plan === i}">${esc(o)}</button>`).join('')}</div>${S.plan != null ? `<p class="then">${md(U.planThen.replace('{when}', U.planOpts[S.plan].toLowerCase()))}</p>` : ''}</div>` : ''}
      <details class="gist"><summary>${md(U.gistTitle)}</summary><ol>${U.gist.map(g => `<li>${md(g)}</li>`).join('')}</ol></details>
      <div class="worlds">${W.map((w, i) => {
        const n = w.cards.filter((_, c) => S.done[id(i, c)]).length;
        return `<button class="world ${worldDone(i) ? 'done' : ''}" data-world="${i}" style="--wc:var(--${w.c});--ws:var(--${w.c}s)">
          <span class="badge-ico" aria-hidden="true">${w.badge.ico}</span>
          <span class="n">World ${i + 1} · ${w.mins} min</span><span class="t">${esc(w.title)}</span><span class="d">${md(w.tease)}</span>
          <span class="meta"><i style="--p:${n / w.cards.length * 100}%"></i>${n}/${w.cards.length}</span></button>`;
      }).join('')}</div>
      <div class="shelf">${resume ? `<button data-act="resume" style="font-weight:700;color:var(--ink)">${U.resume} →</button> · ` : ''}${allDone ? `<button data-act="finale" style="font-weight:700;color:var(--ink)">${U.finaleLink}</button> · ` : ''}<span>${U.anyOrder}</span> · <button data-act="calm" aria-pressed="${S.calm}">${S.calm ? U.calmOff : U.calmOn}</button> · <a href="${U.fullLink}" target="_blank" rel="noopener">${U.fullText}</a> · <button data-act="reset">${U.reset}</button></div>`;
    drawBar(); scrollTo(0, 0);
  }

  // ---------- card ----------
  function card() {
    S.view = 'card'; S.tmp = {};
    const w = W[S.w], c = w.cards[S.c], k = id(S.w, S.c);
    document.body.style.setProperty('--wc', `var(--${w.c})`); document.body.style.setProperty('--ws', `var(--${w.c}s)`);
    document.getElementById('nav').hidden = false;
    const isLast = S.c === w.cards.length - 1;
    const dots = w.cards.map((_, i) => `<i class="${S.done[id(S.w, i)] ? 'seen' : ''} ${i === S.c ? 'now' : ''}"></i>`).join('');
    document.getElementById('main').innerHTML = `
      <div class="where"><span class="w">${w.badge.ico} ${esc(w.title)} · ${S.c + 1}/${w.cards.length}</span><span class="dots" aria-hidden="true">${dots}</span>${'speechSynthesis' in window ? `<span class="tools"><button data-act="speak" aria-label="${U.speak}">🔊</button></span>` : ''}</div>
      <article class="card ${S.dir < 0 ? 'back' : ''}" id="card" aria-live="polite">${P[c.type](c, k)}</article>`;
    const nx = document.getElementById('next');
    nx.textContent = isLast ? U.finishWorld : U.next;
    gate();
    if (c.type === 'info' || c.type === 'big') complete(S.w, S.c, 0);
    save(); scrollTo(0, 0);
  }
  // Plays must be answered before Next; reading cards never block.
  function gate() {
    const k = id(S.w, S.c), c = W[S.w].cards[S.c];
    document.getElementById('next').disabled = !(S.done[k] || c.type === 'info' || c.type === 'big');
  }
  const tag = c => `<span class="tag">${esc(c.tag || U.tags[c.type])}</span>`;
  const head = c => `${tag(c)}<h2>${md(c.h)}</h2>`;
  const body = c => (c.p ? (Array.isArray(c.p) ? c.p : [c.p]).map(x => `<p>${md(x)}</p>`).join('') : '') + (c.ul ? `<ul>${c.ul.map(x => `<li>${md(x)}</li>`).join('')}</ul>` : '');
  const more = c => (c.more ? `<details class="more"><summary>${U.more}</summary><div>${(Array.isArray(c.more) ? c.more : [c.more]).map(x => `<p>${md(x)}</p>`).join('')}</div></details>` : '') + (c.src ? `<div class="src">${md(c.src)}</div>` : '');
  const fb = (cls, title, text) => `<div class="fb ${cls}"><b>${md(title)}</b><p>${md(text)}</p></div>`;

  const P = {};
  P.info = c => head(c) + body(c) + more(c);
  P.big = c => head(c) + `<div class="big">${md(c.big)}</div>` + body(c) + more(c);

  // quiz: one right answer; feedback either way, explanation always.
  P.quiz = (c, k) => {
    const a = S.ans[k];
    const opts = c.opts.map((o, i) => {
      let cls = '';
      if (a != null) cls = i === c.right ? 'right' : i === a ? 'wrong' : '';
      return `<button class="opt ${cls}" data-quiz="${i}" ${a != null ? 'disabled' : ''}><span class="k">${'ABCD'[i]}</span><span>${md(o)}</span></button>`;
    }).join('');
    const f = a == null ? '' : a === c.right ? fb('ok', pick(U.yes), c.why) : fb('no', U.no, c.why);
    return head(c) + body(c) + `<div class="opts">${opts}</div>` + f + (a != null ? more(c) : '');
  };
  // guess: slide to a number, then reveal how close it was.
  P.guess = (c, k) => {
    const a = S.ans[k], v = a ?? c.start;
    let f = '';
    if (a != null) { const close = Math.abs(a - c.answer) <= c.tol; f = fb(close ? 'ok' : 'info', (close ? pick(U.yes) + ' ' : '') + U.actual.replace('{v}', () => num(c, c.answer)), c.why); }
    return head(c) + body(c) + `<div class="slide"><output id="gv">${esc(num(c, v))}</output><input type="range" id="gr" min="${c.min}" max="${c.max}" step="${c.step}" value="${v}" ${a != null ? 'disabled' : ''} aria-label="${esc(c.h)}"><div class="scale"><span>${esc(num(c, c.min))}</span><span>${esc(num(c, c.max))}</span></div></div>`
      + (a == null ? `<button class="go" data-act="lock">${U.lock}</button>` : f + more(c));
  };
  // order: tap the items in the right order.
  P.order = (c, k) => {
    const a = S.ans[k];
    const seq = a ? c.items.map((_, i) => i) : (S.tmp.seq || []);
    const pos = i => seq.indexOf(i);
    const chips = c.shown.map(i => `<button class="chip ${pos(i) >= 0 ? 'placed' : ''}" data-order="${i}" ${a ? 'disabled' : ''}><span class="k">${pos(i) >= 0 ? pos(i) + 1 : '·'}</span><span>${md(c.items[i])}</span></button>`).join('');
    let f = '';
    if (a) f = fb(a === 'right' ? 'ok' : 'info', a === 'right' ? pick(U.yes) : U.orderWas, c.why);
    return head(c) + body(c) + `<div class="chips">${chips}</div>` + (a ? f + more(c) : `<button class="go" data-act="undo-order" ${seq.length ? '' : 'disabled'}>${U.undo}</button>`);
  };
  // multi: pick every one that applies.
  P.multi = (c, k) => {
    const a = S.ans[k], sel = a || S.tmp.sel || [];
    const opts = c.opts.map((o, i) => {
      let cls = '';
      if (a) cls = c.right.includes(i) ? 'right' : sel.includes(i) ? 'wrong' : '';
      return `<button class="opt ${cls}" data-multi="${i}" aria-pressed="${sel.includes(i)}" ${a ? 'disabled' : ''}><span class="k">${a ? (c.right.includes(i) ? '✓' : '·') : sel.includes(i) ? '✓' : ''}</span><span>${md(o)}</span></button>`;
    }).join('');
    const exact = a && a.length === c.right.length && a.every(i => c.right.includes(i));
    return head(c) + body(c) + `<div class="opts">${opts}</div>` + (a ? fb(exact ? 'ok' : 'info', exact ? pick(U.yes) : U.close, c.why) + more(c) : `<button class="go" data-act="lock-multi" ${sel.length ? '' : 'disabled'}>${U.lock}</button>`);
  };
  // challenge: move a slider until the goal is met (the stay-link break-even).
  P.challenge = (c, k) => {
    const v = S.ans[k] ?? c.start;
    return head(c) + body(c) + `<div class="slide"><output id="cv">${esc(num(c, v))}</output><input type="range" id="cr" min="${c.min}" max="${c.max}" step="${c.step}" value="${v}" aria-label="${esc(c.h)}"></div><div id="cout">${chOut(c, v, k)}</div>` + (S.done[k] ? more(c) : '');
  };
  function chOut(c, v, k) {
    const r = c.calc(v);
    return `<div class="goal">${r.cells.map(x => `<div><small>${x[0]}</small><b class="${x[2] || ''}">${x[1]}</b></div>`).join('')}</div>` + (S.done[k] ? fb('ok', c.win, c.why) : `<p class="src">${md(c.goalText)}</p>`);
  }
  // decide: no right answer. Records the pick for the summary card.
  P.decide = (c, k) => {
    const a = S.ans[k];
    const opts = c.opts.map((o, i) => `<button class="opt" data-decide="${i}" aria-pressed="${a === i}"><span class="k">${'ABCD'[i]}</span><span>${md(o)}</span>${i === c.lean ? `<span class="lean">${U.lean}</span>` : ''}</button>`).join('');
    return head(c) + body(c) + `<div class="opts">${opts}</div>` + (a != null ? fb('info', U.noted, c.after[a] || U.changeAny) : '') + more(c);
  };
  // summary: the picks, ready to paste into the grilling tickets.
  P.summary = (c, k) => {
    const lines = c.from.map(([wk, ci]) => {
      const wi = W.findIndex(w => w.id === wk), cc = W[wi].cards[ci], a = S.ans[id(wi, ci)];
      return `${cc.short}: ${a == null ? '(skipped)' : cc.opts[a].replace(/\*\*/g, '')}\n  ${cc.ticket}`;
    }).join('\n\n');
    if (!S.done[k]) setTimeout(() => { complete(S.w, S.c, c.xp, U.whyRead); gate(); }, 400);
    return head(c) + body(c) + `<div class="picks" id="picks">${esc(lines)}</div><button class="go" data-act="copy">${U.copy}</button>` + more(c);
  };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- world end and finale ----------
  function worldEnd() {
    S.view = 'end';
    const w = W[S.w], first = !S.badges[w.id];
    if (first) { S.badges[w.id] = 1; S.xp += 50; save(); setTimeout(() => { confetti(); drawBar(true); }, 50); }
    const next = W.findIndex((_, i) => !worldDone(i));
    document.getElementById('nav').hidden = true;
    document.getElementById('main').innerHTML = `<article class="card"><div class="medal"><span class="ico">${w.badge.ico}</span></div>
      <h2 style="text-align:center">${U.badgeGot.replace('{b}', esc(w.badge.name))}</h2>
      <p style="text-align:center;color:var(--muted)">${first ? U.bonus : U.again}</p>
      <div class="kicker">${U.recapTitle}</div><ul class="recap">${w.recap.map(r => `<li>${md(r)}</li>`).join('')}</ul>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">${next >= 0 ? `<button class="go" data-world="${next}">${U.nextWorld.replace('{w}', esc(W[next].title))}</button>` : `<button class="go" data-act="finale">${U.finaleBtn}</button>`}<button class="go" data-act="home" style="background:var(--bg);color:var(--ink);border:1px solid var(--line)">◎ ${U.map}</button></div></article>`;
    scrollTo(0, 0);
  }
  function finale() {
    S.view = 'end'; document.getElementById('nav').hidden = true; confetti();
    document.body.style.setProperty('--wc', 'var(--w1)');
    const mins = Math.max(1, Math.round((Date.now() - S.start) / 60000));
    document.getElementById('main').innerHTML = `<article class="card"><div class="medal"><span class="ico">${W.map(w => w.badge.ico).join(' ')}</span></div>
      <h2 style="text-align:center">${U.finaleTitle}</h2>
      <div class="stats"><div><b>${S.xp}</b><small>XP</small></div><div><b>${Object.keys(S.badges).length}/${W.length}</b><small>${U.badges}</small></div><div><b>${mins > 600 ? '—' : mins}</b><small>${U.minutes}</small></div></div>
      <p>${md(U.finaleText)}</p><ul>${U.finaleNext.map(x => `<li>${md(x)}</li>`).join('')}</ul>
      <button class="go" data-act="home">◎ ${U.map}</button></article>`;
    scrollTo(0, 0);
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

  document.addEventListener('click', e => {
    const el = e.target.closest('button'); if (!el) return;
    const d = el.dataset, c = S.view === 'card' ? W[S.w].cards[S.c] : null, k = c ? id(S.w, S.c) : null;
    if (d.world != null) return openWorld(+d.world);
    if (d.act === 'home') return home();
    if (d.act === 'next') return go(1);
    if (d.act === 'prev') return go(-1);
    if (d.act === 'finale') return finale();
    if (d.act === 'calm') { S.calm = !S.calm; save(); return home(); }
    if (d.plan != null) { S.plan = +d.plan; save(); return home(); }
    if (d.act === 'speak') {
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
      const el2 = document.getElementById('card'); const txt = [...el2.querySelectorAll('h2, p, li, .opt span:last-child, .fb')].map(n => n.textContent).join('. ');
      speechSynthesis.speak(new SpeechSynthesisUtterance(txt)); return;
    }
    if (d.act === 'resume') { S.w = saved.at[0]; S.c = saved.at[1]; S.dir = 1; return card(); }
    if (d.act === 'reset') { if (confirm(U.resetAsk)) { localStorage.removeItem(KEY); location.reload(); } return; }
    if (d.quiz != null && S.ans[k] == null) { S.ans[k] = +d.quiz; complete(S.w, S.c, +d.quiz === c.right ? 20 : 5, +d.quiz === c.right ? U.whyRight : U.whyTried); return redraw(); }
    if (d.act === 'lock') { const v = +document.getElementById('gr').value; S.ans[k] = v; const close = Math.abs(v - c.answer) <= c.tol; complete(S.w, S.c, close ? 25 : 10, close ? U.whyClose : U.whyTried); return redraw(); }
    if (d.order != null && !S.ans[k]) {
      const seq = S.tmp.seq || (S.tmp.seq = []); const i = +d.order;
      if (!seq.includes(i)) seq.push(i);
      if (seq.length === c.items.length) { const right = seq.every((x, j) => x === j); S.ans[k] = right ? 'right' : 'shown'; complete(S.w, S.c, right ? 20 : 5, right ? U.whyRight : U.whyTried); }
      return redraw();
    }
    if (d.act === 'undo-order') { (S.tmp.seq || []).pop(); return redraw(); }
    if (d.multi != null && !S.ans[k]) { const sel = S.tmp.sel || (S.tmp.sel = []); const i = +d.multi; sel.includes(i) ? sel.splice(sel.indexOf(i), 1) : sel.push(i); return redraw(); }
    if (d.act === 'lock-multi') { const sel = S.tmp.sel.slice(); S.ans[k] = sel; const exact = sel.length === c.right.length && sel.every(i => c.right.includes(i)); complete(S.w, S.c, exact ? 20 : 8, exact ? U.whyRight : U.whyTried); return redraw(); }
    if (d.decide != null) { const first = S.ans[k] == null; S.ans[k] = +d.decide; if (first) complete(S.w, S.c, 15, U.whyDecide); else save(); return redraw(); }
    if (d.act === 'copy') {
      const t = document.getElementById('picks').textContent;
      const ok = () => { el.textContent = U.copied; setTimeout(() => el.textContent = U.copy, 1500); };
      try { navigator.clipboard.writeText(t).then(ok, () => {}); } catch {}
    }
  });
  function redraw() {
    const c = W[S.w].cards[S.c], k = id(S.w, S.c);
    const box = document.getElementById('card'); box.classList.remove('back'); box.style.animation = 'none';
    box.innerHTML = P[c.type](c, k); gate(); save();
  }
  document.addEventListener('input', e => {
    if (S.view !== 'card') return;
    const c = W[S.w].cards[S.c], k = id(S.w, S.c);
    if (e.target.id === 'gr') document.getElementById('gv').textContent = num(c, +e.target.value);
    if (e.target.id === 'cr') {
      const v = +e.target.value; S.ans[k] = v;
      document.getElementById('cv').textContent = num(c, v);
      if (!S.done[k] && c.calc(v).win) { complete(S.w, S.c, 25, U.whyWin); }
      document.getElementById('cout').innerHTML = chOut(c, v, k); gate(); save();
    }
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
