import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../src/config';
import { expect, test } from '../../src/fixtures';

/**
 * Contract layer of the pyramid. The committed snapshot (docs/reference/openapi.json) is what
 * every API test validates responses against; this test fails when the deployed API documents
 * something different, so the team reviews the change instead of the suite silently drifting.
 * Refresh the snapshot with: curl -s $API_URL/docs-json -o docs/reference/openapi.json
 */
test.describe('OpenAPI contract @contract', () => {
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/reference/openapi.json'), 'utf8'));

  test('deployed API publishes the same endpoints as the committed snapshot', async ({ request }) => {
    const live = await (await request.get(`${config.apiUrl}/docs-json`)).json();
    const ops = (doc: typeof snapshot) =>
      Object.entries(doc.paths as Record<string, object>).flatMap(([p, methods]) => Object.keys(methods).map((m) => `${m.toUpperCase()} ${p}`)).sort();
    expect(ops(live)).toEqual(ops(snapshot));
  });

  test('deployed API publishes the same schemas as the committed snapshot', async ({ request }) => {
    const live = await (await request.get(`${config.apiUrl}/docs-json`)).json();
    expect(live.components.schemas).toEqual(snapshot.components.schemas);
  });

  test('every documented operation declares its success response', async () => {
    const missing: string[] = [];
    for (const [p, methods] of Object.entries(snapshot.paths as Record<string, Record<string, { responses: object }>>)) {
      for (const [m, op] of Object.entries(methods)) {
        if (!Object.keys(op.responses).some((code) => code.startsWith('2'))) missing.push(`${m.toUpperCase()} ${p}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
