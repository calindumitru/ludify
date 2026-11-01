# @ludify/server

Ludify's MCP server: a stateless Cloudflare Worker serving MCP over Streamable HTTP at `/mcp`,
with no auth, no Durable Objects and no storage (SPEC.md §3). Built on the official MCP SDK
(`@modelcontextprotocol/server` v2 and `@modelcontextprotocol/ext-apps`), which runs on Workers
as is.

## Tools

- `ludify_guide()`: returns [guide.md](guide.md), the deck-writing manual, as text: the card types,
  the writing and source rules, depth and structure, `ui` and the engine's English strings, decks
  from existing research (skip `ludify_plan`), answering a picks message, a whole quick deck, and
  the deck JSON Schema. The model calls it right before writing a deck. `scripts/build-guide.ts`
  writes it into `src/guide.gen.ts` (not committed), and `src/guide.test.ts` fails when the schema,
  the English strings or the example deck in it drift from `@ludify/deck`.
- `ludify_render(deck, attempt?)`: checks the deck with `validateDeck` from `@ludify/deck`. A valid deck
  comes back with `_meta.deck`, and the host opens the deck player (`ui://ludify/deck-player-v1.html`),
  which plays it inline. On attempt 1 (the default), an invalid deck comes back as a tool error listing
  every problem, one per line, pointing to `ludify_guide` and asking for `attempt: 2`. The server
  keeps nothing between calls, so the model counts the attempts. From attempt 2 on, a deck with
  broken cards plays as a partial deck (`partialDeck` from `@ludify/deck`): the valid cards, with
  `skipped` naming each card left out and why, which the engine shows as a note at the top of the
  map. A deck-level problem still comes back as a tool error, asking for the next attempt. A deck
  without `ui.key` gets one made from its content, so two decks on one host origin don't share
  saved progress.

## The deck player

`scripts/build-player.ts` takes the page `buildDeck` writes, leaves its deck block empty, adds the
host bridge (`src/player/bridge.ts`) before the engine and wraps the engine in `window.ludifyBoot`.
The bridge connects to the host, waits for `ludify_render`'s result, writes the deck into the JSON
block, routes links through the host's `openLink`, and starts the engine. The page goes into
`src/player.gen.ts` (not committed), because a Worker can't read files or run esbuild. Hosts cache
the page by its URI: bump the `v1` in `PLAYER_URI` when a change can't work with an old page.

## Commands

From the repo root:

- `npm run dev -w @ludify/server`: builds the player and runs `wrangler dev` on
  `http://localhost:8791/mcp`.
- `npm run smoke`: `scripts/smoke.ts` (the Worker in `wrangler dev`, called over MCP: `ludify_guide`,
  then `ludify_render` with `packages/deck/fixtures/quick-deck.json`, a broken copy on attempts 1 and 2, and
  `partial-deck.json` on attempt 2) and `scripts/player-check.ts` (the
  results, the partial deck too, played in a stand-in host at 375 px; screenshots in `packages/server/dist/shots/player/`).
- `npm test`, `npm run typecheck`: unit tests call the Worker's fetch handler in-process.
