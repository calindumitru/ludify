// Plays ludify_render's result in the deck player inside a stand-in host (scripts/fake-host.ts),
// in headless Chromium at phone width: the deck shows, a link goes through the host, Send to chat
// on the summary card posts the picks to the host as the user's message, a broken deck
// shows a short note, a partial deck (attempt 2) names its cards left out at the top, and nothing
// errors or scrolls sideways. Screenshots: dist/shots/player/.
// Usage: node scripts/player-check.ts   (run `npm run build` first)
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Frame } from 'playwright';
import { brokenDeck, loadDeck } from './render-checks.ts';
import { render } from '../src/server.ts';
import { PLAYER_HTML } from '../src/player.gen.ts';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const shots = here('../dist/shots/player');
await mkdir(shots, { recursive: true });
const harness = (await build({ entryPoints: [here('fake-host.ts')], bundle: true, format: 'iife', write: false, target: 'es2022' })).outputFiles[0].text;

const WIDTH = 375;
const errs: string[] = [];
const browser = await chromium.launch();

async function open(result: unknown, name: string) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 780 } });
  page.on('pageerror', e => errs.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION)/.test(m.text())) errs.push(`${name}: ${m.text()}`); });
  await page.setContent('<!doctype html><body style="margin:0"></body>');
  await page.addScriptTag({ content: harness });
  const t0 = Date.now();
  await page.evaluate(([html, r, w]) => window.startHost(html as string, r as Record<string, unknown>, w as number), [PLAYER_HTML, result, WIDTH] as const);
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.readyState === 'complete');
  const frame = page.frames()[1];
  return { page, frame, t0 };
}

const sideways = async (frame: Frame, where: string) => {
  // Measured once main's slide-in animations end (a card enters from 18 px to the right), as autoplay does.
  const [sw, vw] = await frame.evaluate(async () => {
    const moving = document.getAnimations().filter(a => (a.effect as KeyframeEffect | null)?.target?.closest('main'));
    await Promise.race([Promise.all(moving.map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, 1000))]);
    return [document.documentElement.scrollWidth, innerWidth];
  });
  if (sw > vw) errs.push(`${where}: scrolls sideways (${sw}px in ${vw}px)`);
  return `${sw}/${vw}px`;
};

// A valid deck plays.
const deck = await loadDeck('quick-deck.json');
const ok = await render(deck);
{
  const { page, frame, t0 } = await open(ok, 'valid');
  await frame.waitForSelector('.world', { timeout: 10_000 });
  const ms = Date.now() - t0;
  const worlds = await frame.locator('.world').count();
  const title = await frame.locator('h1').first().innerText();
  if (worlds !== deck.worlds.length) errs.push(`valid: ${worlds} world tiles, deck has ${deck.worlds.length}`);
  if (!title.includes(deck.ui.title)) errs.push(`valid: title "${title}" is not the deck's "${deck.ui.title}"`);
  const lang = await frame.$eval('html', el => el.lang);
  if (lang !== deck.lang) errs.push(`valid: page lang "${lang}", deck "${deck.lang}"`);
  const home = await sideways(frame, 'valid home');
  await page.screenshot({ path: `${shots}/home.png` });

  await frame.locator('.world').first().click();
  const link = frame.locator('main a[href^="https:"]').first();
  await link.waitFor();
  const href = await link.getAttribute('href');
  const card = await sideways(frame, 'valid first card');
  await page.screenshot({ path: `${shots}/card.png` });
  await link.click();
  await page.waitForFunction(() => window.opened.length > 0, null, { timeout: 5000 }).catch(() => {});
  const opened = await page.evaluate(() => window.opened);
  if (opened[0] !== href) errs.push(`valid: link ${href} did not go through the host (opened: ${JSON.stringify(opened)})`);
  console.log(`valid: ${worlds} worlds shown ${ms} ms after the host started; width home ${home}, card ${card}; link through host: ${opened[0] === href}`);

  // The decision world: pick the first option on each decision, then Send to chat on the summary
  // card posts the picks to the host as the user's message. This host sends it (it is not Claude),
  // so the note says it was sent.
  await frame.locator('[data-act="home"]').first().click();
  const di = deck.worlds.findIndex((w: { cards: { type: string }[] }) => w.cards.some(c => c.type === 'summary'));
  await frame.locator(`.world[data-world="${di}"]`).click();
  const want = ['My Ludify picks:'];
  for (const c of deck.worlds[di].cards as { type: string; short?: string; opts?: string[] }[]) {
    if (c.type === 'decide') { await frame.locator('[data-decide="0"]').click(); want.push(`- ${c.short}: ${c.opts![0]}`); }
    if (c.type === 'summary') break;
    await frame.locator('#next').click();
  }
  await frame.locator('[data-act="send"]').click();
  await page.waitForFunction(() => window.messages.length > 0, null, { timeout: 5000 }).catch(() => {});
  const messages = await page.evaluate(() => window.messages);
  const expected = { role: 'user', content: [{ type: 'text', text: want.join('\n') }] };
  if (JSON.stringify(messages) !== JSON.stringify([expected])) errs.push(`valid: Send to chat gave the host ${JSON.stringify(messages)}, expected ${JSON.stringify([expected])}`);
  await frame.waitForFunction(() => document.getElementById('sent')?.textContent, null, { timeout: 2000 }).catch(() => {});
  const note = await frame.locator('#sent').innerText();
  if (note !== 'Sent to the chat ✓') errs.push(`valid: the note after Send to chat reads "${note}"`);
  const summary = await sideways(frame, 'valid summary');
  await page.screenshot({ path: `${shots}/summary.png` });
  console.log(`valid: Send to chat gave the host ${JSON.stringify(messages[0])}; note "${note}"; width ${summary}`);
  await page.close();
}

