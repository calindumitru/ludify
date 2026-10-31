import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown.ts';

// Parse the renderer's HTML the way a browser would, inside a <div>.
const parse = (s: string) => {
  const box = new JSDOM('<!doctype html><div id="b"></div>').window.document.getElementById('b')!;
  box.innerHTML = renderMarkdown(s);
  return box;
};

// Every element the output holds, as `tag` or `a[href]`, in document order.
const elements = (box: Element) => [...box.querySelectorAll('*')].map(e => (e.tagName === 'A' ? `a[${e.getAttribute('href')}]` : e.tagName.toLowerCase()));

// The issue's rule: nothing but strong, code and a[href^="https:"], and no attributes beyond a link's own.
const onlyAllowed = (box: Element) => {
  for (const e of box.querySelectorAll('*')) {
    expect(['STRONG', 'CODE', 'A'], e.outerHTML).toContain(e.tagName);
    const attrs = [...e.attributes].map(a => a.name).sort();
    if (e.tagName === 'A') {
      expect(attrs).toEqual(['href', 'rel', 'target']);
      expect(e.getAttribute('href')).toMatch(/^https:\/\//);
      expect(e.getAttribute('rel')).toBe('noopener noreferrer');
    } else expect(attrs).toEqual([]);
  }
};

describe('renderMarkdown', () => {
  it('shows plain text as text', () => {
    const box = parse('Fish & chips < 5 > 3 "quoted" \'single\'');
    expect(box.children).toHaveLength(0);
    expect(box.textContent).toBe('Fish & chips < 5 > 3 "quoted" \'single\'');
  });

  it('renders bold, code and https links', () => {
    const box = parse('**Why:** run `npm test`, then read [the table](https://example.org/a?b=1&c=2).');
    expect(elements(box)).toEqual(['strong', 'code', 'a[https://example.org/a?b=1&c=2]']);
    expect(box.textContent).toBe('Why: run npm test, then read the table.');
    onlyAllowed(box);
  });

  it('nests code and links inside bold, and bold inside a link', () => {
    expect(parse('**a `b` [c](https://x.org/) d**').innerHTML)
      .toBe('<strong>a <code>b</code> <a href="https://x.org/" target="_blank" rel="noopener noreferrer">c</a> d</strong>');
    expect(parse('[**big** news](https://x.org/)').innerHTML)
      .toBe('<a href="https://x.org/" target="_blank" rel="noopener noreferrer"><strong>big</strong> news</a>');
  });

  it('keeps code literal: no bold or links inside it', () => {
    const box = parse('`**not bold** [x](https://x.org/)`');
    expect(elements(box)).toEqual(['code']);
    expect(box.textContent).toBe('**not bold** [x](https://x.org/)');
  });

  describe('hostile input comes out as text', () => {
    const cases: [string, string][] = [
      ['<script>alert(1)</script>', '<script>alert(1)</script>'],
      ['<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>'],
      ['<svg/onload=alert(1)>', '<svg/onload=alert(1)>'],
      ['<a href="javascript:alert(1)">x</a>', '<a href="javascript:alert(1)">x</a>'],
      ['[click](javascript:alert(1))', '[click](javascript:alert(1))'],
      ['[click](javascript:alert`1`)', '[click](javascript:alert1)'],
      ['[click](JaVaScRiPt:alert%281%29)', '[click](JaVaScRiPt:alert%281%29)'],
      ['[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)', '[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
      ['[click](http://example.org/)', '[click](http://example.org/)'],
      ['[click](//evil.example/)', '[click](//evil.example/)'],
      ['[click](https:evil.example)', '[click](https:evil.example)'],
      ['[click](https:\\\\evil.example)', '[click](https:\\\\evil.example)'],
      ['[click](vbscript:msgbox)', '[click](vbscript:msgbox)'],
      ['**<b>bold?</b>**', '<b>bold?</b>'],
      ['`<script>alert(1)</script>`', '<script>alert(1)</script>'],
      ['[<img src=x onerror=alert(1)>](https://x.org/)', '<img src=x onerror=alert(1)>'],
      ['&lt;script&gt; &amp;', '&lt;script&gt; &amp;'],
      ['<!-- comment --> <![CDATA[x]]>', '<!-- comment --> <![CDATA[x]]>'],
    ];
    it.each(cases)('%s', (input, text) => {
      const box = parse(input);
      onlyAllowed(box);
      expect(box.querySelectorAll('script, img, svg, iframe, b, [onerror], [onload]')).toHaveLength(0);
      expect(box.textContent).toBe(text);
    });

    it('a link whose URL breaks out of the attribute is still one https link', () => {
      const box = parse('[x](https://x.org/"onmouseover="alert(1))');
      onlyAllowed(box);
      expect(box.querySelectorAll('a')).toHaveLength(0); // the ( in alert(1) ends the URL early: no link
      const box2 = parse('[x](https://x.org/"onmouseover="alert`1`)');
      onlyAllowed(box2);
      expect(elements(box2)).toEqual(['a[https://x.org/%22onmouseover=%22alert%601%60]']);
    });
  });

  describe('nested and unbalanced markers never leave a tag open', () => {
    const cases: [string, string[], string][] = [
      ['**open', [], '**open'],
      ['close**', [], 'close**'],
      ['**a** b**', ['strong'], 'a b**'],
      ['****', [], '****'],
      ['** **', ['strong'], ' '],
      ['**a **b** c**', ['strong', 'strong'], 'a b c'],
      ['`open', [], '`open'],
      ['``', [], '``'],
      ['`a` `b', ['code'], 'a `b'],
      ['[text](https://x.org/', [], '[text](https://x.org/'],
      ['[text]https://x.org/)', [], '[text]https://x.org/)'],
      ['[[x](https://x.org/)]', ['a[https://x.org/]'], '[x]'],
      ['**[a](https://x.org/)', ['a[https://x.org/]'], '**a'],
      ['[**a](https://x.org/)**', ['a[https://x.org/]'], '**a**'],
      ['**`code**`', ['code'], '**code**'],
      ['*single* _under_ ~~strike~~ # head', [], '*single* _under_ ~~strike~~ # head'],
    ];
    it.each(cases)('%s', (input, els, text) => {
      const box = parse(input);
      onlyAllowed(box);
      expect(elements(box)).toEqual(els);
      expect(box.textContent).toBe(text);
    });
  });

  it('treats a missing value as empty and anything else as its text', () => {
    expect(renderMarkdown(undefined)).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(42)).toBe('42');
  });

  it('stays fast on long runs of markers', () => {
    const t = performance.now();
    for (const s of ['**'.repeat(30000) + '*', '['.repeat(60000), '[a'.repeat(30000), '`'.repeat(60000)]) renderMarkdown(s);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});
