export const PHOTO_STORAGE_PORT = Symbol('PHOTO_STORAGE_PORT');

export interface PhotoUploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface PhotoStoragePort {
  createUploadTarget(input: { key: string; mimeType: string; fallbackPath: string }): Promise<PhotoUploadTarget>;
  createDownloadUrl(input: { key: string; fallbackPath: string }): Promise<string>;
  read(key: string): Promise<Uint8Array>;
  write(key: string, body: Uint8Array, mimeType: string): Promise<void>;
}
