import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Requirement } from './entities/requirement.entity';
import { RequirementRevision } from './entities/requirement-revision.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { RequirementsService } from './requirements.service';
import { RequirementsController } from './requirements.controller';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Requirement, RequirementRevision, Project, ProjectMember])],
  controllers: [RequirementsController],
  providers: [RequirementsService, ProjectPolicyGuard],
  exports: [RequirementsService, TypeOrmModule],
})
export class RequirementsModule {}
