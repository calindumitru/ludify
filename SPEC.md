# Ludify — spec

*Disce ludendo*: learn by playing.

Status: draft, 2026-10-30. Nothing is built yet. Sections marked **Decided** were settled with the
Owner; everything under **Proposed** is a starting position the next session should grill before
building; **Open questions** lists what is still undecided.

## 1. What it is

Ludify turns a research question into a short, playable brief. The user brings a topic, answers a
few questions that pin down what they want to know, and the AI researches it on **the user's own
Claude or ChatGPT usage**. The result is a card deck — four short "worlds" of cards with quick
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
5. At the end, a deck is created for them in the same style as the Owner's existing briefs.

Users are the public: anyone with a Claude or ChatGPT account. Not only people with ADHD — the
design helps everyone, but never claims to treat or be proven for ADHD (see §6).

## 3. How it runs on the user's own usage

Researched 2026-10-30. These programmes are weeks to months old; re-check before building.

| Route | Works with | Status | Verdict |
|---|---|---|---|
| **MCP App** inside Claude and ChatGPT | both | MCP Apps is the shared standard for interactive UI in chat hosts, official since 2026-01-26; Claude and ChatGPT both render them ([MCP blog](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/), SDK `@modelcontextprotocol/ext-apps`) | **Proposed primary route** |
| Standalone web app with *Sign in with ChatGPT* | ChatGPT only | Launched 2026-09-29; usage comes from the user's Plus/Pro plan; open-source apps self-serve, hosted/commercial apps must apply; Plus has a 5-hour limit shared across apps ([terms](https://openai.com/policies/sign-in-with-chatgpt-terms/), [help](https://help.openai.com/en/articles/20001542)) | Later, maybe |
| Standalone web app with Claude subscription sign-in | — | **Not allowed**: since Feb 2026 Anthropic's consumer terms forbid using Free/Pro/Max OAuth tokens in other products | No |
| Bring-your-own API key | both | Works, but most consumers have no key, it's pay-per-token, and we'd handle secrets | No (maybe a power-user option later) |
| Shared Claude artifact | Claude only | Viewers' usage counts against their own plan, no keys ([Anthropic](https://claude.com/blog/claude-powered-artifacts)); probably no web search inside the artifact | Throwaway prototype only |

### Proposed: the MCP App

The host (Claude or ChatGPT) does the talking and the researching with its own model and web
search; Ludify supplies the method and the deck.

- **Landing page** (public website): the pitch, a playable example deck, and "Add to Claude" / "Add
  to ChatGPT" instructions. This is also where discovery happens — in-chat app discovery is weak.
- **MCP server** (remote, streamable HTTP), stateless, with roughly these tools:
  - `ludify_plan(topic)` → returns the method: the narrowing questions to ask (as an interactive
    form if the host supports it, else as text) and the research brief template.
  - `ludify_render(deck)` → validates a deck (JSON, see §4) and returns a UI resource that plays it
    inline, plus a download of the self-contained HTML file.
  - Possibly `ludify_guide()` → the deck-writing rules (card types, evidence rules) for the model to
    follow while writing; or embed them in `ludify_plan`'s answer.
- Research runs between those calls, in the host, on the user's plan. Ludify's server never calls a
  model, so Ludify's running cost is only hosting.
- No Ludify accounts, no stored content in v1: the deck lives in the chat and in the downloaded file;
  reading progress lives in the browser's `localStorage`.

## 4. The deck

