/** Response shapes used by the tests. The full contract is enforced by contract.ts against the OpenAPI spec. */

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface DataRoom {
  id: string;
  name: string;
  accessLevel?: 'OWNER' | 'VIEWER';
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  dataRoomId: string;
}

export interface FileItem {
  id: string;
  name: string;
  folderId: string | null;
  dataRoomId?: string;
  size: number;
  mimeType: string;
}

export type ContentItem = ({ type: 'folder' } & Omit<Folder, 'dataRoomId'>) | ({ type: 'file' } & FileItem);

export interface Breadcrumbs {
  dataRoomId: string;
  dataRoomName: string | null;
  folders: { id: string; name: string }[];
  accessLevel: 'OWNER' | 'VIEWER';
}

export interface DeletePreview {
  folderCount: number;
  fileCount: number;
  totalSize: number;
}

export interface UploadIntent {
  fileId: string;
  name: string;
  uploadUrl: string;
}

export type ResourceType = 'DATAROOM' | 'FOLDER' | 'FILE';
export type ShareMode = 'PUBLIC_LINK' | 'USER';

export interface Share {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  mode: ShareMode;
  token: string | null;
  granteeEmail: string | null;
  revokedAt: string | null;
}

export interface ReceivedShare {
  shareId: string;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  dataRoomId: string;
}

export interface PublicSummary {
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
}

export interface SignedUrl {
  url: string;
}
