import type { Readable } from 'node:stream';

export interface StoredFileMetadata {
  sizeBytes: number;
  sha256: string;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

export interface StorageDriver {
  save(storageKey: string, sourcePathOrBuffer: string | Buffer): Promise<StoredFileMetadata>;

  getStream(storageKey: string): Promise<Readable>;

  delete(storageKey: string): Promise<void>;

  exists(storageKey: string): Promise<boolean>;

  getAbsolutePath(storageKey: string): string;
}
