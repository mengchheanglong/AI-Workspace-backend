import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Project } from '../projects/entities/project.entity';
import { Requirement } from '../requirements/entities/requirement.entity';
import { Decision } from '../decisions/entities/decision.entity';
import { Task } from '../tasks/entities/task.entity';
import { Meeting } from '../meetings/entities/meeting.entity';
import { Document } from '../documents/entities/document.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AiModule,
    TypeOrmModule.forFeature([
      Project,
      Requirement,
      Decision,
      Task,
      Meeting,
      Document,
      ProjectMember,
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
