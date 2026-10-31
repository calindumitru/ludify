// Runs inside the host's iframe, before the deck engine. It connects to the host (MCP Apps), waits
// for ludify_render's result, puts the deck into the page's JSON block and starts the engine.
// The deck is data: it reaches the engine only as JSON text, never as markup or code.
import { App } from '@modelcontextprotocol/ext-apps/app-with-deps';

declare global {
  interface Window {
    ludifyBoot?: () => void;
    ludifyHost?: { openLink(url: string): unknown };
  }
}

const app = new App({ name: 'ludify-player', version: '1' });
let started = false;

const say = (text: string) => {
  const main = document.getElementById('main');
  if (!main) return;
  const p = document.createElement('p');
  p.style.cssText = 'padding:2rem 1rem;text-align:center;opacity:.7';
  p.textContent = text;
  main.replaceChildren(p);
};

app.ontoolresult = result => {
  if (started) return;
  const deck = (result._meta as { deck?: unknown } | undefined)?.deck;
  if (result.isError || !deck) {
    say(result.isError ? 'This deck had problems, so it is not shown. The assistant will fix it and try again.' : 'No deck arrived.');
    return;
  }
  started = true;
  document.getElementById('deck')!.textContent = JSON.stringify(deck);
  window.ludifyHost = { openLink: url => app.openLink({ url }) };
  window.ludifyBoot!();
};

say('Loading the deck…');
app.connect().catch(() => say('This page plays a Ludify deck inside Claude or ChatGPT.'));
