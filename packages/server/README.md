# @ludify/server

Ludify's MCP server: a stateless Cloudflare Worker serving MCP over Streamable HTTP at `/mcp`,
with no auth, no Durable Objects and no storage (SPEC.md §3). Built on the official MCP SDK
(`@modelcontextprotocol/server` v2 and `@modelcontextprotocol/ext-apps`), which runs on Workers
as is.

## Tools

- `ludify_plan(topic, extras?)`: the narrowing form. `extras` is up to three topic-specific
  questions as JSON (`{"type": "choice", "q", "opts"}` with 2 to 6 options, or
  `{"type": "text", "q"}`), checked by `validatePlan` (`src/plan.ts`) like a deck: plain text, at
  most three, and an exact error list back as a tool error. A valid plan comes back with
  `_meta.plan`, and the host opens the form (`ui://ludify/plan-form-v1.html`): the three fixed
  questions (what you're deciding, depth, what you already know), then the extras. Its text, for
  the model, is the same questions for hosts that can't show the form (such as mobile) and the
  research method, ending on calling `ludify_guide` before writing. Submitting posts the answers to
  the chat as a "My Ludify plan" message; in Claude, which puts it in the message box, a note under
  the button says to press Enter.
- `ludify_guide()`: returns [guide.md](guide.md), the deck-writing manual, as text: the card types,
  the writing and source rules, depth and structure, `ui` and the engine's English strings, decks
  from existing research (skip `ludify_plan`), answering a picks message, a whole quick deck, and
  the deck JSON Schema. The model calls it right before writing a deck. `scripts/build-guide.ts`
  writes it into `src/guide.gen.ts` (not committed), and `src/guide.test.ts` fails when the schema,
  the English strings or the example deck in it drift from `@ludify/deck`.
- `ludify_render(deck, attempt?)`: checks the deck with `validateDeck` from `@ludify/deck`. A valid deck
  comes back with `_meta.deck`, and the host opens the deck player (`ui://ludify/deck-player-v3.html`),
  which plays it inline. On attempt 1 (the default), an invalid deck comes back as a tool error listing
  every problem, one per line, pointing to `ludify_guide` and asking for `attempt: 2`. The server
  keeps nothing between calls, so the model counts the attempts. From attempt 2 on, a deck with
  broken cards plays as a partial deck (`partialDeck` from `@ludify/deck`): the valid cards, with
  `skipped` naming each card left out, which the engine shows as a note at the top of the map,
  each card with one reason in the deck's language (`ui.skippedWhy`); the exact errors go only to
  the model. A deck-level problem still comes back as a tool error, asking for the next attempt. A deck
  without `ui.key` gets one made from its content, so two decks on one host origin don't share
  saved progress.

## The narrowing form

`scripts/build-form.ts` takes the deck's head from `@ludify/deck`'s `src/shell.html` (fonts,
colours light and dark, base styles), adds `src/form/form.html` (the form's styles) and the bundled
`src/form/form.ts`, and writes `src/form.gen.ts` (not committed). The script connects to the host,
waits for `ludify_plan`'s result and builds the form with DOM calls, every string set as text.
Bump the `v1` in `FORM_URI` when a change can't work with an old page.

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
- `npm run smoke`: `scripts/smoke.ts` (the Worker in `wrangler dev`, called over MCP: `ludify_plan`
  with two extras and with bad ones, `ludify_guide`,
  then `ludify_render` with `packages/deck/fixtures/quick-deck.json`, a broken copy on attempts 1 and 2, and
  `partial-deck.json` on attempt 2) and `scripts/player-check.ts` (the
  results, the partial deck too, played in a stand-in host at 375 px, with Send to chat posting
  the picks to the host; screenshots in `packages/server/dist/shots/player/`), then
  `scripts/form-check.ts` (the narrowing form in the stand-in host, filled by keyboard alone at
  375 px, as Claude and as a host that sends at once, and at 1024 px dark with reduced motion;
  screenshots in `packages/server/dist/shots/form/`).
- `npm test`, `npm run typecheck`: unit tests call the Worker's fetch handler in-process.
