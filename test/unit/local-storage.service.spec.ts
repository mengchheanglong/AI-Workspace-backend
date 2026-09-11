import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from '../../src/modules/storage/local-storage.service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'local-storage-test-'));
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'STORAGE_LOCAL_ROOT') return tempRoot;
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new LocalStorageService(configService);
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  describe('getAbsolutePath', () => {
    it('resolves safe relative keys under rootDir', () => {
      const absPath = service.getAbsolutePath('projects/proj-1/file.txt');
      expect(absPath).toContain(tempRoot);
      expect(absPath.endsWith('file.txt')).toBe(true);
    });

    it('throws error when path traversal is attempted', () => {
      expect(() => {
        service.getAbsolutePath('../../../etc/passwd');
      }).toThrow('path traversal detected');

      expect(() => {
        service.getAbsolutePath('..\\..\\secret.txt');
      }).toThrow('path traversal detected');
    });
  });

  describe('save', () => {
    it('saves a Buffer and computes correct sha256 and sizeBytes', async () => {
      const content = Buffer.from('Hello, Antigravity Documents!');
      const key = 'projects/p1/docs/test.txt';

      const metadata = await service.save(key, content);

      expect(metadata.sizeBytes).toBe(content.length);
      expect(metadata.sha256).toBe(
        '441ed4743278c764f0ab445a5dd678bda056bd85df0fe6f922ad79dba30a13d1',
      );

      const exists = await service.exists(key);
      expect(exists).toBe(true);

      const savedOnDisk = await readFile(service.getAbsolutePath(key));
      expect(savedOnDisk).toEqual(content);
    });

    it('saves a file from a source file path on disk', async () => {
      const sourceFile = join(tempRoot, 'source.txt');
      const content = 'Streamed file content from disk';
      await writeFile(sourceFile, content, 'utf-8');

      const destKey = 'projects/p1/docs/destination.txt';
      const metadata = await service.save(destKey, sourceFile);

      expect(metadata.sizeBytes).toBe(Buffer.byteLength(content));
      expect(await service.exists(destKey)).toBe(true);
    });
  });

  describe('getStream', () => {
    it('returns a readable stream for an existing file', async () => {
      const content = Buffer.from('Stream test content');
      const key = 'stream-test.txt';
      await service.save(key, content);

      const stream = await service.getStream(key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      expect(Buffer.concat(chunks).toString('utf-8')).toBe('Stream test content');
    });

    it('throws NotFoundException when file does not exist', async () => {
      await expect(service.getStream('nonexistent.txt')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes an existing file', async () => {
      const key = 'delete-me.txt';
      await service.save(key, Buffer.from('delete me'));
      expect(await service.exists(key)).toBe(true);

      await service.delete(key);
      expect(await service.exists(key)).toBe(false);
    });

    it('does not throw when deleting a file that does not exist', async () => {
      await expect(service.delete('does-not-exist.txt')).resolves.not.toThrow();
    });
  });
});
