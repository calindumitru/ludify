// A stand-in MCP Apps host for scripts/player-check.ts: puts the player page in an iframe, answers
// its handshake with the official AppBridge, then sends it a ludify_render result. Runs in the
// browser (bundled by esbuild); it is a test double, not a real host.
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

declare global {
  interface Window {
    opened: string[];
    startHost(html: string, result: Record<string, unknown>, width: number): Promise<void>;
  }
}

window.opened = [];
window.startHost = async (html, result, width) => {
  const frame = document.createElement('iframe');
  frame.style.cssText = `width:${width}px;height:760px;border:0`;
  document.body.appendChild(frame);
  const bridge = new AppBridge(null, { name: 'fake-host', version: '0' }, { openLinks: {} });
  bridge.onopenlink = async ({ url }) => { window.opened.push(url); return {}; };
  bridge.oninitialized = () => { void bridge.sendToolResult(result as never); };
  await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  frame.srcdoc = html;
};
