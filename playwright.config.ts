import { defineConfig, devices } from '@playwright/test';
import { config } from './src/config';

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);

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
        // Playwright's own Chromium (`npm run install:browsers`). PW_CHANNEL=chrome uses the installed Google Chrome.
        channel: process.env.PW_CHANNEL,
        // SLOW_MO=400 slows every action down so a human can follow a headed run.
        launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) },
        baseURL: config.webUrl,
        // Trace archives hang on Node 25+ (zip handling); scripts/pw.mjs runs Playwright on Node 22 there.
        trace: NODE_MAJOR > 24 ? 'off' : 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
      },
    },
  ],
});
