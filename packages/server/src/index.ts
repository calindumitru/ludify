// The Cloudflare Worker: MCP over Streamable HTTP at /mcp, no auth, no storage.
import { mcpHandler } from './server.ts';

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/mcp') return mcpHandler.fetch(request);
    return new Response('Ludify MCP server. Add https://<this host>/mcp to Claude or ChatGPT as a connector.\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
