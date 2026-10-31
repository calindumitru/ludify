// XP only ever follows an explanation (SPEC §6, evidence.md row 15): a play earns it once the
// reader has answered and the card shows why. Reading a card, reaching the summary or finishing a
// world earns nothing.

export type Why = 'whyRight' | 'whyTried' | 'whyClose' | 'whyDecide';
export type Reward = { xp: number; why: Why };

const isText = (x: unknown) => typeof x === 'string' && x.trim() !== '';
const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const of = (right: boolean, hit: number, miss: number): Reward =>
  (right ? { xp: hit, why: 'whyRight' } : { xp: miss, why: 'whyTried' });

/**
 * The XP for an answered play, given only when the card has an explanation to show with the
 * feedback: `why` on quiz, guess, order and multi, the picked option's `after` text on decide.
 * Null for any other card, an unanswered play, or a play with nothing to explain.
 */
export function reward(card: Record<string, unknown>, answer: unknown): Reward | null {
  if (answer == null) return null;
  switch (card.type) {
    case 'quiz':
      return isText(card.why) ? of(answer === card.right, 20, 5) : null;
    case 'guess': {
      if (!isText(card.why)) return null;
      const close = Math.abs(num(answer) - num(card.answer)) <= num(card.tol);
      return close ? { xp: 25, why: 'whyClose' } : { xp: 10, why: 'whyTried' };
    }
    case 'order':
      return isText(card.why) ? of(answer === 'right', 20, 5) : null;
    case 'multi': {
      if (!isText(card.why) || !Array.isArray(answer)) return null;
      const right = Array.isArray(card.right) ? card.right : [];
      return of(answer.length === right.length && answer.every(i => right.includes(i)), 20, 8);
    }
    case 'decide': {
      const after = Array.isArray(card.after) ? card.after : [];
      return Number.isInteger(answer) && isText(after[answer as number]) ? { xp: 15, why: 'whyDecide' } : null;
    }
    default:
      return null;
  }
}
