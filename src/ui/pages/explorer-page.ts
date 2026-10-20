import { expect, type Locator, type Page } from '@playwright/test';
import { FileViewerPage } from './file-viewer-page';
import { ShareDialog } from './share-dialog';

export interface PdfUpload {
  name: string;
  buffer: Buffer;
}

/** A folder view: toolbar, contents table and the upload panel. */
export class ExplorerPage {
  private readonly breadcrumb: Locator;
  private readonly fileInput: Locator;

  constructor(private readonly page: Page) {
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    // The product's file input is hidden and unlabelled; the "Upload" button only forwards a click to it.
    this.fileInput = page.locator('input[type="file"]');
  }

  async gotoFolder(folderId: string): Promise<void> {
    await this.page.goto(`/folder/${folderId}`);
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.breadcrumb).toBeVisible();
  }

  /** A row of the contents table (file or folder). */
  row(name: string): Locator {
    return this.page.getByRole('row').filter({ hasText: name });
  }

  /** Opens a row's "Actions for <name>" menu and returns the menu to assert on. */
  async openRowMenu(name: string): Promise<Locator> {
    await this.row(name).getByRole('button', { name: `Actions for ${name}` }).click();
    const menu = this.page.getByRole('menu');
    await expect(menu).toBeVisible();
    return menu;
  }

  async openFile(name: string): Promise<FileViewerPage> {
    await this.row(name).getByText(name, { exact: true }).click();
    return new FileViewerPage(this.page);
  }

  /** Toolbar "Share" button: shares the folder being viewed. */
  async openShare(): Promise<ShareDialog> {
    await this.page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = new ShareDialog(this.page);
    await dialog.waitUntilReady();
    return dialog;
  }

  /** Selects all files at once through the file input, as the "Upload" button's picker would. */
  async uploadPdfs(files: PdfUpload[]): Promise<void> {
    await this.fileInput.setInputFiles(files.map(({ name, buffer }) => ({ name, mimeType: 'application/pdf', buffer })));
  }

  /**
   * Waits until the upload panel reports "Done" for every file. The checks run in parallel on purpose:
   * the panel dismisses itself 5 s after the last upload finishes, so they must not queue up behind each other.
   */
  async expectUploaded(names: string[], timeout = 30_000): Promise<void> {
    await Promise.all(
      names.map((name) =>
        expect(this.page.getByRole('listitem').filter({ hasText: name }).getByText('Done', { exact: true })).toBeVisible({ timeout }),
      ),
    );
  }

  /** Viewer of a shared folder: no toolbar actions and no upload input. Call it once the folder has loaded. */
  async expectReadOnly(): Promise<void> {
    await this.expectLoaded();
    for (const name of ['Upload', 'New folder', 'Share']) {
      await expect(this.page.getByRole('button', { name, exact: true }), `"${name}" button`).toHaveCount(0);
    }
    await expect(this.fileInput).toHaveCount(0);
  }
}