// A broken deck shows a short note, not a deck.
{
  const bad = await render(await brokenDeck());
  const { page, frame } = await open(bad, 'invalid');
  await frame.waitForFunction(() => /had problems/.test(document.getElementById('main')?.textContent ?? ''), null, { timeout: 10_000 })
    .catch(() => errs.push('invalid: no note shown for a broken deck'));
  if (await frame.locator('.world').count()) errs.push('invalid: a broken deck showed worlds');
  await page.screenshot({ path: `${shots}/invalid.png` });
  console.log(`invalid: note "${(await frame.locator('#main').innerText()).trim()}"`);
  await page.close();
}

// Attempt 2 with broken cards: the valid cards play under a note naming each card left out.
{
  const input = await loadDeck('partial-deck.json');
  const partial = await render(input, 2);
  const skipped = (partial._meta as { deck: { skipped: unknown[] } }).deck.skipped;
  const { page, frame } = await open(partial, 'partial');
  await frame.waitForSelector('.world', { timeout: 10_000 });
  const noted = await frame.locator('main .left-out li').count();
  if (noted !== skipped.length) errs.push(`partial: the note names ${noted} cards, ${skipped.length} were left out`);
  const top = await frame.$eval('main > :first-child', el => el.className);
  if (top !== 'left-out') errs.push(`partial: the first thing on the map is "${top}", not the note`);
  const lead = (await frame.locator('main .left-out p').innerText()).trim();
  if (lead !== input.ui.skippedNote) errs.push(`partial: the note reads "${lead}", not the deck's "${input.ui.skippedNote}"`);
  // Each card left out: its heading, then the deck's own reason; the validator's English stays with the model.
  const items = (await frame.locator('main .left-out li').allInnerTexts()).map(t => t.trim());
  for (const [i, t] of items.entries()) {
    const want = `${input.worlds[0].cards[i].h}: ${input.ui.skippedWhy}`;
    if (t !== want) errs.push(`partial: note line ${i + 1} reads "${t}", not "${want}"`);
  }
  const width = await sideways(frame, 'partial home');
  await page.screenshot({ path: `${shots}/partial.png` });
  console.log(`partial: note at the top names ${noted} cards left out, in the deck's language ("${lead}" / ${items.map(t => `"${t}"`).join(' / ')}); width ${width}`);
  await page.close();
}

await browser.close();
if (errs.length) {
  console.error(`player check failed:\n- ${errs.join('\n- ')}`);
  process.exit(1);
}
console.log(`player check passed; screenshots in ${shots}`);
