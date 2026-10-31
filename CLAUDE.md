# Ludify

Turns a research question into a short, playable deck, researched on the user's own Claude or
ChatGPT usage. Start from [SPEC.md](SPEC.md); v1 is decided and being built in slices.

- **Build work** is `ready-for-agent` issues with a `size:*` label, run with the `slice-flow`
  skill; builders follow [docs/building-slices.md](docs/building-slices.md), and the route is in
  [docs/agents/workflow.md](docs/agents/workflow.md).
- **New product questions** become `wayfinder:grilling` tickets, grilled with the Owner through
  the question UI. Record the answers in SPEC.md under **Decided**.
- Design rules come from [docs/evidence.md](docs/evidence.md). Never add points, badges or streaks
  as the engagement engine, and never claim Ludify is proven for ADHD.
- Model-written decks are data (JSON validated against a schema), never code.
- The repo is public: never commit secrets or anyone's email address.
- Commit or push only when the Owner asks; branch first once `main` has history.
