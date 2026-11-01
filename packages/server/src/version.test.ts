import { describe, expect, it } from 'vitest';
import worker from './index.ts';

// The deploy job passes the merged commit as the COMMIT var (`wrangler deploy --var COMMIT:<sha>`).
const sha = '2db5a07c0ffee2db5a07c0ffee2db5a07c0ffee2';

describe('/version', () => {
  it('shows the deployed commit', async () => {
    const res = await worker.fetch(new Request('http://ludify.test/version'), { COMMIT: sha });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ commit: sha });
  });

  it('shows null when no commit was passed in (wrangler dev, a hand deploy)', async () => {
    for (const env of [undefined, {}, { COMMIT: '' }]) {
      const res = await worker.fetch(new Request('http://ludify.test/version'), env);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ commit: null });
    }
  });

  it('answers only at /version exactly', async () => {
    for (const path of ['/version/', '/versions', '/version.json', '/mcp/version']) {
      const res = await worker.fetch(new Request(`http://ludify.test${path}`), { COMMIT: sha });
      expect(await res.text()).not.toContain(sha);
    }
  });
});
