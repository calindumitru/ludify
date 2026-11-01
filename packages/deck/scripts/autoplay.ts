// Plays every card of a built deck in headless Chromium, light and dark, and fails on any
// page error, stuck card, card left unplayed, world that doesn't end on its recap, or markup the
// deck's text should never produce.
// Also checks "Start over" (two taps, no confirm()), links through the host, and the deck's language.
// Ported from calindumitru/skills @ f308ebc (skills/fun-briefs/scripts/autoplay.mjs).
// Usage: node scripts/autoplay.ts <built.html> [shots-dir]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright';
import { DEFAULT_UI, deckLang, mergeUi } from '../src/ui.ts';

const [file, shots] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/autoplay.ts <built.html> [shots-dir]');
  process.exit(2);
}
if (shots) await mkdir(shots, { recursive: true });

type Deck = { lang?: string; worlds: { cards: unknown[]; recap?: unknown }[]; ui?: Record<string, unknown>; skipped?: unknown[] };

// The elements the engine itself writes, and the attributes they carry. Deck text may add only
// strong, code and a[href^="https:"] (the Markdown-lite renderer); anything else is a leak.
const unsafeMarkup = (p: Page) => p.$$eval('body *', els => {
  const tags = new Set(['DIV', 'H1', 'H2', 'P', 'SPAN', 'BUTTON', 'EM', 'DETAILS', 'SUMMARY', 'OL', 'UL', 'LI', 'I', 'B',
    'ARTICLE', 'OUTPUT', 'INPUT', 'SMALL', 'STRONG', 'CODE', 'A', 'MAIN', 'SCRIPT']);
  const attrs = new Set(['class', 'id', 'style', 'hidden', 'disabled', 'role', 'href', 'target', 'rel', 'type', 'min', 'max',
    'step', 'value', 'open', 'aria-label', 'aria-hidden', 'aria-live', 'aria-pressed', 'aria-valuemin', 'aria-valuemax',
    'data-act', 'data-world', 'data-plan', 'data-quiz', 'data-order', 'data-multi', 'data-decide', 'data-open', 'data-close', 'data-armed']);
  const bad: string[] = [];
  for (const e of els) {
    const what = e.outerHTML.slice(0, 120);
    if (!tags.has(e.tagName)) bad.push(`element ${what}`);
    if (e.tagName === 'SCRIPT' && e.closest('main')) bad.push(`script in main: ${what}`);
    for (const a of e.attributes) if (!attrs.has(a.name)) bad.push(`attribute ${a.name} on ${what}`);
    if (e.tagName === 'A' && !/^https:\/\//.test(e.getAttribute('href') ?? '')) bad.push(`link ${what}`);
    const style = e.getAttribute('style') ?? '';
    if (/url\(|expression|@import/i.test(style)) bad.push(`style ${what}`);
  }
  return bad;
});

const b = await chromium.launch();
const errs: string[] = [];
async function run(scheme: 'light' | 'dark') {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, colorScheme: scheme });
  ctx.setDefaultTimeout(5000);
  // confirm() is blocked in both hosts: count calls. In dark, act as an MCP Apps host for links.
  await ctx.addInitScript((asHost: boolean) => {
    const w = window as unknown as Record<string, unknown>;
    w.__confirms = 0; w.__opened = [];
    window.confirm = () => { (w.__confirms as number)++; return true; };
    if (asHost) w.ludifyHost = { openLink: (url: string) => { (w.__opened as string[]).push(url); } };
  }, scheme === 'dark');
  // A deck must never make the page fetch anything but the page itself and its fonts.
  ctx.on('request', r => { const u = new URL(r.url()); if (u.protocol !== 'file:' && !/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) errs.push(`${scheme}: request to ${r.url()}`); });
  const p = await ctx.newPage();
  const popups: string[] = [];
  ctx.on('page', pg => popups.push(pg.url()));
  p.on('pageerror', e => errs.push(`${scheme}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION)/.test(m.text())) errs.push(`${scheme}: ${m.text()}`); });
  p.on('dialog', d => { errs.push(`${scheme}: a ${d.type()} dialog opened: ${d.message()}`); void d.dismiss(); });
  const check = async (where: string) => {
    for (const x of await unsafeMarkup(p)) errs.push(`${scheme}, ${where}: ${x}`);
    // Measured once main's slide-in animations end: a card enters from 18 px to the right.
    const [sw, vw] = await p.evaluate(async () => {
      const moving = document.getAnimations().filter(a => (a.effect as KeyframeEffect | null)?.target?.closest('main'));
      await Promise.race([Promise.all(moving.map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, 1000))]);
      return [document.documentElement.scrollWidth, innerWidth];
    });
    if (sw > vw) errs.push(`${scheme}, ${where}: scrolls sideways (${sw}px wide in a ${vw}px window)`);
  };

  await p.goto(pathToFileURL(path.resolve(file)).href);
  await p.waitForTimeout(1000);
  if (shots) await p.screenshot({ path: `${shots}/home-${scheme}.png` });
  const deck: Deck = await p.$eval('#deck', el => JSON.parse(el.textContent ?? ''));
  const ui = mergeUi(deck.ui);
  const lang = await p.$eval('html', el => el.lang);
  if (lang !== deckLang(deck.lang)) errs.push(`${scheme}: page lang is "${lang}", deck says "${deck.lang}"`);
  // A translated deck shows none of the English strings it translates.
  const english = Object.entries(DEFAULT_UI).filter(([k, v]) => typeof v === 'string' && v.length >= 12 && deck.ui?.[k] != null && deck.ui[k] !== v).map(([, v]) => v as string);
  const leaks = async (where: string) => { const t = await p.innerText('body'); for (const s of english) if (t.includes(s)) errs.push(`${scheme}, ${where}: English "${s}" shows in a translated deck`); };
  await check('home'); await leaks('home');
  // A partial deck names each card it left out, at the top of the map; a whole deck shows no note.
  const noted = await p.$$eval('main .left-out li', x => x.length);
  const want = deck.skipped?.length ?? 0;
  if (noted !== want) errs.push(`${scheme}: the map's note names ${noted} cards left out; the deck skipped ${want}`);
  if (want && (await p.$eval('main > :first-child', el => el.className)) !== 'left-out') errs.push(`${scheme}: the note on cards left out is not at the top`);
  if (want) console.log(`${scheme}: note at the top names ${noted} cards left out: "${(await p.innerText('main .left-out')).replace(/\n/g, ' / ')}"`);

  const total = deck.worlds.reduce((a, w) => a + w.cards.length, 0);
  const worlds = await p.$$eval('.worlds [data-world]', x => x.length);
  if (worlds !== deck.worlds.length) errs.push(`${scheme}: ${worlds} world tiles for ${deck.worlds.length} worlds`);
  let cards = 0, recaps = 0;
  for (let w = 0; w < worlds; w++) {
    await p.click(`.worlds [data-world="${w}"]`);
    for (let i = 0; i < 40; i++) {
      if (await p.$('[data-quiz]:not([disabled])')) await p.click('[data-quiz="0"]');
      else if (await p.$('[data-act="lock"]')) await p.click('[data-act="lock"]');
      else if (await p.$('[data-order]:not([disabled])')) {
        const n = await p.$$eval('[data-order]', x => x.length);
        for (let j = 0; j < n; j++) await p.click(`[data-order="${j}"]`);
      }
      else if (await p.$('[data-multi]:not([disabled])')) { await p.click('[data-multi="0"]'); await p.click('[data-act="lock-multi"]'); }
      else if (await p.$('[data-decide]')) await p.click('[data-decide="0"]');
      await p.waitForTimeout(450);
      await check(`world ${w + 1}, card ${i + 1}`);
      if (i === 0) await leaks(`world ${w + 1}`);
      if (shots && i === 1) await p.screenshot({ path: `${shots}/w${w}-card-${scheme}.png` });
      cards++;
      if (await p.$eval('#next', (el: HTMLButtonElement) => el.disabled)) { errs.push(`${scheme}: stuck on world ${w + 1}, card ${i + 1}`); break; }
      await p.click('#next');
      await p.waitForTimeout(150);
      if (await p.$('main .recap')) break; // the world's end: its recap
    }
    const recap = await p.$$eval('main .recap li', x => x.length);
    const want = Math.min(3, Array.isArray(deck.worlds[w].recap) ? (deck.worlds[w].recap as unknown[]).length : 1);
    if (recap) recaps++;
    if (recap !== want) errs.push(`${scheme}: world ${w + 1} ends on ${recap} recap lines, expected ${want}`);
    if (shots && w === 0) await p.screenshot({ path: `${shots}/w0-recap-${scheme}.png` });
    await check(`world ${w + 1} recap`);
    await p.click('main [data-act="home"]');
  }
  const left = (await p.textContent('#left')) ?? '';
  if (cards !== total) errs.push(`${scheme}: played ${cards} of ${total} cards`);
  if (recaps !== worlds) errs.push(`${scheme}: reached ${recaps} of ${worlds} world recaps`);
  if (left !== ui.allDoneShort) errs.push(`${scheme}: top bar says "${left}" after every card`);
  console.log(`${scheme}: lang ${lang}, ${worlds} worlds, ${cards}/${total} cards played, ${recaps}/${worlds} recaps reached; ${left}; ${await p.textContent('#xp')}`);
  const ticks = await p.$$eval('.worlds .tick', x => x.length);
  if (ticks !== worlds) errs.push(`${scheme}: ${ticks} done ticks on the map for ${worlds} finished worlds`);
  if (shots) await p.screenshot({ path: `${shots}/home-done-${scheme}.png` });
  await check('home, all done'); await leaks('home, all done');

  // Links: a new tab in a plain browser; through the host's openLink inside one.
  const link = await p.$('main a[href]:visible');
  if (link) {
    const [href, target, rel] = await link.evaluate((a: HTMLAnchorElement) => [a.href, a.target, a.rel]);
    if (target !== '_blank' || rel !== 'noopener noreferrer') errs.push(`${scheme}: link ${href} has target "${target}", rel "${rel}"`);
    if (scheme === 'dark') {
      await link.click();
      await p.waitForTimeout(200);
      const opened = await p.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
      if (opened.length !== 1 || opened[0] !== href) errs.push(`dark: host openLink got ${JSON.stringify(opened)}, expected ${href}`);
      if (popups.length) errs.push(`dark: a link opened a tab inside a host: ${popups.join(', ')}`);
    }
  }

  // Start over: one tap only asks; a re-render forgets the ask; the second tap clears.
  const reset = 'main [data-act="reset"]';
  await p.click(reset);
  if ((await p.textContent(reset)) !== ui.resetAsk) errs.push(`${scheme}: first "Start over" tap shows "${await p.textContent(reset)}"`);
  if ((await p.textContent('#left')) !== ui.allDoneShort) errs.push(`${scheme}: one "Start over" tap cleared progress`);
  await p.click('main [data-act="calm"]'); await p.click('main [data-act="calm"]');
  await p.click(reset);
  if ((await p.textContent('#left')) !== ui.allDoneShort) errs.push(`${scheme}: a tap after re-drawing the map cleared progress`);
  await p.click(reset);
  const after = (await p.textContent('#left')) ?? '';
  if (after === ui.allDoneShort || !after.includes(String(total))) errs.push(`${scheme}: two "Start over" taps left the top bar at "${after}"`);
  if ((await p.textContent('#xp'))?.trim() !== '★ 0 XP') errs.push(`${scheme}: XP after start over is "${await p.textContent('#xp')}"`);
  const stored = await p.evaluate(k => localStorage.getItem(k), typeof ui.key === 'string' ? ui.key : 'fq:v1');
  if (stored != null) errs.push(`${scheme}: progress still saved after start over`);
  const confirms = await p.evaluate(() => (window as unknown as { __confirms: number }).__confirms);
  if (confirms) errs.push(`${scheme}: confirm() called ${confirms} times`);
  const pwned = await p.evaluate(() => 'pwned' in window);
  if (pwned) errs.push(`${scheme}: deck text ran code (window.pwned is set)`);
  console.log(`${scheme}: start over took 2 taps, confirm() calls ${confirms}${link ? `, link ${scheme === 'dark' ? 'went to the host' : 'opens a new tab'}` : ''}`);
  await ctx.close();
}
// A step that throws (a button that never shows up) fails the run but keeps what was found so far.
for (const scheme of ['light', 'dark'] as const) {
  try { await run(scheme); } catch (e) { errs.push(`${scheme}: stopped: ${String((e as Error).message).split('\n')[0]}`); }
}
await b.close();
if (errs.length) { console.error('FAIL\n' + errs.join('\n')); process.exit(1); }
console.log('OK: no errors, no stuck cards, every card played, every world ended on its recap, no unsafe markup, light and dark');
