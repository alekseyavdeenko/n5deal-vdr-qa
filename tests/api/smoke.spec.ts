import { covers } from '../../src/annotations';
import { config } from '../../src/config';
import { expect, test } from '../../src/fixtures';

/** Post-deploy smoke: is everything reachable and does auth gate the API? Runs in seconds. */
test.describe('smoke @smoke', () => {
  test('SMK-01 API liveness endpoint answers ok', async ({ anonApi }) => {
    const health = await anonApi.call<{ status: string }>('GET', '/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
  });

  test('SMK-02 web app serves the SPA, including deep links (SPA fallback)', covers('TC-07'), async ({ request }) => {
    for (const path of ['/', '/login', '/folder/00000000-0000-4000-8000-000000000000']) {
      const page = await request.get(`${config.webUrl}${path}`);
      expect(page.status(), path).toBe(200);
      expect(await page.text(), path).toContain('<div id="root">');
    }
  });

  test('SMK-03 protected endpoints reject requests without a token', covers('TC-03'), async ({ anonApi }) => {
    for (const [method, path] of [['GET', '/auth/me'], ['GET', '/data-rooms'], ['GET', '/shares/received']] as const) {
      const res = await anonApi.call(method, path);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  test('SMK-04 owner can log in and sees their data room', covers('TC-01'), async ({ ownerApi }) => {
    const me = await ownerApi.me();
    expect(me.status).toBe(200);
    const rooms = await ownerApi.listRooms();
    expect(rooms.status).toBe(200);
    expect(rooms.body.items.length).toBeGreaterThan(0);
  });
});
