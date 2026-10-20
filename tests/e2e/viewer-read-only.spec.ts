import { makePdf, uniqueName } from '../../src/data/factory';
import { expect, test } from '../../src/ui/fixtures';
import { SharedWithMePage } from '../../src/ui/pages/shared-with-me-page';

test.describe('viewer of a shared folder', () => {
  test('E2E-05 gets a read-only view: no toolbar actions, no Rename/Move/Delete on files', async ({ ownerApi, viewerPage, viewerEmail, roomId, testFolder }) => {
    const subfolder = await ownerApi.createFolder({ name: uniqueName('subfolder'), dataRoomId: roomId, parentId: testFolder.id });
    expect(subfolder.status, 'create subfolder').toBe(201);
    const file = await ownerApi.uploadPdf({
      dataRoomId: roomId,
      folderId: testFolder.id,
      name: uniqueName('readonly', '.pdf'),
      bytes: makePdf('read only'),
    });
    const share = await ownerApi.shareUser('FOLDER', testFolder.id, viewerEmail);
    expect(share.status, 'share folder with the viewer').toBe(201);

    try {
      const sharedWithMe = new SharedWithMePage(viewerPage);
      await sharedWithMe.goto();
      await expect(sharedWithMe.item(testFolder.name)).toBeVisible();

      const explorer = await sharedWithMe.openFolder(testFolder.name);
      await expect(viewerPage).toHaveURL(new RegExp(`/shared-with-me/folder/${testFolder.id}$`));
      await expect(explorer.row(subfolder.body.name)).toBeVisible();
      await expect(explorer.row(file.name)).toBeVisible();

      await explorer.expectReadOnly();

      const menu = await explorer.openRowMenu(file.name);
      await expect(menu.getByRole('menuitem', { name: 'Download' })).toBeVisible();
      for (const name of ['Rename', 'Move', 'Share', 'Delete']) {
        await expect(menu.getByRole('menuitem', { name }), `"${name}" menu item`).toHaveCount(0);
      }
    } finally {
      await ownerApi.revokeShare(share.body.id);
    }
  });
});
