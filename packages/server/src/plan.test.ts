import { describe, expect, it } from 'vitest';
import { FIXED, MAX_EXTRAS, planMessage, planText, validatePlan } from './plan.ts';

const choice = { type: 'choice' as const, q: 'Which country are you in?', opts: ['Romania', 'Italy', 'Elsewhere'] };
const text = { type: 'text' as const, q: 'How big is the house, in m²?' };

describe('validatePlan', () => {
  it('takes a topic alone, with no extras', () => {
    expect(validatePlan('Heat pumps', undefined)).toEqual({ ok: true, errors: [], plan: { topic: 'Heat pumps', extras: [] } });
  });

  it('takes up to three extras of either type and trims the text', () => {
    const r = validatePlan('  Heat pumps ', [choice, { ...text, q: ' How big is the house, in m²? ' }, text]);
    expect(r.errors).toEqual([]);
    expect(r.plan?.topic).toBe('Heat pumps');
    expect(r.plan?.extras).toEqual([choice, text, text]);
  });

  it('takes extras sent as a JSON string', () => {
    expect(validatePlan('Heat pumps', JSON.stringify([choice])).plan?.extras).toEqual([choice]);
  });

  it('names each problem exactly, by its place', () => {
    const r = validatePlan('Heat pumps', [
      { type: 'slider', q: 'How warm?' },
      { type: 'choice', q: '', opts: ['Only one'] },
      { type: 'text', q: 'Your <b>budget</b>?', hint: 'x' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([
      'extra 1: `type` must be "choice" or "text".',
      'extra 2: `q` must be a question of 1 to 120 characters.',
      'extra 2: `opts` must list 2 to 6 options.',
      'extra 3: `hint` isn\'t a field of an extra; use only `type`, `q` and, for a choice, `opts`.',
      'extra 3: `q` must be plain text, with no HTML or Markdown.',
    ]);
  });

  it('allows at most three extras', () => {
    expect(validatePlan('Heat pumps', [text, text, text, text]).errors).toEqual([`extras: give at most ${MAX_EXTRAS} questions; this has 4.`]);
  });

  it('rejects extras that are not a list, and a missing topic', () => {
    expect(validatePlan('', { q: 'x' }).errors).toEqual([
      'topic: give the topic in a few words (1 to 200 characters).',
      'extras: must be a JSON list of questions, like [{"type": "text", "q": "Which country are you in?"}].',
    ]);
    expect(validatePlan('Heat pumps', '[not json').errors).toEqual([
      'extras: must be a JSON list of questions, like [{"type": "text", "q": "Which country are you in?"}].',
    ]);
  });

  it('checks each option, and repeats a question the fixed ones already ask', () => {
    const r = validatePlan('Heat pumps', [
      { type: 'choice', q: 'Which kind?', opts: ['Air', 'Air', 42, 'x'.repeat(61)] },
      { type: 'text', q: 'What do you already know?' },
    ]);
    expect(r.errors).toEqual([
      'extra 1: option 2 repeats option 1.',
      'extra 1: option 3 must be plain text of 1 to 60 characters.',
      'extra 1: option 4 must be plain text of 1 to 60 characters.',
      'extra 2: `q` repeats a question the form always asks; ask something about the topic itself.',
    ]);
  });

  it('rejects a text extra with options', () => {
    expect(validatePlan('Heat pumps', [{ ...text, opts: ['a', 'b'] }]).errors).toEqual([
      'extra 1: `opts` is only for a choice; remove it or make `type` "choice".',
    ]);
  });
});

describe('planMessage', () => {
  it('lists every answer under the topic, in the form\'s order', () => {
    const plan = { topic: 'Heat pumps', extras: [choice, text] };
    const msg = planMessage(plan, { deciding: 'Whether to replace\n my gas boiler', depth: 'thorough', know: '', extras: ['Romania', ' 120 '] });
    expect(msg).toBe([
      'My Ludify plan: Heat pumps',
      `- ${FIXED.deciding}: Whether to replace my gas boiler`,
      `- ${FIXED.depth}: thorough`,
      `- ${FIXED.know}: (no answer)`,
      '- Which country are you in?: Romania',
      '- How big is the house, in m²?: 120',
    ].join('\n'));
  });

  it('defaults the depth to quick', () => {
    expect(planMessage({ topic: 'T', extras: [] }, { deciding: 'x', know: 'y', extras: [] })).toContain(`- ${FIXED.depth}: quick`);
  });
});

describe('planText', () => {
  it('gives the questions for a host without the form, and the research method', () => {
    const t = planText({ topic: 'Heat pumps', extras: [choice, text] });
    expect(t).toContain('Heat pumps');
    for (const q of [FIXED.deciding, FIXED.depth, FIXED.know, choice.q, text.q]) expect(t).toContain(q);
    expect(t).toContain('Romania / Italy / Elsewhere');
    expect(t).toMatch(/My Ludify plan/);
    expect(t).toMatch(/primary/);
    expect(t).toMatch(/peer-reviewed/);
    expect(t).toMatch(/ludify_guide/);
    expect(t).toMatch(/quick/);
    expect(t).toMatch(/thorough/);
  });
});
