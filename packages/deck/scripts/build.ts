// Builds a deck JSON file into one self-contained HTML page.
// With --partial, builds what ludify_render plays after a failed retry: the valid cards, with the
// note naming each card left out.
// Usage: node scripts/build.ts [--partial] <deck.json> <out.html>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDeck } from '../src/build.ts';
import { partialDeck, validateDeck } from '../src/validate.ts';

const args = process.argv.slice(2);
const partial = args[0] === '--partial';
const [input, output] = partial ? args.slice(1) : args;
if (!input || !output) {
  console.error('Usage: node scripts/build.ts [--partial] <deck.json> <out.html>');
  process.exit(2);
}
let deck = JSON.parse(await readFile(input, 'utf8'));
if (partial) {
  deck = partialDeck(validateDeck(deck));
  if (!deck) {
    console.error(`${input}: no deck can be played; run scripts/validate.ts on it`);
    process.exit(1);
  }
}
const html = await buildDeck(deck);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`${output}: ${html.length} bytes`);