Reuse the engine from the Owner's skills repo: `calindumitru/skills`, branch
`fun-briefs-and-grilling` (PR #17), folder `skills/fun-briefs/`:

- `assets/deck/index.html` — the engine (layout, card plays, XP, saved progress, calm mode,
  read-aloud, keyboard and swipe, reduced motion, "N cards left · ~M min").
- `assets/deck/c-deck.js` — a starter deck with every `Q.ui` string key.
- `references/deck.md` — worlds and the nine card types (`info`, `big`, `quiz`, `guess`, `order`,
  `multi`, `challenge`, `decide`, `summary`) and what a good deck looks like.
- `scripts/autoplay.mjs` — Playwright script that plays every card, light and dark; exits 1 on
  page errors or stuck cards.

Live examples built with it (local files on the Owner's machine): `adhd-learning-brief.html`,
`funvenio-audience-quest.html` in `/Users/calin/Projects/`.

**Proposed changes for Ludify:**

- **Decks are data, never code.** Today `c-deck.js` is JavaScript and some card types take
  functions (`guess.fmt`, `challenge.calc`). A model-written deck must be JSON validated against a
  schema; the engine must never `eval` model output. Replace `fmt` with a format template
  (`"{v} min"`, `"€{v}"`); drop `challenge` from v1 or give it a tiny safe formula language.
- Escape everything: card text is Markdown-lite rendered by the engine, so links and HTML from
  the model must be sanitised (only `**bold**`, `` `code` ``, `[text](https url)`).
- Every factual card carries `src` (a source link). The validator rejects decks where it's missing.
- Each brief gets its own `localStorage` key (hash of topic + date).
- Ship a JSON Schema for the deck and give it to the model in `ludify_plan`/`ludify_guide`.

## 5. Research quality

**Proposed:**

- The narrowing questions fix the scope before research starts: what they want to decide or
  understand, depth, what they already know, any region/time constraints.
- Sources: prefer primary and peer-reviewed; every number on a card links to where it came from;
  each `info` card's `tag` grades the evidence (strong / moderate / weak / none / against).
- The deck ends on a "boss level": the decisions the reader faces, or the myths, whichever the
  topic builds towards.
- The deck always states the limits of its evidence (like the "no controlled study of adults with
  ADHD reading documents" caveat in the Owner's ADHD brief).
- Quality will vary with the user's plan and model. A free-tier user gets a weaker brief; say so on
  the landing page rather than hide it.

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

- Ludify accounts, payments, a library of saved briefs, sharing links.
- Ludify calling models itself (no API keys, no model bill).
- Uploading the user's own documents (a natural v2: "ludify this PDF").
- Audio overviews, video, mind maps.
- A standalone web app with Sign in with ChatGPT.

## 8. Open questions (grill these first)

1. **Which host first?** Claude, ChatGPT, or both at once through MCP Apps? (Test how each renders
   the UI and whether forms/tool calls from the iframe work in both.)
2. **Who is it for first?** Students, knowledge workers, people with ADHD specifically, the Owner
   and friends? This changes the landing page and the example deck.
3. **Free forever or a business?** Hosting only costs a little; is there ever a paid tier, and what
   would it hold?
4. **Where do the narrowing questions live?** In the host's own question UI, or a Ludify form
   rendered by the MCP App?
5. **Hosting:** which provider and stack for the MCP server and landing page? (Owner is fluent in
   AWS — Lambda Function URLs, CloudFront — from Funvenio.)
6. **Domain:** `ludify.com` / `ludify.app` availability not checked.
7. **Trademark:** the Owner knowingly accepts the risk from *Ludiz* (French gamified-training tool,
   Skillfab). A formal TMview / USPTO check in classes 9, 41 and 42 has not been done.
8. **Engine ownership:** vendor a copy of the deck engine into this repo, or make it a shared
   package the `fun-briefs` skill also uses?
9. **Language:** English only, or decks in the user's language?
10. **Directory listings:** do we submit to Claude's and ChatGPT's app directories, and what do
    they require (review, privacy policy, terms)?

## 9. To verify before building

- That an MCP App iframe can trigger the next step (call a tool, or post a message) in both hosts.
- Size limits on tool inputs/outputs and UI resources (a deck is ~20–40 KB of JSON; the engine
  ~40 KB of HTML).
- That `localStorage` and the Web Speech API (read-aloud) work inside each host's sandboxed iframe;
  if not, fall back gracefully.
- That the host model actually uses web search during the research step on each plan tier.
- Whether a downloaded HTML file can be offered from inside the iframe.

## 10. Milestones (proposed)

1. **Spike:** a local MCP server with `ludify_render` only, showing the existing ADHD deck (as JSON)
   inline in Claude. Answers most of §9.
2. **Deck schema + safe engine:** JSON Schema, validator, engine reading JSON, `autoplay.mjs` in CI.
3. **Full flow in one host:** `ludify_plan` → questions → research → `ludify_render`.
4. **Second host**, then the landing page with a playable example.
5. **Public launch:** remote hosting, privacy notice, directory submissions.

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
