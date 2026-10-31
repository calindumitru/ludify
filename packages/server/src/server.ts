// The Ludify MCP server: one stateless McpServer per request, with `ludify_render` and the deck
// player it opens. Nothing is stored; the deck travels to the player inside the tool result.
import { McpServer, createMcpHandler, type CallToolResult } from '@modelcontextprotocol/server';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { validateDeck, type Deck } from '@ludify/deck/validate';
import * as z from 'zod';
import { PLAYER_HTML } from './player.gen.ts';

// Hosts cache a UI resource by its URI, so a player change that old pages can't take bumps it.
export const PLAYER_URI = 'ui://ludify/deck-player-v1.html';

// The engine's stylesheet loads its fonts from Google Fonts; the host's sandbox allows only these.
const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

const cardCount = (deck: Deck) => deck.worlds.reduce((n, w) => n + w.cards.length, 0);

// Progress is saved under `ui.key`; a deck without one gets a key from its content, so two decks
// on the same host origin don't share progress.
async function withKey(deck: Deck): Promise<Deck> {
  if (typeof deck.ui?.key === 'string' && deck.ui.key) return deck;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(deck.worlds)));
  const hex = [...new Uint8Array(digest).slice(0, 6)].map(b => b.toString(16).padStart(2, '0')).join('');
  return { ...deck, ui: { ...deck.ui, key: `ludify:${hex}` } };
}

export async function render(input: unknown): Promise<CallToolResult> {
  const result = validateDeck(input);
  if (!result.ok || !result.deck) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'The deck was not shown because it has these problems:\n'
          + result.errors.map(e => `- ${e}`).join('\n')
          + '\nFix every one and call ludify_render again with the whole deck. Call ludify_guide for the deck format and writing rules.',
      }],
    };
  }
  const deck = await withKey(result.deck);
  const cards = cardCount(deck);
  return {
    content: [{ type: 'text', text: `The deck is playing inline: ${cards} cards in ${deck.worlds.length} worlds.` }],
    // The player reads the deck from here; hosts pass `_meta` to the app and keep it out of the model's context.
    _meta: { deck },
  };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'ludify', version: '0.1.0' });

  registerAppResource(server, 'Ludify deck player', PLAYER_URI, { description: 'Plays a Ludify deck.' }, async () => ({
    contents: [{ uri: PLAYER_URI, mimeType: RESOURCE_MIME_TYPE, text: PLAYER_HTML, _meta: { ui: { csp: { resourceDomains: FONT_ORIGINS } } } }],
  }));

  registerAppTool(server, 'ludify_render', {
    title: 'Play a Ludify deck',
    description: 'Checks a Ludify deck (JSON) and plays it inline as cards the user can tap through; if the deck has problems, returns the list to fix.',
    inputSchema: z.object({
      deck: z.unknown().describe('The deck: a JSON object with `lang`, `ui` and `worlds`, written to the format ludify_guide gives.'),
    }),
    annotations: { title: 'Play a Ludify deck', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: PLAYER_URI } },
  }, async ({ deck }) => render(deck));

  return server;
}

export const mcpHandler = createMcpHandler(() => createServer());
