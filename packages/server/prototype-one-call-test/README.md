# One-call test (PROTOTYPE, removed after the test)

Ticket: [Can Claude write a deck and its brief in one tool call?](https://github.com/calindumitru/ludify/issues/72),
on the map [Wayfinder: the brief, spec ready to slice](https://github.com/calindumitru/ludify/issues/59).

Two throwaway tools on the real server:

- `ludify_one_call_guide`: the deck manual (`guide.md`), then the brief format
  ([brief-format.ts](brief-format.ts), SPEC.md §7 written out as fields), then a `started` time.
- `ludify_one_call_test({deck, brief, started})`: checks the deck with `validateDeck` and the brief
  loosely ([check.ts](check.ts)), and returns both sizes, the seconds since the guide, and the
  problems. It also logs one `ONE-CALL RUN {...}` line in the `wrangler dev` terminal. Nothing is shown inline.

## Run it

It's live on the deployed server for the test, so the Ludify connector already in Claude has both
tools. Locally:

    npm run dev -w @ludify/server                   # http://localhost:8791/mcp
    cloudflared tunnel --url http://localhost:8791  # add https://<tunnel>/mcp in Claude

In Claude, add the tunnel URL as a custom connector, then in a new chat:

> Run the Ludify one-call test: research «topic» thoroughly, then call ludify_one_call_guide and
> write a thorough deck and its brief in one ludify_one_call_test call. I'm deciding «goal».

## Per run, record

Finished or not (no call, a cut-off call, an error), seconds from the guide to the result, valid
JSON or not (and whether it came as a string), truncation, deck and brief sizes, model and plan.
