import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentRevision } from './entities/document-revision.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { StorageModule } from '../storage/storage.module';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentRevision, Project, ProjectMember]),
    StorageModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, ProjectPolicyGuard],
  exports: [DocumentsService, TypeOrmModule],
})
export class DocumentsModule {}
