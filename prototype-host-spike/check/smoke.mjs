// PROTOTYPE — loads dist/deck.html in the fake host, plays a few cards, prints the probe calls.
import { chromium } from 'playwright';
import fs from 'node:fs';
const html = fs.readFileSync('dist/deck.html', 'utf8');
const deck = JSON.parse(fs.readFileSync('decks/adhd.json', 'utf8'));
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.setContent('<body></body>'); await p.addScriptTag({ content: fs.readFileSync('dist/harness.js', 'utf8') });
await p.evaluate(([h, d]) => window.start(h, d), [html, deck]);
const f = p.frames()[1];
await p.waitForTimeout(3000); console.log('main:', (await f.locator('#main').first().innerText()).slice(0,100)); console.log('panel:', (await f.locator('#spk-r').textContent()).slice(0,600)); console.log('calls', await p.evaluate(()=>window.calls.length), errs); await f.waitForSelector('.world', { timeout: 2000 });
console.log('worlds:', await f.locator('.world').count(), '| title:', (await f.locator('h1').innerText()).slice(0, 50));
await f.locator('.world').first().click(); await p.waitForTimeout(300);
console.log('card:', (await f.locator('#main h2, #main h3').first().innerText()).slice(0, 60));
await p.waitForTimeout(2000);
const calls = await p.evaluate(() => window.calls.map(c => c.name + ':' + (c.arguments?.report?.name ?? '')));
console.log('tool calls from iframe:', calls.join(', '));
console.log('errors:', errs.length ? errs : 'none');
await b.close();
