import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { KnowledgeChunk, KnowledgeSource, ProcessingJob } from './entities';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { OutboxModule } from './outbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeSource, KnowledgeChunk, ProcessingJob, ProjectMember]),
    StorageModule,
    OutboxModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService, TypeOrmModule],
})
export class IngestionModule {}
