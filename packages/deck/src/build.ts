// Builds one self-contained HTML page from a deck: the engine shell, the engine script
// bundled inline, and the deck as a JSON block the engine reads at start.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const src = (name: string) => fileURLToPath(new URL(name, import.meta.url));

let engine: Promise<string> | undefined;
const bundleEngine = async () => {
  const out = await build({ entryPoints: [src('engine.js')], bundle: true, format: 'iife', write: false, target: 'es2022', charset: 'utf8' });
  return out.outputFiles[0].text;
};

// `<` is escaped so no string in the deck can close the script block; JSON.parse reads it back.
const deckJson = (deck: unknown) => JSON.stringify(deck).replace(/</g, '\\u003c');

export async function buildDeck(deck: unknown): Promise<string> {
  engine ??= bundleEngine();
  const [shell, js] = await Promise.all([readFile(src('shell.html'), 'utf8'), engine]);
  return shell.replace('<!--DECK-->', () => deckJson(deck)).replace('<!--ENGINE-->', () => js);
}
