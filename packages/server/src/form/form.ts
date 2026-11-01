// The narrowing form, inside the host's iframe: connects to the host (MCP Apps), waits for
// ludify_plan's result, builds the form from it and posts the answers to the chat as the user's
// message. Every string from the model is set as text, never as markup.
import { App } from '@modelcontextprotocol/ext-apps/app-with-deps';
import { fillsComposer } from '../host.ts';
import { DEPTHS, FIXED, planMessage, type Depth, type Extra, type Plan } from '../plan.ts';

const WORDS = {
  kicker: 'Ludify · before the research',
  lead: 'A few questions so the research fits your decision. Skip any you like.',
  submit: 'Start the research',
  composerNote: 'This puts your answers in your message box; press Enter there to send them.',
  sent: 'Sent to the chat ✓',
  sendEnter: "It's in your message box: press Enter to send. Claude may show a safety warning first; it's only your answers.",
  sendFailed: "Couldn't send it. Try again, or copy this into the chat:",
  loading: 'Loading the questions…',
  noHost: 'This page shows Ludify\'s questions inside Claude or ChatGPT.',
  noPlan: 'No questions arrived.',
  badPlan: 'These questions had problems, so they are not shown. The assistant will fix them and try again.',
};

const app = new App({ name: 'ludify-form', version: '1' });
const main = document.getElementById('main')!;
let started = false;

type Attrs = Record<string, string | boolean>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) e.setAttribute(k, '');
    else if (v !== false) e.setAttribute(k, v);
  }
  e.append(...kids);
  return e;
}

const say = (text: string) => main.replaceChildren(el('p', { class: 'say' }, text));

const textQ = (id: string, q: string, multi: boolean) => el('div', { class: 'q' },
  el('label', { for: id }, q),
  multi ? el('textarea', { id, name: id, rows: '2', maxlength: '500' }) : el('input', { id, name: id, type: 'text', maxlength: '200', autocomplete: 'off' }));

const choiceQ = (name: string, q: string, opts: [string, string][], checked?: string) => el('fieldset', { class: 'q' },
  el('legend', {}, q),
  el('div', { class: 'opts' }, ...opts.map(([value, label]) =>
    el('label', { class: 'opt' }, el('input', { type: 'radio', name, value, checked: value === checked }), el('span', {}, label)))));

const extraQ = (x: Extra, i: number) => x.type === 'choice'
  ? choiceQ(`x${i}`, x.q, x.opts.map(o => [o, o]))
  : textQ(`x${i}`, x.q, false);

function show(plan: Plan, composer: boolean) {
  const send = el('button', { class: 'go', type: 'submit' }, WORDS.submit);
  const status = el('p', { class: 'sent', id: 'sent', 'aria-live': 'polite' });
  const copy = el('pre', { class: 'copy', id: 'copy', hidden: true });
  const form = el('form', { id: 'form', 'aria-labelledby': 'topic' },
    textQ('deciding', FIXED.deciding, true),
    choiceQ('depth', FIXED.depth, Object.entries(DEPTHS), 'quick'),
    textQ('know', FIXED.know, true),
    ...plan.extras.map(extraQ),
    el('div', { class: 'send' }, send, composer ? el('p', { class: 'note', id: 'note' }, WORDS.composerNote) : '', status, copy));
  main.replaceChildren(
    el('p', { class: 'kicker' }, WORDS.kicker),
    el('h1', { id: 'topic' }, plan.topic),
    el('p', { class: 'lead' }, WORDS.lead),
    form);

  // Enter in a one-line answer moves on rather than sending the form half filled.
  form.addEventListener('keydown', e => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || !(t instanceof HTMLInputElement) || t.type !== 'text') return;
    e.preventDefault();
    const fields = [...form.querySelectorAll<HTMLElement>('textarea, input, button')];
    fields[fields.indexOf(t) + 1]?.focus();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(form);
    const val = (k: string) => String(data.get(k) ?? '');
    const text = planMessage(plan, {
      deciding: val('deciding'),
      depth: (val('depth') || 'quick') as Depth,
      know: val('know'),
      extras: plan.extras.map((_, i) => val(`x${i}`)),
    });
    send.disabled = true;
    status.textContent = '';
    copy.hidden = true;
    const failed = () => { status.textContent = WORDS.sendFailed; copy.textContent = text; copy.hidden = false; };
    app.sendMessage({ role: 'user', content: [{ type: 'text', text }] })
      .then(r => { if (r?.isError) failed(); else status.textContent = composer ? WORDS.sendEnter : WORDS.sent; }, failed)
      .finally(() => { send.disabled = false; });
  });
}

app.ontoolresult = result => {
  if (started) return;
  const plan = (result._meta as { plan?: Plan } | undefined)?.plan;
  if (result.isError || !plan) { say(result.isError ? WORDS.badPlan : WORDS.noPlan); return; }
  started = true;
  show(plan, fillsComposer(app));
};

say(WORDS.loading);
app.connect().catch(() => say(WORDS.noHost));
