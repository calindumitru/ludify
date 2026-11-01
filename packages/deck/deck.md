# The deck format

A deck is data: one JSON file with `ui` (strings) and `worlds` (the cards). The engine
(`src/shell.html` and `src/engine.js`: layout, card plays, XP, saved progress) reads it from a
`<script type="application/json" id="deck">` block, and `scripts/build.ts` writes the engine and the
deck into one self-contained page. Nothing in a deck is ever run as code. Start from
[fixtures/ro-deck.json](fixtures/ro-deck.json): a small valid deck in Romanian that translates every
`ui` key the engine has. The English strings are in [src/ui.ts](src/ui.ts).
[examples/adhd-learning-deck.json](../../examples/adhd-learning-deck.json) is a full deck, still in
the old format.

## What the engine already does

Each of these maps to a row of `evidence.md`; keep them on.

- The home screen has three things: a "60-second version" (`gist`), an optional if-then start plan
  (`planQ`, `planOpts`, `planThen`), and the worlds as tiles the reader can open in any order.
- The top bar shows the work left in plain units: "N cards left · ~M min" (`left`, `secsPerCard`).
  On phones it replaces the progress bar.
- Progress saves to `localStorage` under `ui.key`, and the home screen offers "pick up where you
  stopped". Give each brief its own key.
- Calm mode hides XP and its toasts. Each card has read-aloud. ← → and 1–4 work on the
  keyboard, and the reader can swipe on touch. Reduced motion turns off all animation.
- A play must be answered before Next unlocks. Reading cards never block.
- The page takes the deck's `lang`, and every string the engine shows comes from `ui` (the deck's,
  else the English default). Read-aloud picks the best voice the browser has for `lang`.
- "Start over" asks inside the deck: the first tap turns the button into `resetAsk`, a second tap
  within five seconds clears progress and XP. (`confirm()` is blocked in both hosts.)
