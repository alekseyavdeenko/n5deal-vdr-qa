import type { Browser, Page } from '@playwright/test';
import { expect, test as base } from '../fixtures';

/** localStorage key under which the web app keeps its JWT. */
const TOKEN_KEY = 'dataroom_token';

interface UiFixtures {
  /** Browser page logged in as the data-room owner (own context). */
  ownerPage: Page;
  /** Browser page logged in as the second account (own context). */
  viewerPage: Page;
  /** Browser page without any session - what a visitor of a public link sees. */
  anonPage: Page;
}

/**
 * Runs `use` with a page in a fresh context, so identities never share cookies or storage.
 * With a token the app starts already logged in: the init script runs before the app's own
 * scripts on every navigation, so even the first request is authenticated.
 */
async function withPage(browser: Browser, token: string | undefined, use: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext();
  try {
    if (token) {
      await context.addInitScript(({ key, value }) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          /* opaque origins (about:blank, sandboxed frames) have no storage */
        }
      }, { key: TOKEN_KEY, value: token });
    }
    await use(await context.newPage());
  } finally {
    await context.close();
  }
}

// `ownerApi` / `viewerApi` are requested only for their guard: the test is skipped when the role's credentials are missing.
// They come first so the skip happens before a browser is launched.
export const test = base.extend<UiFixtures>({
  ownerPage: async ({ ownerApi: _guard, tokens, browser }, use) => {
    await withPage(browser, await tokens.get('owner'), use);
  },
  viewerPage: async ({ viewerApi: _guard, tokens, browser }, use) => {
    await withPage(browser, await tokens.get('viewer'), use);
  },
  anonPage: async ({ browser }, use) => {
    await withPage(browser, undefined, use);
  },
});

export { expect };
