import { makePdf, uniqueName } from '../../src/data/factory';
import { expect, test } from '../../src/ui/fixtures';
import { ExplorerPage } from '../../src/ui/pages/explorer-page';
import { PublicSharePage } from '../../src/ui/pages/public-share-page';

test.describe('public link lifecycle', () => {
  test('owner creates a link, an anonymous visitor opens it, revoking shuts it down', async ({ ownerPage, anonPage, ownerApi, roomId, testFolder }) => {
    const file = await ownerApi.uploadPdf({
      dataRoomId: roomId,
      folderId: testFolder.id,
      name: uniqueName('shared', '.pdf'),
      bytes: makePdf('public link'),
    });
    const explorer = new ExplorerPage(ownerPage);
    const publicPage = new PublicSharePage(anonPage);

    const link = await test.step('the owner creates a public link for the folder', async () => {
      await explorer.gotoFolder(testFolder.id);
      const shareDialog = await explorer.openShare();
      const created = await shareDialog.createPublicLink();
      await shareDialog.close();
      return created;
    });

    await test.step('an anonymous visitor opens the link and sees the file', async () => {
      await publicPage.open(link);
      await publicPage.expectItemVisible(file.name);
    });

    await test.step('the owner revokes the link in the UI', async () => {
      const shareDialog = await explorer.openShare();
      expect(await shareDialog.publicLink(), 'the dialog still shows the same link').toBe(link);
      await shareDialog.revokePublicLink();
    });

    await test.step('the visitor reloads and is told the link is revoked', async () => {
      await publicPage.reload();
      await publicPage.expectRevoked();
    });
  });
});
