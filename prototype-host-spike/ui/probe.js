// PROTOTYPE — throwaway spike for ticket #6. Connects the deck engine to the host and probes what the iframe can do.
// Every result is shown in the 🧪 panel and sent to the server log through the app-only ludify_probe_report tool.
import { App } from '@modelcontextprotocol/ext-apps/app-with-deps';

const R = {};
const app = new App({ name: 'ludify-spike', version: '0.0.1' });
const hostName = () => app.getHostVersion()?.name || 'unknown-host';

function report(name, value) {
  R[name] = value;
  draw();
  app.callServerTool({ name: 'ludify_probe_report', arguments: { report: { host: hostName(), name, value } } })
    .catch(e => { R['report.error'] = String(e?.message || e); draw(); });
}
const attempt = async (name, fn) => { try { report(name, { ok: true, result: await fn() ?? null }); } catch (e) { report(name, { ok: false, error: String(e?.message || e) }); } };

// ---------- deck ----------
function toFmt(t) {
  return v => t.replace(/\{v(?::(\d))?\}/g, (_, d) => d ? Number(v).toFixed(+d) : Number(v).toLocaleString('en-GB'));
}
let booted = false;
function play(deck, source) {
  if (booted || !deck) return;
  booted = true;
  for (const w of deck.worlds) for (const c of w.cards) if (typeof c.fmt === 'string') c.fmt = toFmt(c.fmt);
  Q.ui = deck.ui; Q.worlds = deck.worlds;
  report('deck.source', source);
  window.__ludifyBoot();
}

app.ontoolinput = ({ arguments: args }) => report('toolinput', { keys: Object.keys(args || {}), bytes: JSON.stringify(args || {}).length });
app.ontoolresult = async result => {
  report('toolresult', { metaKeys: Object.keys(result._meta || {}), structured: result.structuredContent ?? null, isError: !!result.isError });
  if (result._meta?.deck) return play(result._meta.deck, 'result._meta');
  const id = result.structuredContent?.renderId;
  if (id) {
    const r = await app.callServerTool({ name: 'ludify_fetch_deck', arguments: { renderId: id } });
    play(r.structuredContent?.deck, 'ludify_fetch_deck');
  }
};

// Links: the sandbox may block target=_blank, so route them through the host.
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="http"]');
  if (!a) return;
  e.preventDefault();
  attempt('openLink', () => app.openLink({ url: a.href }));
}, true);

// Read-aloud: report whether the engine's 🔊 actually speaks.
if ('speechSynthesis' in window) {
  const speak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = u => {
    u.addEventListener('start', () => report('speech.start', true));
    u.addEventListener('error', ev => report('speech.error', ev.error || 'error'));
    speak(u);
  };
}

// ---------- automatic probes ----------
async function autoProbes() {
  report('host', { version: app.getHostVersion() ?? null, capabilities: app.getHostCapabilities() ?? null, context: app.getHostContext() ?? null });
  report('origin', location.origin);
  try {
    const k = 'ludify-probe:visits';
    const prev = JSON.parse(localStorage.getItem(k) || '[]');
    const now = { at: new Date().toISOString(), tool: app.getHostContext()?.toolInfo?.id ?? null };
    localStorage.setItem(k, JSON.stringify([...prev, now].slice(-20)));
    report('localStorage', { ok: true, earlierVisitsOnThisOrigin: prev.length, previous: prev.slice(-3) });
  } catch (e) { report('localStorage', { ok: false, error: String(e?.message || e) }); }
  const voices = await new Promise(res => {
    if (!('speechSynthesis' in window)) return res(null);
    const v = speechSynthesis.getVoices();
    if (v.length) return res(v.length);
    speechSynthesis.addEventListener('voiceschanged', () => res(speechSynthesis.getVoices().length), { once: true });
    setTimeout(() => res(speechSynthesis.getVoices().length), 1500);
  });
  report('speech', { api: 'speechSynthesis' in window, voices });
  report('downloadCapability', !!app.getHostCapabilities()?.downloadFile);
}

// ---------- manual probes ----------
const html = () => '<!doctype html>' + document.documentElement.outerHTML;
const PROBES = {
  'Ping server tool': () => attempt('callServerTool', async () => (await app.callServerTool({ name: 'ludify_ping', arguments: {} })).structuredContent),
  'Send chat message': () => attempt('sendMessage', () => app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Ludify spike: this message was sent from inside the deck.' }] })),
  'Download (host)': () => attempt('downloadFile', () => app.downloadFile({ contents: [{ type: 'resource', resource: { uri: 'file:///ludify-brief.html', mimeType: 'text/html', text: html() } }] })),
  'Download (<a download>)': () => attempt('anchorDownload', () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([html()], { type: 'text/html' })), download: 'ludify-brief.html' });
    document.body.appendChild(a); a.click(); a.remove();
    return 'clicked (check whether a file arrived)';
  }),
  'Speak test': () => attempt('speakTest', () => { speechSynthesis.speak(new SpeechSynthesisUtterance('Ludify read-aloud test.')); return 'queued'; }),
  'Fullscreen': () => attempt('fullscreen', () => app.requestDisplayMode({ mode: 'fullscreen' })),
  'confirm()': () => attempt('confirm', () => String(confirm('Ludify spike: does confirm() work?'))),
  'Clipboard': () => attempt('clipboard', () => navigator.clipboard.writeText('Ludify spike clipboard test').then(() => 'written')),
  'Open link': () => attempt('openLink', () => app.openLink({ url: 'https://github.com/calindumitru/ludify/issues/6' })),
};

// ---------- panel ----------
const box = document.createElement('div');
box.innerHTML = `<style>
#spk-btn{position:fixed;top:8px;right:8px;z-index:50;font:700 13px system-ui;padding:4px 8px;border-radius:8px;border:1px solid #888;background:#ffd;color:#000}
#spk{position:fixed;inset:44px 8px auto auto;width:min(420px,calc(100vw - 16px));max-height:75vh;overflow:auto;z-index:50;background:#fff;color:#000;border:2px solid #000;border-radius:10px;padding:10px;font:12px ui-monospace,monospace}
#spk button{margin:2px;font:12px system-ui;padding:3px 6px}#spk pre{white-space:pre-wrap;word-break:break-all;margin:6px 0 0}
</style><button id="spk-btn">🧪 Spike</button><div id="spk" hidden><b>PROTOTYPE probes</b><div id="spk-b"></div><pre id="spk-r"></pre></div>`;
document.body.appendChild(box);
document.getElementById('spk-btn').onclick = () => { const p = document.getElementById('spk'); p.hidden = !p.hidden; };
const bar = document.getElementById('spk-b');
for (const [label, fn] of Object.entries(PROBES)) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.appendChild(b); }
function draw() { const r = document.getElementById('spk-r'); if (r) r.textContent = JSON.stringify(R, null, 1); }

// ---------- go ----------
document.getElementById('main').innerHTML = '<p style="padding:2rem">Loading the deck…</p>';
app.connect().then(autoProbes).catch(e => { R.connect = String(e?.message || e); draw(); });
