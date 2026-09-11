import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { StorageDriver, StoredFileMetadata } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageDriver {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly rootDir: string;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('STORAGE_LOCAL_ROOT') ?? './var/uploads';
    this.rootDir = resolve(configured);
  }

  getAbsolutePath(storageKey: string): string {
    const safeKey = storageKey.replace(/\\/g, '/');
    const targetPath = resolve(this.rootDir, safeKey);
    // Path traversal check
    if (!targetPath.startsWith(this.rootDir + sep) && targetPath !== this.rootDir) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    return targetPath;
  }

  async save(storageKey: string, sourcePathOrBuffer: string | Buffer): Promise<StoredFileMetadata> {
    const targetPath = this.getAbsolutePath(storageKey);
    await mkdir(dirname(targetPath), { recursive: true });

    const hash = createHash('sha256');
    let sizeBytes = 0;

    if (Buffer.isBuffer(sourcePathOrBuffer)) {
      hash.update(sourcePathOrBuffer);
      sizeBytes = sourcePathOrBuffer.length;
      await pipeline(Readable.from(sourcePathOrBuffer), createWriteStream(targetPath));
    } else {
      const readStream = createReadStream(sourcePathOrBuffer);
      const writeStream = createWriteStream(targetPath);

      readStream.on('data', (chunk) => {
        hash.update(chunk);
        sizeBytes += chunk.length;
      });

      await pipeline(readStream, writeStream);
    }

    return {
      sizeBytes,
      sha256: hash.digest('hex'),
    };
  }

  async getStream(storageKey: string): Promise<Readable> {
    const targetPath = this.getAbsolutePath(storageKey);
    try {
      await stat(targetPath);
    } catch {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'Stored file not found on disk.',
      });
    }
    return createReadStream(targetPath);
  }

  async delete(storageKey: string): Promise<void> {
    const targetPath = this.getAbsolutePath(storageKey);
    try {
      await unlink(targetPath);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Failed to delete stored file: ${targetPath}`, err);
      }
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const targetPath = this.getAbsolutePath(storageKey);
    try {
      await stat(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
