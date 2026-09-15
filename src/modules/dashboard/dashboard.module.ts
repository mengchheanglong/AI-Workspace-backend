import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { Requirement } from '../requirements/entities/requirement.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Task, Requirement, AuditLog, ProjectMember])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
