import type { APIRequestContext } from '@playwright/test';
import { checkContract } from './contract';
import type {
  ApiError, Breadcrumbs, ContentItem, DataRoom, DeletePreview, FileItem, Folder, Page,
  PublicSummary, ReceivedShare, ResourceType, Share, ShareMode, SignedUrl, UploadIntent, User,
} from './types';
import type { Credentials } from '../config';

export interface ApiResult<T> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

type Query = Record<string, string | number | undefined>;

interface CallOptions {
  params?: Record<string, string>;
  query?: Query;
  body?: unknown;
}

/**
 * Thin typed client over Playwright's APIRequestContext.
 * - Never throws on HTTP errors: tests assert on `status` and `body` themselves.
 * - Every response of a documented endpoint is checked against the OpenAPI spec;
 *   violations are collected in `contractViolations` and asserted by the fixture.
 */
export class ApiClient {
  readonly contractViolations: string[] = [];

  constructor(
    private readonly request: APIRequestContext,
    private readonly token?: string,
    private readonly contract = true,
  ) {}

  /** Same identity, contract checks off - for tests that deliberately provoke undocumented behaviour. */
  withoutContract(): ApiClient {
    return new ApiClient(this.request, this.token, false);
  }

  async call<T>(method: string, template: string, opts: CallOptions = {}): Promise<ApiResult<T>> {
    let url = template;
    for (const [key, value] of Object.entries(opts.params ?? {})) url = url.replace(`{${key}}`, encodeURIComponent(value));
    const query = Object.fromEntries(Object.entries(opts.query ?? {}).filter(([, v]) => v !== undefined)) as Record<string, string | number>;

    const response = await this.request.fetch(url, {
      method,
      params: query,
      data: opts.body,
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      failOnStatusCode: false,
    });
    const text = await response.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON body stays as text */ }

