import { expect, test } from '../../src/ui/fixtures';
import { ExplorerPage } from '../../src/ui/pages/explorer-page';

/**
 * F-10 (docs/findings.md): the create-share endpoint is not safe against parallel requests, so a double
 * click on "Create public link" leaves two active links; revoking the one the UI shows leaves the other
 * working. Expected to fail until fixed - when it starts passing, Playwright flags it so the
 * test.fail() marker (and this file's @known-bug tag) can be removed.
 */
test.describe('sharing @known-bug', () => {
  test(
    'double click on "Create public link" creates exactly one active link',
    { annotation: { type: 'issue', description: 'F-10' } },
    async ({ ownerPage, ownerApi, testFolder }) => {
      test.fail(true, 'F-10: parallel create requests produce several active public links');

      const explorer = new ExplorerPage(ownerPage);
      await explorer.gotoFolder(testFolder.id);
      const shareDialog = await explorer.openShare();
      await shareDialog.doubleClickCreatePublicLink();

      const shares = await ownerApi.listShares('FOLDER', testFolder.id, 'PUBLIC_LINK');
      expect(shares.status).toBe(200);
      const active = shares.body.items.filter((share) => share.revokedAt === null);
      expect(active, 'active public links of the folder').toHaveLength(1);
    },
  );
});
