# Ludify — spec

*Disce ludendo*: learn by playing.

Status: ready to build, 2026-10-31. Nothing is built yet. Sections marked **Decided** were settled
with the Owner; **Open questions** lists what is still undecided (only launch questions are left).

## 1. What it is

Ludify turns a research question into a short, playable deck. The user brings a topic, answers a
few questions that pin down what they want to know, and the AI researches it on **the user's own
Claude or ChatGPT usage**. The result is a card deck — two or four short "worlds" of cards with quick
quizzes, guesses and decisions — that is fun to go through and still accurate, designed from graded
evidence on what keeps readers with ADHD engaged ([docs/evidence.md](docs/evidence.md)).

Think NotebookLM, simplified, with one output done properly instead of many done generically.

### Why it should exist

A tools survey (2026-10-30, `tools-landscape.md` on the `research/adhd-learning-engagement` branch
of the Owner's funvenio repo) found nothing that does this:

- Study-material generators (NotebookLM, Knowt, Kahoot, Wayground) make quizzes, flashcards and
  audio, but move content into their own app and make no ADHD claims. NotebookLM is the strongest.
- Game builders (Genially, Gimkit, H5P) have mechanics but need questions written by hand.
- ADHD-branded tools only restyle text (Bionic Reading, which tests show doesn't help) or don't
  touch documents. Penseum pitches "documents → ADHD-friendly games" but has it on a waitlist.
- No tool has independent evidence of an ADHD benefit. Closest concept: Google's *Learn Your Way*
  (an experiment on textbooks only).

## 2. Users and the flow

**Decided** (the Owner's own description):

1. The user opens Ludify and sees an intro and an example of how it works.
2. They connect their ChatGPT or Claude account.
3. They enter a research topic and get a few questions to pinpoint what they're interested in.
4. When they confirm, the research runs on their own usage.
5. At the end, a deck is created for them in the same style as the Owner's existing decks.

Users are the public: anyone with a Claude or ChatGPT account. Not only people with ADHD — the
design helps everyone, but never claims to treat or be proven for ADHD (see §6).

**Decided** (2026-10-30, [Who is Ludify for first?](https://github.com/calindumitru/ludify/issues/4)):

- **First audience: decision-makers**, meaning adults researching something they have to decide (a purchase, a
  treatment option, a career move, a tool). Research defaults are practical, the deck ends on the
  decisions they face, and the example deck is a decision topic.
- **Reach in v1:** Claude on every plan, Free included (as its one custom connector), plus the
  ChatGPT plans that can add a server by URL (Business, Enterprise/Edu, Pro with read-only tools,
  and Plus, which the spike showed can add one in the desktop app). ChatGPT Free and Go, and anything that needs a
  directory listing, wait for a later launch effort.
- **Desktop and web first.** On mobile the deck must still play; the narrowing questions may fall
  back to plain text.
- **Positioning:** the landing page leads with finishing the research you started. Lower down it
  says Ludify is designed from the evidence on attention and learning, names ADHD there, and says it
  isn't a treatment or proven for ADHD.

## 3. How it runs on the user's own usage

Researched 2026-10-30. These programmes are weeks to months old; re-check before building.

| Route | Works with | Status | Verdict |
|---|---|---|---|
| **MCP App** inside Claude and ChatGPT | both | MCP Apps is the shared standard for interactive UI in chat hosts, official since 2026-01-26; Claude and ChatGPT both render them ([MCP blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/), SDK `@modelcontextprotocol/ext-apps`) | **Primary route** (decided) |
| Standalone web app with *Sign in with ChatGPT* | ChatGPT only | Launched 2026-09-29; usage comes from the user's Plus/Pro plan; open-source apps self-serve, hosted/commercial apps must apply; Plus has a 5-hour limit shared across apps ([terms](https://openai.com/policies/sign-in-with-chatgpt-terms/), [help](https://help.openai.com/en/articles/20001542)) | Later, maybe |
| Standalone web app with Claude subscription sign-in | — | **Not allowed**: since Feb 2026 Anthropic's consumer terms forbid using Free/Pro/Max OAuth tokens in other products | No |
| Bring-your-own API key | both | Works, but most consumers have no key, it's pay-per-token, and we'd handle secrets | No (maybe a power-user option later) |
| Shared Claude artifact | Claude only | Viewers' usage counts against their own plan, no keys ([Anthropic](https://claude.com/blog/claude-powered-artifacts)); probably no web search inside the artifact | Throwaway prototype only |

### Decided: the MCP App

**Decided** 2026-10-31 (tickets [#7](https://github.com/calindumitru/ludify/issues/7),
[#8](https://github.com/calindumitru/ludify/issues/8), [#9](https://github.com/calindumitru/ludify/issues/9),
[#13](https://github.com/calindumitru/ludify/issues/13)).

The host (Claude or ChatGPT) does the talking and the researching with its own model and web
search; Ludify supplies the method and the deck.

- **Hosts:** both at launch through one MCP App. Claude is the reference host (design, autoplay
  tests); ChatGPT gets a smoke test at every milestone.
- **Landing page** (public website): the pitch, a playable example deck, and "Add to Claude" / "Add
  to ChatGPT" instructions, including how to set Ludify's tools to "Always allow" in Claude. This is
  also where discovery happens — in-chat app discovery is weak.
- **MCP server** (remote, streamable HTTP), stateless, with three tools:
  - `ludify_plan(topic)` → a UI resource with the narrowing form (§5), plus the same questions as
    text for hosts that can't show it (e.g. mobile), and the research method. The form posts the
    answers to the chat (sent at once in ChatGPT; in Claude the user presses Enter).
  - `ludify_guide()` → the deck-writing manual: card types, writing rules, the source rules and the
    deck JSON Schema, plus how to answer a "my picks" message (§4). The model calls it right before
    writing, so the rules are fresh after a long research phase.
  - `ludify_render(deck)` → validates the deck (§4) and returns a UI resource that plays it inline.
    If it's invalid, it returns an exact error list (card 7: missing `src`) as a tool error,
    pointing back to `ludify_guide`, and the model fixes the deck and calls again. If the second try
    is still invalid, the valid cards play under a visible note naming the skipped cards and why.
    **Decided** 2026-11-01 (#22): the note gives each skipped card one translated reason
    (`ui.skippedWhy`), never the validator's English; the model still gets the exact errors.
- **Decks from existing research** are a v1 entry point: research done with the AI in the chat, a
  markdown file attached to the chat, or pasted findings. The model skips `ludify_plan` and goes
  `ludify_guide` → `ludify_render`; Ludify never reads files itself. Facts without a source get one
  from web search, or else are labelled "from your notes · unverified" (§4).
- Research runs between those calls, in the host, on the user's plan. Ludify's server never calls a
  model, so Ludify's running cost is only hosting.
- No Ludify accounts, no stored content and **no file in v1**: the deck lives only in the chat (if
  the chat is lost, so is the deck); reading progress lives in the browser's `localStorage`.
- **Stack:** the official MCP SDK (`@modelcontextprotocol/server` v2 + `ext-apps`, as in the spike)
  in a stateless Cloudflare Worker, no Durable Objects or storage. If the SDK won't run on Workers,
  fall back to Cloudflare's `createMcpHandler`, which wraps it. The landing page runs on Cloudflare
  Pages.

## 4. The deck

**Decided** 2026-10-31 (tickets [#5](https://github.com/calindumitru/ludify/issues/5),
[#10](https://github.com/calindumitru/ludify/issues/10), [#11](https://github.com/calindumitru/ludify/issues/11)).

The engine moves into this repo from the Owner's skills repo (`calindumitru/skills`, folder
`skills/fun-briefs/`), and lives only here: Ludify is meant to replace the `fun-briefs` skill, so
there's no shared package. The skill was retired on 2026-11-01 (calindumitru/skills#19), earlier than
the planned milestone 3; its evidence table now lives in `fun-grilling`, and Ludify keeps its own
copy in `docs/evidence.md`.
What it brings:

- `assets/deck/index.html` — the engine (layout, card plays, XP, saved progress, calm mode,
  read-aloud, keyboard and swipe, reduced motion, "N cards left · ~M min").
- `assets/deck/c-deck.js` — a starter deck with every `Q.ui` string key.
- `references/deck.md` — worlds and the card types and what a good deck looks like.
- `scripts/autoplay.mjs` — Playwright script that plays every card, light and dark; exits 1 on
  page errors or stuck cards.

Live examples built with it (local files on the Owner's machine): `adhd-learning-brief.html`,
`funvenio-audience-quest.html` in `/Users/calin/Projects/`.

Changes for Ludify:

- **Decks are data, never code.** A model-written deck is JSON validated against a JSON Schema; the
  engine never `eval`s model output. Number formats are templates (`"{v} min"`, `"€{v}"`, `"{v:2}"`).
- **Eight card types:** `info`, `big`, `quiz`, `guess`, `order`, `multi`, `decide`, `summary`.
  `challenge` is dropped from v1 (it needed code). `decide` loses its `ticket` field.
- **Markdown-lite only:** `**bold**`, `` `code` `` and `[text](https url)`; everything else renders
  as plain text. Links open through the host's `openLink`.
- **Sources:** every factual card carries `src` (a link), and the validator rejects decks where
  it's missing, with two exceptions: the limits card (`kind: limits`), and `src: {notes: true}` for
  facts from the user's chat or attached research, always shown as "from your notes · unverified".
- **Source tag:** each `info` card's tag names the source type (official, study, test, vendor
  claim, from your notes). Cards that claim an effect ("cuts bills by 30%") also get an evidence
  grade (strong / moderate / weak / none / against); prices and specs don't.
- **Language:** the deck is written in the user's language and carries a `lang` field. The engine
  ships English UI strings; the deck may carry a `ui` block with translated strings, which the model
  fills in and the validator checks like any other data. Read-aloud picks the best available voice
  for `lang` instead of the browser default.
- **Progress:** each deck gets its own `localStorage` key (hash of topic + date). It lasts per chat
  in Claude and across chats in ChatGPT; that's accepted for v1.
- **Host limits:** "Start over" confirms inside the deck (`confirm()` is blocked in both hosts).
- **The ending — Send to chat:** the `summary` card collects the `decide` picks, and one button
  posts them to the chat. The model replies with what follows from them and offers to challenge the
  picks or plan the next steps. The user copies anything they want to keep from the chat.

## 5. Research quality

**Decided** 2026-10-31 (ticket [#12](https://github.com/calindumitru/ludify/issues/12)).

- **The narrowing form** fixes the scope before research starts. Three questions are always asked:
  what you're deciding, how deep, what you already know. The model may add up to three
  topic-specific ones (e.g. country, house size) as JSON, validated like a deck (types, at most
  three, plain text).
- **Language:** **Decided** 2026-11-01 ([#53](https://github.com/calindumitru/ludify/issues/53)).
  `ludify_plan` takes an optional `lang` and `ui`, like a deck (§4): the model writes the form's
  own words in the user's language, any language, and Ludify stores no translations. `ui` covers
  every string shown once a plan has arrived (the fixed questions, depth labels, button, the note
  under it, the status lines) and the message the form posts (its intro line, question labels and
  depth word); the tool's text names the exact intro to wait for. The few lines shown before a plan
  arrives stay English. A bad `ui` string is dropped and English fills that gap; the tool's text
  names it, and it never blocks the form.
- **Depth:** quick is 2 worlds and about 12 cards with a lighter search; thorough is 4 worlds and
  about 25–30 cards with a wider search and more primary sources.
- **Sources:** prefer primary and peer-reviewed; every number on a card links to where it came from;
  tags as in §4.
- **Structure:** every deck ends on a "Your decision" world of `decide` cards, which leads to Send
  to chat. Right before it comes one limits card ("What this can't tell you": gaps in the evidence,
  what's unverified, what depends on the user's situation). Thorough decks also get a myths world.
  The validator requires the decision world and the limits card.
- **Free tier:** quality varies with the user's plan and model. The landing page says so; the deck
  and the form don't.
- **Example deck:** the landing page's playable example is the ADHD deck in `examples/`, rewritten
  to this structure and framed as a decision ("How should I set up my reading and learning?"), so
  ADHD sits inside the content, not in the page's headline.

## 6. Design rules (from the evidence)

Full table with sources: [docs/evidence.md](docs/evidence.md). In short:

- **Do:** a near payoff every card or two; feedback that explains *why*; one idea per card;
  headings and recaps; low-stakes questions after teaching; an optional if-then start plan; work
  left in concrete units; easy stop and resume; choice of order; optional read-aloud; calm mode.
- **Don't:** points or badges as the engine (XP only ever follows an explanation); streaks; Bionic
  Reading, dyslexia fonts or tints; animation or decoration beside the text.
- **Claims:** "designed from the evidence on attention and learning", never "proven for ADHD" or
  any medical claim. No controlled study has tested adults with ADHD reading documents.

## 7. Out of scope for v1

- Ludify accounts, payments, a library of saved decks, sharing links.
- Ludify calling models itself (no API keys, no model bill).
- Uploading documents to Ludify (a natural v2: "ludify this PDF"). A file attached to the chat
  already works in v1, because the host model reads it (§3).
- A downloadable HTML file of the deck: neither host lets the iframe download, and v1 stores
  nothing, so the deck lives only in the chat.
- Audio overviews, video, mind maps.
- Visual card types (charts, graphs, flows, workflows, mind maps as cards): wanted for v2. They'd be
  data the engine draws, never code, and only visuals that carry the content (decoration stays out).
- A standalone web app with Sign in with ChatGPT.
- **The brief** (see GLOSSARY.md) as well as the deck: after v1, needs a prototype first. The two
  are different formats for different jobs, from the Owner's own funvenio documents:

  | | Deck (e.g. funvenio #900, 31 Oct) | Brief (e.g. the audience brief, 28 Oct) |
  |---|---|---|
  | Job | Come out with a decision in about 10 minutes | Consult big material more than once |
  | Shape | Worlds of one-idea cards, any order, a 60-second version up front | A long page: contents index, colour-coded parts, ~25 sections, sticky header |
  | Interaction | Answering: quizzes, guesses, your calls, picks sent back | Exploring: pick a category to see its scores, calculators with your inputs |
  | Evidence | One source per card | Dense: status pills per gate, every figure linked to its source |
  | Pace | Cards and minutes left, recaps, calm mode, read-aloud | None; the reader chooses where to go |

  The reference brief is `/Users/calin/Projects/funvenio-audience-brief.html` on the Owner's
  machine; like the deck, it's a data object drawn by a script, though its calculators are code
  today. The deck gets you interested; deciding properly also takes the brief. Open for the prototype: where
  the brief lives (a host document, a Ludify page, inside the deck), and how its explorers
  (scores, calculators) stay data, never code. v1 builds the deck only.

  **Decided** 2026-11-01 ([#62](https://github.com/calindumitru/ludify/issues/62)), on the
  [brief map](https://github.com/calindumitru/ludify/issues/59): **the brief as data.** A brief is
  JSON the engine draws, shaped like the audience brief:
  - **Skeleton:** a hero (kicker, title, lead, key-fact tiles, a disclaimer), then colour-coded
    parts (each with a door on the hero and an intro), then sections (title, short name for the
    contents index, lede), each a list of blocks. `lang`, a translatable `ui` and the deck's
    Markdown-lite carry over; part colours come from a fixed palette.
  - **Blocks:** paragraph, lede, sub-heading, list, table (number columns, total rows, a note),
    callout (tip, warning, key point, stop), fact cards, steps, a checklist with saved ticks, tabs,
    expandable panels and terms. Tabs hold any block except more tabs.
  - **Pills:** each brief declares up to 5 statuses, each with its own label and one of 5 fixed
    tones (good, caution, bad, unknown, your call), and uses them inline in text.
  - **Compare explorer:** 2–6 options by 2–6 dimensions; the reader picks an option and sees 0–5
    scores, each labelled as a judgment with its confidence, then a verdict, why, and pill-tagged
    points.
  - **Calculators:** slider inputs (min, max, step, format, presets) and outputs written as
    formulas in a closed arithmetic language (+ − × ÷, brackets, min, max, round, input names) that
    Ludify's own parser evaluates, never `eval`. The validator rejects unknown names and cycles.
  - **Sources:** every section, compare option and calculator output carries a source, tagged by
    type as in decks; inline links on figures are encouraged but not checked.
  - **Limits:** a limits section is required, as well as the hero disclaimer.

  **Decided** 2026-11-01 ([#61](https://github.com/calindumitru/ludify/issues/61)): **where the
  brief lives and how you come back.**
  - **Home:** open until the Owner tries the [prototype](https://github.com/calindumitru/ludify/issues/64),
    which shows three homes for the same brief: an inline door (title, key facts, contents, Open)
    with the brief read fullscreen; a Brief tab inside the deck's player; and the whole brief
    inline, scrolling. A model-written Claude artifact is not a candidate (it makes the brief code).
  - **Coming back** means coming back to its chat, like a deck: Ludify stores nothing, and a new chat
    doesn't have the brief. Nothing carries it across chats.
  - **Telling the user:** the model says so once, after drawing the brief, and suggests pinning or
    renaming the chat or moving it into a Project; `ludify_guide` tells it to. The brief itself
    carries no such line.

  **Decided** 2026-11-01 ([#63](https://github.com/calindumitru/ludify/issues/63)): **where the
  decisions happen when you get both.**
  - **Picks happen in the deck only.** Its decision world holds the picks and the one Send to chat;
    the brief keeps no picks and has no Send to chat.
  - **The brief's decisions follow the form.** When the user named what they're deciding, the brief
    ends with a neutral "Decisions for you" section: each decision, its options and what changes
    them, tagged with the "your call" pill, never the lean, then a pointer to the deck. When they
    named no goal, the brief has no such section.
  - **Neutral means no pick for you.** The compare explorer keeps its verdicts, labelled as
    judgments with their confidence; only the deck's `decide` cards say where the research leans.
  - **How the brief and the deck point at each other** (deck to brief, brief to deck, and whether
    Send to chat mentions the brief) is decided with the
    [prototype](https://github.com/calindumitru/ludify/issues/64).

  **Decided** 2026-11-01 ([#65](https://github.com/calindumitru/ludify/issues/65)): **thorough on
  every plan.** Thorough depth (a brief and a deck) is offered on free plans too, never gated.
  Ludify can't see the user's plan, so it never guesses: the thorough option in the narrowing form
  carries a short note shown to everyone, that it's a longer, heavier run that may hit usage limits
  on free plans.
- Kept in view, not specified: a narrated story version ("tell me a story") as an alternative to
  read-aloud; progress that follows the user across chats in Claude (a fixed `ui.domain`); saving a
  brief outside the chat (a Claude artifact the user keeps, Notion or another notes app).

## 8. Open questions

**Decided** 2026-10-31 (the grilling on the wayfinder map,
[#1](https://github.com/calindumitru/ludify/issues/1)):

- ~~**Which host first?**~~ Both through one MCP App, Claude as the reference host; see §3.
- ~~**Who is it for first?**~~ Decision-makers, desktop first; see §2.
- ~~**Where do the narrowing questions live?**~~ A Ludify form in the iframe, with a text fallback; see §3, §5.
- ~~**Hosting:**~~ a stateless Cloudflare Worker with the official MCP SDK, the landing page on Cloudflare Pages; see §3.
- ~~**Engine ownership:**~~ moves into this repo, no shared package; `fun-briefs` was retired on 2026-11-01; see §4.
- ~~**Language:**~~ decks in the user's language, with translatable UI strings; see §4.

Still open, for a later launch effort (none of them changes how v1 is built):

1. **Free forever or a business?** Hosting only costs a little; is there ever a paid tier, and what
   would it hold?
2. **Domain:** `ludify.com`, `ludify.app`, `ludify.io` and `ludify.dev` all have DNS set up
   (2026-10-31), so they're probably taken; alternatives aren't checked.
3. **Trademark:** the Owner knowingly accepts the risk from *Ludiz* (French gamified-training tool,
   Skillfab). A formal TMview / USPTO check in classes 9, 41 and 42 has not been done.
4. **Directory listings:** do we submit to Claude's and ChatGPT's app directories, and what do
   they require (review, privacy policy, terms)?

## 9. To verify before building

**Checked** 2026-10-30 in the host spike
([Spike: can ludify_render play the ADHD deck inline in both hosts?](https://github.com/calindumitru/ludify/issues/6),
[findings](https://github.com/calindumitru/ludify/blob/prototype/host-spike/prototype-host-spike/FINDINGS.md)):

- The iframe can call a tool and post a message in both hosts. Claude puts the message in the chat
  box for the user to send; ChatGPT sends it at once.
- Sizes: a model wrote a ~13 KB deck in one tool call in both hosts; a 623 KB app page loaded fine.
- `localStorage` works in both (per chat in Claude, across chats in ChatGPT). Read-aloud works in both.
- The host model used web search during the flow in Claude. Not yet seen in ChatGPT.
- **No download from inside the iframe** in either host.
- Also: `confirm()` is blocked in both; the clipboard is blocked in Claude and works in ChatGPT.

**Checked** 2026-11-01 against the deployed Worker ([#47](https://github.com/calindumitru/ludify/issues/47)):

- **chatgpt.com in a browser:** works. Add Ludify under **Plugins → Add custom MCP server → Create
  as a plugin** (Server URL, no authentication). The "Connect to a custom MCP" form under the MCPs
  tab registers it for Codex only, and then the chat never sees Ludify's tools. ChatGPT marks the
  player "CSP off" even though the server declares `ui.csp`; check before a directory submission.
- **Claude desktop:** a model-written deck played inline, and Send to chat filled the composer. Claude
  shows its own warning about text an app puts there ("Use caution before running this prompt…").
- **"ludify" works as a verb** in both hosts once the connector is in the chat.

**Not checked:** Claude Free's one-connector limit (the Owner chose not to test it; the landing page
should say Free allows one custom connector). Mobile in both hosts is still open on #47.

## 10. Milestones

1. **Deployed render:** the Cloudflare Worker with `ludify_render` only, showing the existing ADHD
   deck (as JSON) inline in Claude and ChatGPT. Checks the three facts left in §9. (The local host
   spike, [#6](https://github.com/calindumitru/ludify/issues/6), is done.)
2. **Deck schema + safe engine:** the engine moved into this repo, JSON Schema, validator (with the
   retry and partial-deck rules), engine reading JSON, `autoplay.mjs` in CI.
3. **Full flow:** `ludify_plan` → form → research → `ludify_guide` → `ludify_render` → Send to
   chat, plus decks from existing research, in Claude with a ChatGPT smoke test.
4. **Landing page** with the rewritten ADHD example deck and "Add to" instructions for both hosts.
5. **Public launch:** privacy notice, directory submissions, the launch questions in §8.

## 11. References

- Evidence table: [docs/evidence.md](docs/evidence.md).
- Full research (56 sources) and tools survey: funvenio repo, branch
  `research/adhd-learning-engagement`, folder `research/adhd-learning-engagement-2026-10-30/`
  (`findings.md`, `tools-landscape.md`, and the deck source in `brief/`).
- Deck engine and skills: `calindumitru/skills` PR #17 (`fun-briefs`, `fun-grilling`).
- MCP Apps: [announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/),
  [Claude and ChatGPT support](https://alpic.ai/blog/mcp-apps-goes-official-claude-chatgpt-support).
- Sign in with ChatGPT: [terms](https://openai.com/policies/sign-in-with-chatgpt-terms/),
  [help](https://help.openai.com/en/articles/20001542),
  [limits overview](https://www.eesel.ai/blog/sign-in-with-chatgpt).
- Anthropic's ban on subscription sign-in in third-party apps:
  [WinBuzzer, 2026-02-19](https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/).
- Claude-powered artifacts: [Anthropic](https://claude.com/blog/claude-powered-artifacts).
