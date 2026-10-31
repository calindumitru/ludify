// Plays every card of a built deck in headless Chromium, light and dark, and fails on any
// page error, stuck card, or card left unplayed.
// Ported from calindumitru/skills @ f308ebc (skills/fun-briefs/scripts/autoplay.mjs).
// Usage: node scripts/autoplay.ts <built.html> [shots-dir]
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const [file, shots] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/autoplay.ts <built.html> [shots-dir]');
  process.exit(2);
}
if (shots) await mkdir(shots, { recursive: true });

type Deck = { worlds: { cards: unknown[] }[]; ui: { allDoneShort: string } };

const b = await chromium.launch();
const errs: string[] = [];
for (const scheme of ['light', 'dark'] as const) {
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, colorScheme: scheme });
  p.on('pageerror', e => errs.push(`${scheme}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errs.push(`${scheme}: ${m.text()}`); });
  await p.goto(pathToFileURL(path.resolve(file)).href);
  await p.waitForTimeout(1000);
  if (shots) await p.screenshot({ path: `${shots}/home-${scheme}.png` });
  const deck: Deck = await p.$eval('#deck', el => JSON.parse(el.textContent ?? ''));
  const total = deck.worlds.reduce((a, w) => a + w.cards.length, 0);
  const worlds = await p.$$eval('.worlds [data-world]', x => x.length);
  if (worlds !== deck.worlds.length) errs.push(`${scheme}: ${worlds} world tiles for ${deck.worlds.length} worlds`);
  let cards = 0;
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
      else if (await p.$('#cr')) await p.$eval('#cr', (el: HTMLInputElement) => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); });
      else if (await p.$('[data-decide]')) await p.click('[data-decide="0"]');
      await p.waitForTimeout(450);
      if (shots && i === 1) await p.screenshot({ path: `${shots}/w${w}-card-${scheme}.png` });
      cards++;
      const label = (await p.textContent('#next')) ?? '';
      if (await p.$eval('#next', (el: HTMLButtonElement) => el.disabled)) { errs.push(`${scheme}: stuck on world ${w + 1}, card ${i + 1}`); break; }
      await p.click('#next');
      await p.waitForTimeout(150);
      if (label.includes('Finish')) break;
    }
    await p.click('[data-act="home"]');
  }
  const left = (await p.textContent('#left')) ?? '';
  if (cards !== total) errs.push(`${scheme}: played ${cards} of ${total} cards`);
  if (left !== deck.ui.allDoneShort) errs.push(`${scheme}: top bar says "${left}" after every card`);
  console.log(`${scheme}: ${worlds} worlds, ${cards}/${total} cards played; ${left}; ${await p.textContent('#xp')}`);
}
await b.close();
if (errs.length) { console.error('FAIL\n' + errs.join('\n')); process.exit(1); }
console.log('OK: no errors, no stuck cards, every card played, light and dark');
