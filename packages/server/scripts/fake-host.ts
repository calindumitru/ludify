// A stand-in MCP Apps host for scripts/player-check.ts and scripts/form-check.ts: puts a page in an
// iframe, answers its handshake with the official AppBridge under the given host name, then sends
// it a tool result (ludify_render's or ludify_plan's). Runs in the browser (bundled by esbuild);
// it is a test double, not a real host.
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

declare global {
  interface Window {
    opened: string[];
    messages: unknown[];
    startHost(html: string, result: Record<string, unknown>, width: number, name?: string): Promise<void>;
  }
}

window.opened = [];
window.messages = [];
window.startHost = async (html, result, width, name = 'fake-host') => {
  const frame = document.createElement('iframe');
  frame.style.cssText = `width:${width}px;height:760px;border:0`;
  document.body.appendChild(frame);
  const bridge = new AppBridge(null, { name, version: '0' }, { openLinks: {}, message: { text: {} } });
  bridge.onopenlink = async ({ url }) => { window.opened.push(url); return {}; };
  bridge.onmessage = async params => { window.messages.push(params); return {}; };
  bridge.oninitialized = () => { void bridge.sendToolResult(result as never); };
  await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  frame.srcdoc = html;
};
