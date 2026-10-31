import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildDeck } from './build.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '..');
const example = JSON.parse(await readFile(path.resolve(pkg, '../../examples/adhd-learning-deck.json'), 'utf8'));

// Read back the deck the way the engine does: the text of <script type="application/json" id="deck">.
const deckIn = (html: string) => {
  const m = html.match(/<script type="application\/json" id="deck">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no deck block');
  return JSON.parse(m[1]);
};

// Built from parts so this file does not match its own scan. Playwright's `$eval` is a page query, not eval.
const CODE_FROM_TEXT = new RegExp(['(?<!\\$)\\bev' + 'al\\s*\\(', '\\bnew\\s+Func' + 'tion\\b', '\\bFunc' + 'tion\\s*\\('].join('|'));

describe('buildDeck', () => {
  it('embeds the deck as JSON the page can read back unchanged', async () => {
    const html = await buildDeck(example);
    expect(deckIn(html)).toEqual(example);
  });

  it('writes one self-contained page: the engine inline, no script files to fetch', async () => {
    const html = await buildDeck(example);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).toContain('formatValue');
  });

  it('keeps deck text from closing the script block', async () => {
    const deck = { ...example, ui: { ...example.ui, title: '</script><script>alert(1)</script>' } };
    const html = await buildDeck(deck);
    expect(html.match(/<script/g)).toHaveLength((await buildDeck(example)).match(/<script/g)!.length);
    expect(deckIn(html).ui.title).toBe('</script><script>alert(1)</script>');
  });

  it('builds a page with no code-from-text calls in it', async () => {
    expect(await buildDeck(example)).not.toMatch(CODE_FROM_TEXT);
  });
});

describe('packages/deck source', () => {
  it('calls neither eval nor the Function constructor anywhere', async () => {
    const files = (await readdir(pkg, { recursive: true }))
      .filter(f => !f.startsWith('node_modules') && !f.startsWith('dist') && /\.(ts|js|mjs|html)$/.test(f));
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) expect(await readFile(path.join(pkg, f), 'utf8'), f).not.toMatch(CODE_FROM_TEXT);
  });

  it('names none of the rewards the evidence rules out (issue #34)', async () => {
    // Built from parts so this file does not match its own scan; the validator's tests name the old world field to turn it down.
    const rewards = new RegExp(['bad' + 'ge', 'tro' + 'phy', 'me' + 'dal', 'con' + 'fetti'].join('|'), 'i');
    const files = (await readdir(pkg, { recursive: true }))
      .filter(f => !f.startsWith('node_modules') && !f.startsWith('dist') && /\.(ts|js|html|json|md)$/.test(f) && f !== path.join('src', 'validate.test.ts'));
    expect(files.length).toBeGreaterThan(10);
    const hits: string[] = [];
    for (const f of files) if (rewards.test(await readFile(path.join(pkg, f), 'utf8'))) hits.push(f);
    expect(hits).toEqual([]);
  });
});