    if (this.contract) {
      const result = checkContract(method, template, response.status(), body);
      if (!result.ok) this.contractViolations.push(result.problem!);
    }
    return { status: response.status(), body: body as T, headers: response.headers() };
  }

  // ---- auth --------------------------------------------------------------
  login(creds: Credentials) {
    return this.call<{ accessToken: string } & ApiError>('POST', '/auth/login', { body: creds });
  }
  register(body: { name: string; email: string; password: string }) {
    return this.call<{ accessToken: string } & ApiError>('POST', '/auth/register', { body });
  }
  me() {
    return this.call<User & ApiError>('GET', '/auth/me');
  }

  // ---- data rooms --------------------------------------------------------
  listRooms(query?: Query) {
    return this.call<Page<DataRoom>>('GET', '/data-rooms', { query });
  }
  getRoom(id: string) {
    return this.call<DataRoom & ApiError>('GET', '/data-rooms/{id}', { params: { id } });
  }
  roomContents(id: string, query?: Query) {
    return this.call<Page<ContentItem> & ApiError>('GET', '/data-rooms/{id}/contents', { params: { id }, query });
  }

  // ---- folders -----------------------------------------------------------
  createFolder(body: { name: string; dataRoomId: string; parentId?: string }) {
    return this.call<Folder & ApiError>('POST', '/folders', { body });
  }
  folderContents(id: string, query?: Query) {
    return this.call<Page<ContentItem> & ApiError>('GET', '/folders/{id}/contents', { params: { id }, query });
  }
  breadcrumbs(id: string) {
    return this.call<Breadcrumbs & ApiError>('GET', '/folders/{id}/breadcrumbs', { params: { id } });
  }
  deletePreview(id: string) {
    return this.call<DeletePreview & ApiError>('GET', '/folders/{id}/delete-preview', { params: { id } });
  }
  renameFolder(id: string, name: string) {
    return this.call<Folder & ApiError>('PATCH', '/folders/{id}', { params: { id }, body: { name } });
  }
  deleteFolder(id: string) {
    return this.call<ApiError | null>('DELETE', '/folders/{id}', { params: { id } });
  }

  // ---- files -------------------------------------------------------------
  uploadIntent(body: { dataRoomId: string; folderId?: string; name: string; size: number; mimeType: string }) {
    return this.call<UploadIntent & ApiError>('POST', '/files/upload-intent', { body });
  }
  completeUpload(id: string) {
    return this.call<{ id: string; name: string } & ApiError>('POST', '/files/{id}/complete', { params: { id } });
  }
  getFile(id: string) {
    return this.call<FileItem & ApiError>('GET', '/files/{id}', { params: { id } });
  }
  renameFile(id: string, name: string) {
    return this.call<FileItem & ApiError>('PATCH', '/files/{id}', { params: { id }, body: { name } });
  }
  moveFile(id: string, targetFolderId: string | null) {
    return this.call<FileItem & ApiError>('PATCH', '/files/{id}/move', { params: { id }, body: { targetFolderId } });
  }
  deleteFile(id: string) {
    return this.call<ApiError | null>('DELETE', '/files/{id}', { params: { id } });
  }
  viewUrl(id: string) {
    return this.call<SignedUrl & ApiError>('GET', '/files/{id}/view-url', { params: { id } });
  }
  downloadUrl(id: string) {
    return this.call<SignedUrl & ApiError>('GET', '/files/{id}/download-url', { params: { id } });
  }

  /**
   * Full upload flow the web app uses: intent -> PUT bytes to the signed storage URL -> complete.
   * Returns the completed file (with the final, possibly de-duplicated, name).
   */
  async uploadPdf(opts: { dataRoomId: string; folderId?: string; name: string; bytes: Buffer }): Promise<FileItem> {
    const intent = await this.uploadIntent({
      dataRoomId: opts.dataRoomId, folderId: opts.folderId, name: opts.name, size: opts.bytes.length, mimeType: 'application/pdf',
    });
    if (intent.status !== 201) throw new Error(`upload-intent failed: ${intent.status} ${JSON.stringify(intent.body)}`);
    await putToSignedUrl(intent.body.uploadUrl, opts.bytes);
    const done = await this.completeUpload(intent.body.fileId);
    if (done.status !== 201) throw new Error(`complete failed: ${done.status} ${JSON.stringify(done.body)}`);
    const file = await this.getFile(intent.body.fileId);
    return file.body;
  }

  // ---- shares ------------------------------------------------------------
  createShare(body: { resourceType: ResourceType; resourceId: string; mode: ShareMode; granteeEmail?: string }) {
    return this.call<Share & ApiError>('POST', '/shares', { body });
  }
  shareUser(resourceType: ResourceType, resourceId: string, granteeEmail: string) {
    return this.createShare({ resourceType, resourceId, mode: 'USER', granteeEmail });
  }
  sharePublic(resourceType: ResourceType, resourceId: string) {
    return this.createShare({ resourceType, resourceId, mode: 'PUBLIC_LINK' });
  }
  listShares(resourceType: ResourceType, resourceId: string, mode?: ShareMode) {
    return this.call<Page<Share> & ApiError>('GET', '/shares', { query: { resourceType, resourceId, mode } });
  }
  receivedShares(query?: Query) {
    return this.call<Page<ReceivedShare>>('GET', '/shares/received', { query });
  }
  revokeShare(id: string) {
    return this.call<ApiError | null>('DELETE', '/shares/{id}', { params: { id } });
  }

  // ---- public links (no auth) --------------------------------------------
  publicSummary(token: string) {
    return this.call<PublicSummary & ApiError>('GET', '/public/{token}', { params: { token } });
  }
  publicRoomContents(token: string, query?: Query) {
    return this.call<Page<ContentItem> & ApiError>('GET', '/public/{token}/contents', { params: { token }, query });
  }
  publicFolderContents(token: string, id: string, query?: Query) {
    return this.call<Page<ContentItem> & ApiError>('GET', '/public/{token}/folders/{id}/contents', { params: { token, id }, query });
  }
  publicFile(token: string, id: string) {
    return this.call<FileItem & ApiError>('GET', '/public/{token}/files/{id}', { params: { token, id } });
  }
  publicViewUrl(token: string, id: string) {
    return this.call<SignedUrl & ApiError>('GET', '/public/{token}/files/{id}/view-url', { params: { token, id } });
  }
  publicDownloadUrl(token: string, id: string) {
    return this.call<SignedUrl & ApiError>('GET', '/public/{token}/files/{id}/download-url', { params: { token, id } });
  }
}

/** Same request the web app sends (supabase-js uploadToSignedUrl): multipart body with one unnamed part. */
export async function putToSignedUrl(uploadUrl: string, bytes: Buffer, contentType = 'application/pdf'): Promise<void> {
  const form = new FormData();
  form.append('', new Blob([new Uint8Array(bytes)], { type: contentType }));
  const response = await fetch(uploadUrl, { method: 'PUT', body: form, headers: { 'x-upsert': 'false' } });
  if (!response.ok) throw new Error(`storage PUT failed: ${response.status} ${await response.text()}`);
}

export function errorMessage(body: unknown): string {
  const message = (body as ApiError | null)?.message;
  return Array.isArray(message) ? message.join('; ') : String(message ?? '');
}
