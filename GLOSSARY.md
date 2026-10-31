# Ludify

Ludify turns a research question into a short, playable brief, researched on the user's own Claude
or ChatGPT usage.

## Language

**User**:
The person who asks Ludify for a brief and plays its deck; in v1 always the same person.
_Avoid_: Reader, player, asker

**Brief**:
The researched answer to one topic: its findings, their sources, and the limits of the evidence.
_Avoid_: Report, summary

**Deck**:
The playable form a brief is delivered in, made of worlds of cards.
_Avoid_: Game, quiz, brief (for the playable form)

**World**:
One of a deck's few themed sections, each a run of cards.
_Avoid_: Level, chapter

**Card**:
One screen of a deck holding a single idea or play (an explanation, a quiz, a guess, a decision).
_Avoid_: Slide, page

**Narrowing form**:
The short form shown before research that fixes a brief's scope: what the user is deciding, how
deep to go, what they already know, and up to three topic-specific questions.
_Avoid_: Questionnaire, intake

**Depth**:
How big a brief is: quick (two worlds) or thorough (four worlds, wider research).
_Avoid_: Length, level

**Guide**:
The deck-writing manual the host model fetches right before writing a deck: card types, rules,
source rules and the deck schema.
_Avoid_: Prompt, instructions

**Limits card**:
The card before the decision world that says what the brief can't tell the user: gaps in the
evidence, unverified facts, what depends on their situation.
_Avoid_: Disclaimer, caveat card

**Decision world**:
A deck's last world: only decision cards, then the summary card that sends the picks to the chat.
_Avoid_: Final level, boss level

**Source tag**:
The label on an info card naming where its fact comes from (official, study, test, vendor, notes),
plus an evidence grade when the card claims an effect.
_Avoid_: Badge, label

**Picks**:
The options the user chose on a deck's decision cards, sent to the chat at the end of the deck.
_Avoid_: Answers, results, choices

**Notes**:
Research that existed before Ludify was called (the chat so far, an attached file, pasted
findings). Facts from notes without a found source are shown as unverified.
_Avoid_: Upload, document
