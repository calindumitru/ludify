#!/bin/sh
# PROTOTYPE — the ADHD brief and its engine live in the Owner's private funvenio repo, so they are not
# committed here. Run this from a machine with that repo checked out at ~/Projects/funvenio.
set -e
D=research/adhd-learning-engagement-2026-10-30/brief
B=origin/research/adhd-learning-engagement
mkdir -p decks ui
git -C ~/Projects/funvenio show $B:$D/index.html > ui/engine.html
git -C ~/Projects/funvenio show $B:$D/c-deck.js > /tmp/adhd-c-deck.js
node -e '
const vm=require("vm"),fs=require("fs");
const ctx={Q:{worlds:[],ui:{}}}; ctx.window=ctx;
vm.runInNewContext(fs.readFileSync("/tmp/adhd-c-deck.js","utf8"),ctx);
for(const w of ctx.Q.worlds) for(const c of w.cards) if(typeof c.fmt==="function") c.fmt="g = {v:2}";
fs.writeFileSync("decks/adhd.json",JSON.stringify({ui:ctx.Q.ui,worlds:ctx.Q.worlds},null,1));'
