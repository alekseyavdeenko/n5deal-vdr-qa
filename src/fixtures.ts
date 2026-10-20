import { test as base, expect, type APIRequestContext, type TestInfo } from '@playwright/test';
import { ApiClient } from './api/client';
import type { Folder } from './api/types';
import { config, credentials, hasCredentials, type Role } from './config';
import { uniqueName } from './data/factory';
import { loginToken, newApiContext, RUN_ENV } from './session';

interface WorkerFixtures {
  /** Logs in at most once per worker and role; lazy so suites without .env still run. */
  tokens: { get(role: Role): Promise<string> };
}

interface TestFixtures {
  apiContext: APIRequestContext;
  /** Logged in as the data-room owner (OWNER_* in .env). */
  ownerApi: ApiClient;
  /** Logged in as the second account (VIEWER_* in .env): share recipient, or an outsider when nothing is shared. */
  viewerApi: ApiClient;
  /** No Authorization header - what an anonymous visitor of a public link can do. */
  anonApi: ApiClient;
  viewerEmail: string;
  /** Owner's data room that hosts the run folder. */
  roomId: string;
  /** Fresh empty folder for this test inside the run folder; removed by global teardown. */
  testFolder: Folder;
}

function requireLogin(role: Role, testInfo: TestInfo): void {
  testInfo.skip(!hasCredentials(role), `${role.toUpperCase()}_EMAIL / ${role.toUpperCase()}_PASSWORD not set in .env`);
}

function assertContract(client: ApiClient, testInfo: TestInfo): void {
  if (client.contractViolations.length === 0) return;
  testInfo.annotations.push(...client.contractViolations.map((description) => ({ type: 'contract-violation', description })));
  if (config.contractStrict) {
    expect(client.contractViolations, 'API responses must match the published OpenAPI spec').toEqual([]);
  }
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  tokens: [
    async ({}, use) => {
      const cache = new Map<Role, Promise<string>>();
      await use({
        get(role) {
          if (!cache.has(role)) cache.set(role, loginToken(role));
          return cache.get(role)!;
        },
      });
    },
    { scope: 'worker' },
  ],

  apiContext: async ({}, use) => {
    const context = await newApiContext();
    await use(context);
    await context.dispose();
  },

  ownerApi: async ({ apiContext, tokens }, use, testInfo) => {
    requireLogin('owner', testInfo);
    const client = new ApiClient(apiContext, await tokens.get('owner'));
    await use(client);
    assertContract(client, testInfo);
  },

  viewerApi: async ({ apiContext, tokens }, use, testInfo) => {
    requireLogin('viewer', testInfo);
    const client = new ApiClient(apiContext, await tokens.get('viewer'));
    await use(client);
    assertContract(client, testInfo);
  },

  anonApi: async ({ apiContext }, use, testInfo) => {
    const client = new ApiClient(apiContext);
    await use(client);
    assertContract(client, testInfo);
  },

  viewerEmail: async ({}, use, testInfo) => {
    requireLogin('viewer', testInfo);
    await use(credentials('viewer').email.trim().toLowerCase());
  },

  roomId: async ({ ownerApi }, use) => {
    const fromSetup = process.env[RUN_ENV.roomId];
    await use(fromSetup ?? (await ownerApi.listRooms()).body.items[0].id);
  },

  testFolder: async ({ ownerApi, roomId }, use, testInfo) => {
    const parentId = process.env[RUN_ENV.runFolderId];
    if (!parentId) throw new Error('Run folder missing - global-setup did not run with owner credentials');
    const created = await ownerApi.createFolder({ name: uniqueName(slug(testInfo.title)), dataRoomId: roomId, parentId });
    expect(created.status, 'create test folder').toBe(201);
    await use(created.body);
  },
});

export { expect };
