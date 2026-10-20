import type { ApiClient, ApiResult } from '../../src/api/client';
import type { FileItem, Folder } from '../../src/api/types';
import { makePdf } from '../../src/data/factory';
import { expect, test } from '../../src/fixtures';

/**
 * The core promise of a data room: a recipient sees exactly what was shared with them, read-only.
 * Layout created per test inside testFolder:
 *   shared/            <- shared with the viewer (USER)
 *     sub/
 *       contract.pdf
 *   private/           <- not shared
 *     secret.pdf
 */
interface Layout {
  shared: Folder;
  sub: Folder;
  contract: FileItem;
  privateFolder: Folder;
  secret: FileItem;
  shareId: string;
}

async function buildLayout(owner: ApiClient, roomId: string, parent: Folder, viewerEmail: string): Promise<Layout> {
  const folder = async (name: string, parentId: string) => (await owner.createFolder({ name, dataRoomId: roomId, parentId })).body;
  const shared = await folder('shared', parent.id);
  const sub = await folder('sub', shared.id);
  const privateFolder = await folder('private', parent.id);
  const contract = await owner.uploadPdf({ dataRoomId: roomId, folderId: sub.id, name: 'contract.pdf', bytes: makePdf('contract') });
  const secret = await owner.uploadPdf({ dataRoomId: roomId, folderId: privateFolder.id, name: 'secret.pdf', bytes: makePdf('secret') });
  const share = await owner.shareUser('FOLDER', shared.id, viewerEmail);
  expect(share.status).toBe(201);
  return { shared, sub, contract, privateFolder, secret, shareId: share.body.id };
}

