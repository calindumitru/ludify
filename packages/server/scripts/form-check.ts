// Fills ludify_plan's narrowing form inside a stand-in host (scripts/fake-host.ts), in headless
// Chromium, by keyboard alone: Tab, typing, arrow keys, Space and Enter. Checks the answers reach the
// host as the user's message, the note under the button in Claude, the focus ring, reduced motion,
// a rejected plan's note, and that nothing scrolls sideways at phone width or on a desktop.
// Screenshots: dist/shots/form/.
// Usage: node scripts/form-check.ts   (run `npm run build` first)
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Frame, type Page } from 'playwright';
import { PLAN_INPUT } from './render-checks.ts';
import { plan } from '../src/server.ts';
import { FIXED, planMessage } from '../src/plan.ts';
import { FORM_HTML } from '../src/form.gen.ts';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const shots = here('../dist/shots/form');
await mkdir(shots, { recursive: true });
const harness = (await build({ entryPoints: [here('fake-host.ts')], bundle: true, format: 'iife', write: false, target: 'es2022' })).outputFiles[0].text;

const errs: string[] = [];
const browser = await chromium.launch();
const good = plan(PLAN_INPUT.topic, PLAN_INPUT.extras);
const thePlan = (good._meta as { plan: Parameters<typeof planMessage>[0] }).plan;

type Opts = { width: number; host?: string; dark?: boolean; reduce?: boolean };
async function open(result: unknown, name: string, { width, host, dark, reduce }: Opts) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: dark ? 'dark' : 'light', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  page.on('pageerror', e => errs.push(`${name}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION)/.test(m.text())) errs.push(`${name}: ${m.text()}`); });
  await page.setContent('<!doctype html><body style="margin:0"></body>');
  await page.addScriptTag({ content: harness });
  const t0 = Date.now();
  await page.evaluate(([html, r, w, h]) => window.startHost(html as string, r as Record<string, unknown>, w as number, h as string | undefined), [FORM_HTML, result, width, host] as const);
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.readyState === 'complete');
  return { page, frame: page.frames()[1], t0 };
}

// The page's own width against the frame's, and the frame made tall enough to screenshot whole.
async function measure(page: Page, frame: Frame, where: string) {
  const [sw, vw, h] = await frame.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.documentElement.scrollHeight]);
  if (sw > vw) errs.push(`${where}: scrolls sideways (${sw}px in ${vw}px)`);
  await page.evaluate(px => { document.querySelector('iframe')!.style.height = `${px}px`; }, h);
  return `${sw}/${vw}px`;
}

const active = (frame: Frame) => frame.evaluate(() => {
  const a = document.activeElement as HTMLInputElement | null;
  return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.name && !a.id ? `[${a.name}=${a.value}]` : ''}` : 'none';
});

// ChatGPT-like host (sends at once), phone width, keyboard only.
{
  const { page, frame, t0 } = await open(good, 'keyboard', { width: 375 });
  await frame.waitForSelector('#form', { timeout: 10_000 });
  const ms = Date.now() - t0;
  const qs = (await frame.locator('form label[for], form legend').allInnerTexts()).map(t => t.trim());
  const wantQs = [FIXED.deciding, FIXED.depth, FIXED.know, ...PLAN_INPUT.extras.map(x => x.q)];
  if (JSON.stringify(qs) !== JSON.stringify(wantQs)) errs.push(`keyboard: questions ${JSON.stringify(qs)}, expected ${JSON.stringify(wantQs)}`);
  if (await frame.locator('#note').count()) errs.push('keyboard: a host that sends at once shows the press-Enter note');
  const width = await measure(page, frame, 'keyboard phone');
  await page.screenshot({ path: `${shots}/phone.png`, fullPage: true });

  const path: string[] = [];
  const step = async (key: string) => { await page.keyboard.press(key); path.push(`${key} → ${await active(frame)}`); };
  await step('Tab');
  await page.keyboard.type('Whether to replace my gas boiler');
  await step('Tab');
  const ring = await frame.evaluate(() => getComputedStyle((document.activeElement as HTMLElement).closest('.opt')!).outlineStyle);
  if (ring !== 'solid') errs.push(`keyboard: the focused depth option shows no focus ring (outline ${ring})`);
  await step('ArrowDown');
  await step('Tab');
  await page.keyboard.type('Air-source ones exist');
  await step('Tab');
  await step('Space');
  await step('ArrowDown');
  await step('Tab');
  await page.keyboard.type('120');
  await step('Enter');
  if ((await active(frame)) !== 'button') errs.push(`keyboard: Enter in the last text answer did not move to the button (${await active(frame)})`);
  if (await page.evaluate(() => window.messages.length)) errs.push('keyboard: Enter in a text answer sent the form');
  await step('Enter');
  await page.waitForFunction(() => window.messages.length > 0, null, { timeout: 5000 }).catch(() => {});
  const messages = await page.evaluate(() => window.messages);
  const text = planMessage(thePlan, { deciding: 'Whether to replace my gas boiler', depth: 'thorough', know: 'Air-source ones exist', extras: ['Italy', '120'] });
  const expected = [{ role: 'user', content: [{ type: 'text', text }] }];
  if (JSON.stringify(messages) !== JSON.stringify(expected)) errs.push(`keyboard: the host got ${JSON.stringify(messages)}, expected ${JSON.stringify(expected)}`);
  const status = await frame.locator('#sent').innerText();
  if (status !== 'Sent to the chat ✓') errs.push(`keyboard: the note after sending reads "${status}"`);
  await page.screenshot({ path: `${shots}/phone-sent.png`, fullPage: true });
  console.log(`keyboard: form shown ${ms} ms after the host started; ${qs.length} questions; width ${width}; ${path.length} keys to send (${path.join(', ')})`);
  console.log(`keyboard: the host got:\n${text.replace(/^/gm, '    ')}\n  status "${status}"`);
  await page.close();
}

