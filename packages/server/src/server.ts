// The Ludify MCP server: one stateless McpServer per request, with `ludify_plan` and the narrowing
// form it opens, `ludify_guide` (the deck-writing manual), `ludify_render` and the deck player it
// opens. Nothing is stored; the plan and the deck travel to their pages inside the tool result.
import { McpServer, createMcpHandler, type CallToolResult } from '@modelcontextprotocol/server';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import { partialDeck, validateDeck, type Deck } from '@ludify/deck/validate';
import * as z from 'zod';
import { FORM_HTML } from './form.gen.ts';
import { GUIDE } from './guide.gen.ts';
import { planText, validatePlan } from './plan.ts';
import { PLAYER_HTML } from './player.gen.ts';

// Hosts cache a UI resource by its URI, so a player change that old pages can't take bumps it.
export const PLAYER_URI = 'ui://ludify/deck-player-v3.html';
export const FORM_URI = 'ui://ludify/plan-form-v1.html';

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

const bullets = (errors: string[]) => errors.map(e => `- ${e}`).join('\n');

// The server keeps nothing between calls, so the model says which try this is. Attempt 1 of an
// invalid deck returns the errors; from attempt 2 on, the valid cards play under a note naming the
// cards left out, unless a deck-level problem leaves nothing to play.
export async function render(input: unknown, attempt = 1): Promise<CallToolResult> {
  const result = validateDeck(input);
  const played = result.ok || attempt >= 2 ? partialDeck(result) : null;
  if (!played) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'The deck was not shown because it has these problems:\n'
          + bullets(result.errors)
          + `\nFix every one and call ludify_render again with the whole deck and \`attempt: ${attempt + 1}\`. Call ludify_guide for the deck format and writing rules.`,
      }],
    };
  }
  const deck = await withKey(played);
  const cards = cardCount(deck);
  const left = result.skipped.length;
  const text = `The deck is playing inline: ${cards} cards in ${deck.worlds.length} worlds.`
    + (result.ok ? '' : (left
      ? ` ${left} card${left === 1 ? ' was' : 's were'} left out, and a note at the top of the deck names them for the user.`
      : ' No card was left out; a broken `ui` string shows in English.')
      + ` It still had these problems:\n${bullets(result.errors)}\nTell the user in one line that some cards were left out; call ludify_render again only if they ask for a fixed deck.`);
  return {
    content: [{ type: 'text', text }],
    // The player reads the deck from here; hosts pass `_meta` to the app and keep it out of the model's context.
    _meta: { deck },
  };
}

// ludify_plan: checks the model's extras like a deck; valid ones go to the form in `_meta.plan`,
// with the questions and the research method as text for the model.
export function plan(topic: unknown, extras: unknown): CallToolResult {
  const result = validatePlan(topic, extras);
  if (!result.plan) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'The narrowing form was not shown because of these problems:\n'
          + bullets(result.errors)
          + '\nFix every one and call ludify_plan again, or leave `extras` out to ask only the three fixed questions.',
      }],
    };
  }
  return { content: [{ type: 'text', text: planText(result.plan) }], _meta: { plan: result.plan } };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'ludify', version: '0.1.0' });

  registerAppResource(server, 'Ludify deck player', PLAYER_URI, { description: 'Plays a Ludify deck.' }, async () => ({
    contents: [{ uri: PLAYER_URI, mimeType: RESOURCE_MIME_TYPE, text: PLAYER_HTML, _meta: { ui: { csp: { resourceDomains: FONT_ORIGINS } } } }],
  }));

  registerAppResource(server, 'Ludify narrowing form', FORM_URI, { description: 'Asks what the research should cover.' }, async () => ({
    contents: [{ uri: FORM_URI, mimeType: RESOURCE_MIME_TYPE, text: FORM_HTML, _meta: { ui: { csp: { resourceDomains: FONT_ORIGINS } } } }],
  }));

  registerAppTool(server, 'ludify_plan', {
    title: 'Plan a Ludify deck',
    description: 'Call it first when the user asks for a Ludify deck on a topic that still needs researching. '
      + 'Shows the narrowing form (what they are deciding, how deep to go, what they already know, and up to three questions you add for this topic), '
      + 'whose answers come back as a "My Ludify plan" message; returns the same questions as text for hosts that can\'t show the form, and the research method. '
      + 'Skip it when the research is already in the chat, attached or pasted: go to ludify_guide.',
    inputSchema: z.object({
      topic: z.string().describe('The topic in a few words, in the user\'s language.'),
      extras: z.unknown().optional().describe('Up to three questions about this topic that would change the research (e.g. country, budget, house size), '
        + 'in the user\'s language, plain text: a JSON list of {"type": "choice", "q": "...", "opts": ["...", "..."]} (2 to 6 options) '
        + 'or {"type": "text", "q": "..."}. Leave it out when the three fixed questions are enough.'),
    }),
    annotations: { title: 'Plan a Ludify deck', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: FORM_URI } },
  }, async ({ topic, extras }) => plan(topic, extras));

  server.registerTool('ludify_guide', {
    title: 'How to write a Ludify deck',
    description: 'Returns the manual for writing a Ludify deck: the card types, the writing and source rules, depth and structure, '
      + 'and the deck JSON Schema. Call it right before you write a deck, also when the research is already in the chat, '
      + 'in an attached file or pasted in (then skip ludify_plan). It also says how to answer a "My Ludify picks" message.',
    annotations: { title: 'How to write a Ludify deck', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => ({ content: [{ type: 'text', text: GUIDE }] }));

  registerAppTool(server, 'ludify_render', {
    title: 'Play a Ludify deck',
    description: 'Checks a Ludify deck (JSON) and plays it inline as cards the user can tap through; if the deck has problems, returns the list to fix. '
      + 'Call it again with `attempt: 2` after fixing; from then on, cards that are still broken are left out with a note to the user. '
      + 'Call ludify_guide first and write the deck to its format.',
    inputSchema: z.object({
      deck: z.unknown().describe('The deck: a JSON object with `lang`, `ui` and `worlds`, written to the format ludify_guide gives.'),
      attempt: z.number().int().min(1).optional().describe('Which try this is: leave it out the first time, then 2, 3 and so on as the error asks. '
        + 'From 2 on, a deck that still has broken cards plays without them.'),
    }),
    annotations: { title: 'Play a Ludify deck', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: PLAYER_URI } },
  }, async ({ deck, attempt }) => render(deck, attempt));

  return server;
}

export const mcpHandler = createMcpHandler(() => createServer());
