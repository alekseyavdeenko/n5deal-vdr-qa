import { covers } from '../../src/annotations';
import { errorMessage } from '../../src/api/client';
import type { FileItem, Folder } from '../../src/api/types';
import { makePdf } from '../../src/data/factory';
import { expect, test } from '../../src/fixtures';

/**
 * Layout inside testFolder:
 *   deal/            <- public link
 *     docs/
 *       memo.pdf
 *   other/           <- NOT shared
 *     hidden.pdf
 */
test.describe('public links @security', () => {
  let deal: Folder, docs: Folder, other: Folder, memo: FileItem, hidden: FileItem;

  test.beforeEach(async ({ ownerApi, roomId, testFolder }) => {
    const folder = async (name: string, parentId: string) => (await ownerApi.createFolder({ name, dataRoomId: roomId, parentId })).body;
    deal = await folder('deal', testFolder.id);
    docs = await folder('docs', deal.id);
    other = await folder('other', testFolder.id);
    memo = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: docs.id, name: 'memo.pdf', bytes: makePdf('memo') });
    hidden = await ownerApi.uploadPdf({ dataRoomId: roomId, folderId: other.id, name: 'hidden.pdf', bytes: makePdf('hidden') });
  });

  test('PUB-01 anyone with the link can browse the shared folder and open its files', covers('TC-70'), async ({ ownerApi, anonApi }) => {
    const link = await ownerApi.sharePublic('FOLDER', deal.id);
    expect(link.status).toBe(201);
    const token = link.body.token!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);

    expect((await anonApi.publicSummary(token)).body).toMatchObject({ resourceType: 'FOLDER', resourceId: deal.id, resourceName: 'deal' });
    expect((await anonApi.publicFolderContents(token, deal.id)).body.items.map((i) => i.name)).toEqual(['docs']);
    expect((await anonApi.publicFolderContents(token, docs.id)).body.items.map((i) => i.name)).toEqual(['memo.pdf']);
    expect((await anonApi.publicFile(token, memo.id)).body).toMatchObject({ name: 'memo.pdf', size: memo.size });

    const view = await anonApi.publicViewUrl(token, memo.id);
    expect(view.status).toBe(200);
    const pdf = await fetch(view.body.url);
    expect(pdf.status).toBe(200);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('PUB-02 a link cannot be used to step outside the shared folder', covers('TC-71'), async ({ ownerApi, anonApi, testFolder }) => {
    const token = (await ownerApi.sharePublic('FOLDER', deal.id)).body.token!;
    const escapes: [string, number][] = [
      ['parent folder', (await anonApi.publicFolderContents(token, testFolder.id)).status],
      ['sibling folder', (await anonApi.publicFolderContents(token, other.id)).status],
      ['file in sibling', (await anonApi.publicFile(token, hidden.id)).status],
      ['view url of sibling file', (await anonApi.publicViewUrl(token, hidden.id)).status],
      ['download url of sibling file', (await anonApi.publicDownloadUrl(token, hidden.id)).status],
      ['room root via folder link', (await anonApi.publicRoomContents(token)).status],
    ];
    for (const [label, status] of escapes) expect(status, label).toBe(404);
  });

  test('PUB-03 a file link opens that file and nothing else', covers('TC-72'), async ({ ownerApi, anonApi }) => {
    const token = (await ownerApi.sharePublic('FILE', memo.id)).body.token!;
    expect((await anonApi.publicSummary(token)).body).toMatchObject({ resourceType: 'FILE', resourceId: memo.id, size: memo.size, mimeType: 'application/pdf' });
    expect((await anonApi.publicViewUrl(token, memo.id)).status).toBe(200);
    expect((await anonApi.publicFolderContents(token, docs.id)).status).toBe(404);
    expect((await anonApi.publicFile(token, hidden.id)).status).toBe(404);
  });

  test('PUB-04 creating a link twice returns the same link', covers('TC-73'), async ({ ownerApi }) => {
    const first = await ownerApi.sharePublic('FOLDER', deal.id);
    const second = await ownerApi.sharePublic('FOLDER', deal.id);
    expect(second.body.token).toBe(first.body.token);
    expect((await ownerApi.listShares('FOLDER', deal.id, 'PUBLIC_LINK')).body.items).toHaveLength(1);
  });

  test('PUB-05 revoked link answers 410 everywhere; a new link gets a new token', covers('TC-75', 'TC-76'), async ({ ownerApi, anonApi }) => {
    const share = (await ownerApi.sharePublic('FOLDER', deal.id)).body;
    expect((await ownerApi.revokeShare(share.id)).status).toBe(204);

    const summary = await anonApi.publicSummary(share.token!);
    expect(summary.status).toBe(410);
    expect(errorMessage(summary.body)).toBe('This link has been revoked');
    expect((await anonApi.publicFolderContents(share.token!, docs.id)).status).toBe(410);
    expect((await anonApi.publicViewUrl(share.token!, memo.id)).status).toBe(410);

    const fresh = (await ownerApi.sharePublic('FOLDER', deal.id)).body;
    expect(fresh.token).not.toBe(share.token);
    expect((await anonApi.publicSummary(fresh.token!)).status).toBe(200);
    expect((await anonApi.publicSummary(share.token!)).status).toBe(410);
  });

  test('PUB-06 deleting the shared folder kills the link', covers('TC-77', 'TC-116'), async ({ ownerApi, anonApi }) => {
    const token = (await ownerApi.sharePublic('FOLDER', deal.id)).body.token!;
    // A 500 here is the product bug F-29 (folder delete times out when the shared database is slow), not a test problem.
    expect((await ownerApi.deleteFolder(deal.id)).status, 'delete the shared folder (500 = F-29)').toBe(204);
    expect((await anonApi.publicSummary(token)).status).toBe(404);
    expect((await anonApi.publicViewUrl(token, memo.id)).status).toBe(404);
  });

  test('PUB-07 unknown token is a plain 404', covers('TC-78'), async ({ anonApi }) => {
    expect((await anonApi.publicSummary('this-token-does-not-exist-0000000')).status).toBe(404);
  });
});