- XP only ever follows an explanation: it comes with the feedback of an answered play whose card
  shows why (`why`, or the picked option's `after` on a decide card), never for reading a card,
  reaching the summary or finishing a world. +20 right first time (quiz, order, multi), +5 for a
  wrong try (+8 on multi), +25 for a close guess (+10 otherwise), +15 per decision. The rule is
  `reward()` in [src/xp.ts](src/xp.ts).
- A world ends on its recap: its key points in three lines or fewer, then on to the next world.
  The map shows a plain ✓ on each finished world. The deck ends on the `summary` card; there are
  no collectibles, no end-of-deck reward screen and no celebration effects (`evidence.md` rows 13,
  15 and 19).

## Worlds

```json
{ "id": "money", "c": "w2", "title": "Money", "mins": 4, "tease": "One line on what this world gives you.",
  "recap": ["One to three", "things", "to keep"],
  "cards": [] }
```

`recap` (one to three texts) is shown when the world ends; `cards` holds 5–8 cards.

`c` is `w1`–`w4`. Those are the four colours: give each world its own. More than four worlds needs
new `--w5`/`--w5s` variables in the engine's CSS. Keep `mins` honest: about 35 seconds a card.

## Cards

Every card takes `h` (a headline of at most 12 words, which states the point), plus optional `tag`,
`p` (a string or an array of strings), `ul`, `more` (detail behind a tap) and `src` (an https URL,
shown as "Source: site.org", or `{"notes": true}`). Text is Markdown-lite: `**bold**`, `` `code` ``
and `[text](https://…)`. Nothing else is markup: HTML, other Markdown and links that aren't `https:`
show as the text they are.

| `type` | Extra fields | Use it for |
|---|---|---|
| `info` | `tag` is a source tag: `{"source": "study", "grade": "moderate"}` | One idea. The tag shows as "Study · Moderate evidence"; a fact from the user's notes shows as "From your notes · unverified". |
| `big` | `big` (the number) | One striking number with its meaning in `p`. |
| `quiz` | `opts` (2–4), `right` (index), `why` | Retrieval after the card that taught it, or a prediction before the reveal. True/false is `opts: ['True','False']` with `tag: 'True or false'`. |
| `guess` | `min`, `max`, `step`, `start`, `answer`, `tol`, `fmt` (a template: `"{v} min"`, `"€{v}"`, `"{v:2}"` for two decimals), `why` | Slide to estimate a number, then reveal it. Surprising numbers make the best ones. |
| `order` | `items` (in the right order), `shown` (the display order, as indices), `why` | Ranking a priority order or a sequence. |
| `multi` | `opts`, `right` (an array of indices), `why` | "Which of these…": status checks and myth sorting. |
| `decide` | `opts`, `lean` (index of the recommendation), `after` (one line per option), `short` | Decisions that belong to the reader. There's no right answer, and the pick is recorded. |
| `summary` | `from: [[worldId, cardIndex], …]` | Collecting the `decide` picks into text, one line per decision. |

`why` always explains: it names the number, the reason or the source. It never just says "correct".

## Shape of a good deck

- Four worlds of 5–8 cards each, about 15 minutes in all. The last world is the "boss level": the
  decisions, or the myths, whichever the brief builds towards.
- Within a world, alternate: an `info` card, then a play that retrieves it or predicts the next one.
  Never put three `info` cards in a row.
- Each world's `recap` gives three lines at most: the things the reader should still know tomorrow.
- Use emoji only as signals (one per tag at most). Leave decoration and images out.

## Validation

A model-written deck is checked before it plays: `validateDeck(json)` in `src/validate.ts`, against
[deck.schema.json](deck.schema.json) (JSON Schema draft 2020-12) and the rules a schema can't
express. Where this page and the schema differ, the schema wins: the example deck still uses the
old format until its rewrite (SPEC milestone 4).

The model doesn't read this page: `ludify_guide` gives it
[packages/server/guide.md](../server/guide.md), which embeds this schema and the English `ui`
strings and is tested against both, so a schema change means pasting the new schema into it.

What the schema adds to the tables above:

- `lang` (a BCP 47 tag) is required. `ui` is optional, holds only the engine's string keys, and its
  strings are plain text without HTML tags.
- `src` is an https URL, or `{"notes": true}` for a fact from the user's notes. Every card except
  `decide` and `summary` needs it, apart from the limits card.
- An `info` card's `tag` is a source tag, `{"source": "study", "grade": "moderate"}`: `source` is
  one of `official`, `study`, `test`, `vendor`, `notes`, and `grade` (`strong`, `moderate`, `weak`,
  `none`, `against`) is there only when the card claims an effect. The limits card is
  `{"type": "info", "kind": "limits", ...}` and needs neither tag nor `src`.
- No `challenge` cards, and no `ticket` on `decide`. Older decks' reward fields are refused like
  any unknown field: the world's collectible gets "world 1: `<field>` isn't a world field; remove
  it.", and `xp` on `summary` gets "world 2, card 3: `xp` isn't a field of a summary card;
  remove it."

Rules checked in code: 2 or 4 worlds; the last world is the decision world (`decide` cards, then one
`summary`); exactly one limits card, the last card of the world before it; `summary.from` points at
`decide` cards; indexes inside a card exist (`right`, `lean`, `shown`) and a guess's `start` and
`answer` sit between `min` and `max`; 64 KB at most.

The result is `{ ok, errors, deck, skipped }`. Each error is one sentence naming the place
(`world 2, card 3`), the field and the fix. A broken card is left out of `deck` and listed in
`skipped`; a broken `ui` string is left out and the engine's English fills in. `deck` is `null`
when the deck can't be played: a deck-level error, a broken limits card or summary, no valid
`decide` card left in the decision world (or none left that the summary collects), or a world with
no valid card left. When a `decide` card is dropped, `summary.from` is re-pointed at the cards that
remain.
