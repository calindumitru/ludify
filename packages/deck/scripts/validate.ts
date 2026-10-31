// Validates a deck file and prints the result: node scripts/validate.ts <deck.json>
// Exits 1 when the deck has errors.
import { readFile } from 'node:fs/promises';
import { validateDeck } from '../src/validate.ts';

const [file] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/validate.ts <deck.json>');
  process.exit(2);
}
const result = validateDeck(await readFile(file, 'utf8'));
for (const error of result.errors) console.log(error);
const cards = result.deck?.worlds.reduce((n, w) => n + w.cards.length, 0);
console.log(result.ok ? `OK: ${cards} cards.` : `${result.errors.length} errors; ${result.deck ? `plays ${cards} cards, skips ${result.skipped.length}` : 'no deck to play'}.`);
process.exit(result.ok ? 0 : 1);
