import { expect, type Locator, type Page } from '@playwright/test';
import { ExplorerPage } from './explorer-page';

/** "Shared with me": everything other users have shared with the logged-in account. */
export class SharedWithMePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/shared-with-me');
    await expect(this.page.getByRole('heading', { name: 'Shared with me' })).toBeVisible();
  }

  /** Each received share is a row with role "link" showing the item's name. */
  item(name: string): Locator {
    return this.page.getByRole('link', { name });
  }

  /** Opens a shared folder in its read-only explorer. */
  async openFolder(name: string): Promise<ExplorerPage> {
    await this.item(name).click();
    return new ExplorerPage(this.page);
  }
}
