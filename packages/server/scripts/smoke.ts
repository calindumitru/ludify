// Smoke test: starts the Worker in `wrangler dev` (the real Workers runtime, locally) and calls
// ludify_guide, then ludify_render over MCP: the quick fixture deck; a broken copy on attempt 1 and,
// with its deck-level problem, on attempt 2; and a deck with broken cards on attempt 2 (partial).
// Usage: node scripts/smoke.ts [port]   (default 8791; run `npm run build` first)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkDeckLevel, checkGuide, checkInvalid, checkPartial, checkTool, checkValid, connect } from './render-checks.ts';

const port = Number(process.argv[2] ?? 8791);
const base = `http://127.0.0.1:${port}`;
const cwd = fileURLToPath(new URL('..', import.meta.url));

const dev = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1'], {
  cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
let log = '';
dev.stdout.on('data', d => { log += d; });
dev.stderr.on('data', d => { log += d; });

async function ready(ms = 60_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (dev.exitCode !== null) throw new Error(`wrangler dev exited ${dev.exitCode}`);
    try { if ((await fetch(base)).status === 404) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('wrangler dev did not start in time');
}

let failed = false;
try {
  const t0 = Date.now();
  await ready();
  console.log(`wrangler dev up on ${base} in ${Date.now() - t0} ms`);
  const client = await connect(`${base}/mcp`);
  let t = Date.now();
  const guide = await checkGuide(client);
  console.log(`ok: ludify_guide returns the manual (${Date.now() - t} ms): ${guide.length} characters`);
  const uri = await checkTool(client);
  console.log(`ok: ludify_render is listed, read-only, opens ${uri}`);
  t = Date.now();
  const { html } = await checkValid(client, uri);
  console.log(`ok: valid deck plays (${Date.now() - t} ms); player page ${html.length} bytes`);
  t = Date.now();
  const text = await checkInvalid(client);
  console.log(`ok: broken deck is a tool error on attempt 1 (${Date.now() - t} ms):\n${text.replace(/^/gm, '    ')}`);
  t = Date.now();
  const partial = await checkPartial(client);
  console.log(`ok: broken cards on attempt 2 play as a partial deck (${Date.now() - t} ms, both attempts):\n${partial.replace(/^/gm, '    ')}`);
  t = Date.now();
  const deckLevel = await checkDeckLevel(client);
  console.log(`ok: a deck-level problem on attempt 2 is still a tool error (${Date.now() - t} ms): ${deckLevel.split('\n').filter(l => l.startsWith('- ')).length} problems`);
  await client.close();
} catch (e) {
  failed = true;
  console.error('SMOKE FAILED:', e);
  console.error('--- wrangler dev output ---\n' + log);
} finally {
  dev.kill('SIGTERM');
}
process.exit(failed ? 1 : 0);
