import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import schema from '@ludify/deck/deck.schema.json' with { type: 'json' };
import { validateDeck } from '@ludify/deck/validate';
import { DEFAULT_UI } from '@ludify/deck/ui';

const guide = await readFile(new URL('../guide.md', import.meta.url), 'utf8');

// The first ```json block after the `## <heading>` line.
function guideBlock(md: string, heading: string): string {
  const at = md.indexOf(`\n## ${heading}\n`);
  if (at < 0) throw new Error(`guide.md has no "## ${heading}" section`);
  const block = /```json\n([\s\S]*?)\n```/.exec(md.slice(at));
  if (!block) throw new Error(`guide.md's "## ${heading}" section has no json block`);
  return block[1];
}

describe('the guide (guide.md)', () => {
  it("embeds the validator's deck schema, unchanged", () => {
    expect(JSON.parse(guideBlock(guide, 'The deck schema')), 'copy packages/deck/deck.schema.json into guide.md').toEqual(schema);
  });

  it("embeds the engine's English strings, unchanged", () => {
    expect(JSON.parse(guideBlock(guide, "The engine's English strings")), 'copy DEFAULT_UI from packages/deck/src/ui.ts into guide.md').toEqual(DEFAULT_UI);
  });

  it('shows a whole quick deck that the validator accepts', () => {
    const result = validateDeck(JSON.parse(guideBlock(guide, 'A whole quick deck')));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('names every card type the schema allows, and every source and grade', () => {
    const d = schema.$defs;
    for (const name of [...d.card.properties.type.enum, ...d.sourceTag.properties.source.enum, ...d.sourceTag.properties.grade.enum])
      expect(guide).toContain(`\`${name}\``);
  });

  it('covers decks from existing research and answering a picks message', () => {
    expect(guide).toMatch(/^## Decks from existing research/m);
    expect(guide).toMatch(/skip `ludify_plan`/);
    expect(guide).toContain('"src": {"notes": true}');
    expect(guide).toMatch(/^## Answering a picks message/m);
  });

  it('keeps the evidence rules: no points, badges or streaks, never "proven for ADHD"', () => {
    expect(guide).toContain('No points, badges or streaks');
    expect(guide).toContain('Never write that something is "proven for ADHD"');
  });
});
