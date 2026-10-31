# @ludify/server

Ludify's MCP server: a stateless Cloudflare Worker serving MCP over Streamable HTTP at `/mcp`,
with no auth, no Durable Objects and no storage (SPEC.md §3). Built on the official MCP SDK
(`@modelcontextprotocol/server` v2 and `@modelcontextprotocol/ext-apps`), which runs on Workers
as is.

## Tools

- `ludify_render(deck)`: checks the deck with `validateDeck` from `@ludify/deck`. A valid deck
  comes back with `_meta.deck`, and the host opens the deck player (`ui://ludify/deck-player-v1.html`),
  which plays it inline. An invalid deck comes back as a tool error listing every problem, one per
  line, and pointing to `ludify_guide` (a later slice adds it). A deck without `ui.key` gets one made
  from its content, so two decks on one host origin don't share saved progress.

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
- `npm run smoke`: `scripts/smoke.ts` (the Worker in `wrangler dev`, called over MCP with
  `packages/deck/fixtures/quick-deck.json` and a broken copy) and `scripts/player-check.ts` (the
  result played in a stand-in host at 375 px; screenshots in `packages/server/dist/shots/player/`).
- `npm test`, `npm run typecheck`: unit tests call the Worker's fetch handler in-process.
