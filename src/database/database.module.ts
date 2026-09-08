import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Environment } from '../config/environment';
import { databaseOptions } from './database-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        ...databaseOptions(config.get('DATABASE_URL', { infer: true })),
        retryAttempts: 1,
      }),
    }),
  ],
})
export class DatabaseModule {}
