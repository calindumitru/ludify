# Brief spike (PROTOTYPE, never merge)

Ticket: [Prototype: a brief and its deck in Claude](https://github.com/calindumitru/ludify/issues/64),
on the map [Wayfinder: the brief, spec ready to slice](https://github.com/calindumitru/ludify/issues/59).

`ludify_brief_spike(view)` on the real server shows a brief and its deck, fixed data, with a
PROTOTYPE bar to switch the brief's **home** and the **pointer set** (how a deck card links to the
brief and how you get back). Decided with it: home B (a Brief tab inside the deck's player), the
return bar, no brief line in Send to chat. See the ticket's resolution.

## Data (not committed)

`brief.json`, `deck.json` and `links.json` hold the Owner's private funvenio research, so they stay
out of this public repo. `convert/` rebuilds them from the two reference files on the Owner's
machine (`funvenio-audience-brief.html`, `funvenio-audience-quest.html` in `~/Projects`):

    node convert/load.mjs && node convert/quest.mjs && node convert/deck.mjs && node convert/brief.mjs

`deck.mjs` then needs the limits card the converter leaves out (see the ticket), and `links.json`
the hand-set links listed in the resolution.

## Run it

    node prototype-brief-spike/build.ts           # from packages/server; writes src/spike.gen.ts and dist/
    npm run dev -w @ludify/server                 # http://localhost:8791/mcp
    cloudflared tunnel --url http://localhost:8791  # add https://<tunnel>/mcp in Claude

`dist/index.html` is a fake chat with both views for a quick look in a browser (serve `dist/`).
