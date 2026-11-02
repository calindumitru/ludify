import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const s = readFileSync('/Users/calin/Projects/funvenio-audience-quest.html', 'utf8');
const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for (const js of scripts) { if (/document\./.test(js)) break; vm.runInContext(js, ctx); }
writeFileSync(new URL('quest.json', import.meta.url), JSON.stringify(ctx.Q, null, 1));
console.log(Object.keys(ctx.Q.ui).join(','));
ctx.Q.worlds.forEach(w => console.log(w.id, w.title, '|', w.cards.map(c => c.type + (c.src ? '' : '(nosrc)')).join(',')));
console.log(JSON.stringify(ctx.Q.worlds[0].cards.slice(0,3)).slice(0,1200));
