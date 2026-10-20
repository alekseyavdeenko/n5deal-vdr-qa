import { putToSignedUrl } from '../../src/api/client';
import { config } from '../../src/config';
import { makePdf } from '../../src/data/factory';
import { expect, test } from '../../src/fixtures';

/**
 * Confirmed defects (docs/findings.md), written as the behaviour we EXPECT.
 * They are marked test.fail(): today they fail, so the suite stays green; when a fix ships the
 * test starts passing, Playwright reports "expected to fail but passed", and the marker is removed.
 * Contract checks are off here because several bugs produce undocumented responses (e.g. 500).
 */
const issue = (id: string, description: string) => ({ annotation: { type: 'issue', description: `${id}: ${description}` } });

test.describe('known bugs @known-bug', () => {
  test.fail(true, 'Confirmed defect - see the issue annotation and docs/findings.md');

  test('BUG-01 parallel uploads of the same name get distinct names', issue('F-01', 'same-name files in one batch keep duplicate names'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const intents = await Promise.all([1, 2, 3].map(() =>
      api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'batch.pdf', size: 100, mimeType: 'application/pdf' })));
    const names = intents.map((i) => i.body.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('BUG-02 double-creating a public link yields one active link', issue('F-10', 'parallel create-link requests create several active links; UI revoke closes only one'), async ({ ownerApi, testFolder }) => {
    const api = ownerApi.withoutContract();
    await Promise.all([1, 2, 3].map(() => api.sharePublic('FOLDER', testFolder.id)));
    const active = await api.listShares('FOLDER', testFolder.id, 'PUBLIC_LINK');
    expect(active.body.items).toHaveLength(1);
  });

  test('BUG-03 parallel creation of the same folder name creates it once', issue('F-11', 'no uniqueness under concurrency'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => api.createFolder({ name: 'Financials', dataRoomId: roomId, parentId: testFolder.id })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
  });

  test('BUG-04 an abandoned upload does not reserve the file name', issue('F-12', 'pending upload intents reserve names forever'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'ghost.pdf', size: 100, mimeType: 'application/pdf' });
    const real = await api.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'ghost.pdf', bytes: makePdf() });
    expect(real.name).toBe('ghost.pdf');
  });

  test('BUG-05 unknown request fields are rejected instead of silently ignored', issue('F-13', 'typo in move body moves the file to the room root'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'typo.pdf', size: 100, mimeType: 'application/pdf' });
    try {
      const moved = await api.call('PATCH', '/files/{id}/move', { params: { id: intent.body.fileId }, body: { targetFolderID: testFolder.id } });
      expect(moved.status).toBe(400);
    } finally {
      await api.deleteFile(intent.body.fileId); // it may have landed in the room root - outside the run folder
    }
  });

  test('BUG-06 a NUL character in a name is a validation error, not a server crash', issue('F-14', '500 on NUL character'), async ({ ownerApi, roomId, testFolder }) => {
    const res = await ownerApi.withoutContract().createFolder({ name: 'bad\u0000name', dataRoomId: roomId, parentId: testFolder.id });
    expect(res.status).toBe(400);
  });

  test('BUG-07 deleting the same file twice in parallel never returns 5xx', issue('F-14', 'parallel delete -> 500'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'race.pdf', size: 100, mimeType: 'application/pdf' });
    const results = await Promise.all([1, 2, 3].map(() => api.deleteFile(intent.body.fileId)));
    expect(results.map((r) => r.status).filter((s) => s >= 500)).toEqual([]);
  });

  test('BUG-08 completing an upload that never reached storage is a 400', issue('F-14', 'complete before upload -> 500'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'never.pdf', size: 100, mimeType: 'application/pdf' });
    expect((await api.completeUpload(intent.body.fileId)).status).toBe(400);
  });

  test('BUG-09 a file whose content is not a PDF is rejected', issue('F-02', 'server trusts the declared MIME type'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const bytes = Buffer.from('MZ\x90\x00 this is not a PDF');
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'fake.pdf', size: bytes.length, mimeType: 'application/pdf' });
    await putToSignedUrl(intent.body.uploadUrl, bytes);
    expect((await api.completeUpload(intent.body.fileId)).status).toBe(400);
  });

  test('BUG-10 the stored size cannot exceed the size declared (and validated) at intent', issue('F-02', '50 MB limit checked on declared size only'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const bytes = makePdf('x'.repeat(2000));
    const intent = await api.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'liar.pdf', size: 10, mimeType: 'application/pdf' });
    await putToSignedUrl(intent.body.uploadUrl, bytes);
    expect((await api.completeUpload(intent.body.fileId)).status).toBe(400);
  });

  test('BUG-11 bidirectional-override characters are rejected in names', issue('F-03', 'RLO spoofing: invoice\\u202Efdp.exe renders as invoiceexe.pdf'), async ({ ownerApi, roomId, testFolder }) => {
    const res = await ownerApi.withoutContract().createFolder({ name: 'invoice‮fdp.exe', dataRoomId: roomId, parentId: testFolder.id });
    expect(res.status).toBe(400);
  });

  test('BUG-12 rename keeps the .pdf extension', issue('F-04', 'rename can drop or change the extension'), async ({ ownerApi, roomId, testFolder }) => {
    const api = ownerApi.withoutContract();
    const file = await api.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'report.pdf', bytes: makePdf() });
    const renamed = await api.renameFile(file.id, 'report.exe');
    expect(renamed.status === 400 || renamed.body.name.endsWith('.pdf')).toBe(true);
  });

  test('BUG-13 sharing an item with its own owner is rejected', issue('F-05', 'self-share appears in own "Shared with me"'), async ({ ownerApi, testFolder }) => {
    const me = (await ownerApi.me()).body.email;
    const res = await ownerApi.withoutContract().shareUser('FOLDER', testFolder.id, me);
    expect(res.status).toBe(400);
  });

  test('BUG-14 "forbidden" and "does not exist" are indistinguishable', issue('F-17', '404 message reveals whether an id exists'), async ({ ownerApi, viewerApi }) => {
    const ownersFolder = process.env.QA_RUN_FOLDER_ID!;
    const forbidden = await viewerApi.withoutContract().folderContents(ownersFolder);
    const missing = await viewerApi.withoutContract().folderContents('11111111-1111-4111-8111-111111111111');
    void ownerApi;
    expect(forbidden.body).toEqual(missing.body);
  });

  test('BUG-15 the web app cannot be framed by other sites and the API hides its server stack', issue('F-27', 'no clickjacking protection on the web app; API sends X-Powered-By: Express'), async ({ request }) => {
    const web = (await request.get(`${config.webUrl}/`)).headers();
    const framingBlocked = Boolean(web['x-frame-options']) || /frame-ancestors/i.test(web['content-security-policy'] ?? '');
    const api = (await request.get(`${config.apiUrl}/health`)).headers();
    expect({ framingBlocked, poweredBy: api['x-powered-by'] ?? null }).toEqual({ framingBlocked: true, poweredBy: null });
  });
});
