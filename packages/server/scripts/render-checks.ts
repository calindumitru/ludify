// What a host sees from ludify_guide and ludify_render, checked over MCP. Both the unit tests (the Worker's fetch
// handler in Node) and the smoke test (the Worker in `wrangler dev`) run these.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport, type FetchLike } from '@modelcontextprotocol/client';
import { partialDeck, validateDeck } from '@ludify/deck/validate';

const fixture = (name: string) => new URL(`../../deck/fixtures/${name}`, import.meta.url);
export const loadDeck = async (name: string) => JSON.parse(await readFile(fixture(name), 'utf8'));

// A broken copy of the quick fixture: three problems, each in a different place.
export async function brokenDeck() {
  const deck = await loadDeck('quick-deck.json');
  delete deck.worlds[0].cards[0].src; // info card without a source
  deck.worlds[0].cards[1].right = 9; // quiz answer index out of range
  deck.worlds[1].cards.pop(); // decision world without its summary
  return deck;
}

export async function connect(url: string, fetch?: FetchLike) {
  const client = new Client({ name: 'ludify-smoke', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), fetch ? { fetch } : undefined));
  return client;
}

type Text = { type: string; text?: string };
const textOf = (content: unknown) => (content as Text[]).filter(c => c.type === 'text').map(c => c.text).join('\n');

export async function checkTool(client: Client) {
  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'ludify_render');
  assert.ok(tool, 'ludify_render is listed');
  assert.equal(tool.annotations?.readOnlyHint, true, 'ludify_render is read-only');
  const uri = (tool._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri;
  assert.match(uri ?? '', /^ui:\/\//, 'ludify_render names its UI resource');
  return uri!;
}

// ludify_guide: a read-only tool with no arguments that returns the whole manual as text.
export async function checkGuide(client: Client) {
  const { tools } = await client.listTools();
  const tool = tools.find(t => t.name === 'ludify_guide');
  assert.ok(tool, 'ludify_guide is listed');
  assert.equal(tool.annotations?.readOnlyHint, true, 'ludify_guide is read-only');
  assert.match(tool.description ?? '', /ludify_plan/, 'ludify_guide says when to skip ludify_plan');
  const result = await client.callTool({ name: 'ludify_guide', arguments: {} });
  assert.notEqual(result.isError, true, textOf(result.content));
  const text = textOf(result.content);
  assert.equal(text, await readFile(new URL('../guide.md', import.meta.url), 'utf8'), 'the manual is guide.md as it is');
  return text;
}

export async function checkValid(client: Client, uri: string) {
  const deck = await loadDeck('quick-deck.json');
  const result = await client.callTool({ name: 'ludify_render', arguments: { deck } });
  assert.notEqual(result.isError, true, `valid deck is not an error: ${textOf(result.content)}`);
  assert.deepEqual((result._meta as { deck?: unknown })?.deck, deck, 'the deck reaches the player in _meta');
  assert.match(textOf(result.content), /8 cards in 2 worlds/);

  const { contents } = await client.readResource({ uri });
  const page = contents[0] as { mimeType?: string; text?: string };
  assert.equal(page.mimeType, 'text/html;profile=mcp-app');
  assert.match(page.text ?? '', /window\.ludifyBoot = \(\) => \{/, 'the player wraps the engine');
  assert.match(page.text ?? '', /<script type="application\/json" id="deck"><\/script>/, 'the player starts with no deck');
  return { result, html: page.text! };
}

// Attempt 1 (the default): a broken deck is a tool error listing every problem.
export async function checkInvalid(client: Client) {
  const deck = await brokenDeck();
  const result = await client.callTool({ name: 'ludify_render', arguments: { deck } });
  assert.equal(result.isError, true, 'broken deck is a tool error');
  const text = textOf(result.content);
  const lines = text.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
  assert.deepEqual(lines, validateDeck(deck).errors, 'the error text lists exactly what validateDeck found');
  assert.equal(lines.length, 3, text);
  assert.ok(lines.some(l => l.startsWith('world 1, card 1:') && l.includes('`src`')), 'names the info card without a source');
  assert.ok(lines.some(l => l.startsWith('world 1, card 2:') && l.includes('`right`')), 'names the quiz answer out of range');
  assert.ok(lines.some(l => l.includes('`summary`')), 'names the missing summary');
  assert.match(text, /ludify_guide/, 'the error points to ludify_guide');
  assert.match(text, /`attempt: 2`/, 'the error asks for attempt 2');
  assert.equal(result._meta, undefined, 'no deck is sent to the player');
  return text;
}

// Attempt 2, cards still broken: the valid cards play, with the note naming each card left out.
export async function checkPartial(client: Client) {
  const deck = await loadDeck('partial-deck.json');
  const first = await client.callTool({ name: 'ludify_render', arguments: { deck } });
  assert.equal(first.isError, true, 'attempt 1 with broken cards is still a tool error');
  const result = await client.callTool({ name: 'ludify_render', arguments: { deck, attempt: 2 } });
  const text = textOf(result.content);
  assert.notEqual(result.isError, true, `attempt 2 plays the valid cards: ${text}`);
  const played = (result._meta as { deck?: { skipped?: unknown[]; worlds: { cards: unknown[] }[] } })?.deck;
  assert.deepEqual(played, partialDeck(validateDeck(deck)), 'the player gets the valid cards and the cards left out');
  assert.equal(played?.skipped?.length, 2, 'two cards are left out');
  assert.match(text, /9 cards in 2 worlds/);
  assert.match(text, /2 cards were left out/);
  const lines = text.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
  assert.deepEqual(lines, validateDeck(deck).errors, 'the text lists what is still wrong');
  return text;
}

// Attempt 2 with a deck-level problem: still a tool error, never a broken deck.
export async function checkDeckLevel(client: Client) {
  const deck = await brokenDeck();
  const result = await client.callTool({ name: 'ludify_render', arguments: { deck, attempt: 2 } });
  assert.equal(result.isError, true, 'a deck-level problem on attempt 2 is a tool error');
  const text = textOf(result.content);
  const lines = text.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
  assert.deepEqual(lines, validateDeck(deck).errors);
  assert.match(text, /`attempt: 3`/, 'the error asks for the next attempt');
  assert.equal(result._meta, undefined, 'no deck is sent to the player');
  return text;
}
