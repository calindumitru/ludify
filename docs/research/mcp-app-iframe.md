# What an MCP App iframe can do in Claude and ChatGPT

Researched 2026-10-30 for [issue #2](https://github.com/calindumitru/ludify/issues/2) (SPEC §3, §9).
Nothing here was tested in a real host. Status labels:

- **Documented**: a primary source says so (spec, SDK source, or the host's own docs). Not tested by us.
- **Inferred**: follows from a documented fact, but no source states it directly.
- **Unknown**: the docs say nothing. Only the spike (SPEC §10, milestone 1) can answer it.

## Sources

| Short name | Source |
|---|---|
| Spec (stable) | MCP Apps spec, version 2026-01-26: [`specification/2026-01-26/apps.mdx`](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) |
| Spec (draft) | [`specification/draft/apps.mdx`](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx) |
| SDK | `@modelcontextprotocol/ext-apps` 2.0.4 (npm, 2026-10-27), repo at commit `cf599cc` (2026-10-29): [`src/spec.types.ts`](https://github.com/modelcontextprotocol/ext-apps/blob/main/src/spec.types.ts), [`docs/patterns.md`](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/patterns.md), [`docs/migrate_from_openai_apps.md`](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/migrate_from_openai_apps.md) |
| Claude: server | [Build an MCP server for Claude](https://claude.com/docs/connectors/building/index.md) |
| Claude: apps | [Get started](https://claude.com/docs/connectors/building/mcp-apps/getting-started.md), [Design guidelines](https://claude.com/docs/connectors/building/mcp-apps/design-guidelines.md), [Troubleshooting](https://claude.com/docs/connectors/building/mcp-apps/troubleshooting.md), [Instance supersession](https://claude.com/docs/connectors/building/mcp-apps/instance-supersession.md), [External links](https://claude.com/docs/connectors/building/mcp-apps/external-links.md) |
| ChatGPT: apps | [MCP Apps in ChatGPT](https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt/), [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui.md), [Reference (`window.openai`)](https://developers.openai.com/plugins/reference), [Security & Privacy](https://developers.openai.com/plugins/guides/security-privacy.md), [Plugin Extensions](https://developers.openai.com/plugins/build/extensions), [OpenAI MCP extensions spec](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md) |

OpenAI's developer docs have moved from `/apps-sdk/` to `/plugins/`. ChatGPT apps are now called "plugins".

## Summary

| Question | Claude (web, desktop) | ChatGPT |
|---|---|---|
| Iframe calls a tool | **Documented** (`tools/call`) | **Documented** (`tools/call`; also `window.openai.callTool`) |
| Iframe posts a chat message | **Documented** (`ui/message` via `app.sendMessage`) | **Documented** (`ui/message`; also `sendFollowUpMessage`) |
| Tool result size | **Documented**: about 150,000 characters | **Unknown** |
| Tool input size / UI resource size | **Unknown** | **Unknown** |
| `localStorage` | **Documented** works (`allow-same-origin`). Scoped to one conversation unless `ui.domain` is set | **Documented** exists, but OpenAI says not to rely on it. `widgetState` is the host's alternative |
| Web Speech API (`speechSynthesis`) | **Unknown** | **Unknown** |
| File download | **Unknown**: `ui/download-file` exists in the draft spec and SDK. Claude's docs don't mention it | **Unknown** for `ui/download-file`. `getFileDownloadUrl` exists, but only for files ChatGPT already holds |
| Forms / elicitation | **Unknown**: not in Claude's docs. One third-party page (June 2026) says claude.ai lacks it | **Documented**: MCP form elicitation plus OpenAI "extended forms". Desktop: full support. Web: with limits. Mobile: none |

## 1. Can the iframe continue the flow?

**Spec (stable).** A View may send `tools/call` and `resources/read` to the server, through the host
([Spec, "Standard MCP Messages"](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)).
Two more requests are defined:

- `ui/message` sends `{role: "user", content: {type: "text", text}}` to the chat. The host "SHOULD add the message to the conversation context" and "MAY request user consent".
- `ui/update-model-context` puts content into the model's context without starting a turn.

The host "MAY decide to block some messages or subject them to further user approval".

A tool can be hidden from the model and kept callable only by the app (`_meta.ui.visibility: ["app"]`). The host "MUST reject `tools/call` requests from apps for tools that don't include `"app"` in visibility".

**Claude: documented.**

- The [Troubleshooting](https://claude.com/docs/connectors/building/mcp-apps/troubleshooting.md) page recommends "app-initiated tool calls to load additional data from within your widget".
- The [Instance supersession](https://claude.com/docs/connectors/building/mcp-apps/instance-supersession.md) page says each widget instance "independently pushes model-context updates … and messages to Claude", meaning `updateModelContext` and `sendMessage`.
- In fullscreen, "the composer is always visible" ([Design guidelines](https://claude.com/docs/connectors/building/mcp-apps/design-guidelines.md)).
- Claude's design guidance: free text and follow-up questions "go through chat"; buttons and selections stay in the app.

**ChatGPT: documented.** [MCP Apps in ChatGPT](https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt/) lists `tools/call`, `ui/message` and `ui/update-model-context` as the portable bridge. It names `window.openai.callTool` and `sendFollowUpMessage({prompt, scrollToBottom})` as compatibility aliases.

**For Ludify:** a "Continue" button in the iframe can send `ui/message`, for example "Research these answers and build the deck", in both hosts. Docs for both hosts allow a consent step before the message is sent. Whether a step actually appears is **unknown**.

## 2. Size limits

**Spec:** sets no size limits.

**Claude, tool results: documented.**

- On claude.ai and Desktop, the "maximum tool result size" is about 150,000 characters. The tool call timeout is 240 s ([Build an MCP server](https://claude.com/docs/connectors/building/index.md)).
- Above about 150,000 characters, with code execution on, Claude writes the result to a file in the sandbox. The app then receives a pointer instead of `structuredContent`, "so it never hydrates" ([Troubleshooting](https://claude.com/docs/connectors/building/mcp-apps/troubleshooting.md)).
- A 20–40 KB deck is well under this limit.

**Claude, tool input size and UI resource (HTML) size: unknown.** The docs are silent.

**Claude, inline height: documented.** "The host also caps inline height and clips content that exceeds it". The cap's value isn't given. For a scrollable viewport, request fullscreen ([Design guidelines](https://claude.com/docs/connectors/building/mcp-apps/design-guidelines.md)).

**ChatGPT: unknown.** The [Reference](https://developers.openai.com/plugins/reference) gives no numbers for `structuredContent`, `_meta`, widget state, tool output, or template HTML. The only limit it gives is 64 characters for the invocation status text. It also warns that the model reads `structuredContent` "verbatim", so keep it concise. That matters for Ludify: if the deck is in `structuredContent`, ChatGPT's model reads all 20–40 KB of it.

**Tool input: unknown in both hosts.** For `ludify_render(deck)`, the deck is the tool input, so the model has to write 20–40 KB of JSON (very roughly 5–13k tokens) as one tool call. No source documents a limit on input size or on model output per tool call. The spike must test this.

## 3. `localStorage` and the Web Speech API

**Spec:** a web host must render the View inside a sandbox proxy with `allow-scripts allow-same-origin`. The reference host sets `allow-scripts allow-same-origin allow-forms` on the inner iframe ([`examples/basic-host/src/sandbox.ts`](https://github.com/modelcontextprotocol/ext-apps/blob/main/examples/basic-host/src/sandbox.ts)).

The SDK's own guidance is to persist view state in `localStorage`, keyed by an ID from the server ([`docs/patterns.md`, "Persisting view state"](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/patterns.md)).

Permissions (`camera`, `microphone`, `geolocation`, `clipboardWrite`) can be requested in `_meta.ui.permissions`. Hosts "MAY" honor them. Apps "SHOULD NOT assume permissions are granted".

**Claude `localStorage`: documented.**

- The iframe sandbox includes `allow-same-origin`, and Claude's docs show persisting to `localStorage` on claude.ai web ([Instance supersession](https://claude.com/docs/connectors/building/mcp-apps/instance-supersession.md)).
- **Scope matters.** Without `ui.domain`, "Claude derives the iframe origin from the conversation and connector". So `localStorage` is per conversation: reading progress would not follow the user to a new chat.
- With a fixed `ui.domain`, the origin is shared across every conversation for the connector. The value is the first 32 hex characters of the SHA-256 of the server URL, plus `.claudemcpcontent.com`, and it requires a remote connector ([Get started](https://claude.com/docs/connectors/building/mcp-apps/getting-started.md)).

**Claude mobile.**

- Apps run in a native WebView (`WKWebView` on iOS, `WebView` on Android), not in a sandboxed iframe.
- They have "no camera, microphone, or location access".
- `toolInfo.id` is `undefined` when an iOS conversation is rehydrated ([Design guidelines](https://claude.com/docs/connectors/building/mcp-apps/design-guidelines.md), [Instance supersession](https://claude.com/docs/connectors/building/mcp-apps/instance-supersession.md)).
- Whether `localStorage` persists in those WebViews is **unknown**.

**ChatGPT `localStorage`: documented, with caveats.** The docs say: "Avoid `localStorage` for core state. UI runs in an isolated iframe, and browser storage does not provide a reliable cross-device or cross-session data layer" ([Add UI](https://developers.openai.com/plugins/build/chatgpt-ui.md)).

The host's alternative is `window.openai.widgetState` / `setWidgetState`. It belongs to one rendered instance and is not a standard MCP Apps method ([Reference](https://developers.openai.com/plugins/reference)).

The default sandbox origin is `https://web-sandbox.oaiusercontent.com`, unless the app sets `ui.domain`. Setting `ui.domain` is required for submission.

[Security & Privacy](https://developers.openai.com/plugins/guides/security-privacy.md) says widgets cannot use `window.alert`, `window.prompt`, `window.confirm` or `navigator.clipboard`.

**Web Speech API: unknown in both hosts.** No source mentions `speechSynthesis` or `SpeechRecognition`:

- The spec's permission list has `microphone` but nothing for speech output.
- The SDK's `transcript-server` example uses `SpeechRecognition` (speech input), but no host doc says it works.
- Read-aloud uses `speechSynthesis`. As far as we know, it doesn't need a Permissions Policy feature, so the iframe sandbox probably doesn't block it (**inferred**). Whether voices are actually available, especially in Claude's mobile WebViews, is **unknown**.

Ludify must feature-detect read-aloud and hide it when unavailable, as SPEC §9 already plans.

## 4. Can the iframe offer a file download?

**Spec: the stable spec does not cover it.** The **draft** spec and SDK 2.0.4 add `ui/download-file` ([draft spec](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx), `McpUiDownloadFileRequest` in [`src/spec.types.ts`](https://github.com/modelcontextprotocol/ext-apps/blob/main/src/spec.types.ts)):

- The app sends an `EmbeddedResource`: inline `text` or base64 `blob`, with the filename taken from `uri`. It can also send a `ResourceLink` for the host to fetch.
- The draft states that "direct file downloads are blocked (`allow-downloads` is not set)".
- The host signals support with `hostCapabilities.downloadFile`. The SDK's PDF example shows its download button only when that flag is set.

**Claude: unknown.** No Claude page mentions `ui/download-file` or downloads. Claude's docs also say not to depend on "advanced or draft capabilities" ([Build an MCP server](https://claude.com/docs/connectors/building/index.md)).

**ChatGPT: unknown for `ui/download-file`.** `window.openai.getFileDownloadUrl({fileId})` returns a temporary URL, but only for files ChatGPT already holds: uploads, library files, file parameters ([Reference](https://developers.openai.com/plugins/reference)). It can't serve a file the app generated. The SDK's migration guide lists it as "Not yet implemented" in MCP Apps.

**Fallbacks:**

- `ui/open-link` to a URL the server hosts. This is documented in both hosts; Claude shows a confirmation dialog for custom connectors ([External links](https://claude.com/docs/connectors/building/mcp-apps/external-links.md)). But Ludify would then have to store the deck, which goes against SPEC §3 ("no stored content").
- Clipboard: blocked in ChatGPT; in Claude, `clipboardWrite` is only a permission request the host may refuse.

**For Ludify:** the spike should log `app.getHostCapabilities()` in each host. If `downloadFile` is set, use `ui/download-file` with the engine's HTML as an `EmbeddedResource`. If not, the download is the landing page's job, or needs a stateless signed URL.

## 5. Forms or elicitation for asking the user questions

**Spec (MCP Apps):** no form primitive. The app can draw its own form and send the answers with `ui/message` or an app-only `tools/call`. Claude's design guidance prefers "visible controls" (segmented buttons, toggles) over menus in the app, and pushes free text to the chat input ([Design guidelines](https://claude.com/docs/connectors/building/mcp-apps/design-guidelines.md)).

**Claude: unknown.**

- Claude's server docs list what Claude does *not* support: "Resource subscriptions, Sampling, Advanced or draft capabilities". Elicitation is not mentioned either way ([Build an MCP server](https://claude.com/docs/connectors/building/index.md)).
- The MCP 2026-07-28 post (2026-07-28) only says support "is rolling out across Claude products soon" ([Anthropic](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)).
- A third-party help page (Relativity, modified 2026-06-30) says claude.ai and Cowork do not support elicitation ([Relativity](https://help.relativity.com/RelativityOne/Content/Relativity/MCP/Anthropic_Claude.htm)). This is not a primary source.

**ChatGPT: documented.**

- ChatGPT supports MCP form elicitation and extends it with "extended forms": image choices with `x-openai-thumbnail`, and more input types ([Plugin Extensions](https://developers.openai.com/plugins/build/extensions), [OpenAI MCP extensions spec](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#openai-form-elicitation)).
- Extended forms are "supported on Desktop, supported with limits on Web, and not supported on iOS or Android".
- OpenAI-registered servers must use MCP `2026-07-28` with multi-round-trip requests (MRTR) for form elicitation. Servers on older protocol versions use `openai/elicitation/create`.
- URL-mode elicitation isn't mentioned.

**For Ludify:** don't depend on elicitation. The portable route works in both hosts: `ludify_plan` renders the narrowing questions as an MCP App form with buttons and chips, then sends the answers with `ui/message`. When no UI is available, it falls back to plain-text questions in chat (SPEC §3 already plans this). ChatGPT elicitation can be an extra later.

## What the spike must answer (SPEC §10, milestone 1)

1. Log `getHostCapabilities()` and `getHostContext()` in Claude web, Claude Desktop and ChatGPT. Check `downloadFile`, `serverTools`, `sandbox.permissions`, `availableDisplayModes` and `containerDimensions`.
2. Pass a 40 KB deck as tool input and as `structuredContent` in each host. Does the model write it without truncation? Does the iframe receive it?
3. Serve a 40 KB HTML UI resource. Does it load in both hosts?
4. Send `ui/message` from a button. Is it sent right away, or after a consent step?
5. `localStorage`: does it survive a reload, a new chat (with and without `ui.domain`), and Claude iOS?
6. `speechSynthesis.speak()` on desktop and mobile in each host.
7. `ui/download-file` with an HTML `EmbeddedResource`, if `downloadFile` is advertised.
