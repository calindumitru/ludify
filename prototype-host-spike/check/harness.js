// PROTOTYPE — a fake host for a local smoke test (not a real host; the hosts are what the spike checks).
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
window.calls = [];
window.start = async (html, deck) => {
  const f = document.createElement('iframe'); f.style.cssText = 'width:900px;height:700px'; document.body.appendChild(f);
  const bridge = new AppBridge(null, { name: 'fake-host', version: '0' }, { openLinks: {}, serverTools: {} });
  bridge.oncalltool = async p => { window.calls.push(p); return { content: [{ type: 'text', text: 'ok' }], structuredContent: {} }; };
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: { example: 'adhd' } });
    await bridge.sendToolResult({ content: [{ type: 'text', text: 'x' }], structuredContent: { renderId: 'r1' }, _meta: { deck } });
  };
  await bridge.connect(new PostMessageTransport(f.contentWindow, f.contentWindow));
  f.srcdoc = html;
};
