import { defineConfig, devices } from '@playwright/test';
import { config } from './src/config';

/**
 * Two projects on one runner:
 *  - api: request-level tests (functional, access control, public links, contract) - the wide base of the pyramid
 *  - e2e: a few browser journeys that only the UI can prove
 * The target is a shared public deployment, so parallelism is modest on purpose.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ['list'],
    ['./src/reporters/known-bugs-reporter.ts'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  projects: [
    {
      name: 'api',
      testMatch: /(api|contract)\/.*\.spec\.ts/,
    },
    {
      name: 'e2e',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Locally: the installed Google Chrome (no 150 MB download). CI: Playwright's bundled Chromium.
        // Override with PW_CHANNEL=chromium (bundled) or PW_CHANNEL=msedge.
        channel: process.env.PW_CHANNEL ?? (process.env.CI ? undefined : 'chrome'),
        // SLOW_MO=400 slows every action down so a human can follow a headed run.
        launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) },
        baseURL: config.webUrl,
        // Trace archives hang on Node 26 (zip handling) - on by default only in CI (Node 22). Force with PW_TRACE=retain-on-failure.
        trace: (process.env.PW_TRACE as 'off' | 'retain-on-failure' | undefined) ?? (process.env.CI ? 'retain-on-failure' : 'off'),
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
      },
    },
  ],
});
