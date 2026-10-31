# @ludify/deck

The deck engine: it plays a deck (JSON) as one self-contained HTML page. The format is in
[deck.md](deck.md).

## Source

Moved from [`calindumitru/skills`](https://github.com/calindumitru/skills) at commit `f308ebc`,
folder `skills/fun-briefs/`:

| There | Here |
|---|---|
| `assets/deck/index.html` | `src/shell.html` (markup and CSS) and `src/engine.js` (the script) |
| `references/deck.md` | `deck.md` |
| `scripts/autoplay.mjs` | `scripts/autoplay.ts` |
| `assets/deck/build.py`, `assets/deck/c-deck.js` | `scripts/build.ts`, `src/build.ts` (decks are JSON now) |

What changed on the way in: the engine reads its deck from
`<script type="application/json" id="deck">` instead of a `c-deck.js` script, and a `guess` card's
`fmt` is a template (`src/format.ts`) instead of a function. Until Ludify's full flow works
(SPEC.md milestone 3), engine fixes go into both copies.

Changed since, for model-written decks:

- Deck text reaches the page only through the Markdown-lite renderer (`src/markdown.ts`: `**bold**`,
  `` `code` ``, `[text](https://…)`) or as escaped plain text; numbers are checked before they go
  into markup.
- The engine's English strings are in `src/ui.ts`; a deck's `ui` block overrides them key by key.
  The page takes the deck's `lang`, and read-aloud picks a voice for it (`src/voice.ts`).
- `info` cards show a source tag; "Start over" asks with a second tap instead of `confirm()`.
- `challenge` cards and `decide.ticket` are gone.

## Inside a host

Links open in a new tab. A page that embeds the deck in an MCP Apps host sets
`window.ludifyHost = { openLink(url) }` before the engine runs, and the engine then sends every link
click there instead (only `https:` links exist).

## Commands

From the repo root:

- `npm run typecheck`, `npm test`: types and unit tests.
- `npm run build:example -w @ludify/deck`: builds the example deck into
  `packages/deck/dist/adhd-learning-deck.html`; open that file in a browser to play it.
- `npm run autoplay`: builds the example deck and the two fixture decks in `fixtures/` (Romanian,
  with a full `ui` block; hostile, with markup and `javascript:` links in every string) and plays
  every card in headless Chromium, light and dark. It fails on a page error, a stuck card, markup
  the engine doesn't write, a request to anywhere but the fonts, a `confirm()` call, English showing
  in a translated deck, or a page wider than 400 px. It also taps "Start over" and follows a link
  through a stand-in host. Screenshots land in `packages/deck/dist/shots/<deck>/`. Needs
  `npx playwright install chromium` once.
- `node packages/deck/scripts/build.ts <deck.json> <out.html>`: builds any deck.
- `node packages/deck/scripts/validate.ts <deck.json>`: validates a deck against `deck.schema.json`
  and the deck rules, prints each error, and exits 1 if there are any.

## Validation

`deck.schema.json` (JSON Schema draft 2020-12) is the deck format; `validateDeck` in
`src/validate.ts` checks a deck against it and against the rules a schema can't express. See
[deck.md](deck.md#validation).
