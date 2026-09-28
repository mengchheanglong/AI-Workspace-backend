import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

export function databaseOptions(url: string): DataSourceOptions {
  const isCloudSsl =
    url.includes('sslmode=require') ||
    url.includes('supabase.co') ||
    url.includes('pooler.supabase.com') ||
    url.includes('neon.tech') ||
    process.env.DATABASE_SSL === 'true';

  // Strip sslmode from URL query parameters so pg driver uses explicit ssl options
  const cleanUrl = isCloudSsl
    ? url.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
    : url;

  return {
    type: 'postgres',
    url: cleanUrl,
    ssl: isCloudSsl ? { rejectUnauthorized: false } : undefined,
    entities: [join(__dirname, '../modules/**/*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
    migrationsTableName: 'schema_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: {
      max: 10,
      connectionTimeoutMillis: 10000,
      statement_timeout: 10000,
      ...(isCloudSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    },
  };
}
