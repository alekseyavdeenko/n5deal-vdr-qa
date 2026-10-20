import { expect, test } from '../../src/ui/fixtures';
import { ExplorerPage } from '../../src/ui/pages/explorer-page';

/**
 * F-10 (docs/findings.md): the create-share endpoint is not safe against parallel requests. A machine-speed
 * double click (both clicks before React re-renders) leaves two active links; revoking the one the UI shows
 * leaves the other working. A human double-click is blocked by the disabled button (checked by hand), so
 * this reproduces the race through the real UI rather than a typical user path.
 * Expected to fail until fixed - when it starts passing, Playwright flags it and the marker can be removed.
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
