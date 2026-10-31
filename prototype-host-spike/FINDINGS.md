# Host spike: findings (PROTOTYPE, never merged)

Ticket: [Spike: can ludify_render play the ADHD deck inline in both hosts?](https://github.com/calindumitru/ludify/issues/6).
Run 2026-10-30 by the Owner in Claude (claude.ai/Desktop, custom connector) and the ChatGPT desktop app
(Plus plan), against this server over a Cloudflare quick tunnel. Results come from 144 probe reports the
iframe sent to the server, plus what the Owner saw on screen.

## Verdict

The whole loop works in **both hosts**: topic → guide tool → web research → the model writes a ~13 KB
deck as **one** `ludify_render` call → the deck plays inline. Both decks passed validation first time.

## Results

| Check | Claude | ChatGPT (desktop, Plus) |
|---|---|---|
| Add a no-auth server by URL | Yes; "No sign-in" auto-detected. Also offers "Sign in when needed" | **Yes on Plus** ("Add custom MCP server" → "Create as a plugin"; a "Tunnel" option too), then a consent screen citing the app's "terms and privacy policy" |
| Protocol | Handshake on 2025-11-25, then 2026-07-28 `server/discover`; SDK v2 stateless handler serves both | Same handler worked |
| Tool approval | Default "Needs approval" per tool; app-only tools listed separately with no switch | Not observed |
| Deck plays inline | Yes | Yes |
| Deck delivery | `_meta.deck` on the tool result reaches the iframe; tool input also visible | Same |
| Model writes the deck in one call | 13.3 KB, 24 cards, valid, ~86 s after the guide, **with web search**; sources real and relevant | 13.0 KB, 25 cards, valid, ~66 s after the guide (built from research already in the chat) |
| App page size | 623 KB HTML loaded fine | Same |
| iframe → server tool (`callServerTool`) | Yes, ~0.5 s | Yes, ~0.5 s |
| iframe → chat message (`sendMessage`) | **Fills the composer; the user presses Enter** | **Sends immediately** |
| Open link | Yes, with an "Open external link" confirmation each time | Yes |
| `localStorage` | Works; origin is **per chat** (`<hash>.claudemcpcontent.com`), so progress resets in a new chat. Survives reloads within a chat | Works; origin **per server** (`codex-sandbox://mcp-app-<hash>.web-sandbox.oaiusercontent.com`), so progress follows the user across chats |
| Read-aloud (`speechSynthesis`) | Works, 180 voices; the default voice is unpleasant | Starts, 180 voices |
| Host download (`ui/download-file`) | Not offered | Not offered |
| `<a download>` | Silently blocked | Silently blocked |
| `confirm()` | Blocked, returns `false`, no dialog | Same |
| Clipboard | Blocked by permissions policy | **Works** (contrary to OpenAI's docs) |
| Fullscreen | Granted | Granted |

## Consequences for the build

- Narrowing questions as Ludify's own form work in both, but "submit" differs: one click in ChatGPT,
  click + Enter in Claude.
- No download from inside the deck in either host: the HTML file has to come from elsewhere (a link to
  a Ludify page, or the landing page), or v1 drops it.
- Engine fixes: replace `confirm()` in "Start over" with an in-page confirm; "Copy my picks" can't rely
  on the clipboard (send the picks to the chat instead); route links through `openLink`; pick a better
  voice than the default.
- Source rule: the example deck's evidence-limits card ("The catch") has no `src`, correctly. The rule
  needs an exception for such cards, and possibly a "from this conversation" source when the deck is
  built from research already in the chat.
- New use case seen: "ludify this conversation", turning research already in a chat into a deck.
- The real server needs its own favicon (Claude shows the domain's icon) and, for ChatGPT's consent
  screen, terms and a privacy policy.
- Two approval prompts (guide, then render) stand between a new Claude user and their first deck.

## Not tested

- chatgpt.com in a browser (only the desktop app); ChatGPT mobile; Claude mobile.
- Claude Free's one-connector limit and whether directory connectors count toward it.
- The `/mcp-stable` endpoint (a fixed Claude origin, so progress would follow the user across chats).
- How the hosts behave when a deck fails validation (no model-written deck failed).

## Run it again

`npm install && npm run setup && npm start`, then `cloudflared tunnel --url http://localhost:8787` and
add `https://<tunnel>/mcp` in each host. `npm run smoke` drives the page through a fake host locally.
`setup` needs the Owner's private funvenio checkout for the example deck.
