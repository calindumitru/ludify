# Example decks

Decks are data: JSON with `ui` (strings) and `worlds` (cards), in the format of the `fun-briefs`
skill's [deck reference](https://github.com/calindumitru/skills/blob/main/skills/fun-briefs/references/deck.md),
with one change: a `guess` card's `fmt` is a template string (`"{v} min"`, `"{v:2}"` for two
decimals), never a function. The JSON Schema doesn't exist yet.

- [adhd-learning-deck.json](adhd-learning-deck.json): *What actually keeps ADHD brains reading*. The
  science of attention, reward timing and learning design, with each claim graded by its evidence.
  Every card's sources are in [docs/evidence.md](../docs/evidence.md).
