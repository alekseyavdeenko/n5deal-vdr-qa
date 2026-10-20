import { BUG_CHECK, knownBug } from '../../src/annotations';
import { credentials } from '../../src/config';
import { makePdf } from '../../src/data/factory';
import { expect, test } from '../../src/ui/fixtures';
import { ExplorerPage } from '../../src/ui/pages/explorer-page';
import { LoginPage } from '../../src/ui/pages/login-page';

/**
 * Confirmed UI defects (docs/findings.md), written as the correct behaviour and marked test.fail():
 * they fail today and will be reported as "expected to fail but passed" once fixed.
 */
test.describe('known UI bugs @known-bug', () => {
  test(
    'E2E-07 after login the user is taken to the page they opened by link',
    knownBug('F-28', 'the link is lost after login', 'TC-112'),
    async ({ anonPage, testFolder }) => {
      test.fail(true, 'F-28: login always redirects to "/"');
      const { email, password } = credentials('owner');

      await anonPage.goto(`/folder/${testFolder.id}`);
      await expect(anonPage).toHaveURL(/\/login/);
      await new LoginPage(anonPage).signIn(email, password);

      await expect(anonPage, BUG_CHECK).toHaveURL(new RegExp(`/folder/${testFolder.id}`), { timeout: 10_000 });
    },
  );

  test(
    'E2E-08 Retry finishes an upload whose last step failed because of a network error',
    knownBug('F-22', 'Retry after a failed "complete" request never succeeds', 'TC-104'),
    async ({ ownerPage, testFolder }) => {
      test.fail(true, 'F-22: Retry re-uploads bytes that storage already has and gets 400 forever');
      const explorer = new ExplorerPage(ownerPage);
      await explorer.gotoFolder(testFolder.id);

      // a one-off network drop on the last step of the upload ("complete")
      await ownerPage.route('**/files/*/complete', (route) => route.abort('failed'), { times: 1 });
      await explorer.uploadPdfs([{ name: 'retry.pdf', buffer: makePdf('retry') }]);

      const row = ownerPage.getByRole('listitem').filter({ hasText: 'retry.pdf' });
      await expect(row.getByText('Error', { exact: true })).toBeVisible();
      await row.getByRole('button', { name: 'Retry upload of retry.pdf' }).click();

      await expect(row.getByText('Done', { exact: true }), `${BUG_CHECK}: upload finished after Retry`).toBeVisible({ timeout: 15_000 });
    },
  );
});
