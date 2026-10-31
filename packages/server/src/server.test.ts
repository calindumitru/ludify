import { describe, expect, it } from 'vitest';
import worker from './index.ts';
import { checkInvalid, checkTool, checkValid, connect, loadDeck } from '../scripts/render-checks.ts';
import { render } from './server.ts';

// The Worker's own fetch handler, called in-process: the same requests `wrangler dev` would get.
const client = () => connect('http://ludify.test/mcp', (url, init) => worker.fetch(new Request(url, init)));

describe('ludify_render over MCP', () => {
  it('lists a read-only tool that opens the deck player', async () => {
    const c = await client();
    expect(await checkTool(c)).toBe('ui://ludify/deck-player-v1.html');
  });

  it('plays a valid deck: the deck goes to the player in _meta', async () => {
    const c = await client();
    await checkValid(c, await checkTool(c));
  });

  it('returns a tool error listing each problem of an invalid deck', async () => {
    expect(await checkInvalid(await client())).toMatch(/^The deck was not shown because it has these problems:\n- /);
  });

  it('answers 404 off /mcp', async () => {
    const res = await worker.fetch(new Request('http://ludify.test/'));
    expect(res.status).toBe(404);
  });
});

describe('render', () => {
  it('keeps a deck\'s own progress key', async () => {
    const deck = await loadDeck('quick-deck.json');
    const out = await render(deck);
    expect((out._meta as { deck: { ui: { key: string } } }).deck.ui.key).toBe(deck.ui.key);
  });

  it('gives a deck without a key one from its content, the same each time', async () => {
    const deck = await loadDeck('quick-deck.json');
    delete deck.ui.key;
    const key = async (d: unknown) => ((await render(d))._meta as { deck: { ui: { key: string } } }).deck.ui.key;
    const k = await key(deck);
    expect(k).toMatch(/^ludify:[0-9a-f]{12}$/);
    expect(await key(structuredClone(deck))).toBe(k);
    deck.worlds[0].cards[0].h = 'Another heading';
    expect(await key(deck)).not.toBe(k);
  });

  it('turns input that is not a deck into a tool error, never a throw', async () => {
    for (const input of [undefined, null, 'not json', 42, []]) {
      const out = await render(input);
      expect(out.isError).toBe(true);
    }
  });
});
