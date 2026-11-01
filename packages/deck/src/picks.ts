// The picks: the options the user chose on a deck's decision cards. The summary card shows them as
// lines, and its Send to chat button posts them to the chat as one short message. Both are plain
// text: the Markdown-lite marks come off, and a link keeps its text and drops its address.

type Card = { h?: unknown; short?: unknown; opts?: unknown };
type World = { id?: unknown; cards: Card[] };
export type PicksWords = { intro: unknown; skipped: unknown };

/** Model text without its Markdown-lite: **bold** and `code` marks go, [text](url) keeps its text. */
const plain = (x: unknown) => String(x ?? '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|`/g, '');

/** One line per decision the summary card's `from` names: its short name, then the option chosen
 * (or the deck's word for skipped). Refs that name no card are left out. `answers` is keyed
 * "worldId:cardIndex", as the engine saves them. */
export function picksLines(worlds: World[], from: unknown, answers: Record<string, unknown>, words: PicksWords): string[] {
  const refs = Array.isArray(from) ? from : [];
  return refs.flatMap(ref => {
    if (!Array.isArray(ref)) return [];
    const [wk, ci] = ref;
    const w = worlds.find(x => x.id === wk);
    const card = w && Number.isInteger(ci) ? w.cards[ci] : undefined;
    if (!card) return [];
    const a = Object.hasOwn(answers, `${wk}:${ci}`) ? answers[`${wk}:${ci}`] : undefined;
    const opts = Array.isArray(card.opts) ? card.opts : [];
    const opt = Number.isInteger(a) ? opts[a as number] : undefined;
    return [`${plain(card.short ?? card.h)}: ${opt == null ? plain(words.skipped) : plain(opt)}`];
  });
}

/** The message Send to chat posts: the deck's intro line ("My Ludify picks:"), then a dash per pick. */
export function picksMessage(worlds: World[], from: unknown, answers: Record<string, unknown>, words: PicksWords): string {
  return [plain(words.intro), ...picksLines(worlds, from, answers, words).map(l => `- ${l}`)].join('\n');
}
