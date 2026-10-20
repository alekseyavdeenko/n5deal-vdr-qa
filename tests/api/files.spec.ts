import { errorMessage } from '../../src/api/client';
import { makePdf } from '../../src/data/factory';
import { expect, test } from '../../src/fixtures';

test.describe('files', () => {
  test('uploaded PDF is listed with its real size and can be viewed and downloaded', async ({ ownerApi, roomId, testFolder }) => {
    const bytes = makePdf('quarterly report');
    const file = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'Q3 report.pdf', bytes });
    expect(file).toMatchObject({ name: 'Q3 report.pdf', size: bytes.length, mimeType: 'application/pdf', folderId: testFolder.id });

    const listed = (await ownerApi.folderContents(testFolder.id)).body.items.find((i) => i.id === file.id);
    expect(listed).toMatchObject({ type: 'file', size: bytes.length });

    const view = await ownerApi.viewUrl(file.id);
    expect(view.status).toBe(200);
    const viewed = await fetch(view.body.url);
    expect(viewed.status).toBe(200);
    expect(viewed.headers.get('content-type')).toContain('application/pdf');
    expect(Buffer.from(await viewed.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');

    const download = await ownerApi.downloadUrl(file.id);
    expect(download.status).toBe(200);
    const downloaded = await fetch(download.body.url);
    expect(downloaded.headers.get('content-disposition') ?? '').toMatch(/attachment/i);
    expect(decodeURIComponent(downloaded.headers.get('content-disposition') ?? '')).toContain('Q3 report.pdf');
  });

  test('uploading a name that already exists gets a numeric suffix', async ({ ownerApi, roomId, testFolder }) => {
    const first = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'NDA.pdf', bytes: makePdf() });
    const second = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'nda.PDF', bytes: makePdf() });
    const third = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'NDA.pdf', bytes: makePdf() });
    expect([first.name, second.name, third.name]).toEqual(['NDA.pdf', 'nda (1).PDF', 'NDA (2).pdf']);
  });

  test('rename resolves conflicts with a suffix and keeps the content reachable', async ({ ownerApi, roomId, testFolder }) => {
    await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'final.pdf', bytes: makePdf() });
    const draft = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'draft.pdf', bytes: makePdf() });

    const renamed = await ownerApi.renameFile(draft.id, 'FINAL.pdf');
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('FINAL (1).pdf');
    expect((await ownerApi.viewUrl(draft.id)).status).toBe(200);

    expect((await ownerApi.renameFile(draft.id, '   ')).status).toBe(400);
  });

  test('move to another folder, with name-conflict suffix at the destination', async ({ ownerApi, roomId, testFolder }) => {
    const target = (await ownerApi.createFolder({ name: 'target', dataRoomId: roomId, parentId: testFolder.id })).body;
    await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: target.id, name: 'term-sheet.pdf', bytes: makePdf() });
    const mover = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'term-sheet.pdf', bytes: makePdf() });

    const moved = await ownerApi.moveFile(mover.id, target.id);
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ folderId: target.id, name: 'term-sheet (1).pdf' });
    const names = (await ownerApi.folderContents(target.id)).body.items.map((i) => i.name);
    expect(names.sort()).toEqual(['term-sheet (1).pdf', 'term-sheet.pdf'].sort()); // order depends on DB collation
    expect((await ownerApi.folderContents(testFolder.id)).body.items.map((i) => i.id)).not.toContain(mover.id);
  });

  test('delete removes the file and its content', async ({ ownerApi, roomId, testFolder }) => {
    const file = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'to-delete.pdf', bytes: makePdf() });
    expect((await ownerApi.deleteFile(file.id)).status).toBe(204);
    expect((await ownerApi.getFile(file.id)).status).toBe(404);
    expect((await ownerApi.viewUrl(file.id)).status).toBe(404);
  });

  test('upload intent enforces PDF type, size range and a name', async ({ ownerApi, roomId, testFolder }) => {
    const base = { dataRoomId: roomId, folderId: testFolder.id, name: 'x.pdf', size: 1000, mimeType: 'application/pdf' };
    const cases: [string, object, string][] = [
      ['non-PDF type', { mimeType: 'text/plain' }, 'Only PDF files are supported'],
      ['empty file', { size: 0 }, 'size'],
      ['over 50 MB', { size: 50 * 1024 * 1024 + 1 }, '50 MB'],
      ['blank name', { name: '   ' }, 'name'],
    ];
    for (const [label, override, message] of cases) {
      const res = await ownerApi.uploadIntent({ ...base, ...override } as typeof base);
      expect(res.status, label).toBe(400);
      expect(errorMessage(res.body), label).toContain(message);
    }
    const atLimit = await ownerApi.uploadIntent({ ...base, size: 50 * 1024 * 1024 });
    expect(atLimit.status, 'exactly 50 MB').toBe(201);
    await ownerApi.deleteFile(atLimit.body.fileId);
  });

  test('an upload that was never completed stays invisible', async ({ ownerApi, roomId, testFolder }) => {
    const intent = await ownerApi.uploadIntent({ dataRoomId: roomId, folderId: testFolder.id, name: 'pending.pdf', size: 100, mimeType: 'application/pdf' });
    expect(intent.status).toBe(201);
    expect((await ownerApi.folderContents(testFolder.id)).body.items).toHaveLength(0);
    expect((await ownerApi.getFile(intent.body.fileId)).status).toBe(404);
    expect((await ownerApi.deleteFile(intent.body.fileId)).status).toBe(204);
  });
});