test.describe('access control: USER share is read-only and scoped @security', () => {
  test('viewer can read everything inside the shared folder', async ({ ownerApi, viewerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);

    expect((await viewerApi.folderContents(l.shared.id)).body.items.map((i) => i.name)).toEqual(['sub']);
    expect((await viewerApi.folderContents(l.sub.id)).body.items.map((i) => i.name)).toEqual(['contract.pdf']);
    expect((await viewerApi.getFile(l.contract.id)).status).toBe(200);
    expect((await viewerApi.viewUrl(l.contract.id)).status).toBe(200);
    expect((await viewerApi.downloadUrl(l.contract.id)).status).toBe(200);

    const received = await viewerApi.receivedShares({ limit: 100 });
    expect(received.body.items).toContainEqual(expect.objectContaining({ shareId: l.shareId, resourceType: 'FOLDER', resourceName: 'shared' }));
  });

  test('viewer breadcrumbs start at the shared folder and hide everything above it', async ({ ownerApi, viewerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);
    const crumbs = await viewerApi.breadcrumbs(l.sub.id);
    expect(crumbs.status).toBe(200);
    expect(crumbs.body).toMatchObject({ accessLevel: 'VIEWER', dataRoomName: null });
    expect(crumbs.body.folders.map((f) => f.name)).toEqual(['shared', 'sub']);
  });

  test('viewer cannot change anything in the shared folder', async ({ ownerApi, viewerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);
    const attempts: [string, () => Promise<ApiResult<unknown>>][] = [
      ['create subfolder', () => viewerApi.createFolder({ name: 'x', dataRoomId: roomId, parentId: l.shared.id })],
      ['rename folder', () => viewerApi.renameFolder(l.sub.id, 'hacked')],
      ['delete preview', () => viewerApi.deletePreview(l.sub.id)],
      ['delete folder', () => viewerApi.deleteFolder(l.sub.id)],
      ['upload intent', () => viewerApi.uploadIntent({ dataRoomId: roomId, folderId: l.sub.id, name: 'x.pdf', size: 10, mimeType: 'application/pdf' })],
      ['complete upload', () => viewerApi.completeUpload(l.contract.id)],
      ['rename file', () => viewerApi.renameFile(l.contract.id, 'hacked.pdf')],
      ['move file', () => viewerApi.moveFile(l.contract.id, l.shared.id)],
      ['delete file', () => viewerApi.deleteFile(l.contract.id)],
      ['re-share publicly', () => viewerApi.sharePublic('FOLDER', l.shared.id)],
      ['list shares', () => viewerApi.listShares('FOLDER', l.shared.id)],
      ['revoke own access', () => viewerApi.revokeShare(l.shareId)],
    ];
    for (const [label, attempt] of attempts) {
      expect((await attempt()).status, label).toBe(404);
    }
    // nothing changed
    expect((await ownerApi.getFile(l.contract.id)).body).toMatchObject({ name: 'contract.pdf', folderId: l.sub.id });
    expect((await ownerApi.folderContents(l.shared.id)).body.items.map((i) => i.name)).toEqual(['sub']);
  });

  test('viewer cannot reach anything outside the shared folder (no IDOR)', async ({ ownerApi, viewerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);
    const attempts: [string, () => Promise<ApiResult<unknown>>][] = [
      ['parent folder', () => viewerApi.folderContents(testFolder.id)],
      ['parent breadcrumbs', () => viewerApi.breadcrumbs(testFolder.id)],
      ['sibling folder', () => viewerApi.folderContents(l.privateFolder.id)],
      ['file in sibling', () => viewerApi.getFile(l.secret.id)],
      ['view url of sibling file', () => viewerApi.viewUrl(l.secret.id)],
      ['the data room', () => viewerApi.getRoom(roomId)],
      ['data room root', () => viewerApi.roomContents(roomId)],
    ];
    for (const [label, attempt] of attempts) {
      expect((await attempt()).status, label).toBe(404);
    }
  });

  test('a single-file share gives access to that file only', async ({ ownerApi, viewerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);
    expect((await ownerApi.shareUser('FILE', l.secret.id, viewerEmail)).status).toBe(201);

    expect((await viewerApi.getFile(l.secret.id)).status).toBe(200);
    expect((await viewerApi.viewUrl(l.secret.id)).status).toBe(200);
    expect((await viewerApi.folderContents(l.privateFolder.id)).status).toBe(404);
  });

  test('access follows the file: moving it out of the shared folder removes access', async ({ ownerApi, viewerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);
    expect((await viewerApi.getFile(l.contract.id)).status).toBe(200);
    expect((await ownerApi.moveFile(l.contract.id, l.privateFolder.id)).status).toBe(200);
    expect((await viewerApi.getFile(l.contract.id)).status).toBe(404);
  });

  test('revoking the share removes access immediately and the item leaves "Shared with me"', async ({ ownerApi, viewerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);
    expect((await ownerApi.revokeShare(l.shareId)).status).toBe(204);

    expect((await viewerApi.folderContents(l.shared.id)).status).toBe(404);
    expect((await viewerApi.getFile(l.contract.id)).status).toBe(404);
    const received = await viewerApi.receivedShares({ limit: 100 });
    expect(received.body.items.map((s) => s.shareId)).not.toContain(l.shareId);
  });

  test('sharing is idempotent and re-sharing after revoke works', async ({ ownerApi, viewerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);
    const again = await ownerApi.shareUser('FOLDER', l.shared.id, `  ${viewerEmail.toUpperCase()} `);
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(l.shareId); // same active share, email normalised

    await ownerApi.revokeShare(l.shareId);
    const reshared = await ownerApi.shareUser('FOLDER', l.shared.id, viewerEmail);
    expect(reshared.body.id).not.toBe(l.shareId);
    expect((await viewerApi.folderContents(l.shared.id)).status).toBe(200);
  });

  test('owner sees who has access; invalid share requests are rejected', async ({ ownerApi, roomId, testFolder, viewerEmail }) => {
    const l = await buildLayout(ownerApi, roomId, testFolder, viewerEmail);
    const shares = await ownerApi.listShares('FOLDER', l.shared.id);
    expect(shares.body.items).toContainEqual(expect.objectContaining({ id: l.shareId, mode: 'USER', granteeEmail: viewerEmail, token: null }));

    expect((await ownerApi.createShare({ resourceType: 'FOLDER', resourceId: l.shared.id, mode: 'USER' })).status).toBe(400);
    expect((await ownerApi.shareUser('FOLDER', l.shared.id, 'not-an-email')).status).toBe(400);
  });
});
