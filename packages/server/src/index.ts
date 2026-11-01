// The Cloudflare Worker: MCP over Streamable HTTP at /mcp, no auth, no storage.
import { mcpHandler } from './server.ts';

// COMMIT is the commit the deploy job shipped (`wrangler deploy --var COMMIT:<sha>`); unset in
// `wrangler dev` and the tests.
export interface Env {
  COMMIT?: string;
}

export default {
  async fetch(request: Request, env: Env = {}): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/mcp') return mcpHandler.fetch(request);
    if (pathname === '/version') {
      return Response.json({ commit: env.COMMIT || null }, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    return new Response('Ludify MCP server. Add https://<this host>/mcp to Claude or ChatGPT as a connector.\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
