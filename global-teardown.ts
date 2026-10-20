import { ApiClient } from './src/api/client';
import { loginToken, newApiContext, RUN_ENV } from './src/session';

/** Deletes the run folder (cascades to everything the tests created). Set KEEP_TEST_DATA=true to inspect it. */
export default async function globalTeardown(): Promise<void> {
  const folderId = process.env[RUN_ENV.runFolderId];
  if (!folderId || process.env.KEEP_TEST_DATA === 'true') return;
  const context = await newApiContext();
  try {
    const api = new ApiClient(context, await loginToken('owner'), false);
    const result = await api.deleteFolder(folderId);
    console.log(`[teardown] run folder deleted: ${result.status}`);
  } finally {
    await context.dispose();
  }
}