// Claude fills the message box: the note under the button says so, before and after.
{
  const { page, frame } = await open(good, 'claude', { width: 375, host: 'Claude' });
  await frame.waitForSelector('#form', { timeout: 10_000 });
  const note = await frame.locator('#note').innerText().catch(() => '');
  if (!/press Enter/.test(note)) errs.push(`claude: no press-Enter note under the button ("${note}")`);
  const below = await frame.evaluate(() => {
    const b = document.querySelector('.go')!.getBoundingClientRect(), n = document.getElementById('note')!.getBoundingClientRect();
    return n.top >= b.bottom;
  });
  if (!below) errs.push('claude: the note is not under the button');
  await frame.locator('.go').focus();
  await page.keyboard.press('Enter');
  await frame.waitForFunction(() => document.getElementById('sent')?.textContent, null, { timeout: 5000 }).catch(() => {});
  const status = await frame.locator('#sent').innerText();
  if (!/message box/.test(status)) errs.push(`claude: the note after sending reads "${status}"`);
  const width = await measure(page, frame, 'claude phone');
  await page.screenshot({ path: `${shots}/claude.png`, fullPage: true });
  console.log(`claude: note "${note}"; after sending "${status}"; width ${width}`);
  await page.close();
}

// Desktop width, dark, and reduced motion.
{
  const { page, frame } = await open(good, 'desktop', { width: 1024, dark: true, reduce: true });
  await frame.waitForSelector('#form', { timeout: 10_000 });
  const width = await measure(page, frame, 'desktop');
  const motion = await frame.evaluate(() => getComputedStyle(document.querySelector('.opt')!).transitionDuration);
  if (!/^0s(, 0s)*$/.test(motion)) errs.push(`desktop: reduced motion still transitions (${motion})`);
  const bg = await frame.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.screenshot({ path: `${shots}/desktop-dark.png`, fullPage: true });
  console.log(`desktop: width ${width}; dark background ${bg}; reduced-motion transition ${motion}`);
  await page.close();
}

// A rejected plan shows a short note, not a form.
{
  const bad = plan(PLAN_INPUT.topic, [{ type: 'slider', q: 'x' }]);
  const { page, frame } = await open(bad, 'rejected', { width: 375 });
  await frame.waitForFunction(() => /had problems/.test(document.getElementById('main')?.textContent ?? ''), null, { timeout: 10_000 })
    .catch(() => errs.push('rejected: no note shown for a rejected plan'));
  if (await frame.locator('#form').count()) errs.push('rejected: a rejected plan showed the form');
  console.log(`rejected: note "${(await frame.locator('#main').innerText()).trim()}"`);
  await page.close();
}

await browser.close();
if (errs.length) {
  console.error(`form check failed:\n- ${errs.join('\n- ')}`);
  process.exit(1);
}
console.log(`form check passed; screenshots in ${shots}`);
