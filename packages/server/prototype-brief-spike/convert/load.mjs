import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const s = readFileSync('/Users/calin/Projects/funvenio-audience-brief.html', 'utf8');
const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
// content scripts only: those before the renderer (which touches document)
const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
let n = 0;
for (const js of scripts) { if (/document\./.test(js)) break; vm.runInContext(js, ctx); n++; }
writeFileSync(new URL('fb.json', import.meta.url), JSON.stringify(ctx.FB, null, 1));
console.log('ran', n, 'scripts; parts', ctx.FB.parts.length, 'data', Object.keys(ctx.FB.data));
for (const p of ctx.FB.parts) console.log(Object.keys(p).join(','), '|', p.title || p.name, '|', (p.sections||[]).map(x => (x.blocks||[]).map(b=>b.k||b.type||Object.keys(b)[0]).join('/')).join(' ; ').slice(0,300));
