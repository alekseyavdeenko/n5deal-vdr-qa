import { expect, type Locator, type Page, type Request } from '@playwright/test';

/** The "Share" dialog of a folder or file: public link and people with access. */
export class ShareDialog {
  private readonly dialog: Locator;
  private readonly createLinkButton: Locator;
  private readonly revokeLinkButton: Locator;
  /** The link field has no label; it is the only read-only input in the dialog. */
  private readonly linkInput: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog');
    this.createLinkButton = this.dialog.getByRole('button', { name: 'Create public link' });
    this.revokeLinkButton = this.dialog.getByRole('button', { name: 'Revoke public link' });
    this.linkInput = this.dialog.locator('input[readonly]');
  }

  /** Open and past its loading skeleton (the "Public link" section only renders once shares are loaded). */
  async waitUntilReady(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByText('Public link', { exact: true })).toBeVisible();
  }

  /** Creates the link and returns its full URL. */
  async createPublicLink(): Promise<string> {
    await this.createLinkButton.click();
    return this.publicLink();
  }

  /** The link currently shown in the dialog. */
  async publicLink(): Promise<string> {
    await expect(this.linkInput).toHaveValue(/\/share\/\S+/);
    return this.linkInput.inputValue();
  }

  async revokePublicLink(): Promise<void> {
    await this.revokeLinkButton.click();
    await expect(this.createLinkButton).toBeVisible();
  }

  /**
   * Clicks "Create public link" twice in a row, like an impatient user, and returns once the UI
   * shows a link and every create-share request the clicks produced has been answered.
   */
  async doubleClickCreatePublicLink(): Promise<void> {
    const createRequests: Request[] = [];
    const track = (request: Request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/shares')) createRequests.push(request);
    };
    this.page.on('request', track);
    try {
      await this.createLinkButton.dblclick();
      await this.publicLink();
      await Promise.all(createRequests.map((request) => request.response()));
    } finally {
      this.page.off('request', track);
    }
  }

  async addPerson(email: string): Promise<void> {
    await this.dialog.getByLabel('Email', { exact: true }).fill(email);
    await this.dialog.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(this.dialog.getByText(email)).toBeVisible();
  }

  async close(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Done' }).click();
    await expect(this.dialog).toBeHidden();
  }
}
