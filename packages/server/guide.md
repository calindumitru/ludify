# How to write a Ludify deck

A Ludify deck is a short decision game made from research: the user plays it once, in about ten
minutes, one idea per card, and it ends on their own picks. You write the deck as JSON data and
pass it to `ludify_render`, which checks it and plays it inline. Nothing in a deck is ever run as
code.

Read this whole manual before you write. The JSON Schema at the end is the full contract: where
this text and the schema differ, the schema wins.

## Steps

1. Settle the depth (below): the user's choice from the narrowing form or the chat, else quick.
2. Plan the worlds: their titles, the idea of each card, and the decisions the deck builds towards.
3. Write the deck as one JSON object with `lang`, `ui` and `worlds`, in the user's language.
4. Call `ludify_render` with `{"deck": <the deck>}`.
5. If it returns a list of problems, fix every one and call `ludify_render` again with the whole
   deck and `"attempt": 2`. Each problem names the place (`world 2, card 3`), the field and the
   fix. On attempt 2 and later, cards that are still broken are left out and the rest plays, with
   a note at the top naming each card left out; translate `ui.skippedNote` (the note's first
   line) and `ui.skippedWhy` (the reason after each card) with the other strings. A problem with the deck as a whole still returns the list:
   fix it and call again with the next `attempt`.

Keep your chat message around the deck short: one line saying what the deck covers is enough.
The deck itself carries the content.

## Depth

- **Quick:** 2 worlds and about 12 cards, from a lighter search. World 1 holds the facts and
  ends on the limits card; world 2 is "Your decision".
- **Thorough:** 4 worlds and about 25 to 30 cards, from a wider search with more primary sources.
  Worlds 1 and 2 hold the facts; world 3 is the myths world and ends on the limits card; world 4
  is "Your decision".

The validator accepts 2 or 4 worlds, nothing else. Give a world 5 to 8 cards (the decision world
may have fewer), and set its `mins` honestly: about 35 seconds a card.

## Structure

Every deck has this shape, and the validator checks it:

- **The facts worlds.** Each world is one theme, with a title, a one-line `tease`, and a `recap`
  of one to three lines the reader should still know tomorrow.
- **The myths world** (thorough decks only): the common beliefs on the topic that the evidence
  doesn't support, sorted with `multi` cards ("Which of these hold up?") and explained with
  `info` cards.
- **The limits card**, the last card of the world right before the decision world:
  `{"type": "info", "kind": "limits", "h": "What this can't tell you", "ul": [...]}`. It names the
  gaps in the evidence, the facts that stay unverified, and what depends on the user's own
  situation. It's the only card that needs neither `tag` nor `src`. Exactly one per deck.
