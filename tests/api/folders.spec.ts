import { covers } from '../../src/annotations';
import { errorMessage } from '../../src/api/client';
import type { ContentItem } from '../../src/api/types';
import { makePdf } from '../../src/data/factory';
import { expect, test } from '../../src/fixtures';

const MISSING_ID = '11111111-1111-4111-8111-111111111111';

test.describe('folders', () => {
  test('FOL-01 nested folders are listed with folders first, sorted case-insensitively', covers('TC-10'), async ({ ownerApi, roomId, testFolder }) => {
    for (const name of ['beta', 'Alpha', 'gamma']) {
      expect((await ownerApi.createFolder({ name, dataRoomId: roomId, parentId: testFolder.id })).status).toBe(201);
    }
    await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'aaa.pdf', bytes: makePdf() });

    const contents = await ownerApi.folderContents(testFolder.id);
    expect(contents.status).toBe(200);
    expect(contents.body.items.map((i) => `${i.type}:${i.name}`)).toEqual(['folder:Alpha', 'folder:beta', 'folder:gamma', 'file:aaa.pdf']);
  });

  test('FOL-02 breadcrumbs list every ancestor down to the current folder', covers('TC-11'), async ({ ownerApi, roomId, testFolder }) => {
    const a = (await ownerApi.createFolder({ name: 'level-1', dataRoomId: roomId, parentId: testFolder.id })).body;
    const b = (await ownerApi.createFolder({ name: 'level-2', dataRoomId: roomId, parentId: a.id })).body;

    const crumbs = await ownerApi.breadcrumbs(b.id);
    expect(crumbs.status).toBe(200);
    expect(crumbs.body.accessLevel).toBe('OWNER');
    expect(crumbs.body.dataRoomName).toBeTruthy();
    expect(crumbs.body.folders.slice(-3).map((f) => f.name)).toEqual([testFolder.name, 'level-1', 'level-2']);
  });

  test('FOL-03 folder names are unique among siblings, ignoring case and surrounding spaces', covers('TC-12'), async ({ ownerApi, roomId, testFolder }) => {
    expect((await ownerApi.createFolder({ name: 'Due Diligence', dataRoomId: roomId, parentId: testFolder.id })).status).toBe(201);
    for (const name of ['Due Diligence', 'DUE DILIGENCE', '  due diligence  ']) {
      const dup = await ownerApi.createFolder({ name, dataRoomId: roomId, parentId: testFolder.id });
      expect(dup.status, JSON.stringify(name)).toBe(409);
      expect(errorMessage(dup.body)).toContain('already exists');
    }
  });

  test('FOL-04 the same name is allowed in a different parent', covers('TC-13'), async ({ ownerApi, roomId, testFolder }) => {
    const left = (await ownerApi.createFolder({ name: 'left', dataRoomId: roomId, parentId: testFolder.id })).body;
    const right = (await ownerApi.createFolder({ name: 'right', dataRoomId: roomId, parentId: testFolder.id })).body;
    expect((await ownerApi.createFolder({ name: 'Contracts', dataRoomId: roomId, parentId: left.id })).status).toBe(201);
    expect((await ownerApi.createFolder({ name: 'Contracts', dataRoomId: roomId, parentId: right.id })).status).toBe(201);
  });

  test('FOL-05 folder name validation: required, trimmed, max 200 characters', covers('TC-14'), async ({ ownerApi, roomId, testFolder }) => {
    for (const name of ['', '   ']) {
      const res = await ownerApi.createFolder({ name, dataRoomId: roomId, parentId: testFolder.id });
      expect(res.status, JSON.stringify(name)).toBe(400);
      expect(errorMessage(res.body)).toBe('Enter a folder name');
    }
    expect((await ownerApi.createFolder({ name: 'x'.repeat(200), dataRoomId: roomId, parentId: testFolder.id })).status).toBe(201);
    expect((await ownerApi.createFolder({ name: 'y'.repeat(201), dataRoomId: roomId, parentId: testFolder.id })).status).toBe(400);

    const trimmed = await ownerApi.createFolder({ name: '  Tax  ', dataRoomId: roomId, parentId: testFolder.id });
    expect(trimmed.body.name).toBe('Tax');
  });

  test('FOL-06 rename: new name is saved, sibling clash is 409, changing only the case of its own name is allowed', covers('TC-18'), async ({ ownerApi, roomId, testFolder }) => {
    const alpha = (await ownerApi.createFolder({ name: 'alpha', dataRoomId: roomId, parentId: testFolder.id })).body;
    await ownerApi.createFolder({ name: 'beta', dataRoomId: roomId, parentId: testFolder.id });

    expect((await ownerApi.renameFolder(alpha.id, 'Beta')).status).toBe(409);
    const caseOnly = await ownerApi.renameFolder(alpha.id, 'ALPHA');
    expect(caseOnly.status).toBe(200);
    expect(caseOnly.body.name).toBe('ALPHA');
  });

  test('FOL-07 delete preview counts the whole subtree, then delete removes it all', covers('TC-19', 'TC-20'), async ({ ownerApi, roomId, testFolder }) => {
    const top = (await ownerApi.createFolder({ name: 'to-delete', dataRoomId: roomId, parentId: testFolder.id })).body;
    const child = (await ownerApi.createFolder({ name: 'child', dataRoomId: roomId, parentId: top.id })).body;
    const grandchild = (await ownerApi.createFolder({ name: 'grandchild', dataRoomId: roomId, parentId: child.id })).body;
    const f1 = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: top.id, name: 'one.pdf', bytes: makePdf('one') });
    const f2 = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: grandchild.id, name: 'two.pdf', bytes: makePdf('two') });

    const preview = await ownerApi.deletePreview(top.id);
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({ folderCount: 2, fileCount: 2, totalSize: f1.size + f2.size });

    expect((await ownerApi.deleteFolder(top.id)).status).toBe(204);
    for (const id of [top.id, child.id, grandchild.id]) expect((await ownerApi.folderContents(id)).status).toBe(404);
    for (const id of [f1.id, f2.id]) expect((await ownerApi.getFile(id)).status).toBe(404);
  });

  test('FOL-08 keyset pagination returns every item exactly once', covers('TC-23'), async ({ ownerApi, roomId, testFolder }) => {
    const names = ['p1', 'p2', 'p3', 'p4', 'p5'];
    for (const name of names) await ownerApi.createFolder({ name, dataRoomId: roomId, parentId: testFolder.id });
    await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: testFolder.id, name: 'p6.pdf', bytes: makePdf() });

    const seen: ContentItem[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const res = await ownerApi.folderContents(testFolder.id, { limit: 2, cursor });
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      seen.push(...res.body.items);
      if (!res.body.nextCursor) break;
      cursor = res.body.nextCursor;
    }
    expect(seen.map((i) => i.name)).toEqual([...names, 'p6.pdf']);
  });

  test('FOL-09 pagination parameters are validated', covers('TC-24'), async ({ ownerApi, testFolder }) => {
    expect((await ownerApi.folderContents(testFolder.id, { limit: 0 })).status).toBe(400);
    expect((await ownerApi.folderContents(testFolder.id, { limit: 101 })).status).toBe(400);
    const badCursor = await ownerApi.folderContents(testFolder.id, { cursor: 'not-a-cursor' });
    expect(badCursor.status).toBe(400);
  });

  test('FOL-10 unknown and malformed ids', async ({ ownerApi, roomId }) => {
    expect((await ownerApi.folderContents(MISSING_ID)).status).toBe(404);
    expect((await ownerApi.folderContents('not-a-uuid')).status).toBe(400);
    const orphan = await ownerApi.createFolder({ name: 'orphan', dataRoomId: roomId, parentId: MISSING_ID });
    expect(orphan.status).toBe(404);
  });
});
