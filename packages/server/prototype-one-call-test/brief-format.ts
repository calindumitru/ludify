// PROTOTYPE, removed after the test (ludify#72). The brief format, as the test guide gives it to the model:
// SPEC.md §7 (decision #62) written out as fields. It sits after the deck manual in the guide.
export const BRIEF_FORMAT = `
# PROTOTYPE: the one-call test (a deck and its brief)

This is a test of whether you can write a thorough Ludify answer in ONE tool call: a **deck**
(the manual above) and a **brief**, both from the same research. Do the research first, then call
this guide, then write both and call \`ludify_one_call_test\` once with
\`{"deck": <deck>, "brief": <brief>, "started": <the started number at the end of this guide>}\`.
Pass both as JSON objects, not as strings. Don't show either one in the chat first.

- The deck is a **thorough** deck: 4 worlds, about 25 to 30 cards, as the manual says.
- The brief is the reference document next to it: long and dense, about 40 to 60 KB of JSON
  (roughly 20 to 30 sections). Write it in full; don't shorten it to save space.
- Picks happen in the deck only. If the user named what they're deciding, the brief's last part
  before Limits is a neutral "Decisions for you" section: each decision, its options and what
  changes them, tagged with the \`you\` tone pill, never saying which way the research leans, then
  one line pointing to the deck. No goal named: no such section.

## The brief

A brief is one JSON object. Text fields use the deck's Markdown-lite (\`**bold**\`, \`\` \`code\` \`\`,
\`[text](https://…)\`), plus pills: \`{{<pill id>}}\` inline shows that status pill.

\`\`\`
{
  "lang": "en",
  "ui": { "contents": "Contents", "sources": "Sources", "judgment": "Judgment",
          "confidence": "confidence", "verdict": "Verdict", "why": "Why",
          "pickOption": "Pick an option to see its scores" },
  "pills": { "<id>": { "label": "<short label>", "tone": "good|caution|bad|unknown|you" } },
  "hero": { "kicker": "...", "title": "...", "lead": "...",
            "facts": [ { "v": "€4.2bn", "l": "what the number is" } ],
            "disclaimer": "..." },
  "parts": [ { "id": "...", "title": "...", "c": "p1|p2|p3|p4|p5", "intro": "...",
               "sections": [ { "id": "...", "title": "...", "short": "<2-3 words for the contents>",
                               "lede": "...", "blocks": [ <block>, ... ],
                               "src": [ { "label": "...", "url": "https://...", "type": "official|study|test|vendor|notes" } ] } ] } ]
}
\`\`\`

- **pills:** up to 5, each with its own label and one of the 5 tones.
- **hero.facts:** 3 to 6 key-fact tiles. **parts:** 3 to 6, each a colour \`p1\`..\`p5\`.
- **Sources:** every section has a non-empty \`src\` (except the limits section). Never invent a URL.
- **Limits:** the last part holds a section with \`"id": "limits"\`: what the brief can't tell
  you, as a \`list\` block. Required, as well as \`hero.disclaimer\`.

### Blocks

- \`{"type": "p", "text": "..."}\` a paragraph; \`{"type": "lede", "text": "..."}\`; \`{"type": "h", "text": "..."}\` a sub-heading.
- \`{"type": "list", "items": ["..."], "ordered": false}\`
- \`{"type": "table", "cols": ["..."], "rows": [["..."]], "num": [1, 2], "total": ["..."], "note": "..."}\`
  (\`num\`: indexes of number columns; \`total\` and \`note\` optional).
- \`{"type": "callout", "tone": "tip|warn|key|stop", "title": "...", "text": "..."}\`
- \`{"type": "facts", "items": [{"v": "...", "l": "..."}]}\` fact cards.
- \`{"type": "steps", "items": [{"t": "...", "d": "..."}]}\`
- \`{"type": "checklist", "id": "<unique>", "items": ["..."]}\` (ticks are saved).
- \`{"type": "terms", "items": [{"t": "term", "d": "definition"}]}\`
- \`{"type": "panels", "items": [{"title": "...", "blocks": [<block>]}]}\` expandable panels.
- \`{"type": "tabs", "tabs": [{"label": "...", "blocks": [<block>]}]}\` any block but tabs.
- **Compare explorer** (2–6 options by 2–6 dimensions; scores 0–5 are judgments, each with a
  confidence):
  \`{"type": "compare", "dims": [{"id": "cost", "label": "Cost"}],
    "options": [{"id": "a", "name": "...", "scores": {"cost": [4, "low|medium|high"]},
                 "verdict": "...", "why": "...", "points": [["<pill id>", "..."]], "src": "https://..."}]}\`
- **Calculator** (sliders in, formulas out; formulas use only + - * / ( ), min, max, round,
  numbers and input or earlier output ids):
  \`{"type": "calc", "inputs": [{"id": "n", "label": "...", "help": "...", "min": 0, "max": 100,
     "step": 1, "value": 10, "fmt": "{v}%", "presets": [["Low", 5], ["High", 50]]}],
     "outputs": [{"id": "total", "label": "...", "f": "n * 12", "fmt": "€{v}", "note": "...", "src": "https://..."}],
     "note": "..."}\`
  (\`fmt\`: \`{v}\` a whole number, \`{v:1}\` one decimal.)

Use the rich blocks where they carry the content (a compare explorer when there are options to
weigh, a calculator when the user's own numbers change the answer); plain paragraphs, tables and
callouts for the rest. One place per fact: don't repeat a table the compare explorer already shows.
`;