- **The decision world** ("Your decision", in the user's language), always last: two to four
  `decide` cards, then one `summary` card that collects them. Nothing else goes in it. The
  decisions are the ones the user is actually facing; each option's `after` line says what that
  pick means, and `lean` marks the option the research leans to, when it leans.

## Card types

Every card has `type` and `h`, a headline of at most 12 words that states the point (not a topic
label). Every card may also have `p` (a text or a list of paragraphs), `ul` (bullet points),
`more` (detail behind a "Tell me more" tap) and `tag` (on play cards, a short label replacing the
card type's default one).

| `type` | Its own fields | Use it for |
|---|---|---|
| `info` | `tag` (a source tag, below), `src` | One idea, with where it comes from. |
| `big` | `big` (the number, as text), `src` | One striking number, with its meaning in `p`. |
| `quiz` | `opts` (2 to 4), `right` (index), `why`, `src` | Retrieval right after the card that taught it, or a prediction before the reveal. True or false is `"opts": ["True", "False"]`. |
| `guess` | `min`, `max`, `step`, `start`, `answer`, `tol`, `fmt`, `why`, `src` | Slide to estimate a number, then see it. Surprising numbers make the best ones. `fmt` is a template: `"{v} min"`, `"€{v}"`, `"{v:2}"` for two decimals. `start` and `answer` sit between `min` and `max`. |
| `order` | `items` (2 to 6, in the right order), `shown` (the order to show them in, as indexes), `why`, `src` | Ranking a priority or a sequence. `shown` lists every index of `items` once. |
| `multi` | `opts`, `right` (a list of indexes), `why`, `src` | "Which of these…": status checks and myth sorting. |
| `decide` | `opts`, `lean` (optional index), `after` (one line per option), `short` (a name for the decision) | A decision that belongs to the reader: no right answer, and the pick is recorded. |
| `summary` | `from`: `[[worldId, cardIndex], …]` | Collecting the `decide` picks, one line per decision. |

Indexes (`right`, `lean`, `shown`, `from`) count from 0.

## Writing rules

These come from the engagement evidence Ludify is built on. Follow every one.

- **One idea per card.** A short segment the reader controls. If a card needs "and also", split it.
- **A payoff every card or two.** Alternate: an `info` or `big` card, then a play (`quiz`,
  `guess`, `order`, `multi`) that retrieves it or predicts the next one. Never put three `info`
  cards in a row.
- **Feedback that explains why.** Every `why` names the number, the reason or the source. Never
  write a `why` that only says "correct" or "well done".
- **Signal the structure.** Headlines that state the point, a recap per world, **bold** for the
  key term in a card, not for whole sentences.
- **Cut the extras.** No interesting-but-irrelevant facts, no decoration. Emoji only as a signal,
  one per tag at most.
- **No points, badges or streaks** as the reason to keep going, and no celebration text. The
  engine already gives a little XP after an explanation; don't add your own rewards.
- **Never write that something is "proven for ADHD".** Say "evidence suggests" and grade the
  claim. Call any other claim proven only when a study directly shows it.
- **The reader decides.** Present the evidence and its limits; leave the call to the `decide`
  cards.

Text is Markdown-lite: `**bold**`, `` `code` `` and `[text](https://…)`. Nothing else is markup:
HTML, headings, other Markdown and links that aren't https show as the plain text they are.

## Sources

- **Every card with a fact carries `src`:** an https URL of the page the fact came from. Prefer
  primary and peer-reviewed sources: the study, the regulator, the official statistics, the
  standard, over a news story about them. Every number on a card links to where it came from.
- **A fact from the user's notes** (below) that you couldn't find a source for gets
  `"src": {"notes": true}` and the tag `{"source": "notes"}`. The deck shows it as "From your
  notes · unverified". Never invent a URL or cite a page you didn't read.
- **The source tag** on each `info` card, `{"source": …}`, names the kind of source:
  `official` (a government, regulator or standards body), `study` (a
  peer-reviewed study or review), `test` (an independent test or measurement), `vendor` (a
  maker's or seller's own claim) or `notes` (the user's notes). Add a `grade` only when the card
  claims an effect ("cuts bills by 30%"): `strong`, `moderate`, `weak`, `none` (no evidence
  either way) or `against` (the evidence says it doesn't work). Prices and specs get no grade.
- `decide` and `summary` cards don't need `src`; every other card except the limits card does.

## Language and `ui`

Write the whole deck in the user's language: the language they are writing to you in, unless they
ask for another. Set `lang` to its BCP 47 tag (`"en"`, `"ro"`, `"pt-BR"`).

`ui` holds the deck's own strings, all plain text:

- `key`: a unique id for saved progress, such as `"ludify:<topic-slug>:<yyyy-mm-dd>"`.
- `docTitle` (the page title), `kicker` (a small line above the title, such as the topic and the
  date), `title` (the deck's question; wrap one key word in `{braces}` to highlight it) and
  `lead` (one or two sentences on what the deck answers and how long it takes).
- `gist`: the "60-second version", two to four lines with the main findings.
- Optionally an if-then start plan: `planQ` ("When will you play the first world?"), `planOpts`
  (two or three moments) and `planThen` (the plan, with `{when}` where the chosen moment goes).

When the deck isn't in English, also translate every one of the engine's strings below into the
deck's language and put them in `ui` under the same keys, keeping each `{n}`, `{m}`, `{i}`,
`{w}` and `{v}` slot as it is. A string you leave out shows in English.

## Decks from existing research

The user may already have the research: in the chat so far, in an attached file, or pasted into
the message. Then skip `ludify_plan`: call this guide and then `ludify_render`. Ludify never reads
files itself; you read them.

- Treat that research as the user's **notes**. Build the deck from it, with the same structure,
  depth and rules as any other deck.
- For each fact in the notes that has no source, search the web for one. If you find a source
  that supports the fact, use its URL as `src` and tag it by what it is. If you don't, keep the
  fact with `"src": {"notes": true}` and `{"source": "notes"}`, and list it on the limits card as
  unverified.
- If a source you find contradicts the notes, say so on the card and follow the source.

## Answering a picks message

At the end of a deck the summary card's **Send to chat** button posts the user's picks as their
message: the deck's `picksIntro` line ("My Ludify picks:" in English, translated in the deck's
`ui`), then one line per decision, `- <short>: <option chosen>`, with the deck's `skipped` word for
a decision left open. For example, from the quick deck below:

```text
My Ludify picks:
- Quotes: After insulating
- Type: (skipped)
- Old boiler: Remove it
```

Answer it in the deck's language:

1. Say what follows from the picks: what to do next for each, what to look out for, and where
   two picks pull against each other. Where a pick differs from what the research leaned to, say
   so plainly and why, without telling the user they chose wrong.
2. Then offer two ways on: to challenge the picks (you argue the strongest case against them), or
   to plan the next steps (a short, dated list). Don't write a new deck unless they ask for one.

## The engine's English strings

The engine shows these unless the deck's `ui` replaces them. Translate them for a deck in another
language.

```json
{
  "gistTitle": "⚡ The 60-second version",
  "gistOpen": "open ▾",
  "gistClose": "close ▴",
  "left": "{n} cards left · ~{m} min",
  "allDoneShort": "All done",
  "worldMeta": "World {i} · {m} min",
  "calmOn": "Calm mode: hide XP",
  "calmOff": "Show XP again",
  "speak": "Read this card aloud",
  "anyOrder": "Play in any order",
  "resume": "Pick up where you stopped",
  "reset": "Start over",
  "resetAsk": "Tap again to clear your progress",
  "map": "Map",
  "mapLabel": "Back to the map",
  "prevLabel": "Previous card",
  "keysHint": "← → keys or swipe",
  "progressLabel": "Cards done",
  "tags": {
    "info": "Know this",
    "big": "One number",
    "quiz": "Quick quiz",
    "guess": "Guess",
    "order": "Put in order",
    "multi": "Pick all that apply",
    "decide": "Your call",
    "summary": "Your picks"
  },
  "sources": {
    "official": "Official source",
    "study": "Study",
    "test": "Test",
    "vendor": "Vendor claim",
    "notes": "From your notes · unverified"
  },
  "grades": {
    "strong": "Strong evidence",
    "moderate": "Moderate evidence",
    "weak": "Weak evidence",
    "none": "No evidence",
    "against": "Evidence against"
  },
  "source": "Source",
  "more": "Tell me more",
  "next": "Next →",
  "finishWorld": "Finish world →",
  "lock": "Lock it in",
  "undo": "Undo last",
  "yes": [
    "Nailed it.",
    "Spot on.",
    "Yes!",
    "Exactly."
  ],
  "no": "Not quite. Here's the answer:",
  "close": "Close. The full answer:",
  "orderWas": "Here's the real order:",
  "actual": "The real number: {v}.",
  "lean": "research leans",
  "noted": "Noted.",
  "changeAny": "You can change it any time.",
  "skipped": "(skipped)",
  "skippedNote": "These cards had a problem, so they are left out:",
  "skippedWhy": "this card broke a deck rule",
  "send": "Send to chat",
  "sent": "Sent to the chat ✓",
  "sendEnter": "It's in your message box: press Enter to send. Claude may show a safety warning first; it's only your picks.",
  "sendFailed": "Couldn't send it. Try again.",
  "picksIntro": "My Ludify picks:",
  "whyRight": "right first try",
  "whyTried": "for trying",
  "whyClose": "close guess",
  "whyDecide": "decision made",
  "recapTitle": "To keep from this world",
  "nextWorld": "Next: {w} →"
}
```

## A whole quick deck

A valid quick deck, to show the shape. Its URLs are placeholders: yours are the real pages you
read. A real quick deck has about 12 cards.

```json
{
  "lang": "en",
  "ui": {
    "key": "ludify:heat-pump:2026-11-01",
    "docTitle": "Is a heat pump worth it?",
    "kicker": "Heat pumps · 1 Nov 2026",
    "title": "Is a {heat pump} worth it for your house?",
    "lead": "What it costs, what it saves, and the calls that are yours. Two worlds, about 7 minutes.",
    "gist": [
      "**Running costs** follow your electricity price.",
      "Insulating first shrinks the pump you need.",
      "Get three quotes before you pick a type."
    ],
    "planQ": "When will you play the first world?",
    "planOpts": [
      "Now",
      "After lunch",
      "Tonight"
    ],
    "planThen": "Plan: {when}, open the first world."
  },
  "worlds": [
    {
      "id": "costs",
      "c": "w1",
      "title": "What it costs and saves",
      "mins": 5,
      "tease": "Prices, savings and what they depend on.",
      "recap": [
        "Installed prices vary about twofold.",
        "Savings follow the electricity price.",
        "Insulate first."
      ],
      "cards": [
        {
          "type": "info",
          "tag": {
            "source": "official"
          },
          "h": "An air-source heat pump costs about €12,000 installed",
          "p": "That's the median of quotes in the national installer survey.",
          "src": "https://example.org/installer-survey-2026"
        },
        {
          "type": "guess",
          "h": "How much heat does one unit of electricity give?",
          "min": 1,
          "max": 6,
          "step": 0.1,
          "start": 2,
          "answer": 3.2,
          "tol": 0.4,
          "fmt": "{v:1} units",
          "why": "Field trials measured a seasonal average of **3.2** units of heat per unit of electricity.",
          "src": "https://example.org/field-trial"
        },
        {
          "type": "info",
          "tag": {
            "source": "study",
            "grade": "moderate"
          },
          "h": "Insulating first cuts the heat pump size you need",
          "p": "A smaller unit costs less to buy and runs closer to its best efficiency.",
          "src": "https://example.org/insulation-review"
        },
        {
          "type": "quiz",
          "h": "What drives a heat pump's running cost most?",
          "opts": [
            "The brand",
            "The electricity price",
            "The outdoor unit's colour"
          ],
          "right": 1,
          "why": "Electricity is almost all of the running cost, so its price sets the saving.",
          "src": "https://example.org/running-costs"
        },
        {
          "type": "order",
          "h": "Put these steps in the order that saves most",
          "items": [
            "Insulate the loft and walls",
            "Get three quotes",
            "Pick the unit size"
          ],
          "shown": [
            2,
            0,
            1
          ],
          "why": "Insulation changes the size you need, and the quotes are for that size.",
          "src": "https://example.org/installer-guide"
        },
        {
          "type": "info",
          "tag": {
            "source": "notes"
          },
          "h": "Your house was insulated in 2019",
          "src": {
            "notes": true
          }
        },
        {
          "type": "multi",
          "h": "Which of these hold up?",
          "opts": [
            "Heat pumps don't work below 0 °C",
            "They work best with large radiators",
            "They need a well-insulated house to pay off"
          ],
          "right": [
            1,
            2
          ],
          "why": "Modern units heat down to about −20 °C; low flow temperatures need big radiators and a house that keeps the heat.",
          "src": "https://example.org/cold-climate-tests"
        },
        {
          "type": "info",
          "kind": "limits",
          "h": "What this can't tell you",
          "ul": [
            "Quotes for your street.",
            "Next year's electricity price.",
            "Your insulation date is from your notes, unverified."
          ]
        }
      ]
    },
    {
      "id": "decide",
      "c": "w2",
      "title": "Your decision",
      "mins": 2,
      "tease": "Three calls that are yours to make.",
      "recap": [
        "You picked what fits your house."
      ],
      "cards": [
        {
          "type": "decide",
          "h": "When do you get quotes?",
          "opts": [
            "This month",
            "After insulating",
            "Not yet"
          ],
          "lean": 1,
          "after": [
            "Get three, for the same size.",
            "Insulation first, then quote for the smaller size.",
            "Fine: revisit when prices change."
          ],
          "short": "Quotes"
        },
        {
          "type": "decide",
          "h": "Which type would you look at?",
          "opts": [
            "Air-source",
            "Ground-source"
          ],
          "after": [
            "Cheaper to install, a little less efficient.",
            "More efficient, needs land and digging."
          ],
          "short": "Type"
        },
        {
          "type": "decide",
          "h": "What do you do with the old boiler?",
          "opts": [
            "Remove it",
            "Keep it as a backup"
          ],
          "after": [
            "Frees space and the yearly service.",
            "Covers the coldest days, at a yearly service cost."
          ],
          "short": "Old boiler"
        },
        {
          "type": "summary",
          "h": "Your picks",
          "from": [
            [
              "decide",
              0
            ],
            [
              "decide",
              1
            ],
            [
              "decide",
              2
            ]
          ]
        }
      ]
    }
  ]
}
```

## The deck schema

The JSON Schema (draft 2020-12) `ludify_render` checks the deck against. The validator also
checks what a schema can't: 2 or 4 worlds, the decision world last, the limits card right before
it, where `summary.from` points, the indexes inside a card, and 64 KB at most.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/calindumitru/ludify/main/packages/deck/deck.schema.json",
  "title": "Ludify deck",
  "description": "A deck is data, never code. Rules this schema can't express (2 or 4 worlds, the decision world, the limits card, where summary.from points, indexes inside a card, 64 KB at most) are checked by validateDeck in src/validate.ts.",
  "type": "object",
  "required": ["lang", "worlds"],
  "properties": {
    "lang": {
      "description": "the deck's language as a BCP 47 tag, such as \"en\", \"ro\" or \"pt-BR\"",
      "$comment": "RFC 5646 langtag or private-use tag. Left out: the reserved 4- and 5-8-letter language subtags (none is registered) and the grandfathered tags such as i-klingon. Repeated variants or extension singletons are checked in code.",
      "type": "string",
      "pattern": "^(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}){0,3}(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|[0-9]{3}))?(?:-(?:[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(?:-[0-9A-WY-Za-wy-z](?:-[A-Za-z0-9]{2,8})+)*(?:-[Xx](?:-[A-Za-z0-9]{1,8})+)?|[Xx](?:-[A-Za-z0-9]{1,8})+)$"
    },
    "ui": { "$ref": "#/$defs/ui" },
    "worlds": {
      "description": "a list of worlds: 2 for a quick deck, 4 for a thorough one",
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/world" }
    }
  },
  "unevaluatedProperties": false,
  "$defs": {
    "text": {
      "description": "text (Markdown-lite: **bold**, `code`, [text](https://…))",
      "type": "string",
      "minLength": 1
    },
    "texts": {
      "description": "text, or a list of texts",
      "anyOf": [
        { "$ref": "#/$defs/text" },
        { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/text" } }
      ]
    },
    "textList": {
      "description": "a list of texts",
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/text" }
    },
    "options": {
      "description": "2 to 4 options, each a text",
      "type": "array",
      "minItems": 2,
      "maxItems": 4,
      "items": { "$ref": "#/$defs/text" }
    },
    "index": {
      "description": "an index into the card's list, counting from 0",
      "type": "integer",
      "minimum": 0
    },
    "plain": {
      "description": "plain text without HTML tags",
      "type": "string",
      "minLength": 1,
      "pattern": "^(?![\\s\\S]*<[A-Za-z/!?])"
    },
    "plainList": {
      "description": "a list of plain texts without HTML tags",
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/$defs/plain" }
    },
    "httpsUrl": {
      "description": "an https URL",
      "$comment": "The pattern needs a host; validateDeck also parses the URL and checks the scheme and host.",
      "type": "string",
      "pattern": "^https://[^\\s/?#@]+(?:[/?#][^\\s]*)?$"
    },
    "src": {
      "description": "the source: an https URL, or {\"notes\": true} for a fact from the user's notes",
      "anyOf": [
        { "$ref": "#/$defs/httpsUrl" },
        {
          "type": "object",
          "required": ["notes"],
          "properties": { "notes": { "const": true } },
          "additionalProperties": false
        }
      ]
    },
    "ui": {
      "description": "the engine's strings in the deck's language; every key is optional and the engine's English fills the rest",
      "type": "object",
      "properties": {
        "key": { "$ref": "#/$defs/plain" },
        "docTitle": { "$ref": "#/$defs/plain" },
        "kicker": { "$ref": "#/$defs/plain" },
        "title": { "$ref": "#/$defs/plain" },
        "lead": { "$ref": "#/$defs/plain" },
        "gistTitle": { "$ref": "#/$defs/plain" },
        "gistOpen": { "$ref": "#/$defs/plain" },
        "gistClose": { "$ref": "#/$defs/plain" },
        "gist": { "$ref": "#/$defs/plainList" },
        "planQ": { "$ref": "#/$defs/plain" },
        "planOpts": { "$ref": "#/$defs/plainList" },
        "planThen": { "$ref": "#/$defs/plain" },
        "left": { "$ref": "#/$defs/plain" },
        "allDoneShort": { "$ref": "#/$defs/plain" },
        "secsPerCard": {
          "description": "a whole number of seconds from 5 to 300",
          "type": "integer",
          "minimum": 5,
          "maximum": 300
        },
        "calmOn": { "$ref": "#/$defs/plain" },
        "calmOff": { "$ref": "#/$defs/plain" },
        "speak": { "$ref": "#/$defs/plain" },
        "anyOrder": { "$ref": "#/$defs/plain" },
        "resume": { "$ref": "#/$defs/plain" },
        "fullLink": { "$ref": "#/$defs/httpsUrl" },
        "fullText": { "$ref": "#/$defs/plain" },
        "reset": { "$ref": "#/$defs/plain" },
        "resetAsk": { "$ref": "#/$defs/plain" },
        "worldMeta": { "$ref": "#/$defs/plain" },
        "mapLabel": { "$ref": "#/$defs/plain" },
        "prevLabel": { "$ref": "#/$defs/plain" },
        "keysHint": { "$ref": "#/$defs/plain" },
        "progressLabel": { "$ref": "#/$defs/plain" },
        "sources": {
          "description": "the label for each source type, as plain text without HTML tags",
          "type": "object",
          "properties": {
            "official": { "$ref": "#/$defs/plain" },
            "study": { "$ref": "#/$defs/plain" },
            "test": { "$ref": "#/$defs/plain" },
            "vendor": { "$ref": "#/$defs/plain" },
            "notes": { "$ref": "#/$defs/plain" }
          },
          "additionalProperties": false
        },
        "grades": {
          "description": "the label for each evidence grade, as plain text without HTML tags",
          "type": "object",
          "properties": {
            "strong": { "$ref": "#/$defs/plain" },
            "moderate": { "$ref": "#/$defs/plain" },
            "weak": { "$ref": "#/$defs/plain" },
            "none": { "$ref": "#/$defs/plain" },
            "against": { "$ref": "#/$defs/plain" }
          },
          "additionalProperties": false
        },
        "source": { "$ref": "#/$defs/plain" },
        "skipped": { "$ref": "#/$defs/plain" },
        "skippedNote": { "$ref": "#/$defs/plain" },
        "skippedWhy": { "$ref": "#/$defs/plain" },
        "tags": {
          "description": "the default tag for each card type, as plain text without HTML tags",
          "type": "object",
          "properties": {
            "info": { "$ref": "#/$defs/plain" },
            "big": { "$ref": "#/$defs/plain" },
            "quiz": { "$ref": "#/$defs/plain" },
            "guess": { "$ref": "#/$defs/plain" },
            "order": { "$ref": "#/$defs/plain" },
            "multi": { "$ref": "#/$defs/plain" },
            "decide": { "$ref": "#/$defs/plain" },
            "summary": { "$ref": "#/$defs/plain" }
          },
          "additionalProperties": false
        },
        "more": { "$ref": "#/$defs/plain" },
        "next": { "$ref": "#/$defs/plain" },
        "finishWorld": { "$ref": "#/$defs/plain" },
        "lock": { "$ref": "#/$defs/plain" },
        "undo": { "$ref": "#/$defs/plain" },
        "yes": { "$ref": "#/$defs/plainList" },
        "no": { "$ref": "#/$defs/plain" },
        "close": { "$ref": "#/$defs/plain" },
        "orderWas": { "$ref": "#/$defs/plain" },
        "actual": { "$ref": "#/$defs/plain" },
        "lean": { "$ref": "#/$defs/plain" },
        "noted": { "$ref": "#/$defs/plain" },
        "changeAny": { "$ref": "#/$defs/plain" },
        "send": { "$ref": "#/$defs/plain" },
        "sent": { "$ref": "#/$defs/plain" },
        "sendEnter": { "$ref": "#/$defs/plain" },
        "sendFailed": { "$ref": "#/$defs/plain" },
        "picksIntro": { "$ref": "#/$defs/plain" },
        "whyRight": { "$ref": "#/$defs/plain" },
        "whyTried": { "$ref": "#/$defs/plain" },
        "whyClose": { "$ref": "#/$defs/plain" },
        "whyDecide": { "$ref": "#/$defs/plain" },
        "recapTitle": { "$ref": "#/$defs/plain" },
        "nextWorld": { "$ref": "#/$defs/plain" },
        "map": { "$ref": "#/$defs/plain" }
      },
      "additionalProperties": false
    },
    "world": {
      "type": "object",
      "required": ["id", "c", "title", "mins", "tease", "recap", "cards"],
      "properties": {
        "id": {
          "description": "a short id of lowercase letters, digits and dashes, unique in the deck",
          "type": "string",
          "pattern": "^[a-z0-9][a-z0-9-]{0,31}$"
        },
        "c": {
          "description": "the world's colour: one of w1, w2, w3, w4",
          "enum": ["w1", "w2", "w3", "w4"]
        },
        "title": { "$ref": "#/$defs/plain" },
        "mins": {
          "description": "the minutes the world takes, a whole number from 1 to 30",
          "type": "integer",
          "minimum": 1,
          "maximum": 30
        },
        "tease": { "$ref": "#/$defs/text" },
        "recap": {
          "description": "the world's key points, shown when the world ends: 1 to 3 texts the reader should still know tomorrow",
          "type": "array",
          "minItems": 1,
          "maxItems": 3,
          "items": { "$ref": "#/$defs/text" }
        },
        "cards": {
          "description": "a list of cards",
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/card" }
        }
      },
      "unevaluatedProperties": false
    },
    "cardBase": {
      "type": "object",
      "required": ["type", "h"],
      "properties": {
        "h": {
          "description": "the headline, which states the point",
          "$ref": "#/$defs/text"
        },
        "p": { "description": "the body: text, or a list of paragraphs", "$ref": "#/$defs/texts" },
        "ul": { "description": "a list of bullet points", "$ref": "#/$defs/textList" },
        "more": { "description": "detail behind a tap: text, or a list of paragraphs", "$ref": "#/$defs/texts" }
      }
    },
    "stringTag": {
      "description": "a short label above the card, as text",
      "$ref": "#/$defs/text"
    },
    "why": {
      "description": "the explanation shown after the play, naming the number, the reason or the source",
      "$ref": "#/$defs/text"
    },
    "sourceTag": {
      "description": "the source tag: {\"source\": one of official, study, test, vendor, notes}, plus \"grade\" (strong, moderate, weak, none, against) when the card claims an effect",
      "type": "object",
      "required": ["source"],
      "properties": {
        "source": { "enum": ["official", "study", "test", "vendor", "notes"] },
        "grade": { "enum": ["strong", "moderate", "weak", "none", "against"] }
      },
      "additionalProperties": false
    },
    "card": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "description": "the card type: one of info, big, quiz, guess, order, multi, decide, summary",
          "enum": ["info", "big", "quiz", "guess", "order", "multi", "decide", "summary"]
        }
      },
      "allOf": [
        { "if": { "properties": { "type": { "const": "info" } } }, "then": { "$ref": "#/$defs/info" } },
        { "if": { "properties": { "type": { "const": "big" } } }, "then": { "$ref": "#/$defs/big" } },
        { "if": { "properties": { "type": { "const": "quiz" } } }, "then": { "$ref": "#/$defs/quiz" } },
        { "if": { "properties": { "type": { "const": "guess" } } }, "then": { "$ref": "#/$defs/guess" } },
        { "if": { "properties": { "type": { "const": "order" } } }, "then": { "$ref": "#/$defs/order" } },
        { "if": { "properties": { "type": { "const": "multi" } } }, "then": { "$ref": "#/$defs/multi" } },
        { "if": { "properties": { "type": { "const": "decide" } } }, "then": { "$ref": "#/$defs/decide" } },
        { "if": { "properties": { "type": { "const": "summary" } } }, "then": { "$ref": "#/$defs/summary" } }
      ]
    },
    "info": {
      "description": "One idea. Every info card needs a source tag and a src, except the limits card (kind: limits).",
      "$ref": "#/$defs/cardBase",
      "properties": {
        "type": { "const": "info" },
        "kind": {
          "description": "\"limits\" on the one card that says what the brief can't tell the reader, or nothing",
          "const": "limits"
        },
        "tag": { "$ref": "#/$defs/sourceTag" },
        "src": { "$ref": "#/$defs/src" }
      },
      "if": { "required": ["kind"] },
      "else": { "required": ["tag", "src"] },
      "unevaluatedProperties": false
    },
    "big": {
      "description": "One striking number, with its meaning in p.",
      "$ref": "#/$defs/cardBase",
      "properties": {
        "type": { "const": "big" },
        "tag": { "$ref": "#/$defs/stringTag" },
        "big": { "description": "the number as text, such as \"d = 0.43\"", "$ref": "#/$defs/text" },
        "src": { "$ref": "#/$defs/src" }
      },
      "required": ["big", "src"],
      "unevaluatedProperties": false
    },
    "quiz": {
      "description": "One right answer out of 2 to 4 options.",
      "$ref": "#/$defs/cardBase",
      "properties": {
        "type": { "const": "quiz" },
        "tag": { "$ref": "#/$defs/stringTag" },
        "opts": { "$ref": "#/$defs/options" },
        "right": { "description": "the index of the right option, counting from 0", "$ref": "#/$defs/index" },
        "why": { "$ref": "#/$defs/why" },
        "src": { "$ref": "#/$defs/src" }
      },
      "required": ["opts", "right", "why", "src"],
      "unevaluatedProperties": false
    },
    "guess": {
      "description": "Slide to estimate a number, then reveal it.",
      "$ref": "#/$defs/cardBase",
      "properties": {
        "type": { "const": "guess" },
        "tag": { "$ref": "#/$defs/stringTag" },
        "min": { "description": "the slider's lowest value, a number", "type": "number" },
        "max": { "description": "the slider's highest value, a number", "type": "number" },
        "step": { "description": "the slider's step, a number above 0", "type": "number", "exclusiveMinimum": 0 },
        "start": { "description": "where the slider starts, a number", "type": "number" },
        "answer": { "description": "the real number", "type": "number" },
        "tol": { "description": "how far off still counts as close, a number of 0 or more", "type": "number", "minimum": 0 },
        "fmt": {
          "description": "a number template with {v} or {v:N} (N decimals, 0 to 20), such as \"{v} min\" or \"g = {v:2}\"",
          "type": "string",
          "pattern": "\\{v(:([0-9]|1[0-9]|20))?\\}"
        },
        "why": { "$ref": "#/$defs/why" },
        "src": { "$ref": "#/$defs/src" }
      },
      "required": ["min", "max", "step", "start", "answer", "tol", "why", "src"],
      "unevaluatedProperties": false
    },
    "order": {
      "description": "Put items in order.",
      "$ref": "#/$defs/cardBase",
      "properties": {
        "type": { "const": "order" },
        "tag": { "$ref": "#/$defs/stringTag" },
        "items": {
          "description": "2 to 6 items in the right order, each a text",
          "type": "array",
          "minItems": 2,
          "maxItems": 6,
          "items": { "$ref": "#/$defs/text" }
        },
        "shown": {
          "description": "the display order, as a list of indexes into items counting from 0",
          "type": "array",
          "items": { "$ref": "#/$defs/index" }
        },
        "why": { "$ref": "#/$defs/why" },
        "src": { "$ref": "#/$defs/src" }
      },
      "required": ["items", "shown", "why", "src"],
      "unevaluatedProperties": false
    },
    "multi": {
      "description": "Pick all that apply.",
      "$ref": "#/$defs/cardBase",
      "properties": {
        "type": { "const": "multi" },
        "tag": { "$ref": "#/$defs/stringTag" },
        "opts": { "$ref": "#/$defs/options" },
        "right": {
          "description": "the indexes of every right option, counting from 0, each once",
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "$ref": "#/$defs/index" }
        },
        "why": { "$ref": "#/$defs/why" },
        "src": { "$ref": "#/$defs/src" }
      },
      "required": ["opts", "right", "why", "src"],
      "unevaluatedProperties": false
    },
    "decide": {
      "description": "A decision that belongs to the reader: no right answer, and the pick is recorded.",
      "$ref": "#/$defs/cardBase",
      "properties": {
        "type": { "const": "decide" },
        "tag": { "$ref": "#/$defs/stringTag" },
        "opts": { "$ref": "#/$defs/options" },
        "lean": { "description": "the index of the option the research leans to, counting from 0", "$ref": "#/$defs/index" },
        "after": { "description": "one text per option, shown after it's picked", "$ref": "#/$defs/textList" },
        "short": { "description": "a short name for the decision, used in the summary", "$ref": "#/$defs/plain" },
        "src": { "$ref": "#/$defs/src" }
      },
      "required": ["opts", "after", "short"],
      "unevaluatedProperties": false
    },
    "summary": {
      "description": "Collects the decide picks; the last card of the decision world.",
      "$ref": "#/$defs/cardBase",
      "properties": {
        "type": { "const": "summary" },
        "tag": { "$ref": "#/$defs/stringTag" },
        "from": {
          "description": "the decide cards to collect, as [world id, card index counting from 0] pairs",
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "array",
            "prefixItems": [{ "type": "string" }, { "type": "integer", "minimum": 0 }],
            "minItems": 2,
            "maxItems": 2
          }
        }
      },
      "required": ["from"],
      "unevaluatedProperties": false
    }
  }
}
```
