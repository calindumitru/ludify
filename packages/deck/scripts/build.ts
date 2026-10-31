// Builds a deck JSON file into one self-contained HTML page.
// Usage: node scripts/build.ts <deck.json> <out.html>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDeck } from '../src/build.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/build.ts <deck.json> <out.html>');
  process.exit(2);
}
const html = await buildDeck(JSON.parse(await readFile(input, 'utf8')));
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`${output}: ${html.length} bytes`);
