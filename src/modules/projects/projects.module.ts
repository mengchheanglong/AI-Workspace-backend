import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { User } from '../users/entities/user.entity';
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { ProjectsController } from './projects.controller';
import { ProjectMembersController } from './project-members.controller';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectMember, User]), AuditModule],
  controllers: [ProjectsController, ProjectMembersController],
  providers: [ProjectsService, ProjectMembersService, ProjectPolicyGuard],
  exports: [ProjectsService, ProjectMembersService, ProjectPolicyGuard, TypeOrmModule],
})
export class ProjectsModule {}
