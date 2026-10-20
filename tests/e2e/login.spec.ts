import type { Page } from '@playwright/test';
import { credentials, hasCredentials } from '../../src/config';
import { expect, test } from '../../src/ui/fixtures';
import { ExplorerPage } from '../../src/ui/pages/explorer-page';
import { LoginPage } from '../../src/ui/pages/login-page';

test.describe('login @smoke', () => {
  test.skip(!hasCredentials('owner'), 'OWNER_EMAIL / OWNER_PASSWORD not set in .env');

  const tokenInStorage = (page: Page) => page.evaluate(() => window.localStorage.getItem('dataroom_token'));

  test('valid credentials land on the data room', async ({ anonPage }) => {
    const { email, password } = credentials('owner');
    const login = new LoginPage(anonPage);

    await login.goto();
    await login.signIn(email, password);

    await expect(anonPage).toHaveURL('/');
    await new ExplorerPage(anonPage).expectLoaded();
    expect(await tokenInStorage(anonPage), 'session token is stored').toBeTruthy();
  });

  test('a wrong password shows an error and keeps the user on the login page', async ({ anonPage }) => {
    const { email, password } = credentials('owner');
    const login = new LoginPage(anonPage);

    await login.goto();
    await login.signIn(email, `${password}-wrong`);

    await login.expectError('Invalid email or password');
    await expect(anonPage).toHaveURL('/login');
    expect(await tokenInStorage(anonPage), 'no session token is stored').toBeNull();
  });
});
