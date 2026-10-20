import { expect, type Page } from '@playwright/test';

/** The full-page PDF viewer (/file/:id and the public /share/:token/files/:id). */
export class FileViewerPage {
  constructor(private readonly page: Page) {}

  async expectShowing(fileName: string): Promise<void> {
    // The app embeds the document in an <object>, rendered once the signed view URL has been fetched.
    // Wait for it first: the URL changes before the previous page (which lists the same name) is replaced.
    await expect(this.page.locator('object[type="application/pdf"]')).toBeVisible();
    await expect(this.page.getByText(fileName, { exact: true })).toBeVisible();
  }

  /** The "X" in the viewer's top-right corner; navigates back to where the file was opened from. */
  async close(): Promise<void> {
    await this.page.getByLabel('Close', { exact: true }).click();
  }
}
