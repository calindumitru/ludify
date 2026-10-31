// PROTOTYPE — throwaway spike for ticket #6 (https://github.com/calindumitru/ludify/issues/6). Never merged.
// A stateless MCP server: ludify_guide + ludify_render for the model, three app-only tools for the iframe.
// Every request and every probe result is appended to PROTOTYPE-probe-log.jsonl so the run can be read back.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import * as z from 'zod';

const PORT = +(process.env.PORT || 8787);
const LOG = new URL('./PROTOTYPE-probe-log.jsonl', import.meta.url);
const HTML = fs.readFileSync(new URL('./dist/deck.html', import.meta.url), 'utf8');
const EXAMPLE = JSON.parse(fs.readFileSync(new URL('./decks/adhd.json', import.meta.url), 'utf8'));
const GUIDE = fs.readFileSync(new URL('./guide.md', import.meta.url), 'utf8');
const UI_URI = 'ui://ludify/deck-v1.html';
const TYPES = ['info', 'big', 'quiz', 'guess', 'order', 'multi', 'decide', 'summary'];
const decks = new Map(); // renderId -> deck, in memory only (spike)

const log = (kind, data) => fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), kind, ...data }) + '\n');

function check(deck, needSrc = true) {
  const errs = [];
  if (!deck || !Array.isArray(deck.worlds) || !deck.worlds.length) errs.push('deck.worlds must be a non-empty array');
  (deck?.worlds || []).forEach((w, i) => {
    if (!w.title || !Array.isArray(w.cards) || !w.cards.length) errs.push(`worlds[${i}] needs a title and cards`);
    (w.cards || []).forEach((c, j) => {
      if (!TYPES.includes(c.type)) errs.push(`worlds[${i}].cards[${j}].type "${c.type}" is not one of ${TYPES.join(', ')}`);
      if (needSrc && c.type === 'info' && !c.src) errs.push(`worlds[${i}].cards[${j}] is an info card without src`);
      if ('fmt' in c && typeof c.fmt !== 'string') errs.push(`worlds[${i}].cards[${j}].fmt must be a template string like "{v} min"`);
    });
  });
  return errs;
}

function build(stableDomain) {
  const server = new McpServer({ name: 'ludify-spike', version: '0.0.1' });

  registerAppResource(server, 'Ludify deck player', UI_URI, { description: 'Plays a Ludify deck (spike)' }, async () => ({
    contents: [{ uri: UI_URI, mimeType: RESOURCE_MIME_TYPE, text: HTML, _meta: { ui: stableDomain ? { domain: stableDomain } : {} } }],
  }));

  server.registerTool('ludify_guide', {
    description: 'Call this FIRST when the user asks Ludify for a brief. Returns the deck format and writing rules. Then research the topic with web search, then call ludify_render with the deck.',
    inputSchema: z.object({ topic: z.string().describe('The research topic in the user\'s words') }),
    annotations: { readOnlyHint: true },
  }, async ({ topic }) => {
    log('guide', { topic });
    return { content: [{ type: 'text', text: GUIDE }] };
  });

  registerAppTool(server, 'ludify_render', {
    description: 'Play a Ludify deck inline. Pass `deck` (JSON written per ludify_guide) or `example: "adhd"` to show the built-in example deck.',
    inputSchema: z.object({
      deck: z.record(z.string(), z.any()).optional().describe('The deck JSON: { ui: {...}, worlds: [...] }'),
      example: z.enum(['adhd']).optional(),
    }),
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: UI_URI } },
  }, async ({ deck, example }) => {
    const src = example ? EXAMPLE : deck;
    const bytes = Buffer.byteLength(JSON.stringify(deck ?? {}));
    const errs = check(src, !example); // the example's evidence-limits card has no src
    const cards = (src?.worlds || []).reduce((a, w) => a + (w.cards?.length || 0), 0);
    log('render', { example: example ?? null, inputBytes: bytes, cards, errors: errs });
    if (errs.length) return { isError: true, content: [{ type: 'text', text: 'Deck rejected. Fix and call again:\n- ' + errs.join('\n- ') }] };
    const renderId = crypto.randomUUID();
    const merged = { ...src, ui: { ...EXAMPLE.ui, ...(src.ui || {}), key: 'ludify:' + crypto.createHash('sha256').update(JSON.stringify(src.worlds)).digest('hex').slice(0, 12) } };
    decks.set(renderId, merged);
    return {
      content: [{ type: 'text', text: `Rendered a deck of ${cards} cards (${Math.round(bytes / 1024)} KB written). The user can play it above.` }],
      structuredContent: { renderId, cards, inputBytes: bytes },
      _meta: { deck: merged },
    };
  });

  const appOnly = { ui: { resourceUri: UI_URI, visibility: ['app'] } };
  registerAppTool(server, 'ludify_fetch_deck', { description: 'App-only: fetch a rendered deck by id.', inputSchema: z.object({ renderId: z.string() }), _meta: appOnly },
    async ({ renderId }) => {
      const deck = decks.get(renderId);
      log('fetch_deck', { renderId, found: !!deck });
      return { content: [{ type: 'text', text: deck ? 'ok' : 'not found' }], structuredContent: { deck: deck ?? null } };
    });
  registerAppTool(server, 'ludify_ping', { description: 'App-only: round-trip check.', inputSchema: z.object({}), _meta: appOnly },
    async () => ({ content: [{ type: 'text', text: 'pong' }], structuredContent: { serverTime: new Date().toISOString() } }));
  registerAppTool(server, 'ludify_probe_report', { description: 'App-only: record a probe result.', inputSchema: z.object({ report: z.record(z.string(), z.any()) }), _meta: appOnly },
    async ({ report }) => { log('probe', { report }); return { content: [{ type: 'text', text: 'logged' }] }; });

  return server;
}

const claudeDomain = url => crypto.createHash('sha256').update(url).digest('hex').slice(0, 32) + '.claudemcpcontent.com';
const handlers = new Map();
const handlerFor = stable => {
  if (!handlers.has(stable)) handlers.set(stable, createMcpHandler(() => build(stable), { onerror: e => log('error', { message: String(e?.message || e) }) }));
  return handlers.get(stable);
};

http.createServer(async (req, res) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const path = req.url.split('?')[0];
  if (path !== '/mcp' && path !== '/mcp-stable') { res.writeHead(404).end('Ludify spike. MCP endpoint: /mcp (or /mcp-stable for a fixed Claude iframe domain)'); return; }
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  let msg = null; try { msg = JSON.parse(body.toString() || 'null'); } catch {}
  for (const m of [].concat(msg || [])) log('request', { path, method: m.method, tool: m.params?.name, client: m.params?.clientInfo, protocol: m.params?.protocolVersion, bytes: body.length, ua: req.headers['user-agent'] });
  const stable = path === '/mcp-stable' ? claudeDomain(`https://${host}/mcp-stable`) : null;
  const request = new Request(`https://${host}${req.url}`, { method: req.method, headers: req.headers, body: body.length ? body : undefined });
  try {
    const out = await handlerFor(stable).fetch(request);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    if (out.body) for await (const c of out.body) res.write(c);
    res.end();
  } catch (e) { log('error', { message: String(e?.message || e) }); res.writeHead(500).end(); }
}).listen(PORT, () => console.log(`Ludify spike on http://localhost:${PORT}/mcp — log: ${LOG.pathname}`));
