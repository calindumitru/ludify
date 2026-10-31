// Markdown-lite: the only way model text becomes markup. Three things are markup:
// **bold**, `code` and [text](https://…). Everything else, HTML included, comes out as text.
// The output is an HTML string in which every character of the input is escaped, and the
// only tags are the <strong>, <code> and <a href="https:…"> this file writes itself.

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text as HTML that shows exactly that text: the string form of `textContent`. */
export const escapeHtml = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ENTITIES[c]);

/** The URL normalised if it is an absolute https: URL, otherwise null. */
export function httpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^https:\/\/[^\s]+$/i.test(raw)) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname ? u.href : null;
  } catch {
    return null;
  }
}

/** An <a> to an https: URL, or the text alone when the URL is anything else. */
export function linkHtml(url: unknown, innerHtml: string): string {
  const href = httpsUrl(url);
  return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${innerHtml}</a>` : innerHtml;
}

type Token =
  | { k: 'text'; v: string }
  | { k: 'code'; v: string }
  | { k: 'stars' }
  | { k: 'link'; label: string; href: string };

// A link's text holds no brackets or line breaks; its URL no spaces or parentheses.
const LINK = /\[([^[\]\n]+)\]\(([^()\s]+)\)/y;

function lex(s: string, links: boolean): Token[] {
  const out: Token[] = [];
  let text = '';
  const flush = () => { if (text) out.push({ k: 'text', v: text }); text = ''; };
  for (let i = 0; i < s.length;) {
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end > i + 1) { flush(); out.push({ k: 'code', v: s.slice(i + 1, end) }); i = end + 1; continue; }
      // `` (empty) or a lone ` stays text; a lone one means no ` follows, so nothing later is code either.
      const n = end === i + 1 ? 2 : 1;
      text += s.slice(i, i + n); i += n; continue;
    }
    if (s[i] === '*' && s[i + 1] === '*') { flush(); out.push({ k: 'stars' }); i += 2; continue; }
    if (s[i] === '[' && links) {
      LINK.lastIndex = i;
      const m = LINK.exec(s);
      const href = m && httpsUrl(m[2]);
      if (m && href) { flush(); out.push({ k: 'link', label: m[1], href }); i = LINK.lastIndex; continue; }
    }
    text += s[i]; i++;
  }
  flush();
  return out;
}

function render(s: string, links: boolean): string {
  const tokens = lex(s, links);
  // ** markers pair up in order: first with second, third with fourth. An empty pair (****) and an
  // odd one out stay text, so a bold can never be left open.
  const stars = tokens.flatMap((t, i) => (t.k === 'stars' ? [i] : []));
  const opens = new Set<number>(), closes = new Set<number>();
  for (let j = 0; j + 1 < stars.length; j += 2) {
    if (stars[j + 1] > stars[j] + 1) { opens.add(stars[j]); closes.add(stars[j + 1]); }
  }
  let html = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.k === 'text') html += escapeHtml(t.v);
    else if (t.k === 'code') html += `<code>${escapeHtml(t.v)}</code>`;
    else if (t.k === 'link') html += linkHtml(t.href, render(t.label, false));
    else html += opens.has(i) ? '<strong>' : closes.has(i) ? '</strong>' : '**';
  }
  return html;
}

/** Model text as safe HTML: **bold**, `code` and [text](https://…) only. */
export const renderMarkdown = (s: unknown): string => render(String(s ?? ''), true);
