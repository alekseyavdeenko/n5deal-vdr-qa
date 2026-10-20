import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { ApiClient } from './api/client';
import { config, credentials, type Role } from './config';

export async function newApiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: config.apiUrl, extraHTTPHeaders: { Accept: 'application/json' } });
}

/** Logs in through the API and returns the bearer token (credentials come from .env, never from code). */
export async function loginToken(role: Role): Promise<string> {
  const context = await newApiContext();
  try {
    const result = await new ApiClient(context, undefined, false).login(credentials(role));
    if (result.status !== 200) throw new Error(`Login as ${role} failed: ${result.status} ${JSON.stringify(result.body)}`);
    return result.body.accessToken;
  } finally {
    await context.dispose();
  }
}

/** Run-folder bookkeeping shared between global setup, teardown and workers (via env vars). */
export const RUN_ENV = {
  roomId: 'QA_ROOM_ID',
  runFolderId: 'QA_RUN_FOLDER_ID',
} as const;

/** Run folders look like `n5qa-20261020131500-ab12`; only these are ever swept. */
export const RUN_FOLDER_PATTERN = /^n5qa-(\d{14})-[a-z0-9]{4}$/;
