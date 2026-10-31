// PROTOTYPE — builds dist/deck.html: the ADHD brief's engine with the deck script swapped for the host bridge + probes.
import fs from 'node:fs';
import { buildSync } from 'esbuild';
const probe = buildSync({ entryPoints: ['ui/probe.js'], bundle: true, format: 'iife', write: false, minify: true, target: 'es2022' })
  .outputFiles[0].text.replaceAll('</script', '<\\/script');
let html = fs.readFileSync('ui/engine.html', 'utf8');
const swap = (from, to) => { if (!html.includes(from)) throw new Error('engine changed: ' + from); html = html.replace(from, () => to); };
swap('<script src="c-deck.js" charset="utf-8"></script>', `<script>${probe}</script>`);
swap('<script>\n(() => {', '<script>\nwindow.__ludifyBoot = () => {');
const end = html.lastIndexOf('})();\n</script>'); if (end < 0) throw new Error('engine end not found');
html = html.slice(0, end) + '};\n</script>' + html.slice(end + '})();\n</script>'.length);
fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/deck.html', html);
console.log('dist/deck.html', Math.round(html.length / 1024), 'KB');
