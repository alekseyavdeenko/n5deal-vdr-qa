import { BUG_CHECK, knownBug } from '../../src/annotations';
import { putToSignedUrl, type ApiClient } from '../../src/api/client';
import { config } from '../../src/config';
import { makePdf } from '../../src/data/factory';
import { expect, test } from '../../src/fixtures';

/**
 * Confirmed defects (docs/findings.md), written as the behaviour we EXPECT.
 * They are marked test.fail(): today they fail, so the suite stays green; when a fix ships the
 * test starts passing, Playwright reports "expected to fail but passed", and the marker is removed.
 * The assertion that checks the bug itself carries BUG_CHECK, so the known-bugs reporter can tell
 * "the bug is still there" from "the test broke for another reason".
 * Contract checks are off here because several bugs produce undocumented responses (e.g. 500).
 */

/** Race bugs need requests to collide. 10 parallel requests, up to 3 tries, stop as soon as the bug shows. */
const RACE_REQUESTS = 10;
const RACE_ATTEMPTS = 3;

async function newFolder(api: ApiClient, roomId: string, parentId: string, name: string): Promise<string> {
  const res = await api.createFolder({ name, dataRoomId: roomId, parentId });
  expect(res.status, `create folder ${name}`).toBe(201);
  return res.body.id;
}

