import { describe, expect, it } from 'vitest';
import { reward } from './xp.ts';

const why = 'Payoffs come first: the strongest ADHD evidence.';

describe('reward', () => {
  it('gives XP after the explanation of an answered play', () => {
    expect(reward({ type: 'quiz', right: 1, why }, 1)).toEqual({ xp: 20, why: 'whyRight' });
    expect(reward({ type: 'quiz', right: 1, why }, 0)).toEqual({ xp: 5, why: 'whyTried' });
    expect(reward({ type: 'guess', answer: 40, tol: 5, why }, 44)).toEqual({ xp: 25, why: 'whyClose' });
    expect(reward({ type: 'guess', answer: 40, tol: 5, why }, 10)).toEqual({ xp: 10, why: 'whyTried' });
    expect(reward({ type: 'order', why }, 'right')).toEqual({ xp: 20, why: 'whyRight' });
    expect(reward({ type: 'order', why }, 'shown')).toEqual({ xp: 5, why: 'whyTried' });
    expect(reward({ type: 'multi', right: [0, 2], why }, [2, 0])).toEqual({ xp: 20, why: 'whyRight' });
    expect(reward({ type: 'multi', right: [0, 2], why }, [0])).toEqual({ xp: 8, why: 'whyTried' });
    expect(reward({ type: 'decide', after: ['Start with the payoff.', 'Start with a quiz.'] }, 1)).toEqual({ xp: 15, why: 'whyDecide' });
  });

  it('gives none for a card with nothing to explain: reading, or collecting picks', () => {
    expect(reward({ type: 'info' }, undefined)).toBeNull();
    expect(reward({ type: 'big' }, undefined)).toBeNull();
    expect(reward({ type: 'summary', from: [['decide', 0]] }, undefined)).toBeNull();
    expect(reward({ type: 'challenge', why }, 1)).toBeNull();
  });

  it('gives none when the play has no explanation to show', () => {
    expect(reward({ type: 'quiz', right: 0 }, 0)).toBeNull();
    expect(reward({ type: 'quiz', right: 0, why: '  ' }, 0)).toBeNull();
    expect(reward({ type: 'order', why: ['not', 'text'] }, 'right')).toBeNull();
    expect(reward({ type: 'decide', after: ['Start with the payoff.'] }, 1)).toBeNull();
    expect(reward({ type: 'decide', after: ['', 'b'] }, 0)).toBeNull();
  });

  it('gives none before the play is answered', () => {
    expect(reward({ type: 'quiz', right: 0, why }, undefined)).toBeNull();
    expect(reward({ type: 'multi', right: [0], why }, undefined)).toBeNull();
    expect(reward({ type: 'decide', after: ['a'] }, null)).toBeNull();
  });
});
