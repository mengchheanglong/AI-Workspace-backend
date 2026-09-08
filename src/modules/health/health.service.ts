import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { mkdir, open, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Environment } from '../../config/environment';

@Injectable()
export class HealthService {
  constructor(
    private readonly database: DataSource,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async ready(): Promise<{ data: { status: 'ok' } }> {
    try {
      await this.database.query('SELECT 1');
      const root = resolve(this.config.get('STORAGE_LOCAL_ROOT', { infer: true }));
      await mkdir(root, { recursive: true });
      const probe = join(root, `.health-${randomUUID()}`);
      const file = await open(probe, 'wx', 0o600);
      await file.close();
      await unlink(probe);
      return { data: { status: 'ok' } };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
