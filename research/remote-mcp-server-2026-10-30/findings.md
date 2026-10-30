# What a public remote MCP server needs to be added to Claude and ChatGPT

Resolves [#3](https://github.com/calindumitru/ludify/issues/3). Researched 2026-10-30 against primary
sources (Anthropic and OpenAI docs and help centres, the MCP spec). Nothing here was tested in a live
account.

**Labels used below**

- **Documented**: a first-party page says so. Not tried in a real account.
- **Unknown**: the docs say nothing. A live test is needed.
- None of the claims is **confirmed**, because nothing was tested.

help.openai.com refuses automated fetches (HTTP 403). Its pages were read from Internet Archive
snapshots, and each citation gives the snapshot date.

## Answer in one screen

| | Claude | ChatGPT |
|---|---|---|
| Add a custom server by URL on the **Free** plan | **Yes, one custom connector** (documented) | **No** (the docs name only Business, Enterprise/Edu and Pro, so Free is left out) |
| Add by URL on paid personal plans | Pro, Max, Ultra: yes, no limit stated | **Pro: yes, read/fetch tools only.** Plus and Go: not mentioned, so assume no |
| Add on team plans | Team/Enterprise: only an Owner adds it, then members connect | Business: admins/owners only. Enterprise/Edu: admins plus members granted the right through RBAC |
| Transport | Streamable HTTP (legacy HTTP+SSE still accepted but being deprecated) | "SSE and streaming HTTP"; the plugin docs say streamable HTTP, usually at `/mcp` |
| **No-auth allowed?** | **Yes**, supported by default (`none`) | **Yes**: "No authentication", "OAuth", or "OAuth or no authentication" |
| Review or developer-mode gate for personal use | None: "no review by Anthropic". There is a warning about unverified connectors | No review. Developer Mode no longer needs to be on: you accept a risk warning for each server. Web only, not mobile |
| Public listing | Directory submission with Anthropic review. Only paid plans can submit | Plugin directory submission with OpenAI review. Identity verification (individual or business) is required |
| Interactive UI (MCP Apps) | Yes | Yes. ChatGPT implements the MCP Apps standard, with `window.openai` as optional extras |
| Web search on the plan | All plans, Free included | All users |
| Host searches the web **during a tool-driven flow** | **Unknown**: the docs are silent | **Unknown**: the docs are silent (one hint below) |

**What this means for Ludify:**

- **Claude.** A Free user can add Ludify by URL as their one custom connector, with no auth and no
  review. This is the easiest route.
- **ChatGPT.** Free, Go and Plus users **cannot** add Ludify by URL. Pro users can, if every tool
  is read-only. Ludify's tools (`ludify_plan`, `ludify_render`) only read, so they qualify if marked
  `readOnlyHint: true`.
- **ChatGPT public route.** To reach most ChatGPT users, Ludify would have to be **published in the
  plugin directory**. That means OpenAI review and identity verification of the publisher.
- **Free and Go on ChatGPT.** Even a published plugin might not work on these plans. The help centre
  says the directory "is available across ChatGPT plans", but installing a given plugin "depends on
  your plan". The docs don't say whether a no-auth MCP plugin with UI works on Free or Go
  (**unknown**).

## Claude

### Plans

- **Documented.** Custom connectors added by URL are available on "Free, Pro, Max, Ultra, Team, and
  Enterprise plans". "On the Free plan, you can add one custom connector."
  - [Add a connector that isn't in the directory](https://claude.com/docs/connectors/custom/add-unlisted.md)
  - [Help centre: custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
    ("Free users are limited to one custom connector")
- **Team/Enterprise.** Only an Owner (or, on Enterprise, a member whose custom role includes
  managing the organization's libraries) adds the connector. Members then connect with their own
  account.
- **Clients.** A connected connector works on web, desktop and mobile. Claude connects from
  Anthropic's cloud, so the server must be publicly reachable from Anthropic's IP ranges.
  - [Get started with connectors](https://claude.com/docs/connectors/getting-started.md)
  - [Help centre](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- **Unknown.** Whether connectors from the directory count toward the Free plan's one-connector
  limit. The docs only state the limit for custom connectors.

### Transport

- **Documented.** "Use Streamable HTTP … Claude also supports the legacy HTTP+SSE transport, which
  is being deprecated in favor of Streamable HTTP."
  ([Build an MCP server for Claude](https://claude.com/docs/connectors/building.md))

### Auth

- **Documented: no-auth is allowed.** Type `none`, "No authentication (authless server)", is
  "Supported by default", and it works with every URL option.
  ([Authentication for connectors](https://claude.com/docs/connectors/building/authentication.md))
- **Optional sign-in later.** "Lazy authentication" leaves some tools open and asks for sign-in only
  for the others.
- **OAuth.** If used, Claude follows the MCP authorization specs dated 2025-03-26, 2025-06-18 and
  2025-11-25. It can register itself through DCR or CIMD. The callback is
  `https://claude.ai/api/mcp/auth_callback`.
- **Static request headers.** In beta, limited to some organizations, and Anthropic must approve
  each header name. Not needed for Ludify.

### Review gate

- **Documented.** Adding a custom connector by URL involves "no review by Anthropic". The user sees
  a warning that custom connectors reach unverified services.
  ([building](https://claude.com/docs/connectors/building.md))
- **Directory listing.** This is optional and reviewed by Anthropic. "Anyone on a paid Claude plan
  can submit … Free accounts can't submit."
  ([Publish to the directory](https://claude.com/docs/directory/publish.md))

### MCP Apps

- **Documented.** Claude renders MCP Apps (interactive UI inside the conversation).
  ([Get started with MCP Apps](https://claude.com/docs/connectors/building/mcp-apps/getting-started.md))
- **UI origin.** On Claude, the sandbox origin is the first 32 hex characters of SHA-256(server
  URL), followed by `.claudemcpcontent.com`.
- **Spec page.** The MCP Apps spec page lists Claude (web) and Claude Desktop as supporting hosts.
  ([MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps))

### Web search

- **Documented.** Web search is available on all plans, Free included. In the "new Claude
  experience" there is no toggle, and "Claude searches the web when it helps". Free usage resets
  every five hours, and search and fetch count toward it.
  ([Enable and use web search](https://support.claude.com/en/articles/10684626-enable-and-use-web-search))
- **Unknown.** Whether Claude keeps searching the web in a conversation where a connector's tools
  are driving the flow. No page discusses web search and connectors together.

## ChatGPT

OpenAI renamed again in 2026: custom MCP servers are now added as **plugins** at
`chatgpt.com/plugins`. The older "Developer mode / MCP apps" pages are labelled legacy.

### Plans

- **Documented.** "Custom MCP server connections and full MCP support are available for ChatGPT
  Business and Enterprise/Edu customers on ChatGPT web."
- **Pro.** The FAQ adds: "Pro users can connect custom MCP servers with read/fetch permissions" and
  "Full MCP is only available to Business and Enterprise/Edu users".
- **Platform.** "Can I connect custom MCP servers on mobile? No - web only."
- **Source.** [Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt),
  read via the [Internet Archive snapshot of 2026-10-19](http://web.archive.org/web/20261019193201/https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).
  The page said "Updated: 3 days ago".
- **Free, Go and Plus: not mentioned.** The help centre doesn't name them for custom servers.
  Treat them as **not available** until a live test shows otherwise.
- **Earlier version.** The 2026-10-08 snapshot, titled "Developer mode and MCP apps", said the same:
  Business and Enterprise/Edu, plus Pro read/fetch only.
- **The developer doc.** It says only "Use ChatGPT on the web. Workspace permissions and security
  restrictions … apply" and doesn't list plans.
  ([Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server))

### Transport

- **Documented.** "Supported MCP protocols: SSE and streaming HTTP."
  ([Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server))
- **Plugin docs.** "A public endpoint supports streamable HTTP, typically at `/mcp`."
  ([Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt))
- **No local servers.** ChatGPT doesn't connect to local servers directly. A Secure MCP Tunnel
  exists for private servers.

### Auth

- **Documented: no-auth is allowed.** "Authentication options include **OAuth**, **No
  authentication**, and **OAuth or no authentication**."
  ([Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server))
- **OpenAI's own example.** The plugins quickstart connects a public example server with "No
  authentication". ([Quickstart](https://developers.openai.com/plugins/quickstart))
- **Per tool.** `securitySchemes: noauth` means "the tool is callable anonymously". "Many plugin
  MCP servers can operate in a read-only, anonymous mode."
  ([Authentication](https://developers.openai.com/plugins/build/auth))

### Review gate

- **Custom server, personal use. Documented.** There is no OpenAI review. "You don't need to turn
  on Developer Mode first. Instead, review and acknowledge the risk warning for each server you
  add."
- **Write confirmation.** Tools without `readOnlyHint` are treated as write actions and need
  confirmation.
- **Public directory. Documented.**
  - Submit through the plugin submission portal on platform.openai.com.
  - The publisher must complete **individual or business identity verification** ("Publishing
    under an unverified individual or business name will result in rejection").
  - The server must be on a public domain, with a CSP if it returns UI.
  - "Every plugin must complete OpenAI review", and review timelines vary.
  - Source: [Remote MCP server review requirements](https://developers.openai.com/plugins/deploy/app-review)
- **Who can use a published plugin. Partly documented.**
  - "The directory is available across ChatGPT plans … Installing or using an individual plugin
    depends on your plan, workspace, role, region, and its included capabilities."
    ([Plugins in ChatGPT and Codex](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt-and-codex),
    [snapshot 2026-09-29](http://web.archive.org/web/20260929114820/https://help.openai.com/en/articles/20001256-plugins-in-chatgpt-and-codex))
  - "On Free and Go accounts, you can discover plugins through the directory and recommendations,
    but plugin extensions are not available to these plans."
    ([Troubleshooting plugins & apps](https://help.openai.com/en/articles/20001497-troubleshooting-plugins-apps-in-chatgpt),
    [snapshot 2026-10-06](http://web.archive.org/web/20261006084548/https://help.openai.com/en/articles/20001497-troubleshooting-plugins-apps-in-chatgpt))
  - "Plugin extensions" is a specific feature (see
    [Plugin Extensions](https://developers.openai.com/plugins/build/extensions)), so this sentence
    doesn't clearly rule out ordinary MCP plugins on Free or Go.
  - **Unknown:** whether a published no-auth plugin with MCP Apps UI runs for Free and Go users.
  - For history: at launch in October 2025, apps were open to logged-in Free, Go, Plus and Pro
    users outside the EEA, Switzerland and the UK
    ([OpenAI](https://openai.com/blog/introducing-apps-in-chatgpt)). That may no longer hold.

### MCP Apps

- **Documented.** "ChatGPT implements the open MCP Apps UI standard so you can build your UI once
  and run it across MCP Apps-compatible hosts."
  ([plugins docs, combined export](https://developers.openai.com/plugins/llms-full.txt), section
  "Add UI to your MCP server")
- **Extras.** `window.openai` extensions are optional extras on top of the standard.

### Web search

- **Documented.** ChatGPT search has been available to all users since 2025-02-05
  ([OpenAI](https://openai.com/blog/introducing-chatgpt-search)).
- **Unknown.** Whether ChatGPT keeps using web search while a custom plugin's tools drive the flow,
  on any plan.
- **Hint.** OpenAI's own prompting advice for custom MCP servers includes "Do not use built-in
  browsing or other tools; only use the Acme CRM app". That suggests built-in browsing stays
  available next to custom tools, but the docs don't say so.
  ([Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server))
- **Deep research.** It can use custom apps "for read/fetch actions only" (help centre FAQ, same
  snapshot as above).

## SPEC §3 route table, re-checked

| SPEC §3 row | Still right? | Notes |
|---|---|---|
| MCP App in Claude and ChatGPT | **Yes, with a caveat** | Both render MCP Apps (see the MCP Apps sections above). The caveat: on ChatGPT, only Pro (read-only) and Business/Enterprise/Edu can add Ludify by URL. Free, Go and Plus need a published directory plugin. The SDK `@modelcontextprotocol/ext-apps` is now **v2.0.4** (released 2026-10-27). v2.0.0 (2026-09-08) moved to the MCP TypeScript SDK 2.0 split packages and needs zod 4.2+; the wire protocol is unchanged ([release notes](https://github.com/modelcontextprotocol/ext-apps/releases/tag/v2.0.0)). OpenAI's examples still pin `^1.0.1`. |
| Sign in with ChatGPT | **Mostly; tighten the wording** | Plan usage is for "Eligible ChatGPT Plus and Pro users". It "is available to all open-source partners and selected private clients". Sign in with ChatGPT for websites and plugins "is currently available to selected commercial partners through a limited trial". Paid or remotely hosted apps must fill in an interest form ([SIWC quickstart](https://developers.openai.com/siwc/quickstart), [plan usage overview](https://developers.openai.com/siwc/token-sharing-open-source)). The 5-hour shared limit from SPEC wasn't re-verified. |
| Claude subscription sign-in for third-party apps | **Yes, still not allowed** | "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users." Developers "should use API key authentication" ([Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). The exact date in SPEC ("since Feb 2026") comes from press coverage, not from this page. |
| Bring-your-own API key | Unchanged | Not re-researched. |
| Shared Claude artifact | Not re-checked | Out of scope for #3. |

Small corrections for SPEC:

- Claude now has an **Ultra** plan next to Free, Pro and Max.
- OpenAI now calls these **plugins**, not apps. The landing page's "Add to ChatGPT" steps should say
  Plugins → + → Add custom MCP server.

## Other things a builder should know

- **MCP spec version.** The latest MCP spec is **2026-07-28**. It defines two transports, stdio and
  Streamable HTTP, and drops the connection-scoped `initialize` session. Clients on older versions
  detect the difference and fall back
  ([Transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)). This
  suits a stateless server, but hosts may still speak older versions, so support both.
- **Auth is optional in MCP.** "Authorization is OPTIONAL for MCP implementations."
  ([Authorization](https://modelcontextprotocol.io/specification/latest/basic/authorization))
- **Tool annotations on ChatGPT.**
  - Set `readOnlyHint: true` on both tools. On ChatGPT, tools without it are treated as writes,
    need confirmation, and are blocked for Pro custom servers.
  - `openWorldHint` should be `false`, because Ludify's server never touches the public internet.
    This is our reading of the definition.
- **ChatGPT freezes tool definitions.** For workspace-published apps, ChatGPT uses a "frozen"
  snapshot of the tools. Changing a tool's schema can break calls until an admin refreshes. Keep
  tool schemas backward-compatible.
- **Custom servers on ChatGPT are web only.** The custom server route doesn't work on ChatGPT
  mobile. Claude connectors work on mobile once connected.

## Still unknown (needs a live test)

1. Can a ChatGPT **Plus** account add a custom MCP server today? The docs leave Plus out.
2. Does a published, no-auth ChatGPT plugin with MCP Apps UI work for **Free and Go** users?
3. On each host and plan, does the model still run **web search** in the same conversation while
   Ludify's tools drive the flow? Test on Claude Free and ChatGPT Pro at least.
4. Do Claude directory connectors count toward the Free plan's one-custom-connector limit?
