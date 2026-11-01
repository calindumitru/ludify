// ludify_plan's logic: the narrowing form's questions, the check on the model's topic-specific
// `extras`, the answers message the form posts to the chat, and the text fallback with the research
// method. Plain functions, no host or server code, so the form's page bundles this file too.

/** The three questions the narrowing form always asks. */
export const FIXED = {
  deciding: 'What are you deciding?',
  depth: 'How deep should it go?',
  know: 'What do you already know?',
} as const;

export const DEPTHS = {
  quick: 'Quick: 2 worlds, about 12 cards, a lighter search',
  thorough: 'Thorough: 4 worlds, 25 to 30 cards, a wider search with more primary sources',
} as const;
export type Depth = keyof typeof DEPTHS;

export const MAX_EXTRAS = 3;
const MAX_TOPIC = 200;
const MAX_Q = 120;
const MAX_OPT = 60;
const OPTS = [2, 6] as const;

export type Extra = { type: 'choice'; q: string; opts: string[] } | { type: 'text'; q: string };
export type Plan = { topic: string; extras: Extra[] };
export type PlanResult = { ok: boolean; errors: string[]; plan: Plan | null };
export type Answers = { deciding: string; depth?: Depth; know: string; extras: string[] };

const LIST_EXAMPLE = 'must be a JSON list of questions, like [{"type": "text", "q": "Which country are you in?"}].';
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
// The form shows every string as text, so markup would show as typed: HTML tags and the Markdown
// marks a deck allows are turned away instead.
const marked = (s: string) => /<[a-z!/]|\*\*|`|\]\(/i.test(s);
const fits = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max && !/[\n\r]/.test(v);
const same = (a: string, b: string) => a.trim().toLowerCase().replace(/[?.!]+$/, '') === b.toLowerCase().replace(/[?.!]+$/, '');

function checkExtra(x: unknown, n: number, errors: string[]): Extra | null {
  const at = `extra ${n}`;
  if (!isObject(x)) { errors.push(`${at}: must be an object with \`type\` and \`q\`.`); return null; }
  const before = errors.length;
  for (const k of Object.keys(x))
    if (!['type', 'q', 'opts'].includes(k)) errors.push(`${at}: \`${k}\` isn't a field of an extra; use only \`type\`, \`q\` and, for a choice, \`opts\`.`);
  if (x.type !== 'choice' && x.type !== 'text') errors.push(`${at}: \`type\` must be "choice" or "text".`);
  if (!fits(x.q, MAX_Q)) errors.push(`${at}: \`q\` must be a question of 1 to ${MAX_Q} characters.`);
  else if (marked(x.q)) errors.push(`${at}: \`q\` must be plain text, with no HTML or Markdown.`);
  else if (Object.values(FIXED).some(f => same(x.q as string, f))) errors.push(`${at}: \`q\` repeats a question the form always asks; ask something about the topic itself.`);
  if (x.type === 'choice') {
    const opts = x.opts;
    if (!Array.isArray(opts) || opts.length < OPTS[0] || opts.length > OPTS[1]) errors.push(`${at}: \`opts\` must list ${OPTS[0]} to ${OPTS[1]} options.`);
    else opts.forEach((o, i) => {
      if (!fits(o, MAX_OPT) || marked(o)) errors.push(`${at}: option ${i + 1} must be plain text of 1 to ${MAX_OPT} characters.`);
      else {
        const first = opts.findIndex(p => typeof p === 'string' && same(p, o.trim()));
        if (first < i) errors.push(`${at}: option ${i + 1} repeats option ${first + 1}.`);
      }
    });
  } else if (x.type === 'text' && 'opts' in x) errors.push(`${at}: \`opts\` is only for a choice; remove it or make \`type\` "choice".`);
  if (errors.length > before) return null;
  const q = (x.q as string).trim();
  return x.type === 'choice' ? { type: 'choice', q, opts: (x.opts as string[]).map(o => o.trim()) } : { type: 'text', q };
}

/** Checks ludify_plan's input like a deck: every problem as one sentence the model can act on. */
export function validatePlan(topic: unknown, extras: unknown): PlanResult {
  const errors: string[] = [];
  if (!fits(topic, MAX_TOPIC)) errors.push(`topic: give the topic in a few words (1 to ${MAX_TOPIC} characters).`);
  let list: unknown = extras ?? [];
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = null; }
  }
  const out: Extra[] = [];
  if (!Array.isArray(list)) errors.push(`extras: ${LIST_EXAMPLE}`);
  else if (list.length > MAX_EXTRAS) errors.push(`extras: give at most ${MAX_EXTRAS} questions; this has ${list.length}.`);
  else list.forEach((x, i) => { const e = checkExtra(x, i + 1, errors); if (e) out.push(e); });
  return errors.length
    ? { ok: false, errors, plan: null }
    : { ok: true, errors, plan: { topic: (topic as string).trim(), extras: out } };
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The message the form posts to the chat: the topic, then one line per question with its answer. */
export function planMessage(plan: Plan, answers: Answers): string {
  const a = (s: string | undefined) => oneLine(s ?? '') || '(no answer)';
  return [
    `My Ludify plan: ${plan.topic}`,
    `- ${FIXED.deciding}: ${a(answers.deciding)}`,
    `- ${FIXED.depth}: ${answers.depth ?? 'quick'}`,
    `- ${FIXED.know}: ${a(answers.know)}`,
    ...plan.extras.map((x, i) => `- ${x.q}: ${a(answers.extras[i])}`),
  ].join('\n');
}

/** What the model reads: how the form works, the same questions for a host that can't show it,
 * and the research method. */
export function planText(plan: Plan): string {
  const qs = [
    `${FIXED.deciding} (a sentence)`,
    `${FIXED.depth} ${DEPTHS.quick}; or ${DEPTHS.thorough}.`,
    `${FIXED.know} (a sentence, or nothing)`,
    ...plan.extras.map(x => x.type === 'choice' ? `${x.q} (${x.opts.join(' / ')})` : x.q),
  ];
  return `The narrowing form for "${plan.topic}" is showing. When the user submits it, their answers arrive as a message that starts "My Ludify plan:". Wait for it; don't research before the answers arrive.

If the form doesn't show (some hosts, such as mobile apps, can't show it) or the user answers in the chat instead, ask these questions in one short message, in the user's language, and wait for the answers:
${qs.map((q, i) => `${i + 1}. ${q}`).join('\n')}

The research method, once you have the answers:
- Scope: research what the user is deciding, at the depth they chose (quick if they didn't say), skipping what they already know, and fitting their answers to the topic questions.
- Search: the options they are choosing between, what each costs and what it leads to, the evidence on the effects that matter for the decision, and the common beliefs the evidence doesn't support. A thorough deck searches wider and reads more primary sources.
- Sources: prefer primary ones (official bodies, regulators, makers' specifications, the study itself) and peer-reviewed research, then reviews of that research. Treat vendor and marketing claims as claims. Note the source and its link for every number and fact you will use.
- Gaps: keep a list of what the evidence can't settle, what stays unverified and what depends on the user's own situation; the deck ends on it.
- Then call ludify_guide right before you write the deck, and write it to that manual.`;
}
