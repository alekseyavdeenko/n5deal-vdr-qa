import { ApiClient } from './src/api/client';
import { hasCredentials, runId } from './src/config';
import { loginToken, newApiContext, RUN_ENV, RUN_FOLDER_PATTERN } from './src/session';

const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * Creates one folder per run in the owner's data room. Every test works below it,
 * so a run never touches data that other people keep in the shared demo account.
 * Also sweeps run folders left behind by crashed runs older than 2 hours.
 */
export default async function globalSetup(): Promise<void> {
  const id = runId();
  if (!hasCredentials('owner')) {
    console.warn('[setup] OWNER_* credentials not set - only tests that need no login will run.');
    return;
  }
  const context = await newApiContext();
  try {
    const api = new ApiClient(context, await loginToken('owner'), false);
    const rooms = await api.listRooms();
    const room = rooms.body.items[0];
    if (!room) throw new Error('Owner has no data room');

    await sweepStaleRunFolders(api, room.id);

    const folder = await api.createFolder({ name: id, dataRoomId: room.id });
    if (folder.status !== 201) throw new Error(`Could not create run folder: ${folder.status} ${JSON.stringify(folder.body)}`);

    process.env[RUN_ENV.roomId] = room.id;
    process.env[RUN_ENV.runFolderId] = folder.body.id;
    console.log(`[setup] run ${id} -> folder ${folder.body.id}`);
  } finally {
    await context.dispose();
  }
}

async function sweepStaleRunFolders(api: ApiClient, roomId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await api.roomContents(roomId, { limit: 100, cursor });
    for (const item of page.body.items ?? []) {
      const match = item.type === 'folder' ? RUN_FOLDER_PATTERN.exec(item.name) : null;
      if (!match) continue;
      const [, stamp] = match;
      const created = Date.UTC(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8), +stamp.slice(8, 10), +stamp.slice(10, 12), +stamp.slice(12, 14));
      if (Date.now() - created > STALE_AFTER_MS) await api.deleteFolder(item.id);
    }
    cursor = page.body.nextCursor ?? undefined;
  } while (cursor);
}
