# Where a brief can live in Claude and ChatGPT, and what it costs

Researched 2026-11-01 for [issue #60](https://github.com/calindumitru/ludify/issues/60) (map
[#59](https://github.com/calindumitru/ludify/issues/59)). It builds on the v1 iframe research
([#2](https://github.com/calindumitru/ludify/issues/2),
[findings](https://github.com/calindumitru/ludify/blob/research/mcp-app-iframe/docs/research/mcp-app-iframe.md))
and the host spike ([#6](https://github.com/calindumitru/ludify/issues/6), SPEC §9).

Status labels, as in the earlier research:

- **Documented**: a primary source says so. Not tested by us.
- **Observed**: seen in our own host spike (2026-10-30) or the live checks (#47, 2026-11-01).
- **Inferred**: follows from documented facts; no source says it.
- **Unknown**: the docs are silent.

Nothing new was tested in a host for this ticket. The OpenAI help center and pricing page refused
automated reads (HTTP 403), so the ChatGPT canvas, Library and plan figures below come from search
results that quote those pages; they are marked *search snippet* and must be re-read by hand.

## Sources

| Short name | Source (read 2026-11-01) |
|---|---|
| Spec | MCP Apps spec, [stable 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) and [draft](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx); [`src/spec.types.ts`](https://github.com/modelcontextprotocol/ext-apps/blob/main/src/spec.types.ts); [`docs/patterns.md`](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/patterns.md). SDK `@modelcontextprotocol/ext-apps` 2.0.4 (npm latest, about 2026-10-27) |
| Claude apps | [Design guidelines](https://claude.com/docs/connectors/building/mcp-apps/design-guidelines.md), [Instance supersession](https://claude.com/docs/connectors/building/mcp-apps/instance-supersession.md), [Troubleshooting](https://claude.com/docs/connectors/building/mcp-apps/troubleshooting.md), [Get started](https://claude.com/docs/connectors/building/mcp-apps/getting-started.md), [Build an MCP server](https://claude.com/docs/connectors/building/index.md). No page shows a date |
| Claude help | [Artifacts](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them), [Share artifacts](https://support.claude.com/en/articles/9547008-share-artifacts), [Projects](https://support.claude.com/en/articles/9517075-what-are-projects), [Chat search and memory](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context), [Usage and length limits](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work), [Pro](https://support.claude.com/en/articles/8325606-what-is-the-pro-plan), [Max](https://support.claude.com/en/articles/11049741-what-is-the-max-plan), [Pricing](https://claude.com/pricing) |
| ChatGPT apps | [Add UI](https://developers.openai.com/plugins/build/chatgpt-ui.md), [Reference (`window.openai`)](https://developers.openai.com/plugins/reference), [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines), [Changelog](https://developers.openai.com/plugins/changelog), [15 lessons (blog)](https://developers.openai.com/blog/15-lessons-building-chatgpt-apps) |
| ChatGPT help (*search snippet*) | [Model release notes](https://help.openai.com/en/articles/9624314-model-release-notes), [Projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt), [Library](https://help.openai.com/en/articles/20001052-using-library-to-manage-files-in-chatgpt), [Memory](https://help.openai.com/en/articles/8590148-memory-in-chatgpt), [Pricing](https://openai.com/chatgpt/pricing/), [Go](https://help.openai.com/en/articles/11989085-what-is-chatgpt-go) |
| Yardstick | The Owner's `funvenio-audience-brief.html` (28 Oct), measured locally |

## Summary

| Question | Claude | ChatGPT |
|---|---|---|
| Long document in an MCP App | Inline is height-capped; a scrolling document belongs in **fullscreen** (*documented*, granted in the spike). `pip` is in the protocol; Claude describes no pip behaviour | Inline grows to the mobile display height, no nested scroll; **fullscreen** "for work that benefits from more space"; pip is for "live sessions like games or videos" (*documented*) |
| Host documents a tool can create | **None.** Artifacts are written by the Claude model; no doc says a tool or connector can create one, or add to a Project | **None documented** for canvas. A widget can save a *user-selected* file to the Library with `uploadFile(file, {library: true})`; whether a widget-made file is allowed is *unknown* |
| What outlives the chat | Artifacts (Artifacts tab, all plans), Projects; the app iframe only inside its chat | Library files, Projects; the app iframe only inside its chat. Canvas was dropped from the current models on 2026-05-28 (*search snippet*) |
| Size of a brief | ~44 KB of content data (~11–13k tokens), about 3× the 13 KB spike deck | same |
| Size limits | Tool result ~150,000 characters, 240 s per tool call (*documented*); tool input and HTML size *unknown* | No limits documented except 64-character status text |
| Reopen the same chat | The tool result is in the transcript; widgets remount as they scroll into view, on every device (*documented*) | *Unknown*: no doc says a widget is re-rendered when an old chat reopens |
| New chat | The brief stays in the old chat. `localStorage` is per chat (*observed*) unless a fixed `ui.domain` | The brief stays in the old chat. `localStorage` follows the server across chats (*observed*) |
| Cost | No numbers published: Free has "limited usage every 5 hours and every week"; Pro is 1×, Max 5×, Ultra 10× per week | Free/Go chats "unlimited" with safeguards; Instant context Free 27K, Go/Plus 54K tokens (*search snippet*) |

## 1. Long documents: what each host offers

### MCP App iframe (both hosts)

The spec defines three display modes, `inline`, `fullscreen` and `pip` (`McpUiDisplayMode` in
`spec.types.ts`). The view declares the modes it supports in `appCapabilities.availableDisplayModes`
and asks for a change with `ui/request-display-mode`; the host answers with the mode actually set,
which "may differ from requested if not supported". The draft adds MUSTs: the view checks the host's
`availableDisplayModes` first and handles a different answer.

**Claude** (*documented*, Design guidelines):

- "An MCP App appears in the conversation as an inline card, an inline carousel, or a full screen view."
- "The host also caps inline height and clips content that exceeds it." No number is given.
- "If your app needs its own vertically scrollable viewport, request fullscreen presentation with
  `ui/request-display-mode` instead of rendering inline." The app supplies its own fullscreen
  button; "a close button appears in the native header bar."
- Full screen is listed for "Document editing". `pip` is named as a mode value only; no behaviour
  is described on any surface (*unknown*).
- Fullscreen was granted in the spike (*observed*).

**ChatGPT** (*documented*, UI guidelines and Reference):

- "Every app initially appears inline." Inline cards can grow "up to the height of the mobile
  display area", with "No nested scrolling".
- Fullscreen: "Use fullscreen for work that benefits from more space"; "The ChatGPT composer
  remains overlaid."
- Pip: "A persistent floating window inside ChatGPT optimized for ongoing or live sessions like games
  or videos." "Do not overload PiP with controls or static content." "On mobile, picture-in-picture
  may be presented as fullscreen."
- Fullscreen was granted in the spike (*observed*).

**For the brief:** a ~25-section document fits **inline as a door** (title, contents, an "Open"
button) and **fullscreen as the reader**, in both hosts. Pip is the wrong mode for a document by
OpenAI's own rule; it could hold the deck's "now playing" state at most.

### Claude artifacts

*Documented* (Artifacts help article):

- Claude (the model) makes an artifact in a chat when content is "significant and self-contained";
  the user can also start one from a template in the Artifacts tab. Free has artifacts, with "Cloud
  code execution and file creation" switched on.
- "Everything you make is saved to the Artifacts tab in your Claude sidebar." They can be viewed on
  iOS and Android. "Artifacts start private to you"; Free can share by link.
- Persistent storage (Pro and above, web and Desktop only): "a 20 MB limit per artifact", text only,
  personal or shared.
- "Artifacts can connect to the apps you've connected to Claude" (Pro and above), except "Connector
  tools that need approval for each action".
- No length limit is documented.

**Can a tool create one? No source says so** (*unknown*, likely no). No Claude connector page
mentions artifacts. The only route is the model writing it, which means the model writes the
brief's *code* (HTML/React), against Ludify's rule that model-written content is data. An artifact
could instead be a thin shell that calls a Ludify tool for the engine, but then the brief's data
still has to live somewhere the artifact can reach (its storage, or a server).

### Claude Projects

*Documented*: available on all plans ("Free users can create a maximum of five projects"); project
knowledge is used in every chat inside the project; paid plans get RAG "up to 10x" capacity. No
source says a tool or the model can add a file to project knowledge in chat projects; only a beta
for some Claude Code users has a Library that "collects the files you add and the files Claude
produces". **A tool cannot put the brief in a Project** (*inferred* from silence). The user could
attach the brief's JSON to a project by hand, if Ludify offered a download, which neither host's
iframe allows (SPEC §9).

### ChatGPT canvas

*Search snippet* (Model release notes, 2026-05-28): canvas "will no longer be available in GPT-5.5
Instant or GPT-5.5 Thinking"; writing moves to blocks inside the chat; paid users keep canvas on
legacy models until they are sunset. Other GPT-5.5 help pages disagree, so check by hand. No
developer page mentions canvas; **no app can open or write one** (*documented by absence*). Canvas
is not a route for the brief.

### ChatGPT Projects and Library

- Projects keep chats, files and instructions together; Plus and Pro can reference earlier chats in
  a project (*search snippet*). No developer doc lets an app add a project file.
- Library: "files uploaded to or created in ChatGPT are saved to Library"; deleting a chat does not
  delete them (*search snippet*). Web is certain; mobile notes disagree.
- `window.openai.uploadFile(file, { library: true })` "Upload[s] a user-selected file … Pass
  `{ library: true }` to also save the upload in the user's ChatGPT file library when that library
  is available" (Reference; changelog 2026-03-24; non-image files since 2026-03-09). It is a
  ChatGPT-only extension, no size limit is given, and "the file library may not be available to
  every user". **Whether a widget may upload a file it generated** (the brief as JSON or HTML)
  rather than one the user picked is *unknown*; a spike could try it with a `File` built in the
  iframe. It is the only documented way for anything Ludify draws to outlive a ChatGPT chat.

## 2. Size: a brief against the limits

**The yardstick** (measured 2026-11-01): `funvenio-audience-brief.html` is 76,583 bytes. Its
content is already data pushed onto `FB.parts` / `FB.data` by seven scripts totalling about
44 KB; the renderer and calculators are another 15 KB. So a brief as JSON is **about 40–45 KB,
roughly 11–13k tokens** of model output, against the 13 KB, 24-card deck the spike wrote in one
call (SPEC §9). Brief plus deck is ~55–60 KB written by the model.

| Limit | Claude | ChatGPT |
|---|---|---|
| Tool result | "~150,000 characters" on claude.ai and Desktop; above it, with code execution on, the result goes to a sandbox file and the app "never hydrates" (*documented*) | Not documented; the model reads `structuredContent` "verbatim", `_meta` is "Hidden from the model" (*documented*) |
| Tool call timeout | 240 s (*documented*) | Not documented |
| Tool input (the model writing the brief as one call) | Not documented; 13 KB worked (*observed*) | Not documented; 13 KB worked (*observed*) |
| UI resource HTML | Not documented; 623 KB loaded (*observed*) | Not documented; 623 KB loaded (*observed*) |
| `widgetState` | n/a | Not documented |
| Spec | No limits in the stable spec; the draft's security notes reportedly suggest 10 MB tool results (seen only in a summary of the draft, not verbatim) | same |

A 44 KB brief is well inside Claude's 150,000-character result limit, even returned whole. The open
risk is the **input**: no host documents how much JSON a model will write in one tool call, and a
brief is 3× what we tested. Splitting the brief into several calls (one per part, ~10 KB each) is
the safe shape if one call fails (*inferred*). Return the brief in `_meta`, not `structuredContent`,
so ChatGPT's model doesn't read it all back (as the deck already does, SPEC §9).

Context matters more than the limits above on small plans: ChatGPT Instant's total context is
**27K tokens on Free and 54K on Go/Plus** (*search snippet*, pricing page). A 12k-token brief plus
the research behind it does not fit in Free Instant; Reasoning models have 256K on Go/Plus. Claude's
pricing page says "Up to 1M" context on every plan, "varies by model" (*documented*).

## 3. Coming back

| Situation | Claude | ChatGPT |
|---|---|---|
| Reload or reopen the same chat | *Documented*: "Tool results are stored in the conversation transcript, so every device and every remount of the widget sees the same key." On reopen, Claude "lazy-mounts widget cells as they scroll into view" and delivers the tool result again through `toolresult`. A brief reopens with its data | *Unknown*: no OpenAI page says a widget re-renders with `toolOutput` when an old chat reopens. `widgetState` is "persisted between renders" and "belongs to one rendered UI instance" |
| Another device | Same transcript, so yes on web and desktop (*documented*). Mobile: native WebView; users "must add a connector on web or desktop before it appears on mobile"; on iOS `toolInfo.id` is `undefined` when a conversation is rehydrated | Chats sync; widget rehydration *unknown*. OpenAI: "browser storage does not provide a reliable cross-device or cross-session data layer" |
| A new chat | The brief is not there; it stays in the old chat. Paid plans can search past chats ("Pro, Max, Ultra, Team, and Enterprise"); Free cannot | The brief is not there. Reference chat history and Projects can recall the old chat's text, not its widget (*inferred*) |
| Reading place (`localStorage`) | Per chat: origin `<hash>.claudemcpcontent.com` derived "from the conversation and connector" (*observed*, *documented* for the origin). A fixed `ui.domain` shares it "across every conversation" for the connector. Claude says treat it "as an optimization rather than a correctness guarantee" | Per server across chats: `…web-sandbox.oaiusercontent.com` (*observed*). OpenAI: "Avoid `localStorage` for core state" |

**What survives, in short:** within one chat, the brief survives in Claude by design and probably in
ChatGPT (untested). Across chats, nothing Ludify draws survives without storage, except a ChatGPT
Library file (if `uploadFile` accepts a generated file) or a Claude artifact the model writes itself.
The v1 rule "stores nothing server-side" means "come back to the brief" is really "come back to
the chat it's in". A pinned or named chat (Claude Projects, ChatGPT Projects) is the host-native way
to find it again.

The spec offers no restore-on-reload (the stable spec lists state restoration as future work); its
pattern is `localStorage` keyed by a server-minted `viewUUID` in `_meta` (patterns.md). Ludify
already does this for the deck.

## 4. Cost

Neither host publishes message or token numbers for chat plans, so this is an estimate.

**What a brief adds** (*inferred*): writing ~11–13k tokens of brief JSON plus ~3.5k of deck,
against ~3.5k for a deck alone, so roughly 4–5× the *output* of a quick deck. Input dominates a
thorough run anyway: every web search result and the long chat are re-read on each turn, and Claude
says "Longer conversations that trigger automatic context management consume more of your usage
limit" and "Tools and connectors are token-intensive".

**Claude** (*documented*, Usage and length limits, Pricing; checked 2026-11-01):

- Free: "Limited usage every 5 hours and every week", no numbers. One custom connector (SPEC §9).
- Pro ($20/month): "a five-hour limit and a weekly usage limit". The baseline, 1×.
- Max ($100/month): "five times the Pro plan's usage every five hours and every week".
- Ultra ($200/month): "No 5-hour limit" for verified accounts, "10x Pro usage every week".
- Usage depends on "the length and complexity of your conversations, the features you use, which
  Claude model you're chatting with, and the effort level".

**ChatGPT** (*search snippet*, help center and pricing page, about October 2026):

- Free and Go: "unlimited" everyday text chats subject to abuse safeguards; separate caps on files,
  images, voice and data analysis; Go has about 10× Free's feature limits.
- Plus and Pro: per-model allowances; Pro $100 is described as 5× Plus and Pro $200 as 20×.
- Instant context: Free 27K, Go/Plus 54K, Pro 128K tokens. Reasoning context: Go/Plus 256K, Pro 400K,
  Free "varies".

**Reading the numbers for Ludify:** on Claude Pro and ChatGPT Plus a thorough run (research, brief,
deck) is one long, heavy chat; it fits, but it is a large share of a five-hour window on Claude
Pro (*inferred*; no numbers to measure against). On free tiers the brief is the risk: Claude Free's
limits are small and unpublished, and ChatGPT Free Instant's 27K context can't hold the research
plus a 12k-token brief. Ludify should treat "thorough" as a paid-plan feature in its copy, or
measure it in a spike before promising it on Free.

## What a spike should check

1. Can the model write a 45 KB brief in **one** tool call in each host, or does it need one call per
   part? Time it against Claude's 240 s limit.
2. ChatGPT: does a widget re-render with its data when an old chat is reopened, on web and mobile?
3. ChatGPT: does `uploadFile(new File([json], "brief.json"), { library: true })` accept a file the
   iframe made, and does it then show in Library?
4. Claude: does `ui/request-display-mode` with `pip` do anything on web or desktop?
5. Claude iOS: does a fullscreen brief reopen with its place, given `toolInfo.id` is `undefined` on
   rehydration?
6. Usage: what share of the Claude Pro five-hour window and of ChatGPT Plus does one thorough run take
   (read Settings → Usage before and after)?
7. Re-read the ChatGPT help pages above by hand (canvas status, Library on mobile, plan limits).
