import { expect, type Page } from '@playwright/test';

/** What an anonymous visitor sees at /share/:token. */
export class PublicSharePage {
  constructor(private readonly page: Page) {}

  /** `link` is the full URL copied from the owner's Share dialog. */
  async open(link: string): Promise<void> {
    await this.page.goto(link);
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  /** A file or folder listed on a shared folder's page. */
  async expectItemVisible(name: string): Promise<void> {
    await expect(this.page.getByRole('row').filter({ hasText: name })).toBeVisible();
  }

  async expectRevoked(): Promise<void> {
    await expect(this.page.getByText('This link has been revoked', { exact: true })).toBeVisible();
  }

  async expectNotAvailable(): Promise<void> {
    await expect(this.page.getByText('Link not available', { exact: true })).toBeVisible();
  }
}
