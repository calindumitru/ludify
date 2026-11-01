import { describe, expect, it } from 'vitest';
import { picksLines, picksMessage } from './picks.ts';

const worlds = [
  { id: 'facts', cards: [{ type: 'info', h: 'A fact' }] },
  {
    id: 'decide',
    cards: [
      { type: 'decide', h: 'When do you get quotes?', short: 'Quotes', opts: ['This month', 'After **insulating**'] },
      { type: 'decide', h: 'Which `type`?', opts: ['Air-source', 'See [the guide](https://example.org)'] },
      { type: 'summary', from: [['decide', 0], ['decide', 1]] },
    ],
  },
];
const from = [['decide', 0], ['decide', 1]];
const words = { intro: 'My Ludify picks:', skipped: '(skipped)' };

describe('picksMessage', () => {
  it("lists each decision's short name and the option chosen, under the intro line", () => {
    expect(picksMessage(worlds, from, { 'decide:0': 1, 'decide:1': 0 }, words))
      .toBe('My Ludify picks:\n- Quotes: After insulating\n- Which type?: Air-source');
  });

  it('keeps a link\'s text and drops its address', () => {
    expect(picksMessage(worlds, [['decide', 1]], { 'decide:1': 1 }, words)).toBe('My Ludify picks:\n- Which type?: See the guide');
  });

  it("says a decision was skipped in the deck's words", () => {
    expect(picksMessage(worlds, from, { 'decide:1': 0 }, { intro: 'Alegerile mele Ludify:', skipped: '(sărit)' }))
      .toBe('Alegerile mele Ludify:\n- Quotes: (sărit)\n- Which type?: Air-source');
  });

  it('leaves out refs that name no card, and ignores prototype keys', () => {
    expect(picksMessage(worlds, [['missing', 9], ['__proto__', 0], '<img>', ['decide', 0]], { 'decide:0': 0 }, words))
      .toBe('My Ludify picks:\n- Quotes: This month');
  });
});

describe('picksLines', () => {
  it('gives the same lines without the intro, for the summary card', () => {
    expect(picksLines(worlds, from, { 'decide:0': 0 }, words)).toEqual(['Quotes: This month', 'Which type?: (skipped)']);
  });
});