test.describe('known bugs @known-bug', () => {
  test.fail(true, 'Confirmed defect - see the issue annotation and docs/findings.md');

  test('BUG-01 parallel uploads of the same name get distinct names', knownBug('F-01', 'same-name files in one batch keep duplicate names', 'TC-32'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    let names: string[] = [];
    for (let attempt = 1; attempt <= RACE_ATTEMPTS; attempt += 1) {
      const intents = await Promise.all(Array.from({ length: RACE_REQUESTS }, () =>
        api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: `batch-${attempt}.pdf`, size: 100, mimeType: 'application/pdf' })));
      names = intents.map((i) => i.body.name);
      if (new Set(names).size < names.length) break; // the race happened
    }
    expect(new Set(names).size, BUG_CHECK).toBe(names.length);
  });

  test('BUG-02 double-creating a public link yields one active link', knownBug('F-10', 'parallel create-link requests create several active links; UI revoke closes only one', 'TC-74'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    let active = 0;
    for (let attempt = 1; attempt <= RACE_ATTEMPTS; attempt += 1) {
      const folderId = await newFolder(api, roomId, testFolder.id, `links-${attempt}`); // a fresh folder: an existing link would be reused
      await Promise.all(Array.from({ length: RACE_REQUESTS }, () => api.sharePublic('FOLDER', folderId)));
      active = (await api.listShares('FOLDER', folderId, 'PUBLIC_LINK')).body.items.length;
      if (active > 1) break;
    }
    expect(active, `${BUG_CHECK}: active public links of one folder`).toBe(1);
  });

  test('BUG-03 parallel creation of the same folder name creates it once', knownBug('F-11', 'no uniqueness under concurrency', 'TC-21'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    let created = 0;
    for (let attempt = 1; attempt <= RACE_ATTEMPTS; attempt += 1) {
      const results = await Promise.all(Array.from({ length: RACE_REQUESTS }, () =>
        api.createFolder({ name: `Financials-${attempt}`, dataRoomId: roomId, parentId: testFolder.id })));
      created = results.filter((r) => r.status === 201).length;
      if (created > 1) break;
    }
    expect(created, `${BUG_CHECK}: folders created from ${RACE_REQUESTS} parallel requests`).toBe(1);
  });

  test('BUG-04 an abandoned upload does not reserve the file name', knownBug('F-12', 'pending upload intents reserve names forever', 'TC-46'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'ghost.pdf', size: 100, mimeType: 'application/pdf' });
    const real = await api.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'ghost.pdf', bytes: makePdf() });
    expect(real.name, BUG_CHECK).toBe('ghost.pdf');
  });

  test('BUG-05 unknown request fields are rejected instead of silently ignored', knownBug('F-13', 'typo in move body moves the file to the room root'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'typo.pdf', size: 100, mimeType: 'application/pdf' });
    try {
      const moved = await api.call('PATCH', '/files/{id}/move', { params: { id: intent.body.fileId }, body: { targetFolderID: testFolder.id } });
      expect(moved.status, BUG_CHECK).toBe(400);
    } finally {
      await api.deleteFile(intent.body.fileId); // it may have landed in the room root - outside the run folder
    }
  });

  test('BUG-06 a NUL character in a name is a validation error, not a server crash', knownBug('F-14', '500 on NUL character', 'TC-17'), async ({ ownerApi, roomId, testFolder }) => {
    const res = await ownerApi.withoutContract().createFolder({ name: 'bad\u0000name', dataRoomId: roomId, parentId: testFolder.id });
    expect(res.status, BUG_CHECK).toBe(400);
  });

  test('BUG-07 deleting the same file twice in parallel never returns 5xx', knownBug('F-14', 'parallel delete -> 500'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'race.pdf', size: 100, mimeType: 'application/pdf' });
    const results = await Promise.all([1, 2, 3].map(() => api.deleteFile(intent.body.fileId)));
    expect(results.map((r) => r.status).filter((s) => s >= 500), `${BUG_CHECK}: 5xx answers`).toHaveLength(0);
  });

  test('BUG-08 completing an upload that never reached storage is a 400', knownBug('F-14', 'complete before upload -> 500'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'never.pdf', size: 100, mimeType: 'application/pdf' });
    expect((await api.completeUpload(intent.body.fileId)).status, BUG_CHECK).toBe(400);
  });

  test('BUG-09 a file whose content is not a PDF is rejected', knownBug('F-02', 'server trusts the declared MIME type', 'TC-37'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const bytes = Buffer.from('MZ\x90\x00 this is not a PDF');
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'fake.pdf', size: bytes.length, mimeType: 'application/pdf' });
    await putToSignedUrl(intent.body.uploadUrl, bytes);
    expect((await api.completeUpload(intent.body.fileId)).status, BUG_CHECK).toBe(400);
  });

  test('BUG-10 the stored size cannot exceed the size declared (and validated) at intent', knownBug('F-02', '50 MB limit checked on declared size only', 'TC-38'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const bytes = makePdf('x'.repeat(2000));
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'liar.pdf', size: 10, mimeType: 'application/pdf' });
    await putToSignedUrl(intent.body.uploadUrl, bytes);
    expect((await api.completeUpload(intent.body.fileId)).status, BUG_CHECK).toBe(400);
  });

  test('BUG-11 bidirectional-override characters are rejected in names', knownBug('F-03', 'RLO spoofing: invoice\\u202Efdp.exe renders as invoiceexe.pdf', 'TC-16'), async ({ ownerApi, roomId, testFolder }) => {
    const res = await ownerApi.withoutContract().createFolder({ name: 'invoice‮fdp.exe', dataRoomId: roomId, parentId: testFolder.id });
    expect(res.status, BUG_CHECK).toBe(400);
  });

  test('BUG-12 rename keeps the .pdf extension', knownBug('F-04', 'rename can drop or change the extension', 'TC-43'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const file = await api.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'report.pdf', bytes: makePdf() });
    const renamed = await api.renameFile(file.id, 'report.exe');
    const outcome = renamed.status === 400 ? 'rejected' : renamed.body.name; // either is correct behaviour
    expect(outcome, `${BUG_CHECK}: rename report.pdf -> report.exe`).toMatch(/^rejected$|\.pdf$/);
  });

  test('BUG-13 sharing an item with its own owner is rejected', knownBug('F-05', 'self-share appears in own "Shared with me"', 'TC-60'), async ({ ownerApi, testFolder }) => {
    const api = ownerApi.withoutContract();
    const me = (await api.me()).body.email;
    const res = await api.shareUser('FOLDER', testFolder.id, me);
    try {
      expect(res.status, BUG_CHECK).toBe(400);
    } finally {
      if (res.status === 201) await api.revokeShare(res.body.id); // leave nothing in the owner's "Shared with me"
    }
  });

  test('BUG-14 "forbidden" and "does not exist" are indistinguishable', knownBug('F-17', '404 message reveals whether an id exists', 'TC-62'), async ({ viewerApi, testFolder }) => {
    const api = viewerApi.withoutContract();
    const forbidden = await api.folderContents(testFolder.id); // exists, but belongs to the owner
    const missing = await api.folderContents('11111111-1111-4111-8111-111111111111');
    expect(forbidden.body.message, BUG_CHECK).toBe(missing.body.message);
  });

  test('BUG-15 the web app cannot be framed by other sites and the API hides its server stack', knownBug('F-27', 'no clickjacking protection on the web app; API sends X-Powered-By: Express', 'TC-111'), async ({ request }) => {
    const web = (await request.get(`${config.webUrl}/`)).headers();
    const framingBlocked = Boolean(web['x-frame-options']) || /frame-ancestors/i.test(web['content-security-policy'] ?? '');
    const poweredBy = (await request.get(`${config.apiUrl}/health`)).headers()['x-powered-by'] ?? 'none';
    expect(`framing blocked: ${framingBlocked}, X-Powered-By: ${poweredBy}`, BUG_CHECK).toBe('framing blocked: true, X-Powered-By: none');
  });
});
