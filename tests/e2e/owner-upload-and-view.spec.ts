import { covers } from '../../src/annotations';
import { makePdf, uniqueName } from '../../src/data/factory';
import { expect, test } from '../../src/ui/fixtures';
import { ExplorerPage } from '../../src/ui/pages/explorer-page';

test.describe('owner uploads and views files', () => {
  test('E2E-03 two PDFs uploaded at once appear in the folder and open in the viewer', covers('TC-31', 'TC-40'), async ({ ownerPage, testFolder }) => {
    const files = ['first', 'second'].map((label) => ({ name: uniqueName(label, '.pdf'), buffer: makePdf(label) }));
    const [opened] = files;
    const explorer = new ExplorerPage(ownerPage);

    await test.step('upload both files through the Upload input', async () => {
      await explorer.gotoFolder(testFolder.id);
      await explorer.uploadPdfs(files);
      await explorer.expectUploaded(files.map((file) => file.name));
    });

    await test.step('both files are listed in the folder', async () => {
      for (const file of files) await expect(explorer.row(file.name)).toBeVisible();
    });

    await test.step('opening a file shows the PDF viewer, closing it returns to the folder', async () => {
      const viewer = await explorer.openFile(opened.name);
      await expect(ownerPage).toHaveURL(/\/file\/[\w-]+$/);
      await viewer.expectShowing(opened.name);

      await viewer.close();
      await expect(ownerPage).toHaveURL(new RegExp(`/folder/${testFolder.id}$`));
      await expect(explorer.row(opened.name)).toBeVisible();
    });
  });
});
