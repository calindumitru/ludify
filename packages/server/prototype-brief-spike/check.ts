// PROTOTYPE: screenshots of the fake chat (dist/index.html) per variant, phone width.
// Usage: (cd prototype-brief-spike/dist && python3 -m http.server 8799) & node prototype-brief-spike/check.ts
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const out = new URL('./dist/shots/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs: string[] = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:8799/index.html');
await page.waitForTimeout(1200);
const [, bf, df] = page.frames();
for (const home of ['door', 'tab', 'inline']) for (const ptr of ['card', 'doors', 'message']) {
  await bf.evaluate(v => { localStorage.setItem('spike:variant', JSON.stringify(v)); }, { home, ptr, mention: true });
  await bf.evaluate(() => location.reload()); await df.evaluate(() => location.reload());
  await page.waitForTimeout(900);
  const [, b, d] = page.frames();
  await b.locator('body').screenshot({ path: `${out}${home}-${ptr}-brief.png` });
  await d.evaluate(() => (document.querySelector('[data-world="0"]') as HTMLElement).click());
  await page.waitForTimeout(300);
  await d.locator('body').screenshot({ path: `${out}${home}-${ptr}-deck-card.png` });
  if (home === 'tab') { await d.locator('[data-dtab="brief"]').click(); await page.waitForTimeout(300); await d.locator('body').screenshot({ path: `${out}${home}-${ptr}-deck-brieftab.png` }); }
}
// interactions on the inline brief: compare and calculator
const [, b] = page.frames();
await b.evaluate(() => { localStorage.setItem('spike:variant', JSON.stringify({ home: 'inline', ptr: 'card', mention: true })); location.reload(); });
await page.waitForTimeout(900);
const b2 = page.frames()[1];
await b2.locator('[data-opt="1"]').click();
await b2.locator('[data-preset="b"][data-v="6"]').click();
console.log('calc:', await b2.locator('.b-outs').first().innerText());
console.log('compare:', await b2.locator('.b-compare p').nth(1).innerText());
await b2.locator('#sec-stays').screenshot({ path: `${out}calc.png` });
await b2.locator('#sec-five').screenshot({ path: `${out}compare.png` });
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await browser.close();
