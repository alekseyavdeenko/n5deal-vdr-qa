import { ApiClient } from './src/api/client';
import { loginToken, newApiContext, RUN_ENV } from './src/session';

/** Folder delete can fail with 500 when the shared database is slow (F-29), so cleanup tries a few times. */
const DELETE_ATTEMPTS = 3;
const RETRY_PAUSE_MS = 5_000;

/** Deletes the run folder (cascades to everything the tests created). Set KEEP_TEST_DATA=true to inspect it. */
export default async function globalTeardown(): Promise<void> {
  const folderId = process.env[RUN_ENV.runFolderId];
  if (!folderId || process.env.KEEP_TEST_DATA === 'true') return;
  const context = await newApiContext();
  try {
    const api = new ApiClient(context, await loginToken('owner'), false);
    for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt += 1) {
      const { status } = await api.deleteFolder(folderId);
      if (status < 500) {
        console.log(`[teardown] run folder deleted: ${status}`);
        return;
      }
      console.log(`[teardown] delete returned ${status} (F-29), attempt ${attempt}/${DELETE_ATTEMPTS}`);
      if (attempt < DELETE_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    }
    console.log('[teardown] run folder left in place; the next run removes it (stale sweep after 2 hours)');
  } finally {
    await context.dispose();
  }
}
