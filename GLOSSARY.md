# Ludify

Ludify turns a research question into a short, playable deck, researched on the user's own Claude
or ChatGPT usage.

## Language

**User**:
The person who asks Ludify for a deck and plays it; in v1 always the same person.
_Avoid_: Reader, player, asker

**Research**:
What the host model found on one topic: the findings, their sources and the limits of the
evidence. Ludify never shows it raw; it becomes a deck (and, after v1, a brief).
_Avoid_: Brief (for the findings themselves), notes (unless it existed before Ludify was called)

**Deck**:
The decision game made from research: you play it once, in about ten minutes, one idea per card,
and it ends on your picks. Made of worlds of cards. The only output in v1.
_Avoid_: Game, quiz, brief

**Brief**:
The reference document made from research: a long page you browse and come back to, with a
contents index, dense evidence and things to explore (scores, calculators). After v1. The model
example is the Owner's funvenio audience brief (`funvenio-audience-brief.html`, 28 Oct).
_Avoid_: Report, full brief, deck

**World**:
One of a deck's few themed sections, each a run of cards.
_Avoid_: Level, chapter

**Card**:
One screen of a deck holding a single idea or play (an explanation, a quiz, a guess, a decision).
_Avoid_: Slide, page

**Part**:
One of a brief's few colour-coded groups of sections, each with a door on the brief's opening
screen. The brief's counterpart of a deck's world.
_Avoid_: World (that's a deck's), chapter

**Section**:
One titled stretch of a brief inside a part, listed in its contents index; it can hold a whole
assessment, where a card holds one idea.
_Avoid_: Card (that's a deck's), page, chapter

**Narrowing form**:
The short form shown before research that fixes the research's scope: what the user is deciding, how
deep to go, what they already know, and up to three topic-specific questions.
_Avoid_: Questionnaire, intake

**Depth**:
How big the output is: quick (a two-world deck) or thorough (a four-world deck from wider research
and, after v1, a brief made from the same research).
_Avoid_: Length, level

**Guide**:
The deck-writing manual the host model fetches right before writing a deck: card types, rules,
source rules and the deck schema.
_Avoid_: Prompt, instructions

**Limits card**:
The card before the decision world that says what the research can't tell the user: gaps in the
evidence, unverified facts, what depends on their situation.
_Avoid_: Disclaimer, caveat card

**Decision world**:
A deck's last world when the user is deciding something: only decision cards, then the summary card
that sends the picks to the chat.
_Avoid_: Final level, boss level

**Check-yourself world**:
A deck's last world when the user is only learning, in place of the decision world: recall cards,
then the summary card that sends the threads the user wants to dig into to the chat.
_Avoid_: Test, exam, final quiz

**Deck player**:
The page Ludify's server gives the host to show a deck inline: the deck engine plus a small bridge
that takes the deck from `ludify_render`'s result. One page for every deck.
_Avoid_: Widget, viewer

**Partial deck**:
What `ludify_render` plays when the model's second try at a deck still has broken cards: the valid
cards, under a note at the top naming each card left out, with one reason in the deck's language.
_Avoid_: Broken deck, fallback deck

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
